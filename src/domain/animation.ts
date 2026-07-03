import {
	type Dimension,
	type MatrixFor,
	identityMatrix,
	lerpMatrix,
	multiplyMatrix,
} from "./math";
import {
	type MatrixNode,
	type Workspace,
	getMatrixValues,
	getTotalTransform,
} from "./state";
import { MAX_MATRIX_DURATION_MS, MIN_MATRIX_DURATION_MS } from "./policy";

export type AnimationMode = "steps" | "composed";
export type PlaybackStatus = "idle" | "playing" | "paused";

export interface AnimationState {
	mode: AnimationMode;
	status: PlaybackStatus;
	startedAt: number;
	pausedAt: number;
}

export type AnimationProgress =
	| { mode: "steps"; matrixId: string; progress: number }
	| { mode: "composed"; progress: number };

export function getAnimatedTransform<D extends Dimension>(
	workspace: Workspace<D>,
	animation: AnimationState,
	now: number,
	totalTransform: MatrixFor<D> = getTotalTransform(workspace),
): MatrixFor<D> {
	if (animation.status === "idle") {
		return workspace.appliedTransform;
	}

	const elapsed = getAnimationElapsed(animation, now);
	if (animation.mode === "composed") {
		const animationProgress = getAnimationProgress(
			workspace,
			animation,
			now,
		);
		if (animationProgress?.mode !== "composed")
			return workspace.appliedTransform;
		return lerpMatrix(
			workspace.dimension,
			identityMatrix(workspace.dimension),
			totalTransform,
			animationProgress.progress,
		);
	}

	return getStepTransform(workspace, elapsed);
}

export function getStepTransform<D extends Dimension>(
	workspace: Workspace<D>,
	elapsedMs: number,
): MatrixFor<D> {
	let remaining = elapsedMs;
	let accumulated = identityMatrix(workspace.dimension);

	for (const matrix of [...workspace.matrices].reverse()) {
		const duration = getMatrixDuration(matrix);
		if (remaining <= duration) {
			const partial = lerpMatrix(
				workspace.dimension,
				identityMatrix(workspace.dimension),
				getMatrixValues(matrix),
				remaining / duration,
			);
			return multiplyMatrix(workspace.dimension, partial, accumulated);
		}

		accumulated = multiplyMatrix(
			workspace.dimension,
			getMatrixValues(matrix),
			accumulated,
		);
		remaining -= duration;
	}

	return accumulated;
}

export function getAnimationProgress<D extends Dimension>(
	workspace: Workspace<D>,
	animation: AnimationState,
	now: number,
): AnimationProgress | null {
	if (animation.status === "idle") return null;

	let remaining = getAnimationElapsed(animation, now);
	if (animation.mode === "composed") {
		return {
			mode: "composed",
			progress: Math.min(
				1,
				remaining /
					Math.max(1, getAnimationDuration(workspace, "composed")),
			),
		};
	}

	for (const matrix of [...workspace.matrices].reverse()) {
		const duration = getMatrixDuration(matrix);
		if (remaining <= duration) {
			return {
				mode: "steps",
				matrixId: matrix.id,
				progress: remaining / duration,
			};
		}
		remaining -= duration;
	}

	return null;
}

export function getAnimationDuration<D extends Dimension>(
	workspace: Workspace<D>,
	mode: AnimationMode,
): number {
	const durations = workspace.matrices.map(getMatrixDuration);
	return mode === "composed"
		? Math.max(0, ...durations)
		: durations.reduce((sum, duration) => sum + duration, 0);
}

export function getMatrixDuration<D extends Dimension>(
	matrix: MatrixNode<D>,
): number {
	return Number.isFinite(matrix.durationMs)
		? Math.max(
				MIN_MATRIX_DURATION_MS,
				Math.min(MAX_MATRIX_DURATION_MS, matrix.durationMs),
			)
		: MIN_MATRIX_DURATION_MS;
}

export function getAnimationElapsed(
	animation: AnimationState,
	now: number,
): number {
	if (animation.status === "idle") return 0;
	const currentTime =
		animation.status === "paused" ? animation.pausedAt : now;
	const elapsed = currentTime - animation.startedAt;
	return Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
}
