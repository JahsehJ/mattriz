import { describe, expect, it } from "vitest";
import {
	MatrixNode,
	Workspace,
	canAddWorkspaceNodes,
	createWorkspace,
	createMatrixNode,
	createVectorNode,
	recomputeWorkspace,
	restoreWorkspaceState,
} from "./workspace";
import {
	evaluateWorkspace,
	getTransformedVectors,
} from "./workspace-evaluation";
import { MAX_WORKSPACE_NODES } from "./policy";
import {
	type AnimationFrame,
	type AnimationMode,
	getAnimationDuration,
	getAnimatedTransform,
	getAnimationProgress,
	getMatrixDuration,
	getStepTransform,
} from "./animation";

function workspaceWith(matrices: MatrixNode<2>[]): Workspace<2> {
	const workspace = createWorkspace(2);
	replaceWorkspaceVectors(workspace, []);
	replaceWorkspaceMatrices(workspace, matrices);
	return workspace;
}

function replaceWorkspaceMatrices<D extends 2 | 3>(
	workspace: Workspace<D>,
	matrices: MatrixNode<D>[],
): void {
	workspace.matrices = [...matrices];
	recomputeWorkspace(workspace);
}

function replaceWorkspaceVectors<D extends 2 | 3>(
	workspace: Workspace<D>,
	vectors: Workspace<D>["vectors"],
): void {
	workspace.vectors = [...vectors];
	recomputeWorkspace(workspace);
}

function frame(mode: AnimationMode, elapsedMs: number): AnimationFrame {
	return { mode, elapsedMs };
}

describe("workspace lifecycle", () => {
	it("rejects duplicate IDs from the injected workspace ID factory", () => {
		expect(() => createWorkspace(2, () => "duplicate")).toThrow(
			"Workspace node IDs must be unique",
		);
	});

	it("enforces the workspace node limit for single and batch additions", () => {
		const workspace = createWorkspace(2);
		replaceWorkspaceVectors(
			workspace,
			Array.from({ length: MAX_WORKSPACE_NODES - 1 }, () =>
				createVectorNode(2, "v1", "#ffffff"),
			),
		);

		expect(canAddWorkspaceNodes(workspace, "vectors")).toBe(true);
		expect(canAddWorkspaceNodes(workspace, "vectors", 2)).toBe(false);
		replaceWorkspaceVectors(workspace, [
			...workspace.vectors,
			createVectorNode(2, "v1", "#ffffff"),
		]);
		expect(canAddWorkspaceNodes(workspace, "vectors")).toBe(false);
	});

	it("rejects malformed draft shapes in node factories", () => {
		expect(() => createMatrixNode(2, "A", undefined, ["1"])).toThrow(
			"Invalid draft values",
		);
		expect(() =>
			createVectorNode(2, "v1", "#ffffff", undefined, [
				"1",
				2,
			] as unknown as string[]),
		).toThrow("Invalid draft values");
	});

	it("rejects out-of-policy numeric values in node factories", () => {
		expect(() => createMatrixNode(2, "A", [101, 0, 0, 1])).toThrow(
			"Invalid numeric values",
		);
		expect(() =>
			createVectorNode(2, "v1", "#ffffff", [Number.NaN, 1]),
		).toThrow("Invalid numeric values");
	});

	it("rejects a malformed restored workspace atomically", () => {
		const workspace = createWorkspace(2);
		const originalMatrices = [...workspace.matrices];
		const invalid = {
			dimension: 2 as const,
			matrices: [{ ...workspace.matrices[0], entries: ["1"] }],
			vectors: workspace.vectors,
		};

		expect(restoreWorkspaceState(workspace, invalid, invalid)).toBe(false);
		expect(workspace.matrices).toEqual(originalMatrices);
	});

	it.each([undefined, 42])(
		"rejects a restored workspace with an invalid node ID (%s)",
		(id) => {
			const workspace = createWorkspace(2);
			const invalid = {
				...workspace,
				matrices: [{ ...workspace.matrices[0], id }],
			} as unknown as Workspace<2>;

			expect(restoreWorkspaceState(workspace, invalid, workspace)).toBe(
				false,
			);
		},
	);

	it("rejects restored workspaces with mismatched dimensions or no valid fallback", () => {
		const workspace = createWorkspace(2);
		const wrongDimension = createWorkspace(3);
		const invalid = {
			...workspace,
			matrices: [
				{
					...workspace.matrices[0],
					entries: ["invalid", "0", "0", "1"],
				},
			],
		};

		expect(
			restoreWorkspaceState(
				workspace,
				wrongDimension as unknown as Workspace<2>,
				workspace,
			),
		).toBe(false);
		expect(restoreWorkspaceState(workspace, invalid, invalid)).toBe(false);
	});

	it("reports the structural node limit", () => {
		const workspace = createWorkspace(2);
		workspace.vectors = Array.from(
			{ length: MAX_WORKSPACE_NODES + 1 },
			(_, index) => createVectorNode(2, `v${index}`, "#ffffff"),
		);

		expect(
			evaluateWorkspace(workspace).validity.structuralErrors,
		).toContain("node-limit-exceeded");
	});

	it("reports malformed workspace structure without evaluating it", () => {
		const matrix = {
			...createMatrixNode(2, "A"),
			entries: ["1"],
			durationMs: Number.NaN,
		};
		const vector = {
			...createVectorNode(2, "v1", "#ffffff"),
			id: matrix.id,
			coordinates: [1, "2"] as unknown as string[],
		};

		const result = evaluateWorkspace({
			dimension: 2,
			matrices: [matrix],
			vectors: [vector],
		});

		expect(result.evaluation).toBeNull();
		expect(result.validity.valid).toBe(false);
		expect(result.validity.structuralErrors).toEqual([
			"duplicate-node-id",
			"invalid-entry-count",
			"invalid-duration",
			"invalid-entry-type",
		]);
	});

	it("accepts invalid expression structures while retaining the evaluation", () => {
		const matrix = createMatrixNode(2, "A");
		const vector = createVectorNode(2, "v1", "#ffffff");
		const workspace = workspaceWith([matrix]);
		replaceWorkspaceVectors(workspace, [vector]);
		const evaluation = workspace.lastValidEvaluation;
		const invalidMatrix = {
			...createMatrixNode(2, "B"),
			entries: ["101", "0", "0", "1"],
		};
		const invalidVector = {
			...createVectorNode(2, "v2", "#ffffff"),
			coordinates: ["NaN", "1"],
		};

		replaceWorkspaceMatrices(workspace, [invalidMatrix]);
		replaceWorkspaceVectors(workspace, [invalidVector]);
		expect(workspace.lastValidEvaluation).toEqual(evaluation);
	});

	it("shows the committed transform while idle, not uncommitted matrix edits", () => {
		const matrix = createMatrixNode(2, "A", [3, 0, 0, 3]);
		const workspace = workspaceWith([matrix]);

		expect(
			getAnimatedTransform(
				workspace.lastValidEvaluation,
				[2, 0, 0, 2],
				null,
			),
		).toEqual([2, 0, 0, 2]);
	});
});

describe("animation timeline", () => {
	it("normalizes invalid elapsed time", () => {
		const workspace = workspaceWith([
			{ ...createMatrixNode(2, "A"), durationMs: 100 },
		]);

		expect(
			getAnimationProgress(
				workspace.lastValidEvaluation,
				frame("composed", -10),
			),
		).toEqual({ mode: "composed", progress: 0 });
		expect(
			getAnimationProgress(
				workspace.lastValidEvaluation,
				frame("composed", Number.NaN),
			),
		).toEqual({ mode: "composed", progress: 0 });
	});

	it("normalizes invalid matrix durations", () => {
		const zero = { ...createMatrixNode(2, "A"), durationMs: 0 };
		const nonFinite = {
			...createMatrixNode(2, "B"),
			durationMs: Number.NaN,
		};

		expect([zero, nonFinite].map(getMatrixDuration)).toEqual([100, 100]);
	});

	it("sums step durations and uses the longest duration for composed mode", () => {
		const a = { ...createMatrixNode(2, "A"), durationMs: 100 };
		const b = { ...createMatrixNode(2, "B"), durationMs: 300 };
		const workspace = workspaceWith([a, b]);

		expect(
			getAnimationDuration(workspace.lastValidEvaluation, "steps"),
		).toBe(400);
		expect(
			getAnimationDuration(workspace.lastValidEvaluation, "composed"),
		).toBe(300);
	});

	it("freezes animation progress at the pause time", () => {
		const matrix = { ...createMatrixNode(2, "A"), durationMs: 100 };
		const paused = frame("composed", 25);

		expect(
			getAnimationProgress(
				workspaceWith([matrix]).lastValidEvaluation,
				paused,
			),
		).toEqual({ mode: "composed", progress: 0.25 });
	});
});

describe("step animation workflow", () => {
	it("applies matrices from right to left and reports the active step", () => {
		const scaleX = {
			...createMatrixNode(2, "A", [2, 0, 0, 1]),
			durationMs: 100,
		};
		const shearXByY = {
			...createMatrixNode(2, "B", [1, 1, 0, 1]),
			durationMs: 100,
		};
		const workspace = workspaceWith([scaleX, shearXByY]);

		expect(getStepTransform(workspace.lastValidEvaluation, 50)).toEqual([
			1, 0.5, 0, 1,
		]);
		expect(
			getAnimationProgress(
				workspace.lastValidEvaluation,
				frame("steps", 50),
			),
		).toEqual({
			mode: "steps",
			matrixId: shearXByY.id,
			progress: 0.5,
		});
		expect(getStepTransform(workspace.lastValidEvaluation, 200)).toEqual([
			2, 2, 0, 1,
		]);
	});

	it("completes exactly at the total-duration boundary", () => {
		const a = { ...createMatrixNode(2, "A"), durationMs: 100 };
		const b = { ...createMatrixNode(2, "B"), durationMs: 100 };
		const workspace = workspaceWith([a, b]);
		expect(
			getAnimationProgress(
				workspace.lastValidEvaluation,
				frame("steps", 200),
			),
		).toEqual({
			mode: "steps",
			matrixId: a.id,
			progress: 1,
		});
		expect(
			getAnimationProgress(
				workspace.lastValidEvaluation,
				frame("steps", 200.001),
			),
		).toBeNull();
	});
});

describe("animation progress reporting", () => {
	it("returns null when animation is idle", () => {
		const workspace = workspaceWith([createMatrixNode(2, "A")]);

		expect(
			getAnimationProgress(workspace.lastValidEvaluation, null),
		).toBeNull();
	});

	it("reports composed progress used by transform interpolation", () => {
		const matrix = {
			...createMatrixNode(2, "A", [5, 0, 0, 5]),
			durationMs: 100,
		};
		const workspace = workspaceWith([matrix]);
		expect(
			getAnimationProgress(
				workspace.lastValidEvaluation,
				frame("composed", 50),
			),
		).toEqual({
			mode: "composed",
			progress: 0.5,
		});
		expect(
			getAnimatedTransform(
				workspace.lastValidEvaluation,
				[1, 0, 0, 1],
				frame("composed", 50),
			),
		).toEqual([3, 0, 0, 3]);
		expect(
			getAnimationProgress(
				workspace.lastValidEvaluation,
				frame("composed", 100),
			),
		).toEqual({
			mode: "composed",
			progress: 1,
		});
		expect(
			getAnimationProgress(
				workspace.lastValidEvaluation,
				frame("composed", 100.001),
			),
		).toEqual({
			mode: "composed",
			progress: 1,
		});
		expect(
			getAnimatedTransform(
				workspace.lastValidEvaluation,
				[1, 0, 0, 1],
				frame("composed", 100),
			),
		).toEqual([5, 0, 0, 5]);
	});
});

describe("result derivation", () => {
	it("returns transformed vectors with the workspace dimension", () => {
		const matrix2 = createMatrixNode(2, "A", [2, 0, 0, 3]);
		const workspace2 = workspaceWith([matrix2]);
		replaceWorkspaceVectors(workspace2, [
			createVectorNode(2, "v1", "#fff"),
		]);

		const matrix3 = createMatrixNode(3, "A", [1, 2, 0, 0, 1, 3, 4, 0, 1]);
		const vector3 = createVectorNode(3, "v1", "#fff", [1, 2, 3]);
		const workspace3 = createWorkspace(3);
		replaceWorkspaceMatrices(workspace3, [matrix3]);
		replaceWorkspaceVectors(workspace3, [vector3]);

		expect(getTransformedVectors(workspace2.lastValidEvaluation)).toEqual([
			[2, 3],
		]);
		expect(getTransformedVectors(workspace3.lastValidEvaluation)).toEqual([
			[5, 11, 7],
		]);
	});
});
