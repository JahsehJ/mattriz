import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./expression";
import { getMatrixPresets } from "./presets";

describe("matrix presets", () => {
	it("provides the intended presets for each dimension", () => {
		expect(getMatrixPresets(2).map(({ id }) => id)).toEqual([
			"reflect-x",
			"reflect-y",
			"rotate-45",
		]);
		expect(getMatrixPresets(3).map(({ id }) => id)).toEqual([
			"reflect-xy",
			"reflect-xz",
			"reflect-yz",
			"rotate-x-45",
			"rotate-y-45",
			"rotate-z-45",
		]);
		expect(getMatrixPresets(2).map(({ subject }) => subject)).toEqual([
			{ kind: "axis", name: "X" },
			{ kind: "axis", name: "Y" },
			{ kind: "angle", degrees: 45 },
		]);
		expect(
			getMatrixPresets(3)
				.slice(0, 3)
				.map(({ subject }) => subject),
		).toEqual([
			{ kind: "plane", name: "XY" },
			{ kind: "plane", name: "XZ" },
			{ kind: "plane", name: "YZ" },
		]);
	});

	it("keeps evaluated values synchronized with editable drafts", () => {
		for (const dimension of [2, 3] as const) {
			for (const preset of getMatrixPresets(dimension)) {
				expect(preset.draftValues).toHaveLength(dimension ** 2);
				expect(preset.values).toEqual(
					preset.draftValues.map(evaluateExpression),
				);
			}
		}
	});

	it("identifies the positive 45 degree rotation presets", () => {
		const rotations = [
			...getMatrixPresets(2),
			...getMatrixPresets(3),
		].filter(({ kind }) => kind === "rotation");

		expect(rotations.map(({ id }) => id)).toEqual([
			"rotate-45",
			"rotate-x-45",
			"rotate-y-45",
			"rotate-z-45",
		]);
	});
});
