import { Dimension, MatrixFor, VectorFor, identityMatrix } from "./math";
import {
	type WorkspaceEvaluation,
	type WorkspaceValidity,
	evaluateWorkspace,
	validateWorkspaceDocument,
} from "./workspace-evaluation";
import { MAX_ABSOLUTE_INPUT_VALUE, MAX_WORKSPACE_NODES } from "./policy";
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

export type AnyMatrixNode = MatrixNode<Dimension>;
export type AnyWorkspace = Workspace<Dimension>;

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

export function areWorkspaceMatricesValid<D extends Dimension>(
	workspace: Workspace<D>,
): boolean {
	return (
		workspace.validity.structuralErrors.length === 0 &&
		workspace.matrices.every((matrix) => {
			const entries = workspace.validity.matrixEntries[matrix.id];
			return (
				entries?.length === workspace.dimension ** 2 &&
				entries.every(Boolean)
			);
		})
	);
}

export function recomputeWorkspace<D extends Dimension>(
	workspace: Workspace<D>,
): void {
	const result = evaluateWorkspace(workspace);
	workspace.validity = result.validity;
	if (result.evaluation) workspace.lastValidEvaluation = result.evaluation;
}

export function restoreWorkspaceState<D extends Dimension>(
	workspace: Workspace<D>,
	document: WorkspaceDocument<D>,
	fallbackEvaluation: WorkspaceEvaluation<D>,
): boolean {
	if (
		document.dimension !== workspace.dimension ||
		fallbackEvaluation.dimension !== workspace.dimension
	)
		return false;
	const structuralError = validateWorkspaceDocument(document)[0];
	if (structuralError) return false;
	const current = evaluateWorkspace(document);

	workspace.matrices = [...document.matrices];
	workspace.vectors = [...document.vectors];
	workspace.validity = current.validity;
	workspace.lastValidEvaluation = current.evaluation ?? fallbackEvaluation;
	return true;
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
