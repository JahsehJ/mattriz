import {
	Dimension,
	MatrixValues,
	VectorValues,
	composeMathNotation,
	identityMatrix,
	lerpMatrix,
	multiplyMatrix,
} from "./math";

export type AnimationMode = "steps" | "composed";
export type PlaybackStatus = "idle" | "playing" | "paused";

export interface MatrixNode {
	id: string;
	label: string;
	values: MatrixValues;
	draftValues: string[];
	durationMs: number;
	easing: "linear";
}

export interface VectorNode {
	id: string;
	label: string;
	components: VectorValues;
	draftComponents: string[];
	color: string;
}

export interface Workspace {
	dimension: Dimension;
	matrices: MatrixNode[];
	vectors: VectorNode[];
	appliedTransform: MatrixValues;
}

export interface AnimationState {
	mode: AnimationMode;
	status: PlaybackStatus;
	startedAt: number;
	pausedAt: number;
}

export interface AppState {
	activeDimension: Dimension;
	workspaces: Record<Dimension, Workspace>;
	animation: AnimationState;
	showBasis: boolean;
}

export interface RenderState {
	dimension: Dimension;
	transform: MatrixValues;
	totalTransform: MatrixValues;
	vectors: VectorNode[];
	showBasis: boolean;
}

export interface ActiveStepProgress {
	matrixId: string;
	progress: number;
}

export function createInitialState(): AppState {
	const matrix2 = createMatrixNode(2, "A");
	const matrix3 = createMatrixNode(3, "A");
	const vector2 = createVectorNode(2, "v1", "#f4b740");
	const vector3 = createVectorNode(3, "v1", "#f4b740");

	return {
		activeDimension: 3,
		workspaces: {
			2: {
				dimension: 2,
				matrices: [matrix2],
				vectors: [vector2],
				appliedTransform: identityMatrix(2),
			},
			3: {
				dimension: 3,
				matrices: [matrix3],
				vectors: [vector3],
				appliedTransform: identityMatrix(3),
			},
		},
		animation: {
			mode: "steps",
			status: "idle",
			startedAt: 0,
			pausedAt: 0,
		},
		showBasis: true,
	};
}

export function createMatrixNode(
	dimension: Dimension,
	label: string,
	values?: MatrixValues,
): MatrixNode {
	const nextValues = values ?? identityMatrix(dimension);
	return {
		id: crypto.randomUUID(),
		label,
		values: nextValues,
		draftValues: Array.from(nextValues, String),
		durationMs: 900,
		easing: "linear",
	};
}

export function createVectorNode(
	dimension: Dimension,
	label: string,
	color: string,
): VectorNode {
	const components: VectorValues = dimension === 2 ? [1, 1] : [1, 1, 1];
	return {
		id: crypto.randomUUID(),
		label,
		components,
		draftComponents: Array.from(components, String),
		color,
	};
}

export function getWorkspace(state: AppState): Workspace {
	return state.workspaces[state.activeDimension];
}

export function getTotalTransform(workspace: Workspace): MatrixValues {
	return composeMathNotation(
		workspace.dimension,
		workspace.matrices.map((matrix) => matrix.values),
	);
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
		totalTransform,
		vectors: workspace.vectors,
		showBasis: state.showBasis,
	};
}

export function getAnimatedTransform(
	workspace: Workspace,
	animation: AnimationState,
	now: number,
	totalTransform = getTotalTransform(workspace),
): MatrixValues {
	if (animation.status === "idle") {
		return workspace.appliedTransform;
	}

	const elapsed = Math.max(
		0,
		(animation.status === "paused" ? animation.pausedAt : now) -
			animation.startedAt,
	);
	if (animation.mode === "composed") {
		const duration = Math.max(
			1,
			workspace.matrices.reduce(
				(sum, matrix) => sum + matrix.durationMs,
				0,
			),
		);
		return lerpMatrix(
			workspace.dimension,
			identityMatrix(workspace.dimension),
			totalTransform,
			elapsed / duration,
		);
	}

	return getStepTransform(workspace, elapsed);
}

export function getStepTransform(
	workspace: Workspace,
	elapsedMs: number,
): MatrixValues {
	let remaining = elapsedMs;
	let accumulated = identityMatrix(workspace.dimension);
	const applicationOrder = [...workspace.matrices].reverse();

	for (const matrix of applicationOrder) {
		const duration = Math.max(1, matrix.durationMs);
		if (remaining <= duration) {
			const partial = lerpMatrix(
				workspace.dimension,
				identityMatrix(workspace.dimension),
				matrix.values,
				remaining / duration,
			);
			return multiplyMatrix(workspace.dimension, partial, accumulated);
		}

		accumulated = multiplyMatrix(
			workspace.dimension,
			matrix.values,
			accumulated,
		);
		remaining -= duration;
	}

	return accumulated;
}

export function getActiveStepMatrixId(
	workspace: Workspace,
	animation: AnimationState,
	now: number,
): string | null {
	return getActiveStepProgress(workspace, animation, now)?.matrixId ?? null;
}

export function getActiveStepProgress(
	workspace: Workspace,
	animation: AnimationState,
	now: number,
): ActiveStepProgress | null {
	if (animation.status === "idle" || animation.mode !== "steps") return null;

	let remaining = Math.max(
		0,
		(animation.status === "paused" ? animation.pausedAt : now) -
			animation.startedAt,
	);
	const applicationOrder = [...workspace.matrices].reverse();

	for (const matrix of applicationOrder) {
		const duration = Math.max(1, matrix.durationMs);
		if (remaining <= duration) {
			return {
				matrixId: matrix.id,
				progress: remaining / duration,
			};
		}
		remaining -= duration;
	}

	return null;
}

export function getAnimationDuration(workspace: Workspace): number {
	return workspace.matrices.reduce(
		(sum, matrix) => sum + Math.max(1, matrix.durationMs),
		0,
	);
}
