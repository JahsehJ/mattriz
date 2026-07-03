import {
	areWorkspaceMatricesValid,
	canAddWorkspaceNodes,
	type AnyWorkspace,
} from "../domain/workspace";
import {
	analyzeRealEigenbasis,
	analyzeRepresentativeRealEigenvector,
} from "../domain/math";
import { type MatrixPreset, getMatrixPresets } from "../domain/presets";
import type { Translate } from "../i18n";
import {
	renderMatrixCard,
	renderResultMatrix,
	renderVectorMatrix,
} from "./equation-cards";
import { escapeHtml, renderVectorSymbol } from "./rendering";

interface EquationRendererOptions {
	root: HTMLElement;
	t: Translate;
	getWorkspace(): AnyWorkspace;
	maxInputLength: number;
}

export class EquationRenderer {
	constructor(private readonly options: EquationRendererOptions) {}

	render(): string {
		const workspace = this.options.getWorkspace();
		const hasVectors = workspace.vectors.length > 0;
		const hasResults = workspace.lastValidEvaluation.vectors.length > 0;
		const stale = !workspace.validity.valid;
		const results = hasResults
			? `
      <math class="equation-equals" ${stale ? 'data-stale aria-describedby="stale-result-status"' : ""} aria-label="${this.options.t("equals")}">
        <mo>=</mo>
      </math>
      <section class="equation-right" aria-label="${this.options.t("computedVectors")}">
        <div id="stale-result-status" class="visually-hidden" data-stale-result-status role="status" aria-live="polite">${stale ? this.options.t("staleResults") : ""}</div>
        ${renderResultMatrix(workspace, this.options.t)}
      </section>
    `
			: "";

		return `
    <div class="equation-row ${hasResults ? "" : "equation-row-input-only"}">
      <section class="equation-left" aria-label="${this.options.t("inputMatricesAndVectors")}">
        <ol class="matrix-stack" aria-label="${this.options.t("matrices")}">${this.renderAddMatrixOperand()}${workspace.matrices.map((matrix) => renderMatrixCard(matrix, workspace, this.options.t, this.options.maxInputLength)).join("")}</ol>
        ${hasVectors ? renderVectorMatrix(workspace, this.options.t, this.options.maxInputLength, () => this.renderVectorAddControl("vector-add-button-inline")) : ""}
        ${hasVectors ? "" : this.renderVectorAddControl(`vector-add-button-${workspace.dimension}`)}
      </section>
      ${results}
    </div>
  `;
	}

	updatePresetAvailability(): void {
		const { basisAvailable, vectorAvailable, matricesValid } =
			this.getVectorPresetAvailability();
		this.options.root
			.querySelectorAll<HTMLButtonElement>(
				"[data-action='add-eigenbasis']",
			)
			.forEach((button) => {
				button.disabled = !basisAvailable;
			});
		this.options.root
			.querySelectorAll<HTMLElement>("[data-eigenbasis-unavailable]")
			.forEach((message) => {
				message.toggleAttribute("hidden", basisAvailable);
				message.textContent = this.options.t(
					matricesValid
						? "eigenbasisUnavailable"
						: "eigenPresetsRequireValidMatrices",
				);
			});
		this.options.root
			.querySelectorAll<HTMLButtonElement>(
				"[data-action='add-eigenvector']",
			)
			.forEach((button) => {
				button.disabled = !vectorAvailable;
			});
		this.options.root
			.querySelectorAll<HTMLElement>("[data-eigenvector-unavailable]")
			.forEach((message) => {
				message.toggleAttribute("hidden", vectorAvailable);
				message.textContent = this.options.t(
					matricesValid
						? "eigenvectorUnavailable"
						: "eigenPresetsRequireValidMatrices",
				);
			});
	}

	createVectorDragPreview(vectorId: string): HTMLElement {
		const workspace = this.options.getWorkspace();
		const vector = workspace.vectors.find((item) => item.id === vectorId);
		if (!vector) return document.createElement("div");

		const preview = document.createElement("div");
		preview.className = "vector-column-drag-preview";
		preview.style.setProperty("--vector", vector.color);
		preview.innerHTML = `
    <div class="vector-column-label">
      <math class="vector-label" aria-hidden="true">${renderVectorSymbol(vector.label)}</math>
      <span class="vector-color-label" aria-hidden="true"></span>
    </div>
    <div class="vector-drag-preview-values">
	      ${vector.coordinates
				.slice(0, workspace.dimension)
				.map(
					(coordinate) =>
						`<output class="vector-drag-preview-cell">${escapeHtml(coordinate)}</output>`,
				)
				.join("")}
    </div>
  `;
		return preview;
	}

	private renderAddMatrixOperand(): string {
		const dimension = this.options.getWorkspace().dimension;
		return `
    <li class="matrix-add-item">
      ${this.renderMatrixAddControl(`matrix-add-button-${dimension}`)}
    </li>
  `;
	}

	private renderMatrixAddControl(positionClass: string): string {
		const workspace = this.options.getWorkspace();
		const addDisabled = canAddWorkspaceNodes(workspace, "matrices")
			? ""
			: "disabled";
		return `
    <div class="preset-split matrix-add-button ${positionClass}">
      <button class="equation-add-button preset-main" type="button" data-action="add-matrix" aria-label="${this.options.t("addMatrix")}" title="${this.options.t("addMatrix")}" ${addDisabled}>
        <math aria-hidden="true"><mo>+</mo><mi>M</mi></math>
      </button>
      <details class="preset-menu popup-menu">
        <summary class="preset-toggle" aria-label="${this.options.t("matrixPresets")}" title="${this.options.t("matrixPresets")}" aria-haspopup="menu" aria-expanded="false"></summary>
        <div class="preset-menu-panel popup-menu-panel" role="menu" aria-label="${this.options.t("matrixPresets")}">
          ${getMatrixPresets(workspace.dimension)
				.map(
					(preset) => `
            <button type="button" role="menuitem" data-action="add-matrix-preset" data-preset-id="${preset.id}" ${addDisabled}>
              ${escapeHtml(this.matrixPresetName(preset))}
            </button>`,
				)
				.join("")}
        </div>
      </details>
    </div>
  `;
	}

	private renderVectorAddControl(positionClass: string): string {
		const workspace = this.options.getWorkspace();
		const addDisabled = canAddWorkspaceNodes(workspace, "vectors")
			? ""
			: "disabled";
		return `
    <div class="preset-split vector-add-button ${positionClass}">
      <button class="equation-add-button preset-main" type="button" data-action="add-vector" aria-label="${this.options.t("addVector")}" title="${this.options.t("addVector")}" ${addDisabled}>
        <math aria-hidden="true"><mo>+</mo><mi>v</mi></math>
      </button>
      <details class="preset-menu popup-menu">
        <summary class="preset-toggle" aria-label="${this.options.t("vectorPresets")}" title="${this.options.t("vectorPresets")}" aria-haspopup="menu" aria-expanded="false"></summary>
        <div class="preset-menu-panel popup-menu-panel" role="menu" aria-label="${this.options.t("vectorPresets")}">
          <button type="button" role="menuitem" data-action="add-eigenvector" disabled>${this.options.t("oneEigenvector")}</button>
          <span class="preset-unavailable" data-eigenvector-unavailable hidden></span>
          <button type="button" role="menuitem" data-action="add-eigenbasis" disabled>${this.options.t("allEigenbasis")}</button>
          <span class="preset-unavailable" data-eigenbasis-unavailable hidden></span>
        </div>
      </details>
    </div>
  `;
	}

	private getVectorPresetAvailability(): {
		basisAvailable: boolean;
		vectorAvailable: boolean;
		matricesValid: boolean;
	} {
		const workspace = this.options.getWorkspace();
		if (!areWorkspaceMatricesValid(workspace))
			return {
				basisAvailable: false,
				vectorAvailable: false,
				matricesValid: false,
			};
		const transform = workspace.lastValidEvaluation.totalTransform;
		const basis = analyzeRealEigenbasis(workspace.dimension, transform);
		const representative = analyzeRepresentativeRealEigenvector(
			workspace.dimension,
			transform,
		);
		const vectorCapacity = canAddWorkspaceNodes(workspace, "vectors");
		return {
			basisAvailable: Boolean(
				basis.kind === "basis" &&
				canAddWorkspaceNodes(
					workspace,
					"vectors",
					basis.vectors.length,
				),
			),
			vectorAvailable: representative.kind === "vector" && vectorCapacity,
			matricesValid: true,
		};
	}

	private matrixPresetName(preset: MatrixPreset): string {
		const t = this.options.t;
		if (preset.subject.kind === "axis")
			return t("reflectionAxisPreset", { axis: preset.subject.name });
		if (preset.subject.kind === "plane")
			return t("reflectionPlanePreset", { plane: preset.subject.name });
		const axis =
			preset.subject.kind === "axis-angle"
				? ` ${t("aroundAxis", { axis: preset.subject.axis })}`
				: "";
		return t("rotationPreset", {
			angle: preset.subject.degrees,
			axis,
		});
	}
}
