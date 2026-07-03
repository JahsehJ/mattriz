import { beforeAll, describe, expect, it, vi } from "vitest";
import {
	MAX_WORKSPACE_NODES,
	createInitialState,
	createMatrixNode,
	createVectorNode,
	getNumericCellError,
	type NumericCell,
} from "../domain/state";
import { WorkspaceController } from "./workspace-controller";

beforeAll(() => {
	vi.stubGlobal("CSS", { escape: (value: string) => value });
});

function setup() {
	const state = createInitialState();
	const durationOutput = { textContent: "" };
	const stack = {
		querySelector: vi.fn(() => durationOutput),
		querySelectorAll: vi.fn(() => []),
	} as unknown as HTMLElement;
	const root = {
		querySelector: vi.fn(() => null),
	} as unknown as HTMLElement;
	const options = {
		getState: () => state,
		resetAnimation: vi.fn(),
		updateResults: vi.fn(),
		updateMatrixWidth: vi.fn(),
		updateVectorWidths: vi.fn(),
	};
	return {
		state,
		workspace: state.workspaces[3],
		controller: new WorkspaceController(root, stack, vi.fn(), options),
		options,
		durationOutput,
	};
}

describe("workspace collections", () => {
	it("adds, deletes, and reorders matrices and vectors", () => {
		const { controller, workspace, options } = setup();
		const originalMatrix = workspace.matrices[0];
		const originalVector = workspace.vectors[0];

		controller.addMatrix();
		controller.addVector();
		expect(workspace.matrices.map(({ label }) => label)).toEqual([
			"B",
			"A",
		]);
		expect(workspace.vectors.map(({ label }) => label)).toEqual([
			"v1",
			"v2",
		]);

		controller.moveMatrix(
			originalMatrix.id,
			workspace.matrices[0].id,
			"before",
		);
		controller.moveVector(
			workspace.vectors[1].id,
			originalVector.id,
			"before",
		);
		expect(workspace.matrices[0]).toBe(originalMatrix);
		expect(workspace.vectors[0].label).toBe("v2");

		controller.deleteMatrix(originalMatrix.id);
		controller.deleteVector(originalVector.id);
		expect(workspace.matrices).toHaveLength(1);
		expect(workspace.vectors).toHaveLength(1);
		expect(options.resetAnimation).toHaveBeenCalledTimes(6);
	});

	it("enforces the shared node limit", () => {
		const { controller, workspace, options } = setup();
		workspace.matrices = Array.from(
			{ length: MAX_WORKSPACE_NODES },
			(_, index) => createMatrixNode(3, `M${index}`),
		);
		workspace.vectors = Array.from(
			{ length: MAX_WORKSPACE_NODES },
			(_, index) => createVectorNode(3, `v${index}`, "#000"),
		);

		controller.addMatrix();
		controller.addVector();

		expect(workspace.matrices).toHaveLength(MAX_WORKSPACE_NODES);
		expect(workspace.vectors).toHaveLength(MAX_WORKSPACE_NODES);
		expect(options.resetAnimation).not.toHaveBeenCalled();
	});

	it("adds valid presets and ignores unknown presets", () => {
		const { controller, workspace, options } = setup();

		controller.addMatrixPreset("missing");
		controller.addMatrixPreset("rotate-z-45");

		expect(workspace.matrices).toHaveLength(2);
		expect(options.resetAnimation).toHaveBeenCalledOnce();
	});
});

describe("workspace inputs", () => {
	it("commits valid matrix and vector expressions", () => {
		const { controller, workspace, options } = setup();
		const matrixInput = {
			dataset: { matrixId: workspace.matrices[0].id, entryIndex: "0" },
			value: "sqrt(4)",
		} as unknown as HTMLInputElement;
		const vectorInput = {
			dataset: { vectorId: workspace.vectors[0].id, componentIndex: "1" },
			value: "3/2",
		} as unknown as HTMLInputElement;

		controller.handleInput(matrixInput);
		controller.handleInput(vectorInput);

		expect(workspace.matrices[0].entries[0]).toEqual({
			source: "sqrt(4)",
			value: 2,
		});
		expect(workspace.vectors[0].coordinates[1]).toEqual({
			source: "3/2",
			value: 1.5,
		});
		expect(options.updateMatrixWidth).toHaveBeenCalledWith(matrixInput);
		expect(options.updateVectorWidths).toHaveBeenCalledWith(vectorInput);
		expect(options.updateResults).toHaveBeenCalledTimes(2);
	});

	it("clamps animation durations and updates their output", () => {
		const { controller, workspace, options, durationOutput } = setup();
		const input = {
			dataset: { durationId: workspace.matrices[0].id },
			value: "9999",
		} as unknown as HTMLInputElement;

		controller.handleInput(input);

		expect(workspace.matrices[0].durationMs).toBe(3000);
		expect(durationOutput.textContent).toBe("3000ms");
		expect(options.resetAnimation).toHaveBeenCalledWith(false);
	});

	it("preserves overflow errors on every rejected source/value mismatch", () => {
		const cells: NumericCell[] = [
			{ source: "1", value: 1 },
			{ source: "1", value: 1 },
		];
		const { controller } = setup();
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

		updateNumericDraft(cells, 0, "2", "input", () => false);
		updateNumericDraft(cells, 1, "1", "input", () => false);

		expect(cells).toEqual([
			{
				source: "2",
				value: 1,
				error: "constraint-rejected",
			},
			{ source: "1", value: 1 },
		]);
		expect(cells.map(getNumericCellError)).toEqual([
			"constraint-rejected",
			null,
		]);
	});
});
