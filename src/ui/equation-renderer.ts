import {
	canAddWorkspaceNodes,
	getTotalTransform,
	type AnyWorkspace,
} from "../domain/state";
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
		const results = hasVectors
			? `
      <math class="equation-equals" aria-label="${this.options.t("equals")}">
        <mo>=</mo>
      </math>
      <section class="equation-right" aria-label="${this.options.t("computedVectors")}">
        ${renderResultMatrix(workspace, this.options.t)}
      </section>
    `
			: "";

		return `
    <div class="equation-row ${hasVectors ? "" : "equation-row-input-only"}">
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
		const { basisAvailable, vectorAvailable } =
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
						`<output class="vector-drag-preview-cell">${escapeHtml(coordinate.source)}</output>`,
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
		const { basisAvailable, vectorAvailable } =
			this.getVectorPresetAvailability();
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
          <button type="button" role="menuitem" data-action="add-eigenvector" ${vectorAvailable ? "" : "disabled"}>${this.options.t("oneEigenvector")}</button>
          <span class="preset-unavailable" data-eigenvector-unavailable ${vectorAvailable ? "hidden" : ""}>${this.options.t("eigenvectorUnavailable")}</span>
          <button type="button" role="menuitem" data-action="add-eigenbasis" ${basisAvailable ? "" : "disabled"}>${this.options.t("allEigenbasis")}</button>
          <span class="preset-unavailable" data-eigenbasis-unavailable ${basisAvailable ? "hidden" : ""}>${this.options.t("eigenbasisUnavailable")}</span>
        </div>
      </details>
    </div>
  `;
	}

	private getVectorPresetAvailability(): {
		basisAvailable: boolean;
		vectorAvailable: boolean;
	} {
		const workspace = this.options.getWorkspace();
		const transform = getTotalTransform(workspace);
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
		};
	}

	private matrixPresetName(preset: MatrixPreset): string {
		const t = this.options.t;
		if (preset.kind === "reflection")
			return t(
				this.options.getWorkspace().dimension === 2
					? "reflectionAxisPreset"
					: "reflectionPlanePreset",
				{ axis: preset.axis },
			);
		return t("rotationPreset", {
			angle: preset.angle ?? 45,
			axis: preset.axis
				? ` ${t("aroundAxis", { axis: preset.axis })}`
				: "",
		});
	}
}
