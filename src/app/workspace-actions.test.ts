import { describe, expect, it } from "vitest";
import {
	alphabeticLabel,
	moveItemBy,
	moveItemTo,
	nextMatrixLabel,
	nextVectorLabel,
} from "./workspace-actions";

const items = () => [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("workspace reordering", () => {
	it("moves an item by one position", () => {
		const values = items();

		expect(moveItemBy(values, "b", -1)).toEqual({
			changed: true,
			index: 0,
		});
		expect(values.map(({ id }) => id)).toEqual(["b", "a", "c"]);
	});

	it("does not move across a boundary or for an unknown id", () => {
		const values = items();

		expect(moveItemBy(values, "a", -1)).toEqual({
			changed: false,
			index: 0,
		});
		expect(moveItemBy(values, "missing", 1)).toEqual({
			changed: false,
			index: -1,
		});
		expect(values.map(({ id }) => id)).toEqual(["a", "b", "c"]);
	});

	it("moves relative to a drag target", () => {
		const values = items();

		expect(moveItemTo(values, "a", "c", "after")).toEqual({
			changed: true,
			index: 2,
		});
		expect(values.map(({ id }) => id)).toEqual(["b", "c", "a"]);
	});
});

describe("workspace labels", () => {
	it("generates spreadsheet-style matrix labels", () => {
		expect(alphabeticLabel(0)).toBe("A");
		expect(alphabeticLabel(25)).toBe("Z");
		expect(alphabeticLabel(26)).toBe("AA");
		expect(nextMatrixLabel(["A", "C"])).toBe("B");
	});

	it("uses the first available numbered vector label", () => {
		expect(nextVectorLabel(["v1", "v3"])).toBe("v2");
	});
});
