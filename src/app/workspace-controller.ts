import {
	analyzeRealEigenbasis,
	analyzeRepresentativeRealEigenvector,
} from "../domain/math";
import { getMatrixPresets } from "../domain/presets";
import {
	type AppState,
	type AnyVectorNode,
	canAddWorkspaceNodes,
	createMatrixNode,
	createVectorNode,
	getTotalTransform,
	getWorkspace,
	replaceWorkspaceMatrices,
	replaceWorkspaceVectors,
	setMatrixDuration,
	validateMatrixValuesUpdate,
} from "../domain/state";
import {
	type NumericCell,
	type NumericCommitResult,
	getNumericCellError,
	updateNumericCellDraft,
} from "../domain/numeric-editor";
import {
	canRenderMatrixUpdate,
	canRenderWorkspace,
} from "../rendering/capability";
import type { Translate } from "../i18n";
import {
	type MoveDirection,
	moveItemBy,
	moveItemTo,
	nextMatrixLabel,
	nextVectorLabel,
} from "./workspace-actions";

const VECTOR_COLORS = [
	"#f4b740",
	"#5bd8a6",
	"#ef6f6c",
	"#8fb4ff",
	"#d989ff",
	"#5ed5e8",
];

interface WorkspaceControllerOptions {
	getState(): AppState;
	resetAnimation(renderStack?: boolean): void;
	updateResults(): void;
	updateMatrixWidth(input: HTMLInputElement): void;
	updateVectorWidths(input: HTMLInputElement): void;
}

export class WorkspaceController {
	constructor(
		private readonly root: HTMLElement,
		private readonly stack: HTMLElement,
		private readonly t: Translate,
		private readonly options: WorkspaceControllerOptions,
	) {}

	addMatrix(): void {
		const workspace = this.workspace;
		const matrix = createMatrixNode(
			workspace.dimension,
			nextMatrixLabel(workspace.matrices.map((matrix) => matrix.label)),
		);
		if (
			!replaceWorkspaceMatrices(
				workspace,
				[matrix, ...workspace.matrices],
				canRenderWorkspace,
			).accepted
		)
			return;
		this.options.resetAnimation();
	}

	addVector(): void {
		const workspace = this.workspace;
		const vector = createVectorNode(
			workspace.dimension,
			nextVectorLabel(workspace.vectors.map((vector) => vector.label)),
			this.nextVectorColor,
		);
		if (
			!replaceWorkspaceVectors(workspace, [...workspace.vectors, vector])
				.accepted
		)
			return;
		this.options.resetAnimation();
	}

	addMatrixPreset(presetId: string): void {
		const workspace = this.workspace;
		const preset = getMatrixPresets(workspace.dimension).find(
			(item) => item.id === presetId,
		);
		if (!preset) return;
		const matrix = createMatrixNode(
			workspace.dimension,
			nextMatrixLabel(workspace.matrices.map((matrix) => matrix.label)),
			preset.values,
			preset.draftValues,
		);
		if (
			!replaceWorkspaceMatrices(
				workspace,
				[matrix, ...workspace.matrices],
				canRenderWorkspace,
			).accepted
		) {
			return;
		}
		this.options.resetAnimation();
	}

	addEigenbasis(): void {
		const workspace = this.workspace;
		const result = analyzeRealEigenbasis(
			workspace.dimension,
			getTotalTransform(workspace),
		);
		const basis = result.kind === "basis" ? result.vectors : null;
		if (!basis || !canAddWorkspaceNodes(workspace, "vectors", basis.length))
			return;
		const vectors = [...workspace.vectors];
		for (const components of basis) {
			vectors.push(
				createVectorNode(
					workspace.dimension,
					nextVectorLabel(
						workspace.vectors.map((vector) => vector.label),
					),
					this.nextVectorColor,
					components,
					components.map(formatInputNumber),
				) as AnyVectorNode,
			);
		}
		if (!replaceWorkspaceVectors(workspace, vectors).accepted) return;
		this.options.resetAnimation();
	}

	addRepresentativeEigenvector(): void {
		const workspace = this.workspace;
		if (!canAddWorkspaceNodes(workspace, "vectors")) return;
		const result = analyzeRepresentativeRealEigenvector(
			workspace.dimension,
			getTotalTransform(workspace),
		);
		if (result.kind !== "vector") return;
		const vector = result.vector;
		const vectorNode = createVectorNode(
			workspace.dimension,
			nextVectorLabel(workspace.vectors.map((item) => item.label)),
			this.nextVectorColor,
			vector,
			vector.map(formatInputNumber),
		);
		if (
			!replaceWorkspaceVectors(workspace, [
				...workspace.vectors,
				vectorNode,
			]).accepted
		)
			return;
		this.options.resetAnimation();
	}

	deleteMatrix(id: string): void {
		const workspace = this.workspace;
		const matrices = workspace.matrices.filter(
			(matrix) => matrix.id !== id,
		);
		if (
			!replaceWorkspaceMatrices(workspace, matrices, canRenderWorkspace)
				.accepted
		)
			return;
		this.options.resetAnimation();
	}

	deleteVector(id: string): void {
		const workspace = this.workspace;
		if (
			!replaceWorkspaceVectors(
				workspace,
				workspace.vectors.filter((vector) => vector.id !== id),
			).accepted
		)
			return;
		this.options.resetAnimation();
	}

	moveMatrix(id: string, targetId: string, side: "before" | "after"): void {
		const workspace = this.workspace;
		const matrices = [...workspace.matrices];
		if (!moveItemTo(matrices, id, targetId, side).changed) return;
		if (
			!replaceWorkspaceMatrices(workspace, matrices, canRenderWorkspace)
				.accepted
		)
			return;
		this.options.resetAnimation();
	}

	moveVector(id: string, targetId: string, side: "before" | "after"): void {
		const workspace = this.workspace;
		const vectors = [...workspace.vectors];
		if (!moveItemTo(vectors, id, targetId, side).changed) return;
		if (!replaceWorkspaceVectors(workspace, vectors).accepted) return;
		this.options.resetAnimation();
	}

	moveFocusedItem(element: HTMLElement, direction: MoveDirection): void {
		const matrixId = element.dataset.matrixId;
		const vectorId = element.dataset.vectorColumnId;
		const id = matrixId ?? vectorId;
		if (!id) return;
		const workspace = this.workspace;
		const matrices = [...workspace.matrices];
		const vectors = [...workspace.vectors];
		const result = matrixId
			? moveItemBy(matrices, matrixId, direction)
			: moveItemBy(vectors, id, direction);
		if (!result.changed) return;
		const accepted = matrixId
			? replaceWorkspaceMatrices(workspace, matrices, canRenderWorkspace)
			: replaceWorkspaceVectors(workspace, vectors);
		if (!accepted.accepted) return;
		const items = matrixId ? workspace.matrices : workspace.vectors;
		const label = items[result.index].label;
		this.options.resetAnimation();

		const selector = matrixId
			? `.matrix-item[data-matrix-id="${CSS.escape(id)}"]`
			: `.vector-column-label[data-vector-column-id="${CSS.escape(id)}"]`;
		this.stack.querySelector<HTMLElement>(selector)?.focus();
		const status = this.root.querySelector<HTMLElement>(
			"[data-reorder-status]",
		);
		if (status) {
			status.textContent = this.t("reorderedItem", {
				label,
				position: result.index + 1,
				total: items.length,
			});
		}
	}

	handleInput(input: HTMLInputElement): void {
		if (input.dataset.durationId) {
			this.updateDuration(input.dataset.durationId, Number(input.value));
			return;
		}
		if (input.dataset.matrixId && input.dataset.entryIndex !== undefined) {
			this.options.updateMatrixWidth(input);
			this.updateMatrixEntry(
				input.dataset.matrixId,
				Number(input.dataset.entryIndex),
				input.value,
			);
			return;
		}
		if (
			input.dataset.vectorId &&
			input.dataset.componentIndex !== undefined
		) {
			this.options.updateVectorWidths(input);
			this.updateVectorComponent(
				input.dataset.vectorId,
				Number(input.dataset.componentIndex),
				input.value,
			);
		}
	}

	private updateMatrixEntry(id: string, index: number, value: string): void {
		const matrix = this.workspace.matrices.find((item) => item.id === id);
		if (!matrix) return;
		this.updateNumericDraft(
			matrix.entries,
			index,
			value,
			`input[data-matrix-id="${CSS.escape(id)}"]`,
			(values) =>
				validateMatrixValuesUpdate(
					this.workspace,
					id,
					values,
					(candidate) =>
						canRenderMatrixUpdate(this.workspace, id, candidate),
				),
		);
	}

	private updateVectorComponent(
		id: string,
		index: number,
		value: string,
	): void {
		const vector = this.workspace.vectors.find((item) => item.id === id);
		if (!vector) return;
		this.updateNumericDraft(
			vector.coordinates,
			index,
			value,
			`input[data-vector-id="${CSS.escape(id)}"]`,
			() => true,
		);
	}

	private updateDuration(id: string, value: number): void {
		const matrix = this.workspace.matrices.find((item) => item.id === id);
		if (!matrix || !setMatrixDuration(this.workspace, id, value)) return;
		this.options.resetAnimation(false);
		const output = this.stack.querySelector<HTMLElement>(
			`[data-duration-output="${CSS.escape(id)}"]`,
		);
		if (output) output.textContent = `${matrix.durationMs}ms`;
	}

	private updateNumericDraft(
		cells: NumericCell[],
		index: number,
		value: string,
		inputSelector: string,
		commit: (values: number[]) => NumericCommitResult | boolean,
	): void {
		if (!cells[index]) return;
		const committed = updateNumericCellDraft(cells, index, value, commit);
		this.stack
			.querySelectorAll<HTMLInputElement>(inputSelector)
			.forEach((input, inputIndex) => {
				input.toggleAttribute(
					"aria-invalid",
					cells[inputIndex] !== undefined &&
						getNumericCellError(cells[inputIndex]) !== null,
				);
			});
		if (!committed) return;
		this.options.resetAnimation(false);
		this.options.updateResults();
	}

	private get workspace() {
		return getWorkspace(this.options.getState());
	}

	private get nextVectorColor(): string {
		return VECTOR_COLORS[
			this.workspace.vectors.length % VECTOR_COLORS.length
		];
	}
}

function formatInputNumber(value: number): string {
	const rounded = Math.abs(value) < 0.0000000001 ? 0 : value;
	return Number.isInteger(rounded)
		? String(rounded)
		: Number(rounded.toPrecision(8)).toString();
}
