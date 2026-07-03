import type { Dimension, MatrixFor, VectorFor } from "../domain/math";
import {
	type AppState,
	type Workspace,
	getMatrixValues,
	getVectorValues,
	replaceWorkspaceMatrices,
	replaceWorkspaceVectors,
} from "../domain/state";
import type { AnimationMode } from "../domain/animation";
import { createNumericCells } from "../domain/numeric-editor";
import { canRenderWorkspace } from "../rendering/capability";
import { MAX_RENDER_TRANSFORM_VALUE } from "../domain/policy";

export interface CameraSnapshot {
	position: [number, number, number];
	target: [number, number, number];
	zoom: number;
}

export interface CameraSnapshots {
	2: CameraSnapshot;
	3: CameraSnapshot;
}

export interface MatrixSnapshot<D extends Dimension> {
	label: string;
	sources: string[];
	values: MatrixFor<D>;
	durationMs: number;
}

export interface VectorSnapshot<D extends Dimension> {
	label: string;
	sources: string[];
	values: VectorFor<D>;
	color: string;
}

export interface WorkspaceSnapshot<D extends Dimension> {
	matrices: MatrixSnapshot<D>[];
	vectors: VectorSnapshot<D>[];
	appliedTransform: MatrixFor<D>;
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
			2: captureWorkspace(state.workspaces[2]),
			3: captureWorkspace(state.workspaces[3]),
		},
		cameras,
	};
}

export function restoreSessionSnapshot(snapshot: SessionSnapshot): AppState {
	return {
		activeDimension: snapshot.activeDimension,
		showBasis: snapshot.showBasis,
		showGrid: snapshot.showGrid,
		workspaces: {
			2: restoreWorkspace(2, snapshot.workspaces[2]),
			3: restoreWorkspace(3, snapshot.workspaces[3]),
		},
		animation: {
			mode: snapshot.animationMode,
			status: snapshot.animationActive ? "paused" : "idle",
			startedAt: 0,
			pausedAt: 0,
		},
	};
}

function captureWorkspace<D extends Dimension>(
	workspace: Workspace<D>,
): WorkspaceSnapshot<D> {
	return {
		matrices: workspace.matrices.map((matrix) => ({
			label: matrix.label,
			sources: matrix.entries.map((entry) => entry.source),
			values: getMatrixValues(matrix),
			durationMs: matrix.durationMs,
		})),
		vectors: workspace.vectors.map((vector) => ({
			label: vector.label,
			sources: vector.coordinates.map((coordinate) => coordinate.source),
			values: getVectorValues(vector),
			color: vector.color,
		})),
		appliedTransform: [...workspace.appliedTransform] as MatrixFor<D>,
	};
}

function restoreWorkspace<D extends Dimension>(
	dimension: D,
	snapshot: WorkspaceSnapshot<D>,
): Workspace<D> {
	const workspace: Workspace<D> = {
		dimension,
		matrices: [],
		vectors: [],
		appliedTransform: [...snapshot.appliedTransform] as MatrixFor<D>,
	};
	const matrices = snapshot.matrices.map((matrix) => ({
		id: crypto.randomUUID(),
		dimension,
		label: matrix.label,
		entries: createNumericCells(matrix.values, matrix.sources),
		durationMs: matrix.durationMs,
	}));
	const vectors = snapshot.vectors.map((vector) => ({
		id: crypto.randomUUID(),
		dimension,
		label: vector.label,
		coordinates: createNumericCells(vector.values, vector.sources),
		color: vector.color,
	}));
	if (
		snapshot.appliedTransform.some(
			(value) =>
				!Number.isFinite(value) ||
				Math.abs(value) > MAX_RENDER_TRANSFORM_VALUE,
		) ||
		!replaceWorkspaceMatrices(workspace, matrices, canRenderWorkspace)
			.accepted ||
		!replaceWorkspaceVectors(workspace, vectors).accepted
	)
		throw new Error("Invalid workspace snapshot");
	return workspace;
}
