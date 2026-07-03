import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "../domain/state";
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
			startedAt: 160,
			pausedAt: 0,
		});
		expect(render).toHaveBeenCalledTimes(3);
	});

	it("pauses active playback when visibility is lost", () => {
		const state = createInitialState();
		state.animation.status = "playing";
		const controller = new PlaybackController({
			getState: () => state,
			render: vi.fn(),
			now: () => 250,
		});

		expect(controller.pauseForVisibility()).toBe(true);
		expect(state.animation).toMatchObject({
			status: "paused",
			pausedAt: 250,
		});
		expect(controller.pauseForVisibility()).toBe(false);
	});
});
