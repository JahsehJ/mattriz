import { describe, expect, it, vi } from "vitest";
import { getNumericCellError, type NumericCell } from "../domain/state";
import { WorkspaceController } from "./workspace-controller";

describe("workspace numeric drafts", () => {
	it("preserves overflow errors on every rejected source/value mismatch", () => {
		const cells: NumericCell[] = [
			{ source: "1", value: 1 },
			{ source: "1", value: 1 },
		];
		const stack = {
			querySelectorAll: () => [],
		} as unknown as HTMLElement;
		const controller = new WorkspaceController(
			{} as HTMLElement,
			stack,
			vi.fn(),
			{
				getState: vi.fn(),
				resetAnimation: vi.fn(),
				updateResults: vi.fn(),
				updateMatrixWidth: vi.fn(),
				updateVectorWidths: vi.fn(),
			},
		);
		const updateNumericDraft = (
			controller as unknown as {
				updateNumericDraft(
					cells: NumericCell[],
					index: number,
					value: string,
					inputSelector: string,
					commit: (values: number[]) => boolean,
				): void;
			}
		).updateNumericDraft.bind(controller);
		const reject = () => false;

		updateNumericDraft(cells, 0, "2", "input", reject);
		updateNumericDraft(cells, 1, "1", "input", reject);

		expect(cells).toEqual([
			{ source: "2", value: 1 },
			{ source: "1", value: 1 },
		]);
		expect(cells.map(getNumericCellError)).toEqual([
			"transform-overflow",
			null,
		]);
	});
});
