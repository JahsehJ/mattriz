import {
	type Dimension,
	type MatrixFor,
	identityMatrix,
	multiplyMatrix,
} from "../domain/math";
import { type Workspace, type WorkspaceEvaluation } from "../domain/workspace";

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

export function canRenderMatrixUpdate<D extends Dimension>(
	workspace: Workspace<D>,
	matrixId: string,
	values: number[],
): boolean {
	if (values.length !== workspace.dimension ** 2) return false;
	const candidate = values as MatrixFor<D>;
	return canRenderMatrixSequence(
		workspace.dimension,
		workspace.matrices.map((matrix) =>
			matrix.id === matrixId
				? candidate
				: (workspace.lastValidEvaluation.matrices.find(
						(item) => item.id === matrix.id,
					)?.values ?? candidate),
		),
	);
}
