import {
	analyzeRealEigenbasis,
	analyzeRepresentativeRealEigenvector,
} from "../domain/math";
import { getMatrixPresets } from "../domain/presets";
import {
	canAddWorkspaceNodes,
	createMatrixNode,
	createVectorNode,
	replaceWorkspaceVectors,
	setMatrixEntrySource,
	setMatrixDuration,
	setVectorCoordinateSource,
} from "../domain/workspace";
import { type AppState, getWorkspace } from "./state";
import { replaceWorkspaceMatrices } from "../domain/workspace";
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
	commit(options?: { renderStack?: boolean; updateResults?: boolean }): void;
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
			undefined,
			undefined,
			crypto.randomUUID(),
		);
		if (
			!replaceWorkspaceMatrices(workspace, [
				matrix,
				...workspace.matrices,
			])
		)
			return;
		this.options.commit();
	}

	addVector(): void {
		const workspace = this.workspace;
		const vector = createVectorNode(
			workspace.dimension,
			nextVectorLabel(workspace.vectors.map((vector) => vector.label)),
			this.nextVectorColor,
			undefined,
			undefined,
			crypto.randomUUID(),
		);
		if (!replaceWorkspaceVectors(workspace, [...workspace.vectors, vector]))
			return;
		this.options.commit();
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
			crypto.randomUUID(),
		);
		if (
			!replaceWorkspaceMatrices(workspace, [
				matrix,
				...workspace.matrices,
			])
		) {
			return;
		}
		this.options.commit();
	}

	addEigenbasis(): void {
		const workspace = this.workspace;
		const result = analyzeRealEigenbasis(
			workspace.dimension,
			workspace.lastValidEvaluation.totalTransform,
		);
		const basis = result.kind === "basis" ? result.vectors : null;
		if (!basis || !canAddWorkspaceNodes(workspace, "vectors", basis.length))
			return;
		const vectors = [...workspace.vectors];
		for (const components of basis) {
			vectors.push(
				createVectorNode(
					workspace.dimension,
					nextVectorLabel(vectors.map((vector) => vector.label)),
					VECTOR_COLORS[vectors.length % VECTOR_COLORS.length],
					components,
					components.map(formatInputNumber),
					crypto.randomUUID(),
				),
			);
		}
		if (!replaceWorkspaceVectors(workspace, vectors)) return;
		this.options.commit();
	}

	addRepresentativeEigenvector(): void {
		const workspace = this.workspace;
		if (!canAddWorkspaceNodes(workspace, "vectors")) return;
		const result = analyzeRepresentativeRealEigenvector(
			workspace.dimension,
			workspace.lastValidEvaluation.totalTransform,
		);
		if (result.kind !== "vector") return;
		const vector = result.vector;
		const vectorNode = createVectorNode(
			workspace.dimension,
			nextVectorLabel(workspace.vectors.map((item) => item.label)),
			this.nextVectorColor,
			vector,
			vector.map(formatInputNumber),
			crypto.randomUUID(),
		);
		if (
			!replaceWorkspaceVectors(workspace, [
				...workspace.vectors,
				vectorNode,
			])
		)
			return;
		this.options.commit();
	}

	deleteMatrix(id: string): void {
		const workspace = this.workspace;
		const matrices = workspace.matrices.filter(
			(matrix) => matrix.id !== id,
		);
		if (!replaceWorkspaceMatrices(workspace, matrices)) return;
		this.options.commit();
	}

	deleteVector(id: string): void {
		const workspace = this.workspace;
		if (
			!replaceWorkspaceVectors(
				workspace,
				workspace.vectors.filter((vector) => vector.id !== id),
			)
		)
			return;
		this.options.commit();
	}

	moveMatrix(id: string, targetId: string, side: "before" | "after"): void {
		const workspace = this.workspace;
		const matrices = [...workspace.matrices];
		if (!moveItemTo(matrices, id, targetId, side).changed) return;
		if (!replaceWorkspaceMatrices(workspace, matrices)) return;
		this.options.commit();
	}

	moveVector(id: string, targetId: string, side: "before" | "after"): void {
		const workspace = this.workspace;
		const vectors = [...workspace.vectors];
		if (!moveItemTo(vectors, id, targetId, side).changed) return;
		if (!replaceWorkspaceVectors(workspace, vectors)) return;
		this.options.commit();
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
			? replaceWorkspaceMatrices(workspace, matrices)
			: replaceWorkspaceVectors(workspace, vectors);
		if (!accepted) return;
		const items = matrixId ? workspace.matrices : workspace.vectors;
		const label = items[result.index].label;
		this.options.commit();

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
				input,
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
				input,
			);
		}
	}

	private updateMatrixEntry(
		id: string,
		index: number,
		value: string,
		input: HTMLInputElement,
	): void {
		if (!setMatrixEntrySource(this.workspace, id, index, value)) return;
		this.finishNumericEdit(input);
	}

	private updateVectorComponent(
		id: string,
		index: number,
		value: string,
		input: HTMLInputElement,
	): void {
		if (!setVectorCoordinateSource(this.workspace, id, index, value))
			return;
		this.finishNumericEdit(input);
	}

	private updateDuration(id: string, value: number): void {
		if (!setMatrixDuration(this.workspace, id, value)) return;
		this.options.commit({ renderStack: false });
		const output = this.stack.querySelector<HTMLElement>(
			`[data-duration-output="${CSS.escape(id)}"]`,
		);
		const duration = this.workspace.matrices.find(
			(item) => item.id === id,
		)?.durationMs;
		if (output && duration !== undefined)
			output.textContent = `${duration}ms`;
	}

	private finishNumericEdit(editedInput: HTMLInputElement): void {
		const validity = this.workspace.validity;
		this.workspace.matrices.forEach((matrix) => {
			this.stack
				.querySelectorAll<HTMLInputElement>(
					`input[data-matrix-id="${CSS.escape(matrix.id)}"]`,
				)
				.forEach((input, index) =>
					input.toggleAttribute(
						"aria-invalid",
						validity.matrixEntries[matrix.id]?.[index] === false,
					),
				);
		});
		this.workspace.vectors.forEach((vector) => {
			this.stack
				.querySelectorAll<HTMLInputElement>(
					`input[data-vector-id="${CSS.escape(vector.id)}"]`,
				)
				.forEach((input, index) =>
					input.toggleAttribute(
						"aria-invalid",
						validity.vectorCoordinates[vector.id]?.[index] ===
							false,
					),
				);
		});
		const resultStructureChanged =
			validity.valid &&
			this.stack.querySelectorAll(".result-column-label").length !==
				this.workspace.lastValidEvaluation.vectors.length;
		this.options.commit({
			renderStack: resultStructureChanged,
			updateResults: validity.valid && !resultStructureChanged,
		});
		if (resultStructureChanged) this.restoreEditedInput(editedInput);
		this.stack
			.querySelectorAll<HTMLElement>(
				".equation-equals, .result-matrix-card",
			)
			.forEach((element) =>
				element.toggleAttribute("data-stale", !validity.valid),
			);
	}

	private restoreEditedInput(input: HTMLInputElement): void {
		const replacement = this.stack.querySelector<HTMLInputElement>(
			`input[name=${CSS.escape(input.name)}]`,
		);
		if (!replacement) return;
		replacement.focus();
		if (input.selectionStart === null || input.selectionEnd === null)
			return;
		replacement.setSelectionRange(
			input.selectionStart,
			input.selectionEnd,
			input.selectionDirection ?? undefined,
		);
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
