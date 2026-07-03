import {
	type MatrixFor,
	type VectorFor,
	analyzeRealEigenbasis,
	analyzeRepresentativeRealEigenvector,
} from "../domain/math";
import { getMatrixPresets } from "../domain/presets";
import {
	type AnyWorkspace,
	areWorkspaceMatricesValid,
	canAddWorkspaceNodes,
	createMatrixNode,
	createVectorNode,
	recomputeWorkspace,
} from "../domain/workspace";
import {
	type MoveDirection,
	type MoveResult,
	moveItemBy,
	moveItemTo,
	nextMatrixLabel,
	nextVectorLabel,
	removeItem,
} from "./workspace-actions";

const VECTOR_COLORS = [
	"#f4b740",
	"#5bd8a6",
	"#ef6f6c",
	"#8fb4ff",
	"#d989ff",
	"#5ed5e8",
];

interface WorkspaceEditorOptions {
	getWorkspace(): AnyWorkspace;
	createId(): string;
	commit(): void;
}

export class WorkspaceEditor {
	constructor(private readonly options: WorkspaceEditorOptions) {}

	addMatrix(): void {
		const workspace = this.workspace;
		if (!canAddWorkspaceNodes(workspace, "matrices")) return;
		workspace.matrices.unshift(this.createMatrix());
		this.commit();
	}

	addVector(): void {
		const workspace = this.workspace;
		if (!canAddWorkspaceNodes(workspace, "vectors")) return;
		workspace.vectors.push(this.createVector());
		this.commit();
	}

	addMatrixPreset(presetId: string): void {
		const workspace = this.workspace;
		if (!canAddWorkspaceNodes(workspace, "matrices")) return;
		const preset = getMatrixPresets(workspace.dimension).find(
			(item) => item.id === presetId,
		);
		if (!preset) return;
		workspace.matrices.unshift(
			this.createMatrix(preset.values, preset.draftValues),
		);
		this.commit();
	}

	addEigenbasis(): void {
		const workspace = this.workspace;
		if (!areWorkspaceMatricesValid(workspace)) return;
		const result = analyzeRealEigenbasis(
			workspace.dimension,
			workspace.lastValidEvaluation.totalTransform,
		);
		if (
			result.kind !== "basis" ||
			!canAddWorkspaceNodes(workspace, "vectors", result.vectors.length)
		)
			return;
		const vectors = [...workspace.vectors];
		for (const components of result.vectors) {
			vectors.push(
				this.createVector(
					components,
					components.map(formatInputNumber),
					vectors,
				),
			);
		}
		workspace.vectors = vectors;
		this.commit();
	}

	addRepresentativeEigenvector(): void {
		const workspace = this.workspace;
		if (
			!areWorkspaceMatricesValid(workspace) ||
			!canAddWorkspaceNodes(workspace, "vectors")
		)
			return;
		const result = analyzeRepresentativeRealEigenvector(
			workspace.dimension,
			workspace.lastValidEvaluation.totalTransform,
		);
		if (result.kind !== "vector") return;
		workspace.vectors.push(
			this.createVector(
				result.vector,
				result.vector.map(formatInputNumber),
			),
		);
		this.commit();
	}

	deleteMatrix(id: string): void {
		this.mutateCollection(this.workspace.matrices, (matrices) =>
			removeItem(matrices, id),
		);
	}

	deleteVector(id: string): void {
		this.mutateCollection(this.workspace.vectors, (vectors) =>
			removeItem(vectors, id),
		);
	}

	moveMatrix(id: string, targetId: string, side: "before" | "after"): void {
		this.mutateCollection(this.workspace.matrices, (matrices) =>
			moveItemTo(matrices, id, targetId, side),
		);
	}

	moveVector(id: string, targetId: string, side: "before" | "after"): void {
		this.mutateCollection(this.workspace.vectors, (vectors) =>
			moveItemTo(vectors, id, targetId, side),
		);
	}

	moveItem(
		id: string,
		kind: "matrix" | "vector",
		direction: MoveDirection,
	): MoveResult {
		const move = <T extends { id: string }>(items: T[]) =>
			this.mutateCollection(items, (draft) =>
				moveItemBy(draft, id, direction),
			);
		return kind === "matrix"
			? move(this.workspace.matrices)
			: move(this.workspace.vectors);
	}

	private createMatrix(
		values?: MatrixFor<2 | 3>,
		draftValues?: readonly string[],
	) {
		const workspace = this.workspace;
		return createMatrixNode(
			workspace.dimension,
			nextMatrixLabel(workspace.matrices.map(({ label }) => label)),
			values,
			draftValues,
			this.options.createId(),
		);
	}

	private createVector(
		components?: readonly number[],
		draftComponents?: readonly string[],
		vectors = this.workspace.vectors,
	) {
		const workspace = this.workspace;
		const label = nextVectorLabel(vectors.map((vector) => vector.label));
		return createVectorNode(
			workspace.dimension,
			label,
			vectorColorForLabel(label),
			components as VectorFor<2 | 3> | undefined,
			draftComponents,
			this.options.createId(),
		);
	}

	private commit(): void {
		recomputeWorkspace(this.workspace);
		this.options.commit();
	}

	private mutateCollection<T extends { id: string }>(
		items: T[],
		mutate: (draft: T[]) => MoveResult,
	): MoveResult {
		const draft = [...items];
		const result = mutate(draft);
		if (!result.changed) return result;
		items.splice(0, items.length, ...draft);
		this.commit();
		return result;
	}

	private get workspace() {
		return this.options.getWorkspace();
	}
}

function vectorColorForLabel(label: string): string {
	const number = Number(label.slice(1));
	const index =
		Number.isInteger(number) && number > 0 ? number - 1 : hashString(label);
	return VECTOR_COLORS[index % VECTOR_COLORS.length];
}

function hashString(value: string): number {
	let hash = 0;
	for (const character of value)
		hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
	return hash;
}

function formatInputNumber(value: number): string {
	const rounded = Math.abs(value) < 0.0000000001 ? 0 : value;
	return Number.isInteger(rounded)
		? String(rounded)
		: Number(rounded.toPrecision(8)).toString();
}
