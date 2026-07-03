import { evaluateBoundedExpression } from "../domain/expression";
import {
	getRealEigenbasis,
	getRepresentativeRealEigenvector,
} from "../domain/math";
import { getMatrixPresets } from "../domain/presets";
import {
	MAX_ABSOLUTE_INPUT_VALUE,
	type AppState,
	type NumericCell,
	canAddWorkspaceNodes,
	createMatrixNode,
	createVectorNode,
	getNumericCellError,
	getTotalTransform,
	getWorkspace,
	hasSafeComposedTransform,
} from "../domain/state";
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
		if (!canAddWorkspaceNodes(workspace, "matrices")) return;
		workspace.matrices.unshift(
			createMatrixNode(
				workspace.dimension,
				nextMatrixLabel(
					workspace.matrices.map((matrix) => matrix.label),
				),
			),
		);
		this.options.resetAnimation();
	}

	addVector(): void {
		const workspace = this.workspace;
		if (!canAddWorkspaceNodes(workspace, "vectors")) return;
		workspace.vectors.push(
			createVectorNode(
				workspace.dimension,
				nextVectorLabel(
					workspace.vectors.map((vector) => vector.label),
				),
				this.nextVectorColor,
			),
		);
		this.options.resetAnimation();
	}

	addMatrixPreset(presetId: string): void {
		const workspace = this.workspace;
		const preset = getMatrixPresets(workspace.dimension).find(
			(item) => item.id === presetId,
		);
		if (!preset || !canAddWorkspaceNodes(workspace, "matrices")) return;
		workspace.matrices.unshift(
			createMatrixNode(
				workspace.dimension,
				nextMatrixLabel(
					workspace.matrices.map((matrix) => matrix.label),
				),
				preset.values,
				preset.draftValues,
			),
		);
		if (!hasSafeComposedTransform(workspace)) {
			workspace.matrices.shift();
			return;
		}
		this.options.resetAnimation();
	}

	addEigenbasis(): void {
		const workspace = this.workspace;
		const basis = getRealEigenbasis(
			workspace.dimension,
			getTotalTransform(workspace),
		);
		if (!basis || !canAddWorkspaceNodes(workspace, "vectors", basis.length))
			return;
		for (const components of basis) {
			workspace.vectors.push(
				createVectorNode(
					workspace.dimension,
					nextVectorLabel(
						workspace.vectors.map((vector) => vector.label),
					),
					this.nextVectorColor,
					components,
					components.map(formatInputNumber),
				),
			);
		}
		this.options.resetAnimation();
	}

	addRepresentativeEigenvector(): void {
		const workspace = this.workspace;
		if (!canAddWorkspaceNodes(workspace, "vectors")) return;
		const vector = getRepresentativeRealEigenvector(
			workspace.dimension,
			getTotalTransform(workspace),
		);
		if (!vector) return;
		workspace.vectors.push(
			createVectorNode(
				workspace.dimension,
				nextVectorLabel(workspace.vectors.map((item) => item.label)),
				this.nextVectorColor,
				vector,
				vector.map(formatInputNumber),
			),
		);
		this.options.resetAnimation();
	}

	deleteMatrix(id: string): void {
		const workspace = this.workspace;
		const previous = workspace.matrices;
		workspace.matrices = workspace.matrices.filter(
			(matrix) => matrix.id !== id,
		);
		if (!hasSafeComposedTransform(workspace)) {
			workspace.matrices = previous;
			return;
		}
		this.options.resetAnimation();
	}

	deleteVector(id: string): void {
		this.workspace.vectors = this.workspace.vectors.filter(
			(vector) => vector.id !== id,
		);
		this.options.resetAnimation();
	}

	moveMatrix(id: string, targetId: string, side: "before" | "after"): void {
		const workspace = this.workspace;
		const previous = [...workspace.matrices];
		if (!moveItemTo(workspace.matrices, id, targetId, side).changed) return;
		if (!hasSafeComposedTransform(workspace)) {
			workspace.matrices = previous;
			return;
		}
		this.options.resetAnimation();
	}

	moveVector(id: string, targetId: string, side: "before" | "after"): void {
		if (!moveItemTo(this.workspace.vectors, id, targetId, side).changed)
			return;
		this.options.resetAnimation();
	}

	moveFocusedItem(element: HTMLElement, direction: MoveDirection): void {
		const matrixId = element.dataset.matrixId;
		const vectorId = element.dataset.vectorColumnId;
		const id = matrixId ?? vectorId;
		if (!id) return;
		const result = matrixId
			? moveItemBy(this.workspace.matrices, matrixId, direction)
			: moveItemBy(this.workspace.vectors, id, direction);
		if (!result.changed) return;
		if (matrixId && !hasSafeComposedTransform(this.workspace)) {
			moveItemBy(
				this.workspace.matrices,
				matrixId,
				-direction as MoveDirection,
			);
			return;
		}
		const items = matrixId
			? this.workspace.matrices
			: this.workspace.vectors;
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
			(values) => {
				const previous = matrix.entries;
				matrix.entries = previous.map((entry, entryIndex) => ({
					...entry,
					value: values[entryIndex],
				}));
				const renderable = hasSafeComposedTransform(this.workspace);
				matrix.entries = previous;
				return renderable;
			},
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
		if (!matrix || !Number.isFinite(value)) return;
		matrix.durationMs = Math.max(100, Math.min(3000, value));
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
		commit: (values: number[]) => boolean,
	): void {
		const cell = cells[index];
		if (!cell) return;
		cell.source = value;
		const parsed = cells.map((entry) =>
			evaluateBoundedExpression(entry.source, MAX_ABSOLUTE_INPUT_VALUE),
		);
		if (
			parsed.every((entry): entry is number => entry !== null) &&
			commit(parsed)
		) {
			cells.forEach((entry, entryIndex) => {
				entry.value = parsed[entryIndex];
			});
		}
		this.stack
			.querySelectorAll<HTMLInputElement>(inputSelector)
			.forEach((input, inputIndex) => {
				input.toggleAttribute(
					"aria-invalid",
					cells[inputIndex] !== undefined &&
						getNumericCellError(cells[inputIndex]) !== null,
				);
			});
		if (cells.some((entry) => getNumericCellError(entry) !== null)) return;
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
