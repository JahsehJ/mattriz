import { beforeAll, describe, expect, it, vi } from "vitest";
import {
	MAX_WORKSPACE_NODES,
	createMatrixNode,
	createVectorNode,
	replaceWorkspaceMatrices,
	replaceWorkspaceVectors,
} from "../domain/workspace";
import { createInitialState } from "./state";
import { WorkspaceController } from "./workspace-controller";

beforeAll(() => {
	vi.stubGlobal("CSS", { escape: (value: string) => value });
});

function setup() {
	const state = createInitialState();
	const workspace = state.workspaces[3];
	const renderedResultColumns = workspace.lastValidEvaluation.vectors.map(
		() => ({}),
	);
	const durationOutput = { textContent: "" };
	const stack = {
		querySelector: vi.fn((selector: string) =>
			selector.startsWith("[data-duration-output")
				? durationOutput
				: null,
		),
		querySelectorAll: vi.fn((selector: string) =>
			selector === ".result-column-label" ? renderedResultColumns : [],
		),
	} as unknown as HTMLElement;
	const root = {
		querySelector: vi.fn(() => null),
	} as unknown as HTMLElement;
	const options = {
		getState: () => state,
		commit: vi.fn(),
		updateMatrixWidth: vi.fn(),
		updateVectorWidths: vi.fn(),
	};
	return {
		state,
		workspace,
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
		expect(workspace.matrices[0]).toStrictEqual(originalMatrix);
		expect(workspace.vectors[0].label).toBe("v2");

		controller.deleteMatrix(originalMatrix.id);
		controller.deleteVector(originalVector.id);
		expect(workspace.matrices).toHaveLength(1);
		expect(workspace.vectors).toHaveLength(1);
		expect(options.commit).toHaveBeenCalled();
	});

	it("enforces the shared node limit", () => {
		const { controller, workspace, options } = setup();
		replaceWorkspaceMatrices(
			workspace,
			Array.from({ length: MAX_WORKSPACE_NODES }, (_, index) =>
				createMatrixNode(3, `M${index}`),
			),
		);
		replaceWorkspaceVectors(
			workspace,
			Array.from({ length: MAX_WORKSPACE_NODES }, (_, index) =>
				createVectorNode(3, `v${index}`, "#000"),
			),
		);

		controller.addMatrix();
		controller.addVector();

		expect(workspace.matrices).toHaveLength(MAX_WORKSPACE_NODES);
		expect(workspace.vectors).toHaveLength(MAX_WORKSPACE_NODES);
		expect(options.commit).not.toHaveBeenCalled();
	});

	it("adds valid presets and ignores unknown presets", () => {
		const { controller, workspace, options } = setup();

		controller.addMatrixPreset("missing");
		controller.addMatrixPreset("rotate-z-45");

		expect(workspace.matrices).toHaveLength(2);
		expect(options.commit).toHaveBeenCalledOnce();
	});

	it("assigns distinct sequential labels to every eigenbasis vector", () => {
		const { controller, workspace, options } = setup();

		controller.addEigenbasis();

		expect(workspace.vectors.map(({ label }) => label)).toEqual([
			"v1",
			"v2",
			"v3",
			"v4",
		]);
		expect(new Set(workspace.vectors.map(({ id }) => id)).size).toBe(4);
		expect(workspace.vectors.map(({ color }) => color)).toEqual([
			"#f4b740",
			"#5bd8a6",
			"#ef6f6c",
			"#8fb4ff",
		]);
		expect(options.commit).toHaveBeenCalledOnce();
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

		expect(workspace.matrices[0].entries[0]).toBe("sqrt(4)");
		expect(workspace.vectors[0].coordinates[1]).toBe("3/2");
		expect(workspace.lastValidEvaluation.matrices[0].values[0]).toBe(2);
		expect(workspace.lastValidEvaluation.vectors[0].coordinates[1]).toBe(
			1.5,
		);
		expect(options.updateMatrixWidth).toHaveBeenCalledWith(matrixInput);
		expect(options.updateVectorWidths).toHaveBeenCalledWith(vectorInput);
		expect(options.commit).toHaveBeenLastCalledWith({
			renderStack: false,
			updateResults: true,
		});
	});

	it("re-renders stale result columns when validity returns", () => {
		const { controller, workspace, options } = setup();
		const matrixInput = {
			name: `matrix-${workspace.matrices[0].id}-entry-0`,
			dataset: {
				matrixId: workspace.matrices[0].id,
				entryIndex: "0",
			},
			value: "",
			selectionStart: 0,
			selectionEnd: 0,
		} as unknown as HTMLInputElement;

		controller.handleInput(matrixInput);
		controller.addVector();
		matrixInput.value = "1";
		controller.handleInput(matrixInput);

		expect(workspace.vectors).toHaveLength(2);
		expect(options.commit).toHaveBeenLastCalledWith({
			renderStack: true,
			updateResults: false,
		});
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
		expect(options.commit).toHaveBeenCalledWith({ renderStack: false });
	});
});
