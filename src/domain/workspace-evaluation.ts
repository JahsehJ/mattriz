import { evaluateBoundedExpression } from "./expression";
import {
	type Dimension,
	type MatrixFor,
	type VectorFor,
	applyMatrixToVector,
	composeMathNotation,
} from "./math";
import {
	MAX_ABSOLUTE_INPUT_VALUE,
	MAX_MATRIX_DURATION_MS,
	MAX_WORKSPACE_NODES,
	MIN_MATRIX_DURATION_MS,
} from "./policy";
import type { WorkspaceDocument } from "./workspace-types";

export interface EvaluatedMatrix<D extends Dimension> {
	readonly id: string;
	readonly label: string;
	readonly values: MatrixFor<D>;
	readonly durationMs: number;
}

export interface EvaluatedVector<D extends Dimension> {
	readonly id: string;
	readonly label: string;
	readonly coordinates: VectorFor<D>;
	readonly color: string;
}

export interface WorkspaceEvaluation<D extends Dimension> {
	readonly dimension: D;
	readonly matrices: readonly EvaluatedMatrix<D>[];
	readonly vectors: readonly EvaluatedVector<D>[];
	readonly totalTransform: MatrixFor<D>;
}

export interface WorkspaceValidity {
	readonly matrixEntries: Readonly<Record<string, readonly boolean[]>>;
	readonly vectorCoordinates: Readonly<Record<string, readonly boolean[]>>;
	readonly structuralErrors: readonly WorkspaceStructuralError[];
	readonly valid: boolean;
}

export type WorkspaceStructuralError =
	| "invalid-dimension"
	| "node-limit-exceeded"
	| "duplicate-node-id"
	| "dimension-mismatch"
	| "invalid-entry-count"
	| "invalid-entry-type"
	| "invalid-duration";

export function evaluateWorkspace<D extends Dimension>(
	workspace: WorkspaceDocument<D>,
): { validity: WorkspaceValidity; evaluation: WorkspaceEvaluation<D> | null } {
	const matrixEntries: Record<string, boolean[]> = {};
	const vectorCoordinates: Record<string, boolean[]> = {};
	const structuralErrors = validateWorkspaceDocument(workspace);
	const matrixValues = workspace.matrices.map((matrix) => {
		const values = matrix.entries.map((source) =>
			typeof source === "string"
				? evaluateBoundedExpression(source, MAX_ABSOLUTE_INPUT_VALUE)
				: null,
		);
		matrixEntries[matrix.id] = values.map((value) => value !== null);
		return values;
	});
	const vectorValues = workspace.vectors.map((vector) => {
		const values = vector.coordinates.map((source) =>
			typeof source === "string"
				? evaluateBoundedExpression(source, MAX_ABSOLUTE_INPUT_VALUE)
				: null,
		);
		vectorCoordinates[vector.id] = values.map((value) => value !== null);
		return values;
	});
	const valid =
		structuralErrors.length === 0 &&
		[...matrixValues, ...vectorValues].every((values) =>
			values.every((value) => value !== null),
		);
	const validity = {
		matrixEntries,
		vectorCoordinates,
		structuralErrors,
		valid,
	};
	if (!valid) return { validity, evaluation: null };
	const matrices = workspace.matrices.map((matrix, index) => ({
		id: matrix.id,
		label: matrix.label,
		values: matrixValues[index] as MatrixFor<D>,
		durationMs: matrix.durationMs,
	}));
	const vectors = workspace.vectors.map((vector, index) => ({
		id: vector.id,
		label: vector.label,
		coordinates: vectorValues[index] as VectorFor<D>,
		color: vector.color,
	}));
	return {
		validity,
		evaluation: {
			dimension: workspace.dimension,
			matrices,
			vectors,
			totalTransform: composeMathNotation(
				workspace.dimension,
				matrices.map((matrix) => matrix.values),
			),
		},
	};
}

export function getTransformedVectors<D extends Dimension>(
	evaluation: WorkspaceEvaluation<D>,
): VectorFor<D>[] {
	return evaluation.vectors.map((vector) =>
		applyMatrixToVector(
			evaluation.dimension,
			evaluation.totalTransform,
			vector.coordinates,
		),
	);
}

export function validateWorkspaceDocument<D extends Dimension>(
	workspace: WorkspaceDocument<D>,
): WorkspaceStructuralError[] {
	const errors = new Set<WorkspaceStructuralError>();
	const dimension = workspace.dimension;
	if (dimension !== 2 && dimension !== 3) errors.add("invalid-dimension");
	if (
		workspace.matrices.length > MAX_WORKSPACE_NODES ||
		workspace.vectors.length > MAX_WORKSPACE_NODES
	)
		errors.add("node-limit-exceeded");
	if (hasDuplicateNodeIds([...workspace.matrices, ...workspace.vectors]))
		errors.add("duplicate-node-id");
	for (const matrix of workspace.matrices) {
		if (matrix.dimension !== dimension) errors.add("dimension-mismatch");
		if (matrix.entries.length !== dimension ** 2)
			errors.add("invalid-entry-count");
		if (matrix.entries.some((entry) => typeof entry !== "string"))
			errors.add("invalid-entry-type");
		if (
			!Number.isFinite(matrix.durationMs) ||
			matrix.durationMs < MIN_MATRIX_DURATION_MS ||
			matrix.durationMs > MAX_MATRIX_DURATION_MS
		)
			errors.add("invalid-duration");
	}
	for (const vector of workspace.vectors) {
		if (vector.dimension !== dimension) errors.add("dimension-mismatch");
		if (vector.coordinates.length !== dimension)
			errors.add("invalid-entry-count");
		if (vector.coordinates.some((entry) => typeof entry !== "string"))
			errors.add("invalid-entry-type");
	}
	return [...errors];
}

function hasDuplicateNodeIds(nodes: readonly unknown[]): boolean {
	const ids = nodes.map((node) =>
		isRecord(node) && typeof node.id === "string" ? node.id : null,
	);
	return ids.includes(null) || new Set(ids).size !== nodes.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
