import { describe, expect, it } from "vitest";
import { getMatrixPresets } from "./presets";

describe("matrix presets", () => {
	it("provides dimension-aware exact rotations and reflections", () => {
		const rotation = getMatrixPresets(2).find(
			(preset) => preset.id === "rotate-45",
		);
		expect(rotation?.draftValues).toEqual([
			"sqrt(2)/2",
			"-sqrt(2)/2",
			"sqrt(2)/2",
			"sqrt(2)/2",
		]);
		expect(rotation?.values[0]).toBeCloseTo(Math.SQRT1_2);
		expect(getMatrixPresets(3).map(({ id }) => id)).toContain("reflect-xy");
		expect(getMatrixPresets(3).map(({ id }) => id)).toContain(
			"rotate-z--90",
		);
	});
});
