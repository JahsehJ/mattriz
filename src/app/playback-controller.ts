import { type Mat2, type Mat3, identityMatrix } from "../domain/math";
import { type AppState, getWorkspace } from "./state";
import { getAnimationDuration } from "../domain/animation";
import { canRenderTransform } from "../rendering/capability";
import {
	getPlaybackElapsed,
	pausePlayback,
	resetPlayback,
	togglePlayback,
} from "./playback-state";

interface PlaybackControllerOptions {
	getState(): AppState;
	render(renderStack?: boolean): void;
	now(): number;
}

export class PlaybackController {
	constructor(private readonly options: PlaybackControllerOptions) {}

	toggle(): void {
		const state = this.options.getState();
		state.animation = togglePlayback(state.animation, this.options.now());
		this.options.render(false);
	}

	reset(renderStack = true): void {
		const state = this.options.getState();
		state.animation = resetPlayback(state.animation);
		this.options.render(renderStack);
	}

	resetTransform(): void {
		const state = this.options.getState();
		const workspace = getWorkspace(state);
		if (workspace.dimension === 2)
			state.appliedTransforms[2] = identityMatrix(2);
		else state.appliedTransforms[3] = identityMatrix(3);
		this.reset(false);
	}

	pauseForVisibility(): boolean {
		const state = this.options.getState();
		if (state.animation.status !== "playing") return false;
		state.animation = pausePlayback(state.animation, this.options.now());
		return true;
	}

	complete(): boolean {
		const state = this.options.getState();
		const workspace = getWorkspace(state);
		const now = this.options.now();
		const transform = workspace.lastValidEvaluation.totalTransform;
		if (
			state.animation.status !== "playing" ||
			!Number.isFinite(now) ||
			getPlaybackElapsed(state.animation, now) <
				getAnimationDuration(
					workspace.lastValidEvaluation,
					state.animation.mode,
				) ||
			!canRenderTransform(transform)
		)
			return false;
		if (workspace.dimension === 2)
			state.appliedTransforms[2] = [...transform] as Mat2;
		else state.appliedTransforms[3] = [...transform] as Mat3;
		state.animation = resetPlayback(state.animation);
		this.options.render(false);
		return true;
	}
}
