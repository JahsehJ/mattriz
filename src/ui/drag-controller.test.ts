import { beforeAll, describe, expect, it, vi } from "vitest";
import { DragController, getSortableDropTarget } from "./drag-controller";

beforeAll(() => {
	vi.stubGlobal("window", {
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	});
});

function item(id: string, left: number, width = 100): HTMLElement {
	return {
		dataset: { matrixId: id },
		getBoundingClientRect: () => ({ left, right: left + width, width }),
	} as unknown as HTMLElement;
}

describe("drag target selection", () => {
	it("selects the nearest edge and its drop side", () => {
		const items = [item("a", 0), item("b", 120)];

		expect(
			getSortableDropTarget(
				{ clientX: 115 } as DragEvent,
				items,
				"matrixId",
			),
		).toMatchObject({ id: "b", side: "before" });
		expect(
			getSortableDropTarget(
				{ clientX: 95 } as DragEvent,
				items,
				"matrixId",
			),
		).toMatchObject({ id: "a", side: "after" });
	});

	it("returns null for empty or unidentified targets", () => {
		expect(
			getSortableDropTarget({ clientX: 0 } as DragEvent, [], "matrixId"),
		).toBeNull();
		expect(
			getSortableDropTarget(
				{ clientX: 0 } as DragEvent,
				[item("", 0)],
				"matrixId",
			),
		).toBeNull();
	});
});

describe("drag interaction lifecycle", () => {
	it("moves a matrix to the selected edge and clears drag state", () => {
		const first = item("a", 0);
		const second = item("b", 120);
		const stack = {
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			querySelector: vi.fn(() => null),
			querySelectorAll: vi.fn(() => [first, second]),
		} as unknown as HTMLElement;
		const moveMatrix = vi.fn();
		const controller = new DragController(stack, {
			moveMatrix,
			moveVector: vi.fn(),
			createVectorPreview: vi.fn(),
		});
		const internals = controller as unknown as {
			handleDragStart(event: DragEvent): void;
			handleDrop(event: DragEvent): void;
		};
		const source = {
			closest: (selector: string) =>
				selector.includes(".matrix-item") ? first : null,
		};
		const start = {
			target: source,
			dataTransfer: null,
			preventDefault: vi.fn(),
		} as unknown as DragEvent;
		const preventDrop = vi.fn();
		const drop = {
			clientX: 215,
			preventDefault: preventDrop,
		} as unknown as DragEvent;

		internals.handleDragStart(start);
		internals.handleDrop(drop);

		expect(moveMatrix).toHaveBeenCalledWith("a", "b", "after");
		expect(preventDrop).toHaveBeenCalledOnce();
		controller.dispose();
	});

	it("rejects drags started from interactive controls", () => {
		const stack = {
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		} as unknown as HTMLElement;
		const controller = new DragController(stack, {
			moveMatrix: vi.fn(),
			moveVector: vi.fn(),
			createVectorPreview: vi.fn(),
		});
		const preventDefault = vi.fn();

		(
			controller as unknown as {
				handleDragStart(event: DragEvent): void;
			}
		).handleDragStart({
			target: {
				closest: (selector: string) =>
					selector.includes("input") ? {} : null,
			},
			preventDefault,
		} as unknown as DragEvent);

		expect(preventDefault).toHaveBeenCalledOnce();
	});
});
