import type { Dimension, MatrixFor } from "./math";
import {
	type AppState,
	type VectorNode,
	getTotalTransform,
	getWorkspace,
} from "./state";
import { getAnimatedTransform } from "./animation";

export interface RenderState<D extends Dimension = Dimension> {
	dimension: D;
	transform: MatrixFor<D>;
	vectors: VectorNode<D>[];
	showBasis: boolean;
	showGrid: boolean;
}

export function getRenderState(state: AppState, now: number): RenderState {
	const workspace = getWorkspace(state);
	const totalTransform = getTotalTransform(workspace);

	return {
		dimension: workspace.dimension,
		transform: getAnimatedTransform(
			workspace,
			state.animation,
			now,
			totalTransform,
		),
		vectors: workspace.vectors,
		showBasis: state.showBasis,
		showGrid: state.showGrid,
	};
}
