import { Dimension, MatrixFor, VectorFor, identityMatrix } from "./math";
import {
	type WorkspaceEvaluation,
	type WorkspaceValidity,
	evaluateWorkspace,
	validateWorkspaceDocument,
} from "./workspace-evaluation";
export {
	type EvaluatedMatrix,
	type EvaluatedVector,
	type WorkspaceEvaluation,
	type WorkspaceStructuralError,
	type WorkspaceValidity,
	evaluateWorkspace,
	getTransformedVectors,
	validateWorkspaceDocument,
} from "./workspace-evaluation";
import {
	MAX_ABSOLUTE_INPUT_VALUE,
	MAX_MATRIX_DURATION_MS,
	MAX_WORKSPACE_NODES,
	MIN_MATRIX_DURATION_MS,
} from "./policy";
export { MAX_ABSOLUTE_INPUT_VALUE, MAX_WORKSPACE_NODES } from "./policy";
import type {
	MatrixNode,
	VectorNode,
	WorkspaceDocument,
} from "./workspace-types";
export type {
	MatrixNode,
	VectorNode,
	WorkspaceDocument,
} from "./workspace-types";

export type AnyMatrixNode = MatrixNode<2> | MatrixNode<3>;
export type AnyVectorNode = VectorNode<2> | VectorNode<3>;
export type AnyWorkspace = Workspace<2> | Workspace<3>;

export interface Workspace<D extends Dimension> extends WorkspaceDocument<D> {
	matrices: MatrixNode<D>[];
	vectors: VectorNode<D>[];
	validity: WorkspaceValidity;
	lastValidEvaluation: WorkspaceEvaluation<D>;
}

let localIdSequence = 0;

function createLocalId(): string {
	localIdSequence += 1;
	return `node-${localIdSequence}`;
}

export function createWorkspace<D extends Dimension>(
	dimension: D,
	createId: () => string = createLocalId,
): Workspace<D> {
	const matrixId = createId();
	const vectorId = createId();
	if (matrixId === vectorId)
		throw new Error("Workspace node IDs must be unique");
	const document: WorkspaceDocument<D> = {
		dimension,
		matrices: [
			createMatrixNode(dimension, "A", undefined, undefined, matrixId),
		],
		vectors: [
			createVectorNode(
				dimension,
				"v1",
				"#f4b740",
				undefined,
				undefined,
				vectorId,
			),
		],
	};
	const result = evaluateWorkspace(document);
	const evaluation = result.evaluation;
	if (!evaluation) throw new Error("Failed to create a valid workspace");
	return {
		dimension,
		matrices: [...document.matrices],
		vectors: [...document.vectors],
		validity: result.validity,
		lastValidEvaluation: evaluation,
	};
}

export function createMatrixNode<D extends Dimension>(
	dimension: D,
	label: string,
	values?: MatrixFor<D>,
	draftValues?: readonly string[],
	id = createLocalId(),
): MatrixNode<D> {
	const nextValues = values ?? identityMatrix(dimension);
	assertNumericShape(nextValues, dimension ** 2);
	if (draftValues) assertStringShape(draftValues, dimension ** 2);
	return {
		id,
		dimension,
		label,
		entries: [...(draftValues ?? Array.from(nextValues, String))],
		durationMs: 900,
	};
}

export function createVectorNode<D extends Dimension>(
	dimension: D,
	label: string,
	color: string,
	components?: VectorFor<D>,
	draftComponents?: readonly string[],
	id = createLocalId(),
): VectorNode<D> {
	const nextComponents =
		components ?? ((dimension === 2 ? [1, 1] : [1, 1, 1]) as VectorFor<D>);
	assertNumericShape(nextComponents, dimension);
	if (draftComponents) assertStringShape(draftComponents, dimension);
	return {
		id,
		dimension,
		label,
		coordinates: [
			...(draftComponents ?? Array.from(nextComponents, String)),
		],
		color,
	};
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
): boolean {
	const validation = validateWorkspaceMatrices(workspace, matrices);
	if (!validation) return false;
	workspace.matrices = matrices;
	refreshWorkspace(workspace);
	return true;
}

export function validateWorkspaceMatrices<D extends Dimension>(
	workspace: Workspace<D>,
	matrices: MatrixNode<D>[],
): boolean {
	return validateMutation({
		dimension: workspace.dimension,
		matrices,
		vectors: workspace.vectors,
	});
}

export function replaceWorkspaceVectors<D extends Dimension>(
	workspace: Workspace<D>,
	vectors: VectorNode<D>[],
): boolean {
	const validation = validateMutation({
		dimension: workspace.dimension,
		matrices: workspace.matrices,
		vectors,
	});
	if (!validation) return false;
	workspace.vectors = vectors;
	refreshWorkspace(workspace);
	return true;
}

export function setMatrixDuration<D extends Dimension>(
	workspace: Workspace<D>,
	matrixId: string,
	durationMs: number,
): boolean {
	const matrix = workspace.matrices.find((item) => item.id === matrixId);
	if (!matrix || !Number.isFinite(durationMs)) return false;
	matrix.durationMs = Math.max(
		MIN_MATRIX_DURATION_MS,
		Math.min(MAX_MATRIX_DURATION_MS, durationMs),
	);
	refreshWorkspace(workspace);
	return true;
}

export function setMatrixEntrySource<D extends Dimension>(
	workspace: Workspace<D>,
	matrixId: string,
	index: number,
	source: string,
): boolean {
	const matrix = workspace.matrices.find((item) => item.id === matrixId);
	if (!matrix) return false;
	if (!Number.isInteger(index) || matrix.entries[index] === undefined)
		return false;
	if (typeof source !== "string") return false;
	matrix.entries[index] = source;
	refreshWorkspace(workspace);
	return true;
}

export function setVectorCoordinateSource<D extends Dimension>(
	workspace: Workspace<D>,
	vectorId: string,
	index: number,
	source: string,
): boolean {
	const vector = workspace.vectors.find((item) => item.id === vectorId);
	if (!vector) return false;
	if (!Number.isInteger(index) || vector.coordinates[index] === undefined)
		return false;
	if (typeof source !== "string") return false;
	vector.coordinates[index] = source;
	refreshWorkspace(workspace);
	return true;
}

function refreshWorkspace<D extends Dimension>(workspace: Workspace<D>): void {
	const result = evaluateWorkspace(workspace);
	workspace.validity = result.validity;
	if (result.evaluation) workspace.lastValidEvaluation = result.evaluation;
}

export function restoreWorkspaceState<D extends Dimension>(
	workspace: Workspace<D>,
	document: WorkspaceDocument<D>,
	fallbackDocument: WorkspaceDocument<D>,
): boolean {
	if (
		document.dimension !== workspace.dimension ||
		fallbackDocument.dimension !== workspace.dimension
	)
		return false;
	const structuralError = validateWorkspaceDocument(document)[0];
	if (structuralError) return false;
	const current = evaluateWorkspace(document);
	const fallback = current.evaluation
		? current.evaluation
		: evaluateWorkspace(fallbackDocument).evaluation;
	if (!fallback) return false;

	workspace.matrices = [...document.matrices];
	workspace.vectors = [...document.vectors];
	workspace.validity = current.validity;
	workspace.lastValidEvaluation = fallback;
	return true;
}

function validateMutation<D extends Dimension>(
	document: WorkspaceDocument<D>,
): boolean {
	const error = validateWorkspaceDocument(document)[0];
	return !error || error === "invalid-dimension";
}

function assertNumericShape(values: readonly number[], length: number): void {
	if (
		values.length !== length ||
		!values.every(
			(value) =>
				Number.isFinite(value) &&
				Math.abs(value) <= MAX_ABSOLUTE_INPUT_VALUE,
		)
	)
		throw new Error("Invalid numeric values");
}

function assertStringShape(values: readonly string[], length: number): void {
	if (
		values.length !== length ||
		!values.every((value) => typeof value === "string")
	)
		throw new Error("Invalid draft values");
}
