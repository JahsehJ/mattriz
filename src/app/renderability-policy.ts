import {
	type Dimension,
	type MatrixFor,
	identityMatrix,
	multiplyMatrix,
} from "../math/matrix";
import type { Workspace } from "./workspace";
import type { WorkspaceEvaluation } from "./workspace-evaluation";

// WebGL stores transforms as Float32 values. The margin leaves room for
// subsequent vector calculations.
export const MAX_RENDER_TRANSFORM_VALUE = 1e30;

export function canRenderTransform(values: readonly number[]): boolean {
	return values.every(
		(value) =>
			Number.isFinite(value) &&
			Math.abs(value) <= MAX_RENDER_TRANSFORM_VALUE,
	);
}

export function canRenderMatrixSequence<D extends Dimension>(
	dimension: D,
	matrices: MatrixFor<D>[],
): boolean {
	let accumulated = identityMatrix(dimension);
	for (const matrix of [...matrices].reverse()) {
		accumulated = multiplyMatrix(dimension, matrix, accumulated);
		if (!canRenderTransform(accumulated)) return false;
	}
	return true;
}

export function canRenderWorkspace<D extends Dimension>(
	workspace: Workspace<D>,
): boolean {
	return canRenderEvaluation(workspace.lastValidEvaluation);
}

export function canRenderEvaluation<D extends Dimension>(
	evaluation: WorkspaceEvaluation<D>,
): boolean {
	return canRenderMatrixSequence(
		evaluation.dimension,
		evaluation.matrices.map((matrix) => matrix.values),
	);
}
