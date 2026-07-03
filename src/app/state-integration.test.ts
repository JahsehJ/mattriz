import { describe, expect, it } from "vitest";
import {
	createMatrixNode,
	replaceWorkspaceMatrices,
} from "../domain/workspace";
import { createInitialState } from "./state";
import {
	canRenderMatrixSequence,
	canRenderMatrixUpdate,
} from "../rendering/capability";
import { getRenderState } from "./render-state";

describe("application state integration", () => {
	it("renders only the active workspace", () => {
		const state = createInitialState();
		state.activeDimension = 2;

		expect(getRenderState(state, 0)).toMatchObject({
			dimension: 2,
			vectors: [{ coordinates: [1, 1] }],
			showGrid: true,
		});
	});

	it("stores display options in application state", () => {
		const state = createInitialState();

		state.showGrid = false;
		expect(state.showGrid).toBe(false);
	});

	it("rejects transforms outside the rendering-safe bound", () => {
		const first: [number, number, number, number] = [1e20, 0, 0, 1];
		const zero: [number, number, number, number] = [0, 0, 0, 0];

		expect(canRenderMatrixSequence(2, [first])).toBe(true);
		expect(canRenderMatrixSequence(2, [first, first])).toBe(false);
		expect(canRenderMatrixSequence(2, [zero, first, first])).toBe(false);
	});

	it("validates a render update without mutating the workspace", () => {
		const matrices = Array.from({ length: 16 }, (_, index) =>
			createMatrixNode(2, String.fromCharCode(65 + index), [
				index === 0 ? 1 : 100,
				0,
				0,
				1,
			]),
		);
		const candidate = matrices[0];
		const workspace = createInitialState().workspaces[2];
		replaceWorkspaceMatrices(workspace, matrices);

		expect(
			canRenderMatrixUpdate(workspace, candidate.id, [100, 0, 0, 1]),
		).toBe(false);
		expect(candidate.entries).toEqual(["1", "0", "0", "1"]);
	});
});
