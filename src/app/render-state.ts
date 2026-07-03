import { getAnimatedTransform } from "../domain/animation";
import type { Dimension, MatrixFor, VectorFor } from "../domain/math";
import { type AppState, getWorkspace } from "./state";
import { getAnimationFrame } from "./playback-state";

export interface RenderVector<D extends Dimension> {
	id: string;
	label: string;
	coordinates: VectorFor<D>;
	color: string;
}

export interface RenderState<D extends Dimension = Dimension> {
	dimension: D;
	transform: MatrixFor<D>;
	vectors: readonly RenderVector<D>[];
	showBasis: boolean;
	showGrid: boolean;
}

export function getRenderState(state: AppState, now: number): RenderState {
	const workspace = getWorkspace(state);
	return {
		dimension: workspace.dimension,
		transform: getAnimatedTransform(
			workspace.lastValidEvaluation,
			state.appliedTransforms[workspace.dimension],
			getAnimationFrame(state.animation, now),
			workspace.lastValidEvaluation.totalTransform,
		),
		vectors: workspace.lastValidEvaluation.vectors.map((vector) => ({
			id: vector.id,
			label: vector.label,
			coordinates: vector.coordinates,
			color: vector.color,
		})),
		showBasis: state.showBasis,
		showGrid: state.showGrid,
	};
}
