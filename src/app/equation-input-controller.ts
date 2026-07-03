import {
	MAX_MATRIX_DURATION_MS,
	MIN_MATRIX_DURATION_MS,
} from "../domain/policy";
import { type AnyWorkspace, recomputeWorkspace } from "../domain/workspace";
import { getTransformedVectors } from "../domain/workspace-evaluation";
import type { Translate } from "../i18n";
import { applyEntryColumnTemplate } from "../ui/equation-layout";
import {
	updateMatrixGridWidth,
	updateVectorColumnWidths,
} from "../ui/equation-cards";
import { formatDisplayNumber } from "../ui/number-formatting";
import type { AppState } from "./state";
import { resetPlayback } from "./playback-state";

interface EquationInputControllerOptions {
	getState(): AppState;
	getWorkspace(): AnyWorkspace;
	render(renderStack: boolean): void;
}

export class EquationInputController {
	constructor(
		private readonly stack: HTMLElement,
		private readonly t: Translate,
		private readonly options: EquationInputControllerOptions,
	) {}

	handleInput(input: HTMLInputElement): void {
		if (input.dataset.durationId) {
			this.updateDuration(input.dataset.durationId, Number(input.value));
			return;
		}
		if (input.dataset.matrixId && input.dataset.entryIndex !== undefined) {
			updateMatrixGridWidth(input);
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
			updateVectorColumnWidths(input);
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
		const workspace = this.options.getWorkspace();
		const matrix = workspace.matrices.find((item) => item.id === id);
		if (
			!matrix ||
			!Number.isInteger(index) ||
			matrix.entries[index] === undefined
		)
			return;
		matrix.entries[index] = value;
		recomputeWorkspace(workspace);
		this.finishNumericEdit(input);
	}

	private updateVectorComponent(
		id: string,
		index: number,
		value: string,
		input: HTMLInputElement,
	): void {
		const workspace = this.options.getWorkspace();
		const vector = workspace.vectors.find((item) => item.id === id);
		if (
			!vector ||
			!Number.isInteger(index) ||
			vector.coordinates[index] === undefined
		)
			return;
		vector.coordinates[index] = value;
		recomputeWorkspace(workspace);
		this.finishNumericEdit(input);
	}

	private updateDuration(id: string, value: number): void {
		const workspace = this.options.getWorkspace();
		const matrix = workspace.matrices.find((item) => item.id === id);
		if (!matrix || !Number.isFinite(value)) return;
		matrix.durationMs = Math.max(
			MIN_MATRIX_DURATION_MS,
			Math.min(MAX_MATRIX_DURATION_MS, value),
		);
		recomputeWorkspace(workspace);
		this.resetPlayback();
		this.options.render(false);
		const output = this.stack.querySelector<HTMLElement>(
			`[data-duration-output="${CSS.escape(id)}"]`,
		);
		if (output) output.textContent = `${matrix.durationMs}ms`;
	}

	private finishNumericEdit(editedInput: HTMLInputElement): void {
		const workspace = this.options.getWorkspace();
		const validity = workspace.validity;
		workspace.matrices.forEach((matrix) => {
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
		workspace.vectors.forEach((vector) => {
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
		const renderedResultIds = [
			...this.stack.querySelectorAll<HTMLElement>(
				".result-column-label[data-result-vector-id]",
			),
		].map((label) => label.dataset.resultVectorId);
		const currentResultIds = workspace.lastValidEvaluation.vectors.map(
			(vector) => vector.id,
		);
		const resultStructureChanged =
			validity.valid &&
			(renderedResultIds.length !== currentResultIds.length ||
				renderedResultIds.some(
					(id, index) => id !== currentResultIds[index],
				));
		this.resetPlayback();
		this.options.render(resultStructureChanged);
		if (validity.valid && !resultStructureChanged) this.updateResults();
		if (resultStructureChanged) this.restoreEditedInput(editedInput);
		this.updateResultStaleness();
	}

	private updateResults(): void {
		const workspace = this.options.getWorkspace();
		const vectors = getTransformedVectors(
			workspace.lastValidEvaluation,
		).map((components) => components.map(formatDisplayNumber));
		vectors.forEach((components, vectorIndex) => {
			for (let index = 0; index < workspace.dimension; index += 1) {
				const output = this.stack.querySelector<HTMLOutputElement>(
					`output[data-result-vector-index="${vectorIndex}"][data-result-component-index="${index}"]`,
				);
				if (!output) continue;
				const value = components[index] ?? "0";
				output.value = value;
				output.textContent = value;
			}
		});
		const card = this.stack.querySelector<HTMLElement>(
			".result-matrix-card",
		);
		if (!card) return;
		applyEntryColumnTemplate(
			[
				...card.querySelectorAll<HTMLElement>(
					".result-column-labels, .result-expression",
				),
			],
			vectors,
		);
	}

	private updateResultStaleness(): void {
		const stale = !this.options.getWorkspace().validity.valid;
		this.stack
			.querySelectorAll<HTMLElement>(
				".equation-equals, .result-matrix-card",
			)
			.forEach((element) => {
				element.toggleAttribute("data-stale", stale);
				if (stale)
					element.setAttribute(
						"aria-describedby",
						"stale-result-status",
					);
				else element.removeAttribute("aria-describedby");
			});
		const status = this.stack.querySelector<HTMLElement>(
			"[data-stale-result-status]",
		);
		if (status) status.textContent = stale ? this.t("staleResults") : "";
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

	private resetPlayback(): void {
		const state = this.options.getState();
		state.animation = resetPlayback(state.animation);
	}
}
