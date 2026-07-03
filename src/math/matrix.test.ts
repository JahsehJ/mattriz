import { describe, expect, it } from "vitest";
import {
	type Mat2,
	type Mat3,
	applyMatrixToVector,
	composeMathNotation,
	multiply2,
	multiply3,
} from "./matrix";

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

		expect(applyMatrixToVector(2, transform, [1, 1])).toEqual([4, 1]);
	});
});
