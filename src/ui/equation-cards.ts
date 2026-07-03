import {
	getTransformedVectors,
	type AnyMatrixNode,
	type AnyWorkspace,
} from "../domain/workspace";
import type { Translate } from "../i18n";
import {
	applyEntryColumnTemplate,
	groupEntriesByColumn,
	renderEntryColumnTemplate,
} from "./equation-layout";
import { escapeHtml, renderCloseIcon, renderVectorSymbol } from "./rendering";
import { formatDisplayNumber } from "./number-formatting";

export function renderMatrixCard(
	matrix: AnyMatrixNode,
	workspace: AnyWorkspace,
	t: Translate,
	maxInputLength: number,
): string {
	const columns = workspace.dimension;
	const template = renderEntryColumnTemplate(
		groupEntriesByColumn(matrix.entries, columns),
	);
	const entries = matrix.entries
		.map(
			(entry, index) => `
        <input name="matrix-${matrix.id}-entry-${index}" type="text"
          inputmode="text" maxlength="${maxInputLength}" autocomplete="off"
          value="${escapeHtml(entry)}" data-matrix-id="${matrix.id}"
          data-entry-index="${index}"
          ${workspace.validity.matrixEntries[matrix.id]?.[index] === false ? "aria-invalid" : ""}
          aria-label="${t("matrixEntry", { label: matrix.label, row: Math.floor(index / columns) + 1, column: (index % columns) + 1 })}" />`,
		)
		.join("");
	const durationName = `matrix-${matrix.id}-duration`;
	return `
    <li class="matrix-item" data-matrix-id="${matrix.id}" draggable="true" tabindex="0"
      aria-label="${t("matrix", { label: matrix.label })}"
      aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight" aria-describedby="reorder-instructions">
      <article class="matrix-card matrix-card-${workspace.dimension}" aria-label="${t("matrix", { label: matrix.label })}">
        <header class="matrix-header">
          <math class="matrix-label" aria-label="${matrix.label}"><mi>${matrix.label}</mi></math>
          <div class="matrix-actions"><button type="button" data-action="delete-matrix" data-id="${matrix.id}" aria-label="${t("deleteMatrix", { label: matrix.label })}" title="${t("deleteMatrix", { label: matrix.label })}">${renderCloseIcon()}</button></div>
        </header>
        <div class="matrix-expression" role="group" aria-label="${t("matrixValues", { label: matrix.label })}">
          <div class="matrix-bracket"><div class="matrix-grid matrix-grid-${workspace.dimension}" style="grid-template-columns:${template}" role="group" aria-label="${t("matrixEntries", { label: matrix.label })}">${entries}</div></div>
        </div>
        <label class="duration-row" for="${durationName}">
          <span data-duration-output="${matrix.id}">${matrix.durationMs}ms</span>
          <input id="${durationName}" name="${durationName}" type="range" min="100" max="3000" step="100" value="${matrix.durationMs}" data-duration-id="${matrix.id}" aria-label="${t("matrixDuration", { label: matrix.label })}" />
        </label>
      </article>
    </li>`;
}

export function renderVectorMatrix(
	workspace: AnyWorkspace,
	t: Translate,
	maxInputLength: number,
	renderAddControl: () => string,
): string {
	const template = renderEntryColumnTemplate(
		workspace.vectors.map((vector) => vector.coordinates),
		["60px"],
	);
	const labels = workspace.vectors
		.map(
			(vector) => `
        <div class="vector-column-label" data-vector-column-id="${vector.id}" draggable="true" tabindex="0" role="group" aria-label="${vector.label}" aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight" aria-describedby="reorder-instructions" style="--vector:${vector.color}">
          <math class="vector-label" aria-label="${vector.label}">${renderVectorSymbol(vector.label)}</math>
          <span class="vector-color-label" aria-hidden="true"></span>
          <button type="button" data-action="delete-vector" data-id="${vector.id}" aria-label="${t("deleteVector", { label: vector.label })}" title="${t("deleteVector", { label: vector.label })}">${renderCloseIcon()}</button>
        </div>`,
		)
		.join("");
	const entries = Array.from(
		{ length: workspace.dimension },
		(_, componentIndex) =>
			`${workspace.vectors
				.map((vector) => {
					const coordinate = vector.coordinates[componentIndex];
					const value = coordinate ?? "0";
					return `<input name="vector-${vector.id}-component-${componentIndex}" type="text" inputmode="text" maxlength="${maxInputLength}" autocomplete="off" value="${escapeHtml(value)}" data-vector-id="${vector.id}" data-vector-column-id="${vector.id}" data-component-index="${componentIndex}" ${workspace.validity.vectorCoordinates[vector.id]?.[componentIndex] === false ? "aria-invalid" : ""} aria-label="${t("vectorComponent", { label: vector.label, component: componentIndex + 1 })}" />`;
				})
				.join(
					"",
				)}<span class="vector-add-cell" aria-hidden="true"></span>`,
	).join("");
	return `
    <article class="vector-matrix-card vector-matrix-card-${workspace.dimension}" aria-label="${t("inputVectorMatrix")}">
      <div class="vector-column-labels" style="grid-template-columns:${template}">${labels}${renderAddControl()}</div>
      <div class="vector-expression vector-expression-${workspace.dimension}" style="grid-template-columns:${template}" role="group" aria-label="${t("inputVectorColumns")}">${entries}</div>
      <div class="card-balance-row" aria-hidden="true"></div>
    </article>`;
}

export function renderResultMatrix(
	workspace: AnyWorkspace,
	t: Translate,
): string {
	const evaluation = workspace.lastValidEvaluation;
	const vectors = getTransformedVectors(evaluation).map((components) =>
		components.map(formatDisplayNumber),
	);
	const template = renderEntryColumnTemplate(vectors);
	const labels = evaluation.vectors
		.map(
			(vector) =>
				`<div class="result-column-label" style="--vector:${vector.color}"><math class="vector-label" aria-label="${t("transformedVector", { label: vector.label })}">${renderVectorSymbol(vector.label, true)}</math><span class="vector-color-label" aria-hidden="true"></span></div>`,
		)
		.join("");
	const entries = Array.from(
		{ length: evaluation.dimension },
		(_, componentIndex) =>
			vectors
				.map(
					(components, vectorIndex) =>
						`<output data-result-vector-index="${vectorIndex}" data-result-component-index="${componentIndex}">${components[componentIndex] ?? "0"}</output>`,
				)
				.join(""),
	).join("");
	return `
    <article class="result-matrix-card result-matrix-card-${workspace.dimension}" ${workspace.validity.valid ? "" : "data-stale"} aria-label="${t("transformedVectorMatrix")}">
      <div class="result-column-labels" style="grid-template-columns:${template}">${labels}</div>
      <div class="result-expression result-expression-${workspace.dimension}" style="grid-template-columns:${template}" role="group" aria-label="${t("transformedVectorColumns")}">${entries}</div>
      <div class="card-balance-row" aria-hidden="true"></div>
    </article>`;
}

export function updateMatrixGridWidth(input: HTMLInputElement): void {
	const grid = input.closest<HTMLElement>(".matrix-grid");
	if (!grid) return;
	const values = [...grid.querySelectorAll<HTMLInputElement>("input")].map(
		(entry) => entry.value,
	);
	const columns = grid.classList.contains("matrix-grid-3") ? 3 : 2;
	applyEntryColumnTemplate([grid], groupEntriesByColumn(values, columns));
}

export function updateVectorColumnWidths(input: HTMLInputElement): void {
	const card = input.closest<HTMLElement>(".vector-matrix-card");
	if (!card) return;
	const columns = [
		...card.querySelectorAll<HTMLElement>(".vector-column-label"),
	].map((label) => {
		const id = label.dataset.vectorColumnId;
		if (!id) return [];
		return [
			...card.querySelectorAll<HTMLInputElement>(
				`input[data-vector-id="${CSS.escape(id)}"]`,
			),
		].map((entry) => entry.value);
	});
	applyEntryColumnTemplate(
		[
			...card.querySelectorAll<HTMLElement>(
				".vector-column-labels, .vector-expression",
			),
		],
		columns,
		["60px"],
	);
}
