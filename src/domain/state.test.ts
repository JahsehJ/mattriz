import { describe, expect, it } from "vitest";
import { identityMatrix } from "./math";
import {
	AnimationState,
	MatrixNode,
	Workspace,
	MAX_WORKSPACE_NODES,
	canAddWorkspaceNodes,
	createInitialState,
	createMatrixNode,
	createVectorNode,
	getAnimationDuration,
	getAnimatedTransform,
	getAnimationProgress,
	getMatrixDuration,
	hasSafeComposedTransform,
	getRenderState,
	getStepTransform,
	getTransformedVectors,
} from "./state";

function workspaceWith(matrices: MatrixNode[]): Workspace {
	return {
		dimension: 2,
		matrices,
		vectors: [],
		appliedTransform: identityMatrix(2),
	};
}

function animation(
	mode: AnimationState["mode"],
	status: AnimationState["status"] = "playing",
): AnimationState {
	return {
		mode,
		status,
		startedAt: 1000,
		pausedAt: status === "paused" ? 1025 : 0,
	};
}

describe("workspace lifecycle", () => {
	it("initializes independent identity workspaces for both dimensions", () => {
		const state = createInitialState();

		expect(state.workspaces[2]).toMatchObject({
			dimension: 2,
			appliedTransform: [1, 0, 0, 1],
		});
		expect(state.workspaces[3]).toMatchObject({
			dimension: 3,
			appliedTransform: [1, 0, 0, 0, 1, 0, 0, 0, 1],
		});
	});

	it("renders only the active workspace", () => {
		const state = createInitialState();
		state.activeDimension = 2;

		expect(getRenderState(state, 0)).toMatchObject({
			dimension: 2,
			vectors: state.workspaces[2].vectors,
			showGrid: true,
		});
	});

	it("enforces the workspace node limit for single and batch additions", () => {
		const workspace = createInitialState().workspaces[2];
		workspace.vectors = Array.from(
			{ length: MAX_WORKSPACE_NODES - 1 },
			() => createVectorNode(2, "v1", "#ffffff"),
		);

		expect(canAddWorkspaceNodes(workspace, "vectors")).toBe(true);
		expect(canAddWorkspaceNodes(workspace, "vectors", 2)).toBe(false);
		workspace.vectors.push(createVectorNode(2, "v1", "#ffffff"));
		expect(canAddWorkspaceNodes(workspace, "vectors")).toBe(false);
	});

	it("shows the committed transform while idle, not uncommitted matrix edits", () => {
		const matrix = createMatrixNode(2, "A", [3, 0, 0, 3]);
		const workspace = workspaceWith([matrix]);
		workspace.appliedTransform = [2, 0, 0, 2];

		expect(
			getAnimatedTransform(workspace, animation("steps", "idle"), 1000),
		).toEqual([2, 0, 0, 2]);
	});
});

describe("animation timeline", () => {
	it("normalizes invalid durations before calculating mode duration", () => {
		const zero = createMatrixNode(2, "A");
		const nonFinite = createMatrixNode(2, "B");
		zero.durationMs = 0;
		nonFinite.durationMs = Number.NaN;
		const workspace = workspaceWith([zero, nonFinite]);

		expect([zero, nonFinite].map(getMatrixDuration)).toEqual([1, 1]);
		expect(getAnimationDuration(workspace, "steps")).toBe(2);
		expect(getAnimationDuration(workspace, "composed")).toBe(1);
	});

	it("sums step durations and uses the longest duration for composed mode", () => {
		const a = createMatrixNode(2, "A");
		const b = createMatrixNode(2, "B");
		a.durationMs = 100;
		b.durationMs = 300;
		const workspace = workspaceWith([a, b]);

		expect(getAnimationDuration(workspace, "steps")).toBe(400);
		expect(getAnimationDuration(workspace, "composed")).toBe(300);
	});

	it("freezes animation progress at the pause time", () => {
		const matrix = createMatrixNode(2, "A");
		matrix.durationMs = 100;
		const paused = animation("composed", "paused");

		expect(
			getAnimationProgress(workspaceWith([matrix]), paused, 9999),
		).toEqual({ mode: "composed", progress: 0.25 });
	});
});

describe("step animation workflow", () => {
	it("applies matrices from right to left and reports the active step", () => {
		const scaleX = createMatrixNode(2, "A", [2, 0, 0, 1]);
		const shearXByY = createMatrixNode(2, "B", [1, 1, 0, 1]);
		scaleX.durationMs = 100;
		shearXByY.durationMs = 100;
		const workspace = workspaceWith([scaleX, shearXByY]);
		const playing = animation("steps");

		expect(getStepTransform(workspace, 50)).toEqual([1, 0.5, 0, 1]);
		expect(getAnimationProgress(workspace, playing, 1050)).toEqual({
			mode: "steps",
			matrixId: shearXByY.id,
			progress: 0.5,
		});
		expect(getStepTransform(workspace, 200)).toEqual([2, 2, 0, 1]);
	});

	it("completes exactly at the total-duration boundary", () => {
		const a = createMatrixNode(2, "A");
		const b = createMatrixNode(2, "B");
		a.durationMs = 100;
		b.durationMs = 100;
		const workspace = workspaceWith([a, b]);
		const playing = animation("steps");

		expect(getAnimationProgress(workspace, playing, 1200)).toEqual({
			mode: "steps",
			matrixId: a.id,
			progress: 1,
		});
		expect(getAnimationProgress(workspace, playing, 1200.001)).toBeNull();
	});
});

describe("animation progress reporting", () => {
	it("returns null when animation is idle", () => {
		const workspace = workspaceWith([createMatrixNode(2, "A")]);

		expect(
			getAnimationProgress(
				workspace,
				animation("composed", "idle"),
				1000,
			),
		).toBeNull();
	});

	it("reports composed progress used by transform interpolation", () => {
		const matrix = createMatrixNode(2, "A", [5, 0, 0, 5]);
		matrix.durationMs = 100;
		const workspace = workspaceWith([matrix]);
		const playing = animation("composed");

		expect(getAnimationProgress(workspace, playing, 1050)).toEqual({
			mode: "composed",
			progress: 0.5,
		});
		expect(getAnimatedTransform(workspace, playing, 1050)).toEqual([
			3, 0, 0, 3,
		]);
		expect(getAnimationProgress(workspace, playing, 1100)).toEqual({
			mode: "composed",
			progress: 1,
		});
		expect(getAnimationProgress(workspace, playing, 1100.001)).toEqual({
			mode: "composed",
			progress: 1,
		});
		expect(getAnimatedTransform(workspace, playing, 1100)).toEqual([
			5, 0, 0, 5,
		]);
	});
});

describe("result derivation", () => {
	it("returns transformed vectors with the workspace dimension", () => {
		const matrix2 = createMatrixNode(2, "A", [2, 0, 0, 3]);
		const workspace2 = workspaceWith([matrix2]);
		workspace2.vectors = [createVectorNode(2, "v1", "#fff")];

		const matrix3 = createMatrixNode(3, "A", [1, 2, 0, 0, 1, 3, 4, 0, 1]);
		const vector3 = createVectorNode(3, "v1", "#fff");
		vector3.coordinates.forEach((coordinate, index) => {
			coordinate.value = [1, 2, 3][index];
		});
		const workspace3: Workspace = {
			dimension: 3,
			matrices: [matrix3],
			vectors: [vector3],
			appliedTransform: identityMatrix(3),
		};

		expect(getTransformedVectors(workspace2)).toEqual([[2, 3]]);
		expect(getTransformedVectors(workspace3)).toEqual([[5, 11, 7]]);
	});

	it("rejects composed transforms outside the WebGL-safe bound", () => {
		const first = createMatrixNode(2, "A", [1e20, 0, 0, 1]);
		const second = createMatrixNode(2, "B", [1e20, 0, 0, 1]);

		expect(hasSafeComposedTransform(workspaceWith([first]))).toBe(true);
		expect(hasSafeComposedTransform(workspaceWith([first, second]))).toBe(
			false,
		);
	});

	it("rejects unsafe step prefixes even when the final transform is safe", () => {
		const zero = createMatrixNode(2, "A", [0, 0, 0, 0]);
		const first = createMatrixNode(2, "B", [1e20, 0, 0, 1]);
		const second = createMatrixNode(2, "C", [1e20, 0, 0, 1]);

		expect(
			hasSafeComposedTransform(workspaceWith([zero, first, second])),
		).toBe(false);
	});
});
