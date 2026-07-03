import { describe, expect, it, vi } from "vitest";
import {
	createMatrixNode,
	replaceWorkspaceMatrices,
} from "../domain/workspace";
import { createInitialState } from "./state";
import { MAX_RENDER_TRANSFORM_VALUE } from "../rendering/capability";
import { PlaybackController } from "./playback-controller";

describe("playback controller", () => {
	it("pauses and resumes without counting paused time", () => {
		const state = createInitialState();
		const render = vi.fn();
		let now = 100;
		const controller = new PlaybackController({
			getState: () => state,
			render,
			now: () => now,
		});

		controller.toggle();
		now = 140;
		controller.toggle();
		now = 200;
		controller.toggle();

		expect(state.animation).toMatchObject({
			status: "playing",
			elapsedMs: 40,
			runningSinceMs: 200,
		});
		expect(render).toHaveBeenCalledTimes(3);
	});

	it("pauses active playback when visibility is lost", () => {
		const state = createInitialState();
		state.animation = { ...state.animation, status: "playing" };
		const controller = new PlaybackController({
			getState: () => state,
			render: vi.fn(),
			now: () => 250,
		});

		expect(controller.pauseForVisibility()).toBe(true);
		expect(state.animation).toMatchObject({
			status: "paused",
			elapsedMs: 250,
			runningSinceMs: 0,
		});
		expect(controller.pauseForVisibility()).toBe(false);
	});

	it("resets playback and the committed transform through domain operations", () => {
		const state = createInitialState();
		state.appliedTransforms[3] = [2, 0, 0, 0, 2, 0, 0, 0, 2];
		state.animation = {
			...state.animation,
			status: "paused",
			elapsedMs: 10,
		};
		const render = vi.fn();
		const controller = new PlaybackController({
			getState: () => state,
			render,
			now: () => 250,
		});

		controller.resetTransform();

		expect(state.appliedTransforms[3]).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
		expect(state.animation).toMatchObject({
			status: "idle",
			elapsedMs: 0,
			runningSinceMs: 0,
		});
		expect(render).toHaveBeenCalledWith(false);
	});

	it("requests a full render for a direct reset", () => {
		const state = createInitialState();
		const render = vi.fn();
		const controller = new PlaybackController({
			getState: () => state,
			render,
			now: () => 0,
		});

		controller.reset();

		expect(render).toHaveBeenCalledWith(true);
	});

	it("commits the composed transform when playback completes", () => {
		const state = createInitialState();
		state.activeDimension = 2;
		const workspace = state.workspaces[2];
		replaceWorkspaceMatrices(workspace, [
			createMatrixNode(2, "A", [2, 0, 0, 1]),
		]);
		state.animation = {
			...state.animation,
			status: "playing",
			runningSinceMs: 10,
		};
		const render = vi.fn();
		const controller = new PlaybackController({
			getState: () => state,
			render,
			now: () => 910,
		});

		expect(controller.complete()).toBe(true);
		expect(state.appliedTransforms[2]).toEqual([2, 0, 0, 1]);
		expect(state.animation.status).toBe("idle");
		expect(render).toHaveBeenCalledWith(false);
	});

	it("does not complete playback before its timeline ends", () => {
		const state = createInitialState();
		state.activeDimension = 2;
		const workspace = state.workspaces[2];
		replaceWorkspaceMatrices(workspace, [
			createMatrixNode(2, "A", [2, 0, 0, 1]),
		]);
		state.animation = {
			...state.animation,
			status: "playing",
			runningSinceMs: 10,
		};
		const render = vi.fn();
		const controller = new PlaybackController({
			getState: () => state,
			render,
			now: () => 20,
		});

		expect(controller.complete()).toBe(false);
		expect(state.appliedTransforms[2]).toEqual([1, 0, 0, 1]);
		expect(state.animation.status).toBe("playing");
		expect(render).not.toHaveBeenCalled();
	});

	it("does not complete playback when the composed transform exceeds the render bound", () => {
		const state = createInitialState();
		state.activeDimension = 2;
		const workspace = state.workspaces[2];
		replaceWorkspaceMatrices(
			workspace,
			Array.from({ length: 16 }, (_, index) =>
				createMatrixNode(2, `M${index}`, [100, 0, 0, 100]),
			),
		);
		state.animation = {
			...state.animation,
			status: "playing",
			runningSinceMs: 10,
		};
		const render = vi.fn();
		const controller = new PlaybackController({
			getState: () => state,
			render,
			now: () => 100_000,
		});

		expect(100 ** 16).toBeGreaterThan(MAX_RENDER_TRANSFORM_VALUE);
		expect(controller.complete()).toBe(false);
		expect(state.appliedTransforms[2]).toEqual([1, 0, 0, 1]);
		expect(state.animation.status).toBe("playing");
		expect(render).not.toHaveBeenCalled();
	});

	it("does not commit a transform when playback is not active", () => {
		const state = createInitialState();
		const workspace = state.workspaces[3];
		replaceWorkspaceMatrices(workspace, [
			createMatrixNode(3, "A", [2, 0, 0, 0, 2, 0, 0, 0, 2]),
		]);
		const render = vi.fn();
		const controller = new PlaybackController({
			getState: () => state,
			render,
			now: () => 20,
		});

		expect(controller.complete()).toBe(false);
		expect(state.appliedTransforms[3]).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
		expect(render).not.toHaveBeenCalled();
	});
});
