import { describe, expect, it } from "vitest";
import {
	Mat2,
	Mat3,
	applyMatrixToVector,
	composeMathNotation,
	lerpMatrix,
	multiply2,
	multiply3,
	identityMatrix,
	parseBoundedNumber,
	parseFiniteNumber
} from "./math";
import {
	createInitialState,
	createMatrixNode,
	createVectorNode,
	getActiveStepMatrixId,
	getActiveStepProgress,
	getAnimatedTransform,
	getStepTransform
} from "./state";

describe("matrix math", () => {
	it("multiplies 2x2 matrices", () => {
		expect(multiply2([1, 2, 3, 4], [5, 6, 7, 8])).toEqual([19, 22, 43, 50]);
	});

	it("multiplies 3x3 matrices", () => {
		const a: Mat3 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
		const b: Mat3 = [9, 8, 7, 6, 5, 4, 3, 2, 1];
		expect(multiply3(a, b)).toEqual([30, 24, 18, 84, 69, 54, 138, 114, 90]);
	});

	it("composes visible matrices in math notation order", () => {
		const a: Mat2 = [2, 0, 0, 2];
		const b: Mat2 = [1, 1, 0, 1];
		const total = composeMathNotation(2, [a, b]);
		expect(applyMatrixToVector(2, total, [1, 1])).toEqual([4, 2, 0]);
	});

	it("interpolates matrices entry-wise", () => {
		expect(lerpMatrix(2, [1, 0, 0, 1], [3, 2, 2, 3], 0.5)).toEqual([2, 1, 1, 2]);
	});

	it("parses finite numeric input only", () => {
		expect(parseFiniteNumber("1.25")).toBe(1.25);
		expect(parseFiniteNumber("")).toBe(0);
		expect(parseFiniteNumber("abc")).toBeNull();
		expect(parseFiniteNumber("Infinity")).toBeNull();
	});

	it("rejects finite values outside a configured bound", () => {
		expect(parseBoundedNumber("100", 100)).toBe(100);
		expect(parseBoundedNumber("-100", 100)).toBe(-100);
		expect(parseBoundedNumber("100.01", 100)).toBeNull();
	});
});

describe("animation state", () => {
	it("starts each workspace with an identity matrix and a custom vector", () => {
		const state = createInitialState();
		expect(state.workspaces[2].matrices[0].values).toEqual([1, 0, 0, 1]);
		expect(state.workspaces[2].vectors[0].components).toEqual([1, 1]);
		expect(state.workspaces[2].appliedTransform).toEqual([1, 0, 0, 1]);
		expect(state.workspaces[3].matrices[0].values).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
		expect(state.workspaces[3].vectors[0].components).toEqual([1, 1, 1]);
		expect(state.workspaces[3].appliedTransform).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
	});

	it("creates custom vectors away from the basis axes", () => {
		expect(createVectorNode(2, "u", "#fff").components).toEqual([1, 1]);
		expect(createVectorNode(3, "u", "#fff").components).toEqual([1, 1, 1]);
	});

	it("applies step animation from right to left", () => {
		const a = createMatrixNode(2, "A", [2, 0, 0, 2]);
		const b = createMatrixNode(2, "B", [1, 1, 0, 1]);
		a.durationMs = 100;
		b.durationMs = 100;

		const transform = getStepTransform(
			{
				dimension: 2,
				matrices: [a, b],
				vectors: [],
				appliedTransform: identityMatrix(2)
			},
			150
		);

		expect(transform).toEqual([1.5, 1.5, 0, 1.5]);
	});

	it("reports the active step matrix in application order", () => {
		const a = createMatrixNode(2, "A", [2, 0, 0, 2]);
		const b = createMatrixNode(2, "B", [1, 1, 0, 1]);
		a.durationMs = 100;
		b.durationMs = 100;

		const workspace = {
			dimension: 2 as const,
			matrices: [a, b],
			vectors: [],
			appliedTransform: identityMatrix(2)
		};

		expect(
			getActiveStepMatrixId(
				workspace,
				{
					mode: "steps",
					status: "playing",
					startedAt: 1000,
					pausedAt: 0
				},
				1050
			)
		).toBe(b.id);

		expect(
			getActiveStepMatrixId(
				workspace,
				{
					mode: "steps",
					status: "playing",
					startedAt: 1000,
					pausedAt: 0
				},
				1150
			)
		).toBe(a.id);
	});

	it("reports active step progress within the current matrix duration", () => {
		const a = createMatrixNode(2, "A", [2, 0, 0, 2]);
		const b = createMatrixNode(2, "B", [1, 1, 0, 1]);
		a.durationMs = 300;
		b.durationMs = 100;

		const workspace = {
			dimension: 2 as const,
			matrices: [a, b],
			vectors: [],
			appliedTransform: identityMatrix(2)
		};

		expect(
			getActiveStepProgress(
				workspace,
				{
					mode: "steps",
					status: "playing",
					startedAt: 1000,
					pausedAt: 0
				},
				1050
			)
		).toEqual({ matrixId: b.id, progress: 0.5 });

		expect(
			getActiveStepProgress(
				workspace,
				{
					mode: "steps",
					status: "playing",
					startedAt: 1000,
					pausedAt: 0
				},
				1250
			)
		).toEqual({ matrixId: a.id, progress: 0.5 });
	});

	it("uses the committed transform while idle instead of applying matrix edits immediately", () => {
		const matrix = createMatrixNode(2, "A", [2, 0, 0, 2]);
		const workspace = {
			dimension: 2 as const,
			matrices: [matrix],
			vectors: [],
			appliedTransform: identityMatrix(2)
		};

		expect(
			getAnimatedTransform(
				workspace,
				{
					mode: "steps",
					status: "idle",
					startedAt: 0,
					pausedAt: 0
				},
				0
			)
		).toEqual([1, 0, 0, 1]);

		workspace.appliedTransform = [2, 0, 0, 2];
		matrix.values = [3, 0, 0, 3];

		expect(
			getAnimatedTransform(
				workspace,
				{
					mode: "steps",
					status: "idle",
					startedAt: 0,
					pausedAt: 0
				},
				0
			)
		).toEqual([2, 0, 0, 2]);
	});
});
