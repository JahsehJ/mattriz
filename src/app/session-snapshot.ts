import {
	type Dimension,
	type MatrixFor,
	type VectorFor,
	cloneMatrix,
} from "../domain/math";
import {
	type MatrixNode,
	type VectorNode,
	type Workspace,
	restoreWorkspaceState,
} from "../domain/workspace";
import type {
	EvaluatedMatrix,
	EvaluatedVector,
} from "../domain/workspace-evaluation";
import type { WorkspaceDocument } from "../domain/workspace-types";
import { type AppState, createInitialState } from "./state";
import { type AnimationMode } from "../domain/animation";
import { type PlaybackState, restorePausedPlayback } from "./playback-state";
import {
	MAX_RENDER_TRANSFORM_VALUE,
	canRenderWorkspace,
} from "../rendering/capability";

export interface CameraSnapshot {
	position: [number, number, number];
	target: [number, number, number];
	zoom: number;
}

export interface CameraSnapshots {
	2: CameraSnapshot;
	3: CameraSnapshot;
}

export type MatrixSnapshot = Omit<MatrixNode<Dimension>, "id" | "dimension">;
export type VectorSnapshot = Omit<VectorNode<Dimension>, "id" | "dimension">;
type EvaluatedVectorSnapshot<D extends Dimension> = Omit<
	EvaluatedVector<D>,
	"id" | "coordinates"
> & { values: VectorFor<D> };

export interface WorkspaceEvaluationSnapshot<D extends Dimension> {
	matrices: Omit<EvaluatedMatrix<D>, "id">[];
	vectors: EvaluatedVectorSnapshot<D>[];
}

export interface WorkspaceSnapshot<D extends Dimension> {
	matrices: MatrixSnapshot[];
	vectors: VectorSnapshot[];
	appliedTransform: MatrixFor<D>;
	lastValidEvaluation: WorkspaceEvaluationSnapshot<D>;
}

export interface SessionSnapshot {
	activeDimension: Dimension;
	showBasis: boolean;
	showGrid: boolean;
	animationMode: AnimationMode;
	animationActive: boolean;
	elapsedMs: number;
	workspaces: {
		2: WorkspaceSnapshot<2>;
		3: WorkspaceSnapshot<3>;
	};
	cameras: CameraSnapshots;
}

export function captureSessionSnapshot(
	state: AppState,
	elapsedMs: number,
	cameras: CameraSnapshots,
): SessionSnapshot {
	return {
		activeDimension: state.activeDimension,
		showBasis: state.showBasis,
		showGrid: state.showGrid,
		animationMode: state.animation.mode,
		animationActive: state.animation.status !== "idle",
		elapsedMs,
		workspaces: {
			2: captureWorkspace(
				state.workspaces[2],
				state.appliedTransforms[2],
			),
			3: captureWorkspace(
				state.workspaces[3],
				state.appliedTransforms[3],
			),
		},
		cameras,
	};
}

export function restoreSessionSnapshot(
	snapshot: SessionSnapshot,
	createId: () => string = () => crypto.randomUUID(),
): AppState {
	const state = createInitialState(createId);
	restoreWorkspace(state.workspaces[2], snapshot.workspaces[2], createId);
	restoreWorkspace(state.workspaces[3], snapshot.workspaces[3], createId);
	state.appliedTransforms[2] = cloneMatrix<2>(
		snapshot.workspaces[2].appliedTransform,
	);
	state.appliedTransforms[3] = cloneMatrix<3>(
		snapshot.workspaces[3].appliedTransform,
	);
	const activeWorkspace =
		snapshot.activeDimension === 2
			? state.workspaces[2]
			: state.workspaces[3];
	const animation: PlaybackState =
		snapshot.animationActive &&
		activeWorkspace.validity.valid &&
		canRenderWorkspace(activeWorkspace)
			? restorePausedPlayback(snapshot.animationMode, snapshot.elapsedMs)
			: {
					mode: snapshot.animationMode,
					status: "idle",
					elapsedMs: 0,
					runningSinceMs: 0,
				};
	state.activeDimension = snapshot.activeDimension;
	state.showBasis = snapshot.showBasis;
	state.showGrid = snapshot.showGrid;
	state.animation = animation;
	return state;
}

function captureWorkspace<D extends Dimension>(
	workspace: Workspace<D>,
	appliedTransform: MatrixFor<D>,
): WorkspaceSnapshot<D> {
	return {
		matrices: workspace.matrices.map(captureMatrix),
		vectors: workspace.vectors.map(captureVector),
		appliedTransform: cloneMatrix(appliedTransform),
		lastValidEvaluation: {
			matrices: workspace.lastValidEvaluation.matrices.map(
				captureEvaluatedMatrix,
			),
			vectors: workspace.lastValidEvaluation.vectors.map(
				captureEvaluatedVector,
			),
		},
	};
}

function restoreWorkspace<D extends Dimension>(
	workspace: Workspace<D>,
	snapshot: WorkspaceSnapshot<D>,
	createId: () => string,
): void {
	const dimension = workspace.dimension;
	const document = snapshotToDocument(dimension, snapshot, createId);
	if (
		snapshot.appliedTransform.length !== dimension ** 2 ||
		snapshot.appliedTransform.some(
			(value) =>
				!Number.isFinite(value) ||
				Math.abs(value) > MAX_RENDER_TRANSFORM_VALUE,
		) ||
		!restoreWorkspaceState(
			workspace,
			document,
			evaluationToDocument(
				dimension,
				snapshot.lastValidEvaluation,
				document,
			),
		)
	)
		throw new Error("Invalid workspace snapshot");
}

function snapshotToDocument<D extends Dimension>(
	dimension: D,
	snapshot: WorkspaceSnapshot<D>,
	createId: () => string,
): WorkspaceDocument<D> {
	return {
		dimension,
		matrices: snapshot.matrices.map((matrix) =>
			restoreMatrix(dimension, matrix, createId),
		),
		vectors: snapshot.vectors.map((vector) =>
			restoreVector(dimension, vector, createId),
		),
	};
}

function evaluationToDocument<D extends Dimension>(
	dimension: D,
	evaluation: WorkspaceEvaluationSnapshot<D>,
	document: WorkspaceDocument<D>,
): WorkspaceDocument<D> {
	const matchingId = (
		kind: "matrix" | "vector",
		index: number,
		label: string,
	): string => {
		const nodes = kind === "matrix" ? document.matrices : document.vectors;
		return nodes[index]?.label === label
			? nodes[index].id
			: `evaluation-${kind}-${index}`;
	};
	return {
		dimension,
		matrices: evaluation.matrices.map((matrix, index) => ({
			id: matchingId("matrix", index, matrix.label),
			dimension,
			label: matrix.label,
			entries: matrix.values.map(String),
			durationMs: matrix.durationMs,
		})),
		vectors: evaluation.vectors.map((vector, index) => ({
			id: matchingId("vector", index, vector.label),
			dimension,
			label: vector.label,
			coordinates: vector.values.map(String),
			color: vector.color,
		})),
	};
}

function captureMatrix<D extends Dimension>(
	matrix: MatrixNode<D>,
): MatrixSnapshot {
	return {
		label: matrix.label,
		entries: [...matrix.entries],
		durationMs: matrix.durationMs,
	};
}

function captureVector<D extends Dimension>(
	vector: VectorNode<D>,
): VectorSnapshot {
	return {
		label: vector.label,
		coordinates: [...vector.coordinates],
		color: vector.color,
	};
}

function captureEvaluatedMatrix<D extends Dimension>(
	matrix: EvaluatedMatrix<D>,
): Omit<EvaluatedMatrix<D>, "id"> {
	return {
		label: matrix.label,
		values: cloneMatrix(matrix.values),
		durationMs: matrix.durationMs,
	};
}

function captureEvaluatedVector<D extends Dimension>(
	vector: EvaluatedVector<D>,
): EvaluatedVectorSnapshot<D> {
	return {
		label: vector.label,
		values: [...vector.coordinates] as VectorFor<D>,
		color: vector.color,
	};
}

function restoreMatrix<D extends Dimension>(
	dimension: D,
	matrix: MatrixSnapshot,
	createId: () => string,
): MatrixNode<D> {
	return {
		id: createId(),
		dimension,
		label: matrix.label,
		entries: [...matrix.entries],
		durationMs: matrix.durationMs,
	};
}

function restoreVector<D extends Dimension>(
	dimension: D,
	vector: VectorSnapshot,
	createId: () => string,
): VectorNode<D> {
	return {
		id: createId(),
		dimension,
		label: vector.label,
		coordinates: [...vector.coordinates],
		color: vector.color,
	};
}
