import {
	Dimension,
	MatrixFor,
	VectorFor,
	applyMatrixToVector,
	composeMathNotation,
	identityMatrix,
} from "./math";
import {
	MAX_ABSOLUTE_INPUT_VALUE,
	MAX_MATRIX_DURATION_MS,
	MAX_WORKSPACE_NODES,
	MIN_MATRIX_DURATION_MS,
} from "./policy";
import type { AnimationState } from "./animation";
export type {
	AnimationMode,
	AnimationProgress,
	AnimationState,
	PlaybackStatus,
} from "./animation";
import { createNumericCells, type NumericCells } from "./numeric-editor";

export {
	createNumericCells,
	getNumericCellError,
	updateNumericCellDraft,
} from "./numeric-editor";
export type {
	NumericCell,
	NumericCellError,
	NumericCells,
	NumericCommitResult,
} from "./numeric-editor";

export { MAX_ABSOLUTE_INPUT_VALUE, MAX_WORKSPACE_NODES } from "./policy";

export type MatrixUpdateResult =
	| { accepted: true }
	| {
			accepted: false;
			error: "out-of-range" | "render-range-exceeded";
	  };

export type WorkspaceMutationResult =
	| { accepted: true }
	| {
			accepted: false;
			error:
				| "node-limit-exceeded"
				| "dimension-mismatch"
				| "out-of-range"
				| "render-range-exceeded";
	  };

export interface MatrixNode<D extends Dimension> {
	id: string;
	label: string;
	entries: NumericCells<MatrixFor<D>>;
	durationMs: number;
	readonly dimension: D;
}

export interface VectorNode<D extends Dimension> {
	id: string;
	label: string;
	coordinates: NumericCells<VectorFor<D>>;
	color: string;
	readonly dimension: D;
}

export interface Workspace<D extends Dimension> {
	readonly dimension: D;
	matrices: MatrixNode<D>[];
	vectors: VectorNode<D>[];
	appliedTransform: MatrixFor<D>;
}

export type AnyMatrixNode = MatrixNode<2> | MatrixNode<3>;
export type AnyVectorNode = VectorNode<2> | VectorNode<3>;
export type AnyWorkspace = Workspace<2> | Workspace<3>;

export interface AppState {
	activeDimension: Dimension;
	workspaces: { 2: Workspace<2>; 3: Workspace<3> };
	animation: AnimationState;
	showBasis: boolean;
	showGrid: boolean;
}

function createWorkspace<D extends Dimension>(dimension: D): Workspace<D> {
	return {
		dimension,
		matrices: [createMatrixNode(dimension, "A")],
		vectors: [createVectorNode(dimension, "v1", "#f4b740")],
		appliedTransform: identityMatrix(dimension),
	};
}

export function createInitialState(): AppState {
	return {
		activeDimension: 3,
		workspaces: {
			2: createWorkspace(2),
			3: createWorkspace(3),
		},
		animation: {
			mode: "steps",
			status: "idle",
			startedAt: 0,
			pausedAt: 0,
		},
		showBasis: true,
		showGrid: true,
	};
}

export function createMatrixNode<D extends Dimension>(
	dimension: D,
	label: string,
	values?: MatrixFor<D>,
	draftValues?: string[],
): MatrixNode<D> {
	const nextValues = values ?? identityMatrix(dimension);
	return {
		id: crypto.randomUUID(),
		dimension,
		label,
		entries: createNumericCells(
			nextValues,
			draftValues ?? Array.from(nextValues, String),
		),
		durationMs: 900,
	};
}

export function createVectorNode<D extends Dimension>(
	dimension: D,
	label: string,
	color: string,
	components?: VectorFor<D>,
	draftComponents?: string[],
): VectorNode<D> {
	const nextComponents =
		components ?? ((dimension === 2 ? [1, 1] : [1, 1, 1]) as VectorFor<D>);
	return {
		id: crypto.randomUUID(),
		dimension,
		label,
		coordinates: createNumericCells(
			nextComponents,
			draftComponents ?? Array.from(nextComponents, String),
		),
		color,
	};
}

export function getWorkspace(state: AppState): AnyWorkspace {
	return state.activeDimension === 2
		? state.workspaces[2]
		: state.workspaces[3];
}

export function canAddWorkspaceNodes<D extends Dimension>(
	workspace: Workspace<D>,
	kind: "matrices" | "vectors",
	count = 1,
): boolean {
	return (
		Number.isInteger(count) &&
		count >= 0 &&
		workspace[kind].length + count <= MAX_WORKSPACE_NODES
	);
}

export function replaceWorkspaceMatrices<D extends Dimension>(
	workspace: Workspace<D>,
	matrices: MatrixNode<D>[],
	canApply: (candidate: Workspace<D>) => boolean,
): WorkspaceMutationResult {
	if (matrices.length > MAX_WORKSPACE_NODES) {
		return { accepted: false, error: "node-limit-exceeded" };
	}
	if (
		matrices.some(
			(matrix) =>
				matrix.dimension !== workspace.dimension ||
				matrix.entries.length !== workspace.dimension ** 2,
		)
	) {
		return { accepted: false, error: "dimension-mismatch" };
	}
	if (
		matrices.some((matrix) =>
			matrix.entries.some(
				({ value }) =>
					!Number.isFinite(value) ||
					Math.abs(value) > MAX_ABSOLUTE_INPUT_VALUE,
			),
		)
	) {
		return { accepted: false, error: "out-of-range" };
	}
	const candidate = { ...workspace, matrices };
	if (!canApply(candidate)) {
		return { accepted: false, error: "render-range-exceeded" };
	}
	workspace.matrices = matrices;
	return { accepted: true };
}

export function replaceWorkspaceVectors<D extends Dimension>(
	workspace: Workspace<D>,
	vectors: VectorNode<D>[],
): WorkspaceMutationResult {
	if (vectors.length > MAX_WORKSPACE_NODES) {
		return { accepted: false, error: "node-limit-exceeded" };
	}
	if (
		vectors.some(
			(vector) =>
				vector.dimension !== workspace.dimension ||
				vector.coordinates.length !== workspace.dimension,
		)
	) {
		return { accepted: false, error: "dimension-mismatch" };
	}
	if (
		vectors.some((vector) =>
			vector.coordinates.some(
				({ value }) =>
					!Number.isFinite(value) ||
					Math.abs(value) > MAX_ABSOLUTE_INPUT_VALUE,
			),
		)
	) {
		return { accepted: false, error: "out-of-range" };
	}
	workspace.vectors = vectors;
	return { accepted: true };
}

export function getTotalTransform<D extends Dimension>(
	workspace: Workspace<D>,
): MatrixFor<D> {
	return composeMathNotation(
		workspace.dimension,
		workspace.matrices.map(getMatrixValues),
	);
}

export function setMatrixDuration(
	workspace: AnyWorkspace,
	matrixId: string,
	durationMs: number,
): boolean {
	const matrix = workspace.matrices.find((item) => item.id === matrixId);
	if (!matrix || !Number.isFinite(durationMs)) return false;
	matrix.durationMs = Math.max(
		MIN_MATRIX_DURATION_MS,
		Math.min(MAX_MATRIX_DURATION_MS, durationMs),
	);
	return true;
}

export function setAppliedTransform<D extends Dimension>(
	workspace: Workspace<D>,
	transform: MatrixFor<D>,
): void {
	workspace.appliedTransform = [...transform] as MatrixFor<D>;
}

export function canUpdateMatrixValues(
	workspace: AnyWorkspace,
	matrixId: string,
	values: number[],
): boolean {
	const expectedLength = workspace.dimension ** 2;
	if (
		values.length !== expectedLength ||
		!values.every(
			(value) =>
				Number.isFinite(value) &&
				Math.abs(value) <= MAX_ABSOLUTE_INPUT_VALUE,
		)
	)
		return false;

	const matrixIndex = workspace.matrices.findIndex(
		(matrix) => matrix.id === matrixId,
	);
	if (matrixIndex < 0) return false;
	return matrixIndex >= 0;
}

export function validateMatrixValuesUpdate(
	workspace: AnyWorkspace,
	matrixId: string,
	values: number[],
	canApply: (values: number[]) => boolean,
): MatrixUpdateResult {
	if (!canUpdateMatrixValues(workspace, matrixId, values)) {
		return { accepted: false, error: "out-of-range" };
	}
	if (!canApply(values)) {
		return { accepted: false, error: "render-range-exceeded" };
	}
	return { accepted: true };
}

export function getTransformedVectors<D extends Dimension>(
	workspace: Workspace<D>,
): VectorFor<D>[] {
	const transform = getTotalTransform(workspace);
	return workspace.vectors.map((vector) =>
		applyMatrixToVector(
			workspace.dimension,
			transform,
			getVectorValues(vector),
		),
	);
}

export function getMatrixValues<D extends Dimension>(
	matrix: MatrixNode<D>,
): MatrixFor<D> {
	return matrix.entries.map((entry) => entry.value) as MatrixFor<D>;
}

export function getVectorValues<D extends Dimension>(
	vector: VectorNode<D>,
): VectorFor<D> {
	return vector.coordinates.map(
		(coordinate) => coordinate.value,
	) as VectorFor<D>;
}
