import { describe, expect, it } from "vitest";
import {
	type AnimationFrame,
	type AnimationMatrix,
	type AnimationMode,
	type AnimationSequence,
	getAnimationDuration,
	getAnimatedTransform,
	getAnimationProgress,
	getMatrixDuration,
	getStepTransform,
} from "./animation";

function sequence(matrices: AnimationMatrix<2>[]): AnimationSequence<2> {
	return { dimension: 2, matrices };
}

function matrix(
	id: string,
	values: AnimationMatrix<2>["values"] = [1, 0, 0, 1],
	durationMs = 100,
): AnimationMatrix<2> {
	return { id, values, durationMs };
}

function frame(mode: AnimationMode, elapsedMs: number): AnimationFrame {
	return { mode, elapsedMs };
}

describe("animation timeline", () => {
	it("normalizes invalid elapsed time", () => {
		const animation = sequence([matrix("A")]);

		expect(getAnimationProgress(animation, frame("composed", -10))).toEqual(
			{ mode: "composed", progress: 0 },
		);
		expect(
			getAnimationProgress(animation, frame("composed", Number.NaN)),
		).toEqual({ mode: "composed", progress: 0 });
	});

	it("normalizes invalid matrix durations", () => {
		expect([
			getMatrixDuration(matrix("A", undefined, 0)),
			getMatrixDuration(matrix("B", undefined, Number.NaN)),
		]).toEqual([100, 100]);
	});

	it("sums step durations and uses the longest duration for composed mode", () => {
		const animation = sequence([
			matrix("A", undefined, 100),
			matrix("B", undefined, 300),
		]);

		expect(getAnimationDuration(animation, "steps")).toBe(400);
		expect(getAnimationDuration(animation, "composed")).toBe(300);
	});

	it("freezes animation progress at the pause time", () => {
		expect(
			getAnimationProgress(
				sequence([matrix("A")]),
				frame("composed", 25),
			),
		).toEqual({ mode: "composed", progress: 0.25 });
	});
});

describe("step animation workflow", () => {
	it("applies matrices from right to left and reports the active step", () => {
		const animation = sequence([
			matrix("A", [2, 0, 0, 1]),
			matrix("B", [1, 1, 0, 1]),
		]);

		expect(getStepTransform(animation, 50)).toEqual([1, 0.5, 0, 1]);
		expect(getAnimationProgress(animation, frame("steps", 50))).toEqual({
			mode: "steps",
			matrixId: "B",
			progress: 0.5,
		});
		expect(getStepTransform(animation, 200)).toEqual([2, 2, 0, 1]);
	});

	it("completes exactly at the total-duration boundary", () => {
		const animation = sequence([matrix("A"), matrix("B")]);

		expect(getAnimationProgress(animation, frame("steps", 200))).toEqual({
			mode: "steps",
			matrixId: "A",
			progress: 1,
		});
		expect(
			getAnimationProgress(animation, frame("steps", 200.001)),
		).toBeNull();
	});
});

describe("animation progress reporting", () => {
	it("returns null when animation is idle", () => {
		expect(getAnimationProgress(sequence([matrix("A")]), null)).toBeNull();
	});

	it("shows the committed transform while idle", () => {
		expect(
			getAnimatedTransform(
				sequence([matrix("A", [3, 0, 0, 3])]),
				[2, 0, 0, 2],
				null,
			),
		).toEqual([2, 0, 0, 2]);
	});

	it("reports composed progress used by transform interpolation", () => {
		const animation = sequence([matrix("A", [5, 0, 0, 5])]);

		expect(getAnimationProgress(animation, frame("composed", 50))).toEqual({
			mode: "composed",
			progress: 0.5,
		});
		expect(
			getAnimatedTransform(
				animation,
				[1, 0, 0, 1],
				frame("composed", 50),
			),
		).toEqual([3, 0, 0, 3]);
		expect(getAnimationProgress(animation, frame("composed", 100))).toEqual(
			{ mode: "composed", progress: 1 },
		);
		expect(
			getAnimationProgress(animation, frame("composed", 100.001)),
		).toEqual({ mode: "composed", progress: 1 });
		expect(
			getAnimatedTransform(
				animation,
				[1, 0, 0, 1],
				frame("composed", 100),
			),
		).toEqual([5, 0, 0, 5]);
	});
});
