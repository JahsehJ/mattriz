import { describe, expect, it } from "vitest";
import {
	analyzeRealEigenbasis,
	analyzeRepresentativeRealEigenvector,
} from "./eigensystem";
import type { Mat2, Mat3 } from "./matrix";

describe("real eigensystems", () => {
	it("keeps randomized symmetric-matrix eigenvectors within a residual envelope", () => {
		let seed = 0x5eed;
		const random = (): number => {
			seed = (1664525 * seed + 1013904223) >>> 0;
			return seed / 2 ** 32;
		};
		for (let sample = 0; sample < 40; sample += 1) {
			const angle = random() * Math.PI * 2;
			const eigenvalues = [
				(random() * 2 - 1) * 1e4,
				(random() * 2 - 1) * 1e4,
			];
			const cosine = Math.cos(angle);
			const sine = Math.sin(angle);
			const matrix: Mat2 = [
				eigenvalues[0] * cosine ** 2 + eigenvalues[1] * sine ** 2,
				(eigenvalues[0] - eigenvalues[1]) * cosine * sine,
				(eigenvalues[0] - eigenvalues[1]) * cosine * sine,
				eigenvalues[0] * sine ** 2 + eigenvalues[1] * cosine ** 2,
			];
			const result = analyzeRealEigenbasis(2, matrix);
			expect(result.kind).toBe("basis");
			if (result.kind !== "basis") continue;
			for (const vector of result.vectors) {
				const transformed = [
					matrix[0] * vector[0] + matrix[1] * vector[1],
					matrix[2] * vector[0] + matrix[3] * vector[1],
				];
				const lambda =
					vector[0] * transformed[0] + vector[1] * transformed[1];
				const residual = Math.hypot(
					transformed[0] - lambda * vector[0],
					transformed[1] - lambda * vector[1],
				);
				expect(residual).toBeLessThan(
					1e-8 * Math.max(1, ...matrix.map(Math.abs)),
				);
			}
		}
	});

	it("returns normalized eigenvectors for distinct and repeated eigenvalues", () => {
		expect(analyzeRealEigenbasis(2, [2, 0, 0, 3])).toEqual({
			kind: "basis",
			vectors: [
				[1, 0],
				[0, 1],
			],
		});
		expect(analyzeRealEigenbasis(3, [1, 0, 0, 0, 2, 0, 0, 0, 3])).toEqual({
			kind: "basis",
			vectors: [
				[1, 0, 0],
				[0, 1, 0],
				[0, 0, 1],
			],
		});
		expect(
			analyzeRealEigenbasis(3, [2, 0, 0, 0, 2, 0, 0, 0, 2]),
		).toMatchObject({ kind: "basis" });
		expect(
			analyzeRealEigenbasis(3, [2, 0, 0, 0, 2, 0, 0, 0, 3]),
		).toMatchObject({ kind: "basis" });
	});

	it("resolves nearby eigenvalues without cancellation", () => {
		expect(analyzeRealEigenbasis(2, [1, 0, 0, 1.0001])).toMatchObject({
			kind: "basis",
		});
	});

	it("does not merge distinct eigenvalues that are close together", () => {
		expect(analyzeRealEigenbasis(2, [1, 0, 0, 1.000000001])).toMatchObject({
			kind: "basis",
		});
	});

	it("rejects defective and complex-spectrum full eigenbases", () => {
		expect(analyzeRealEigenbasis(2, [2, 1, 0, 2])).toEqual({
			kind: "not-diagonalizable",
		});
		expect(analyzeRealEigenbasis(2, [0, -1, 1, 0])).toEqual({
			kind: "complex-eigenvalues",
		});
		expect(analyzeRealEigenbasis(3, [0, -1, 0, 1, 0, 0, 0, 0, 2])).toEqual({
			kind: "complex-eigenvalues",
		});
	});

	it("finds one real eigenvector when a full eigenbasis is unavailable", () => {
		expect(analyzeRepresentativeRealEigenvector(2, [2, 1, 0, 2])).toEqual({
			kind: "vector",
			vector: [1, 0],
		});
		expect(
			analyzeRepresentativeRealEigenvector(
				3,
				[0, -1, 0, 1, 0, 0, 0, 0, 2],
			),
		).toEqual({ kind: "vector", vector: [0, 0, 1] });
		expect(analyzeRepresentativeRealEigenvector(2, [0, -1, 1, 0])).toEqual({
			kind: "complex-eigenvalues",
		});
	});

	it("does not invent an eigenbasis for near-degenerate rotations", () => {
		const angle = 1e-8;
		const cosine = Math.cos(angle);
		const sine = Math.sin(angle);
		const rotation2: Mat2 = [cosine, -sine, sine, cosine];
		expect(analyzeRealEigenbasis(2, rotation2).kind).not.toBe("basis");
		expect(
			analyzeRepresentativeRealEigenvector(2, rotation2).kind,
		).not.toBe("vector");

		const rotation3: Mat3 = [cosine, -sine, 0, sine, cosine, 0, 0, 0, 1];
		expect(analyzeRealEigenbasis(3, rotation3).kind).not.toBe("basis");
		expect(analyzeRepresentativeRealEigenvector(3, rotation3)).toEqual({
			kind: "vector",
			vector: [0, 0, 1],
		});
	});
});
