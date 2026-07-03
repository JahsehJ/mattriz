import { describe, expect, it, vi } from "vitest";
import { reconcileOwnedVisuals } from "./vector-visual-reconciler";

describe("owned visual reconciliation", () => {
	it("creates, updates, and releases keyed visuals", () => {
		const stale = { value: 0 };
		const visuals = new Map([["stale", stale]]);
		const remove = vi.fn();

		reconcileOwnedVisuals(
			visuals,
			[
				{ id: "kept", value: 1 },
				{ id: "new", value: 2 },
			],
			(item) => item.id,
			() => ({ value: 0 }),
			(visual, item) => {
				visual.value = item.value;
			},
			remove,
		);

		expect(remove).toHaveBeenCalledWith(stale);
		expect([...visuals]).toEqual([
			["kept", { value: 1 }],
			["new", { value: 2 }],
		]);
	});
});
