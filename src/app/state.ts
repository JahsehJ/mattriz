import { type Dimension, type MatrixFor, identityMatrix } from "../domain/math";
import { type Workspace, createWorkspace } from "../domain/workspace";
import type { PlaybackState } from "./playback-state";

export type { AnimationMode, AnimationProgress } from "../domain/animation";
export type { PlaybackState, PlaybackStatus } from "./playback-state";

export interface AppState {
	activeDimension: Dimension;
	workspaces: { 2: Workspace<2>; 3: Workspace<3> };
	appliedTransforms: {
		2: MatrixFor<2>;
		3: MatrixFor<3>;
	};
	animation: PlaybackState;
	showBasis: boolean;
	showGrid: boolean;
}

export function createInitialState(createId?: () => string): AppState {
	return {
		activeDimension: 3,
		workspaces: {
			2: createId ? createWorkspace(2, createId) : createWorkspace(2),
			3: createId ? createWorkspace(3, createId) : createWorkspace(3),
		},
		appliedTransforms: {
			2: identityMatrix(2),
			3: identityMatrix(3),
		},
		animation: {
			mode: "steps",
			status: "idle",
			elapsedMs: 0,
			runningSinceMs: 0,
		},
		showBasis: true,
		showGrid: true,
	};
}

export function getWorkspace(state: AppState): Workspace<Dimension> {
	return state.activeDimension === 2
		? state.workspaces[2]
		: state.workspaces[3];
}
