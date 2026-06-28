import { describe, expect, it } from "vitest";
import {
	Mat2,
	Mat3,
	applyMatrixToVector,
	composeMathNotation,
	lerpMatrix,
	multiply2,
	multiply3,
	parseBoundedNumber,
	parseFiniteNumber,
} from "./math";

describe("matrix multiplication", () => {
	it("multiplies 2x2 matrices", () => {
		expect(multiply2([1, 2, 3, 4], [5, 6, 7, 8])).toEqual([19, 22, 43, 50]);
	});

	it("multiplies 3x3 matrices", () => {
		const a: Mat3 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
		const b: Mat3 = [9, 8, 7, 6, 5, 4, 3, 2, 1];

		expect(multiply3(a, b)).toEqual([30, 24, 18, 84, 69, 54, 138, 114, 90]);
	});

	it("composes visible matrices in mathematical right-to-left order", () => {
		const scaleX: Mat2 = [2, 0, 0, 1];
		const shearXByY: Mat2 = [1, 1, 0, 1];
		const transform = composeMathNotation(2, [scaleX, shearXByY]);

		expect(applyMatrixToVector(2, transform, [1, 1])).toEqual([4, 1, 0]);
	});
});

describe("matrix interpolation", () => {
	it("interpolates each entry and clamps progress to the animation interval", () => {
		const from: Mat2 = [1, 0, 0, 1];
		const to: Mat2 = [3, 2, 2, 3];

		expect(lerpMatrix(2, from, to, 0.5)).toEqual([2, 1, 1, 2]);
		expect(lerpMatrix(2, from, to, -0.1)).toEqual(from);
		expect(lerpMatrix(2, from, to, 1.1)).toEqual(to);
	});
});

describe("numeric input parsing", () => {
	it("accepts finite numeric input and rejects malformed or non-finite input", () => {
		expect(parseFiniteNumber("1.25")).toBe(1.25);
		expect(parseFiniteNumber("not a number")).toBeNull();
		expect(parseFiniteNumber("Infinity")).toBeNull();
	});

	it("enforces the configured absolute bound", () => {
		expect(parseBoundedNumber("100", 100)).toBe(100);
		expect(parseBoundedNumber("-100", 100)).toBe(-100);
		expect(parseBoundedNumber("100.01", 100)).toBeNull();
	});
});
