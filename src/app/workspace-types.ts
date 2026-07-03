import type { Dimension } from "../math/matrix";

export interface MatrixNode<D extends Dimension> {
	id: string;
	label: string;
	entries: string[];
	durationMs: number;
	dimension: D;
}

export interface VectorNode<D extends Dimension> {
	id: string;
	label: string;
	coordinates: string[];
	color: string;
	dimension: D;
}

export interface WorkspaceDocument<D extends Dimension> {
	dimension: D;
	matrices: readonly MatrixNode<D>[];
	vectors: readonly VectorNode<D>[];
}
