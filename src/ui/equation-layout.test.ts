import { describe, expect, it } from "vitest";
import {
	groupEntriesByColumn,
	renderEntryColumnTemplate,
} from "./equation-layout";

describe("equation column layout", () => {
	it("groups row-major values by visual column", () => {
		expect(groupEntriesByColumn(["1", "2", "3", "4"], 2)).toEqual([
			["1", "3"],
			["2", "4"],
		]);
	});

	it("sizes columns from their longest expression", () => {
		expect(renderEntryColumnTemplate([["1", "12345"]])).toContain(
			"calc(5 * 1ch + 10px)",
		);
	});
});
