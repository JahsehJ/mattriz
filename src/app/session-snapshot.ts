import {
	type Dimension,
	type MatrixFor,
	type VectorFor,
	cloneMatrix,
} from "../domain/math";
import { type Workspace, restoreWorkspaceState } from "../domain/workspace";
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

export interface MatrixSnapshot {
	label: string;
	sources: string[];
	durationMs: number;
}

export interface VectorSnapshot {
	label: string;
	sources: string[];
	color: string;
}

export interface WorkspaceEvaluationSnapshot<D extends Dimension> {
	matrices: { label: string; values: MatrixFor<D>; durationMs: number }[];
	vectors: { label: string; values: VectorFor<D>; color: string }[];
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

export function restoreSessionSnapshot(snapshot: SessionSnapshot): AppState {
	const state = createInitialState(() => crypto.randomUUID());
	restoreWorkspace(state.workspaces[2], snapshot.workspaces[2]);
	restoreWorkspace(state.workspaces[3], snapshot.workspaces[3]);
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
		matrices: workspace.matrices.map((matrix) => ({
			label: matrix.label,
			sources: [...matrix.entries],
			durationMs: matrix.durationMs,
		})),
		vectors: workspace.vectors.map((vector) => ({
			label: vector.label,
			sources: [...vector.coordinates],
			color: vector.color,
		})),
		appliedTransform: cloneMatrix(appliedTransform),
		lastValidEvaluation: {
			matrices: workspace.lastValidEvaluation.matrices.map((matrix) => ({
				label: matrix.label,
				values: cloneMatrix(matrix.values),
				durationMs: matrix.durationMs,
			})),
			vectors: workspace.lastValidEvaluation.vectors.map((vector) => ({
				label: vector.label,
				values: [...vector.coordinates] as VectorFor<D>,
				color: vector.color,
			})),
		},
	};
}

function restoreWorkspace<D extends Dimension>(
	workspace: Workspace<D>,
	snapshot: WorkspaceSnapshot<D>,
): void {
	const dimension = workspace.dimension;
	const matrices = snapshot.matrices.map((matrix) => ({
		id: crypto.randomUUID(),
		dimension,
		label: matrix.label,
		entries: [...matrix.sources],
		durationMs: matrix.durationMs,
	}));
	const vectors = snapshot.vectors.map((vector) => ({
		id: crypto.randomUUID(),
		dimension,
		label: vector.label,
		coordinates: [...vector.sources],
		color: vector.color,
	}));
	if (
		snapshot.appliedTransform.length !== dimension ** 2 ||
		snapshot.appliedTransform.some(
			(value) =>
				!Number.isFinite(value) ||
				Math.abs(value) > MAX_RENDER_TRANSFORM_VALUE,
		) ||
		!restoreWorkspaceState(
			workspace,
			{ dimension, matrices, vectors },
			{
				dimension,
				matrices: snapshot.lastValidEvaluation.matrices.map(
					(matrix, index) => ({
						id:
							matrices[index]?.label === matrix.label
								? matrices[index].id
								: `evaluation-matrix-${index}`,
						dimension,
						label: matrix.label,
						entries: matrix.values.map(String),
						durationMs: matrix.durationMs,
					}),
				),
				vectors: snapshot.lastValidEvaluation.vectors.map(
					(vector, index) => ({
						id:
							vectors[index]?.label === vector.label
								? vectors[index].id
								: `evaluation-vector-${index}`,
						dimension,
						label: vector.label,
						coordinates: vector.values.map(String),
						color: vector.color,
					}),
				),
			},
		)
	)
		throw new Error("Invalid workspace snapshot");
}
