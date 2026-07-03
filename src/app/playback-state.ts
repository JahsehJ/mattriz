import type { AnimationFrame, AnimationMode } from "../domain/animation";

export type PlaybackStatus = "idle" | "playing" | "paused";

export interface PlaybackState {
	mode: AnimationMode;
	status: PlaybackStatus;
	elapsedMs: number;
	runningSinceMs: number;
}

export function togglePlayback(
	playback: PlaybackState,
	now: number,
): PlaybackState {
	if (playback.status === "playing") return pausePlayback(playback, now);
	if (playback.status === "paused") {
		return { ...playback, status: "playing", runningSinceMs: now };
	}
	return {
		...playback,
		status: "playing",
		elapsedMs: 0,
		runningSinceMs: now,
	};
}

export function resetPlayback(playback: PlaybackState): PlaybackState {
	return { ...playback, status: "idle", elapsedMs: 0, runningSinceMs: 0 };
}

export function pausePlayback(
	playback: PlaybackState,
	now: number,
): PlaybackState {
	return playback.status === "playing"
		? {
				...playback,
				status: "paused",
				elapsedMs: getPlaybackElapsed(playback, now),
				runningSinceMs: 0,
			}
		: playback;
}

export function restorePausedPlayback(
	mode: AnimationMode,
	elapsedMs: number,
): PlaybackState {
	if (
		(mode !== "steps" && mode !== "composed") ||
		!Number.isFinite(elapsedMs) ||
		elapsedMs < 0
	)
		throw new Error("Invalid paused animation");
	return { mode, status: "paused", elapsedMs, runningSinceMs: 0 };
}

export function getPlaybackElapsed(
	playback: PlaybackState,
	now: number,
): number {
	if (playback.status === "idle") return 0;
	if (playback.status === "paused") return playback.elapsedMs;
	const elapsed = playback.elapsedMs + now - playback.runningSinceMs;
	return Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
}

export function getAnimationFrame(
	playback: PlaybackState,
	now: number,
): AnimationFrame | null {
	return playback.status === "idle"
		? null
		: { mode: playback.mode, elapsedMs: getPlaybackElapsed(playback, now) };
}
