import { describe, expect, it } from "vitest";
import { restorePausedPlayback } from "./playback-state";
import { createInitialState, getWorkspace } from "./state";

describe("application state", () => {
	it("initializes independent identity workspaces for both dimensions", () => {
		const state = createInitialState();

		expect(state.workspaces[2].dimension).toBe(2);
		expect(state.workspaces[3].dimension).toBe(3);
		expect(state.appliedTransforms[2]).toEqual([1, 0, 0, 1]);
		expect(state.appliedTransforms[3]).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
		expect(getWorkspace(state)).toBe(state.workspaces[3]);
	});

	it("changes the active workspace and animation mode", () => {
		const state = createInitialState();

		state.activeDimension = 2;
		expect(getWorkspace(state)).toBe(state.workspaces[2]);
		state.animation.mode = "composed";
		expect(state.animation.mode).toBe("composed");
	});

	it("restores elapsed progress independently of the page clock", () => {
		const state = createInitialState();
		const restored = restorePausedPlayback("steps", 500);

		state.animation = restored;
		expect(state.animation).toEqual({
			mode: "steps",
			status: "paused",
			elapsedMs: 500,
			runningSinceMs: 0,
		});
	});
});
