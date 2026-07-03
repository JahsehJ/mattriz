import { evaluateExpression } from "../math/expression";
import {
	type Dimension,
	type MatrixFor,
	type VectorFor,
	applyMatrixToVector,
	composeMathNotation,
} from "../math/matrix";
import {
	MAX_ABSOLUTE_INPUT_VALUE,
	MAX_EXPRESSION_LENGTH,
	MAX_MATRIX_DURATION_MS,
	MAX_WORKSPACE_NODES,
	MIN_MATRIX_DURATION_MS,
} from "./policy";
import type { WorkspaceDocument } from "./workspace-types";

function evaluateInputExpression(source: string): number | null {
	if (source.length > MAX_EXPRESSION_LENGTH) return null;
	const value = evaluateExpression(source);
	return value !== null && Math.abs(value) <= MAX_ABSOLUTE_INPUT_VALUE
		? value
		: null;
}

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
	readonly diagnostics: readonly WorkspaceDiagnostic[];
	readonly valid: boolean;
}

export type WorkspaceDiagnosticCode =
	| "invalid-dimension"
	| "node-limit-exceeded"
	| "duplicate-node-id"
	| "dimension-mismatch"
	| "invalid-entry-count"
	| "invalid-entry-type"
	| "invalid-duration"
	| "invalid-expression";

export interface WorkspaceDiagnostic {
	readonly code: WorkspaceDiagnosticCode;
	readonly nodeId?: string;
	readonly field?: "matrix-entry" | "vector-coordinate" | "duration";
	readonly index?: number;
}

export function evaluateWorkspace<D extends Dimension>(
	workspace: WorkspaceDocument<D>,
): { validity: WorkspaceValidity; evaluation: WorkspaceEvaluation<D> | null } {
	const diagnostics = validateWorkspaceDocument(workspace);
	const matrixValues = workspace.matrices.map((matrix) => {
		const values = matrix.entries.map((source, index) => {
			const value =
				typeof source === "string"
					? evaluateInputExpression(source)
					: null;
			if (typeof source === "string" && value === null)
				diagnostics.push({
					code: "invalid-expression",
					nodeId: matrix.id,
					field: "matrix-entry",
					index,
				});
			return value;
		});
		return values;
	});
	const vectorValues = workspace.vectors.map((vector) => {
		const values = vector.coordinates.map((source, index) => {
			const value =
				typeof source === "string"
					? evaluateInputExpression(source)
					: null;
			if (typeof source === "string" && value === null)
				diagnostics.push({
					code: "invalid-expression",
					nodeId: vector.id,
					field: "vector-coordinate",
					index,
				});
			return value;
		});
		return values;
	});
	const valid = diagnostics.length === 0;
	const validity = {
		diagnostics,
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
): WorkspaceDiagnostic[] {
	const diagnostics: WorkspaceDiagnostic[] = [];
	const dimension = workspace.dimension;
	const addDocumentDiagnostic = (code: WorkspaceDiagnosticCode) => {
		if (!diagnostics.some((diagnostic) => diagnostic.code === code))
			diagnostics.push({ code });
	};
	if (dimension !== 2 && dimension !== 3)
		addDocumentDiagnostic("invalid-dimension");
	if (
		workspace.matrices.length > MAX_WORKSPACE_NODES ||
		workspace.vectors.length > MAX_WORKSPACE_NODES
	)
		addDocumentDiagnostic("node-limit-exceeded");
	if (hasDuplicateNodeIds([...workspace.matrices, ...workspace.vectors]))
		addDocumentDiagnostic("duplicate-node-id");
	for (const matrix of workspace.matrices) {
		if (matrix.dimension !== dimension)
			diagnostics.push({
				code: "dimension-mismatch",
				nodeId: matrix.id,
			});
		if (matrix.entries.length !== dimension ** 2)
			diagnostics.push({
				code: "invalid-entry-count",
				nodeId: matrix.id,
				field: "matrix-entry",
			});
		matrix.entries.forEach((entry, index) => {
			if (typeof entry !== "string")
				diagnostics.push({
					code: "invalid-entry-type",
					nodeId: matrix.id,
					field: "matrix-entry",
					index,
				});
		});
		if (
			!Number.isFinite(matrix.durationMs) ||
			matrix.durationMs < MIN_MATRIX_DURATION_MS ||
			matrix.durationMs > MAX_MATRIX_DURATION_MS
		)
			diagnostics.push({
				code: "invalid-duration",
				nodeId: matrix.id,
				field: "duration",
			});
	}
	for (const vector of workspace.vectors) {
		if (vector.dimension !== dimension)
			diagnostics.push({
				code: "dimension-mismatch",
				nodeId: vector.id,
			});
		if (vector.coordinates.length !== dimension)
			diagnostics.push({
				code: "invalid-entry-count",
				nodeId: vector.id,
				field: "vector-coordinate",
			});
		vector.coordinates.forEach((entry, index) => {
			if (typeof entry !== "string")
				diagnostics.push({
					code: "invalid-entry-type",
					nodeId: vector.id,
					field: "vector-coordinate",
					index,
				});
		});
	}
	return diagnostics;
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
