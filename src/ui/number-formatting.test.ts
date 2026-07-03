import { describe, expect, it } from "vitest";
import { formatDisplayNumber } from "./number-formatting";

describe("display number formatting", () => {
	it("normalizes negligible values and preserves integers", () => {
		expect(formatDisplayNumber(0.0000001)).toBe("0");
		expect(formatDisplayNumber(4)).toBe("4");
	});

	it("rounds fractional values to three decimal places", () => {
		expect(formatDisplayNumber(1.23456)).toBe("1.235");
		expect(formatDisplayNumber(1.2)).toBe("1.2");
	});
});
