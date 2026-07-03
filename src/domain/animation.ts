import {
	type Dimension,
	type MatrixFor,
	cloneMatrix,
	composeMathNotation,
	identityMatrix,
	lerpMatrix,
	multiplyMatrix,
} from "./math";
import { MAX_MATRIX_DURATION_MS, MIN_MATRIX_DURATION_MS } from "./policy";

export type AnimationMode = "steps" | "composed";

export interface AnimationFrame {
	readonly mode: AnimationMode;
	readonly elapsedMs: number;
}

export interface AnimationMatrix<D extends Dimension> {
	readonly id: string;
	readonly values: MatrixFor<D>;
	readonly durationMs: number;
}

export interface AnimationSequence<D extends Dimension> {
	readonly dimension: D;
	readonly matrices: readonly AnimationMatrix<D>[];
}

export type AnimationProgress =
	| { mode: "steps"; matrixId: string; progress: number }
	| { mode: "composed"; progress: number };

export function getAnimatedTransform<D extends Dimension>(
	sequence: AnimationSequence<D>,
	appliedTransform: Readonly<MatrixFor<D>>,
	frame: AnimationFrame | null,
	totalTransform: MatrixFor<D> = composeMathNotation(
		sequence.dimension,
		sequence.matrices.map((matrix) => matrix.values),
	),
): MatrixFor<D> {
	if (!frame) return cloneMatrix(appliedTransform);

	if (frame.mode === "composed") {
		const animationProgress = getAnimationProgress(sequence, frame);
		if (animationProgress?.mode !== "composed")
			return cloneMatrix(appliedTransform);
		return lerpMatrix(
			sequence.dimension,
			identityMatrix(sequence.dimension),
			totalTransform,
			animationProgress.progress,
		);
	}

	return getStepTransform(sequence, frame.elapsedMs);
}

export function getStepTransform<D extends Dimension>(
	sequence: AnimationSequence<D>,
	elapsedMs: number,
): MatrixFor<D> {
	let remaining = normalizeElapsedMs(elapsedMs);
	let accumulated = identityMatrix(sequence.dimension);

	for (let index = sequence.matrices.length - 1; index >= 0; index -= 1) {
		const matrix = sequence.matrices[index];
		const duration = getMatrixDuration(matrix);
		if (remaining <= duration) {
			const partial = lerpMatrix(
				sequence.dimension,
				identityMatrix(sequence.dimension),
				cloneMatrix(matrix.values),
				remaining / duration,
			);
			return multiplyMatrix(sequence.dimension, partial, accumulated);
		}

		accumulated = multiplyMatrix(
			sequence.dimension,
			cloneMatrix(matrix.values),
			accumulated,
		);
		remaining -= duration;
	}

	return accumulated;
}

export function getAnimationProgress<D extends Dimension>(
	sequence: AnimationSequence<D>,
	frame: AnimationFrame | null,
): AnimationProgress | null {
	if (!frame) return null;

	let remaining = normalizeElapsedMs(frame.elapsedMs);
	if (frame.mode === "composed") {
		return {
			mode: "composed",
			progress: Math.min(
				1,
				remaining /
					Math.max(1, getAnimationDuration(sequence, "composed")),
			),
		};
	}

	for (let index = sequence.matrices.length - 1; index >= 0; index -= 1) {
		const matrix = sequence.matrices[index];
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

function normalizeElapsedMs(elapsedMs: number): number {
	return Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
}

export function getAnimationDuration<D extends Dimension>(
	sequence: AnimationSequence<D>,
	mode: AnimationMode,
): number {
	let duration = 0;
	for (const matrix of sequence.matrices) {
		const matrixDuration = getMatrixDuration(matrix);
		duration =
			mode === "composed"
				? Math.max(duration, matrixDuration)
				: duration + matrixDuration;
	}
	return duration;
}

export function getMatrixDuration(matrix: {
	readonly durationMs: number;
}): number {
	return Number.isFinite(matrix.durationMs)
		? Math.max(
				MIN_MATRIX_DURATION_MS,
				Math.min(MAX_MATRIX_DURATION_MS, matrix.durationMs),
			)
		: MIN_MATRIX_DURATION_MS;
}
