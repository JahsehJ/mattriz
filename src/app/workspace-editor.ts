import {
	analyzeRealEigenbasis,
	analyzeRepresentativeRealEigenvector,
} from "../math/eigensystem";
import type { MatrixFor, VectorFor } from "../math/matrix";
import { getMatrixPresets } from "./matrix-presets";
import {
	type AnyWorkspace,
	areWorkspaceMatricesValid,
	canAddWorkspaceNodes,
	createMatrixNode,
	createVectorNode,
} from "./workspace";
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
		this.options.commit();
	}

	addVector(): void {
		const workspace = this.workspace;
		if (!canAddWorkspaceNodes(workspace, "vectors")) return;
		workspace.vectors.push(this.createVector());
		this.options.commit();
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
		this.options.commit();
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
		this.options.commit();
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
		this.options.commit();
	}

	deleteItem(kind: "matrix" | "vector", id: string): void {
		const remove = <T extends { id: string }>(items: T[]) =>
			this.mutateCollection(items, (draft) => removeItem(draft, id));
		if (kind === "matrix") remove(this.workspace.matrices);
		else remove(this.workspace.vectors);
	}

	moveItemTo(
		kind: "matrix" | "vector",
		id: string,
		targetId: string,
		side: "before" | "after",
	): void {
		const move = <T extends { id: string }>(items: T[]) =>
			this.mutateCollection(items, (draft) =>
				moveItemTo(draft, id, targetId, side),
			);
		if (kind === "matrix") move(this.workspace.matrices);
		else move(this.workspace.vectors);
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

	private mutateCollection<T extends { id: string }>(
		items: T[],
		mutate: (draft: T[]) => MoveResult,
	): MoveResult {
		const draft = [...items];
		const result = mutate(draft);
		if (!result.changed) return result;
		items.splice(0, items.length, ...draft);
		this.options.commit();
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
