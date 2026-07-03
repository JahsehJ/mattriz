import { beforeAll, describe, expect, it, vi } from "vitest";
import { createMatrixNode, recomputeWorkspace } from "../../app/workspace";
import { MAX_RENDER_TRANSFORM_VALUE } from "../../app/renderability-policy";
import { ApplicationController } from "./application-controller";
import { createInitialState } from "../../app/state";

beforeAll(() => {
	vi.stubGlobal("CSS", { escape: (value: string) => value });
});

function setup(now = 0) {
	const state = createInitialState();
	let idSequence = 0;
	const workspace = state.workspaces[3];
	const durationOutput = { textContent: "" };
	let renderedResultIds = workspace.lastValidEvaluation.vectors.map(
		(vector) => vector.id,
	);
	const stack = {
		querySelector: vi.fn((selector: string) =>
			selector.startsWith("[data-duration-output")
				? durationOutput
				: null,
		),
		querySelectorAll: vi.fn((selector: string) =>
			selector === ".result-column-label[data-result-vector-id]"
				? renderedResultIds.map((id) => ({
						dataset: { resultVectorId: id },
					}))
				: [],
		),
	} as unknown as HTMLElement;
	const rootQuerySelector = vi.fn<(selector: string) => Element | null>(
		() => null,
	);
	const root = {
		querySelector: rootQuerySelector,
		querySelectorAll: vi.fn(() => []),
	} as unknown as HTMLElement;
	const controller = new ApplicationController(
		root,
		stack,
		{} as HTMLSelectElement,
		(key) => key,
		{
			getState: () => state,
			scheduleRender: vi.fn(),
			now: () => now,
			createId: () => `controller-node-${++idSequence}`,
		},
	);
	const render = vi.spyOn(controller, "render").mockImplementation(() => {});
	return {
		state,
		workspace,
		controller,
		render,
		rootQuerySelector,
		durationOutput,
		setRenderedResultIds: (ids: string[]) => {
			renderedResultIds = ids;
		},
	};
}

describe("application controller", () => {
	it("adds, reorders, and deletes workspace nodes", () => {
		const { controller, workspace } = setup();
		const originalMatrix = workspace.matrices[0];
		const originalVector = workspace.vectors[0];

		controller.editor.addMatrix();
		controller.editor.addVector();
		controller.editor.moveItemTo(
			"matrix",
			originalMatrix.id,
			workspace.matrices[0].id,
			"before",
		);
		controller.editor.moveItemTo(
			"vector",
			workspace.vectors[1].id,
			originalVector.id,
			"before",
		);
		controller.editor.deleteItem("matrix", originalMatrix.id);
		controller.editor.deleteItem("vector", originalVector.id);

		expect(workspace.matrices.map(({ label }) => label)).toEqual(["B"]);
		expect(workspace.vectors.map(({ label }) => label)).toEqual(["v2"]);
	});

	it("assigns colors from vector labels after gaps are reused", () => {
		const { controller, workspace } = setup();
		controller.editor.addVector();
		const [v1, v2] = workspace.vectors;
		controller.editor.deleteItem("vector", v1.id);

		controller.editor.addVector();

		expect(workspace.vectors.map(({ label }) => label)).toEqual([
			"v2",
			"v1",
		]);
		expect(workspace.vectors[1].color).not.toBe(v2.color);
		expect(workspace.vectors[1].color).toBe(v1.color);
	});

	it("recomputes edited expressions and clamps durations", () => {
		const { controller, workspace, durationOutput } = setup();
		const matrixInput = {
			closest: () => null,
			dataset: { matrixId: workspace.matrices[0].id, entryIndex: "0" },
			value: "sqrt(4)",
		} as unknown as HTMLInputElement;
		const durationInput = {
			dataset: { durationId: workspace.matrices[0].id },
			value: "9999",
		} as unknown as HTMLInputElement;

		controller.inputs.handleInput(matrixInput);
		controller.inputs.handleInput(durationInput);

		expect(workspace.lastValidEvaluation.matrices[0].values[0]).toBe(2);
		expect(workspace.matrices[0].durationMs).toBe(3000);
		expect(durationOutput.textContent).toBe("3000ms");
	});

	it("refreshes vector presets during a partial render when their menu is open", () => {
		const { controller, render, rootQuerySelector } = setup();
		rootQuerySelector.mockImplementation((selector: string) =>
			selector === ".preset-menu[open] [data-action='add-eigenvector']"
				? ({} as Element)
				: null,
		);
		const updatePresetAvailability = vi.spyOn(
			controller.equations,
			"updatePresetAvailability",
		);
		render.mockRestore();

		controller.render(false);

		expect(updatePresetAvailability.mock.calls).toHaveLength(1);
	});

	it("rerenders result labels when vector order changes during invalid input", () => {
		const { controller, workspace, render, setRenderedResultIds } = setup();
		controller.editor.addVector();
		const originalOrder = workspace.vectors.map((vector) => vector.id);
		setRenderedResultIds(originalOrder);
		const matrixInput = {
			closest: () => null,
			dataset: {
				matrixId: workspace.matrices[0].id,
				entryIndex: "0",
			},
			name: "matrix-entry",
			value: "invalid",
		} as unknown as HTMLInputElement;

		controller.inputs.handleInput(matrixInput);
		controller.editor.moveItemTo(
			"vector",
			originalOrder[1],
			originalOrder[0],
			"before",
		);
		render.mockClear();
		matrixInput.value = "2";
		controller.inputs.handleInput(matrixInput);

		expect(
			workspace.lastValidEvaluation.vectors.map(({ id }) => id),
		).toEqual([originalOrder[1], originalOrder[0]]);
		expect(render).toHaveBeenCalledWith(true);
	});

	it("rejects eigenvector actions while the equation is invalid", () => {
		const { controller, workspace } = setup();
		workspace.matrices[0].entries[0] = "invalid";
		recomputeWorkspace(workspace);
		const vectorCount = workspace.vectors.length;

		controller.editor.addEigenbasis();
		controller.editor.addRepresentativeEigenvector();

		expect(workspace.vectors).toHaveLength(vectorCount);
	});

	it("allows eigenvector actions when only vector input is invalid", () => {
		const { controller, workspace } = setup();
		workspace.vectors[0].coordinates[0] = "invalid";
		recomputeWorkspace(workspace);
		const vectorCount = workspace.vectors.length;

		controller.editor.addRepresentativeEigenvector();

		expect(workspace.vectors).toHaveLength(vectorCount + 1);
	});

	it("commits a completed, renderable playback transform", () => {
		const { state, controller } = setup(910);
		state.activeDimension = 2;
		const workspace = state.workspaces[2];
		workspace.matrices = [createMatrixNode(2, "A", [2, 0, 0, 1])];
		recomputeWorkspace(workspace);
		state.animation = {
			...state.animation,
			status: "playing",
			runningSinceMs: 10,
		};

		expect(controller.completePlayback()).toBe(true);
		expect(state.appliedTransforms[2]).toEqual([2, 0, 0, 1]);
		expect(state.animation.status).toBe("idle");
	});

	it("leaves an overflowing playback transform uncommitted", () => {
		const { state, controller } = setup(100_000);
		state.activeDimension = 2;
		const workspace = state.workspaces[2];
		workspace.matrices = Array.from({ length: 16 }, (_, index) =>
			createMatrixNode(2, `M${index}`, [100, 0, 0, 100]),
		);
		recomputeWorkspace(workspace);
		state.animation = {
			...state.animation,
			status: "playing",
			runningSinceMs: 10,
		};

		expect(100 ** 16).toBeGreaterThan(MAX_RENDER_TRANSFORM_VALUE);
		expect(controller.completePlayback()).toBe(false);
		expect(state.appliedTransforms[2]).toEqual([1, 0, 0, 1]);
	});
});
