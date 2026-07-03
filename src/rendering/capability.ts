import {
	type Dimension,
	type MatrixFor,
	identityMatrix,
	multiplyMatrix,
} from "../domain/math";
import { type Workspace, getMatrixValues } from "../domain/state";
import { MAX_RENDER_TRANSFORM_VALUE } from "../domain/policy";

export { MAX_RENDER_TRANSFORM_VALUE } from "../domain/policy";

export function canRenderMatrixSequence<D extends Dimension>(
	dimension: D,
	matrices: MatrixFor<D>[],
): boolean {
	let accumulated = identityMatrix(dimension);
	for (const matrix of [...matrices].reverse()) {
		accumulated = multiplyMatrix(dimension, matrix, accumulated);
		if (
			accumulated.some(
				(value) =>
					!Number.isFinite(value) ||
					Math.abs(value) > MAX_RENDER_TRANSFORM_VALUE,
			)
		)
			return false;
	}
	return true;
}

export function canRenderWorkspace<D extends Dimension>(
	workspace: Workspace<D>,
): boolean {
	return canRenderMatrixSequence(
		workspace.dimension,
		workspace.matrices.map(getMatrixValues),
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
			matrix.id === matrixId ? candidate : getMatrixValues(matrix),
		),
	);
}
