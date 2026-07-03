import { describe, expect, it } from "vitest";
import {
	getAnimationFrame,
	pausePlayback,
	restorePausedPlayback,
	togglePlayback,
} from "./playback-state";

describe("playback state", () => {
	it("owns clock-relative playback transitions", () => {
		const idle = {
			mode: "steps" as const,
			status: "idle" as const,
			elapsedMs: 0,
			runningSinceMs: 0,
		};
		const playing = togglePlayback(idle, 100);

		expect(getAnimationFrame(playing, 140)).toEqual({
			mode: "steps",
			elapsedMs: 40,
		});
		expect(pausePlayback(playing, 140)).toEqual({
			mode: "steps",
			status: "paused",
			elapsedMs: 40,
			runningSinceMs: 0,
		});
	});

	it("rejects invalid restored elapsed time", () => {
		for (const elapsed of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
			expect(() => restorePausedPlayback("steps", elapsed)).toThrow(
				"Invalid paused animation",
			);
		}
	});
});
