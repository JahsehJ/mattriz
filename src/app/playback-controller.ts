import { identityMatrix } from "../domain/math";
import {
	type AppState,
	getWorkspace,
	setAppliedTransform,
} from "../domain/state";

interface PlaybackControllerOptions {
	getState(): AppState;
	render(renderStack?: boolean): void;
	now(): number;
}

export class PlaybackController {
	constructor(private readonly options: PlaybackControllerOptions) {}

	toggle(): void {
		const animation = this.options.getState().animation;
		const now = this.options.now();
		if (animation.status === "playing") {
			animation.status = "paused";
			animation.pausedAt = now;
		} else if (animation.status === "paused") {
			animation.status = "playing";
			animation.startedAt += now - animation.pausedAt;
			animation.pausedAt = 0;
		} else {
			animation.status = "playing";
			animation.startedAt = now;
			animation.pausedAt = 0;
		}
		this.options.render(false);
	}

	reset(renderStack = true): void {
		const animation = this.options.getState().animation;
		animation.status = "idle";
		animation.startedAt = 0;
		animation.pausedAt = 0;
		this.options.render(renderStack);
	}

	resetTransform(): void {
		const state = this.options.getState();
		const workspace = getWorkspace(state);
		setAppliedTransform(workspace, identityMatrix(workspace.dimension));
		this.reset(false);
	}

	pauseForVisibility(): boolean {
		const animation = this.options.getState().animation;
		if (animation.status !== "playing") return false;
		animation.status = "paused";
		animation.pausedAt = this.options.now();
		return true;
	}
}
