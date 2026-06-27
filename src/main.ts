import "./styles.css";
import packageJson from "../package.json";
import { MatrixScene } from "./scene";
import {
	AppState,
	MatrixNode,
	createInitialState,
	createMatrixNode,
	createVectorNode,
	getActiveStepProgress,
	getAnimationDuration,
	getRenderState,
	getTotalTransform,
	getWorkspace,
} from "./state";
import {
	Dimension,
	VectorValues,
	applyMatrixToVector,
	identityMatrix,
	parseBoundedNumber,
} from "./math";
import { Locale, MessageKey, translate } from "./i18n";

const state: AppState = createInitialState();
const appVersion = packageJson.version;
let locale: Locale = "en";
const t = (key: MessageKey, values?: Record<string, string | number>): string =>
	translate(locale, key, values);
type DragKind = "matrix" | "vector";
type DragState = { kind: DragKind; id: string };
type DropSide = "before" | "after";
type DropTarget = { element: HTMLElement; id: string; side: DropSide };
type SortableNode = { id: string };

let dragState: DragState | null = null;
let draggedElement: HTMLElement | null = null;
let draggedPreviewElement: HTMLElement | null = null;
let dropIndicatorElement: HTMLElement | null = null;
let isInteractingWithInput = false;
const maxAbsoluteInputValue = 100;
const maxNumericInputLength = 16;
const vectorColors = [
	"#f4b740",
	"#5bd8a6",
	"#ef6f6c",
	"#8fb4ff",
	"#d989ff",
	"#5ed5e8",
];

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
	throw new Error("Missing #app root");
}
const root = app;

root.innerHTML = `
  <main class="shell">
    <section class="stage" aria-label="${t("transformationViewport")}" data-i18n-aria="transformationViewport">
      <canvas class="scene-canvas" aria-label="${t("animatedCoordinateSpace")}" data-i18n-aria="animatedCoordinateSpace"></canvas>
      <div class="mode-switch" role="group" aria-label="${t("dimension")}" data-i18n-aria="dimension">
        <button type="button" data-dimension="2">2D</button>
        <button type="button" data-dimension="3">3D</button>
      </div>
      <div class="view-tools" role="group" aria-label="${t("applicationControls")}" data-i18n-aria="applicationControls">
        <select name="language" data-language aria-label="${t("language")}" data-i18n-aria="language">
          <option value="en">English</option>
          <option value="zh-Hant">繁體中文</option>
        </select>
        <button type="button" data-action="reset-view" data-i18n="resetView">${t("resetView")}</button>
        <button type="button" data-action="open-about" aria-haspopup="dialog" data-i18n="about">${t("about")}</button>
      </div>
    </section>
    <footer class="panel" aria-label="${t("controls")}" data-i18n-aria="controls">
      <section class="control-cluster">
        <fieldset class="animation-block">
          <legend data-i18n="animation">${t("animation")}</legend>
          <div class="animation-body">
            <div class="transport" role="group" aria-label="${t("animationControls")}" data-i18n-aria="animationControls">
              <button type="button" data-action="play" aria-label="${t("applyTransform")}">${t("apply")}</button>
              <button type="button" data-action="reset" aria-label="${t("resetTransform")}" data-i18n="reset" data-i18n-aria="resetTransform">${t("reset")}</button>
            </div>
            <label class="mode-row" for="animation-mode">
              <span class="mode-label" data-i18n="method">${t("method")}</span>
              <select id="animation-mode" name="animation-mode" data-animation-mode aria-label="${t("animationMethod")}" data-i18n-aria="animationMethod">
                <option value="steps" data-i18n="steps">${t("steps")}</option>
                <option value="composed" data-i18n="composed">${t("composed")}</option>
              </select>
            </label>
          </div>
        </fieldset>
        <label class="toggle-row" for="show-basis">
          <span class="toggle-label" data-i18n="basis">${t("basis")}</span>
          <input id="show-basis" name="show-basis" type="checkbox" data-action="toggle-basis" checked />
        </label>
      </section>
      <section class="equation-tray" data-matrix-stack aria-label="${t("transformationEquation")}" data-i18n-aria="transformationEquation"></section>
    </footer>
    <dialog class="about-dialog" aria-labelledby="about-title">
      <div class="about-dialog-header">
        <div>
          <p class="about-eyebrow" data-i18n="quickReference">${t("quickReference")}</p>
          <h1 id="about-title" data-i18n="aboutMattriz">${t("aboutMattriz")}</h1>
        </div>
        <button class="about-close" type="button" data-action="close-about" aria-label="${t("close")}" title="${t("close")}" data-i18n-aria="close" data-i18n-title="close">${renderCloseIcon()}</button>
      </div>
      <p class="about-intro" data-i18n="intro">${t("intro")}</p>
      <div class="control-guide" role="table" aria-label="${t("mattrizControls")}" data-i18n-aria="mattrizControls">
        <div class="control-guide-header" role="row">
          <span role="columnheader" data-i18n="control">${t("control")}</span>
          <span role="columnheader" data-i18n="whatItDoes">${t("whatItDoes")}</span>
        </div>
        <div role="row"><span role="cell"><kbd>2D</kbd> <kbd>3D</kbd></span><span role="cell" data-i18n="switchDimensions">${t("switchDimensions")}</span></div>
        <div role="row"><span role="cell"><kbd data-i18n="resetView">${t("resetView")}</kbd></span><span role="cell" data-i18n="restoreCamera">${t("restoreCamera")}</span></div>
        <div role="row"><span role="cell"><kbd data-i18n="apply">${t("apply")}</kbd></span><span role="cell" data-i18n="applyDescription">${t("applyDescription")}</span></div>
        <div role="row"><span role="cell"><kbd data-i18n="pause">${t("pause")}</kbd> <kbd data-i18n="resume">${t("resume")}</kbd></span><span role="cell" data-i18n="pauseDescription">${t("pauseDescription")}</span></div>
        <div role="row"><span role="cell"><kbd data-i18n="reset">${t("reset")}</kbd></span><span role="cell" data-i18n="resetDescription">${t("resetDescription")}</span></div>
        <div role="row"><span role="cell"><kbd data-i18n="method">${t("method")}</kbd></span><span role="cell" data-i18n="methodDescription">${t("methodDescription")}</span></div>
        <div role="row"><span role="cell"><kbd data-i18n="basis">${t("basis")}</kbd></span><span role="cell" data-i18n="basisDescription">${t("basisDescription")}</span></div>
        <div role="row">
          <span class="guide-add-controls" role="cell">
            <span class="equation-add-button guide-add-button" aria-label="${t("addMatrix")}" data-i18n-aria="addMatrix"><math aria-hidden="true"><mo>+</mo><mi>M</mi></math></span>
            <span class="equation-add-button guide-add-button" aria-label="${t("addVector")}" data-i18n-aria="addVector"><math aria-hidden="true"><mo>+</mo><mi>v</mi></math></span>
          </span>
          <span role="cell" data-i18n="addDescription">${t("addDescription")}</span>
        </div>
      </div>
      <section class="interaction-guide" aria-labelledby="interaction-guide-title">
        <h2 id="interaction-guide-title" data-i18n="gestures">${t("gestures")}</h2>
        <dl>
          <div><dt data-i18n="reorder">${t("reorder")}</dt><dd data-i18n="reorderDescription">${t("reorderDescription")}</dd></div>
          <div><dt data-i18n="navigate">${t("navigate")}</dt><dd data-i18n="navigateDescription">${t("navigateDescription")}</dd></div>
        </dl>
      </section>
      <footer class="about-links" aria-label="${t("projectLinks")}" data-i18n-aria="projectLinks">
        <div class="about-link-list">
          <a href="https://github.com/JahsehJ/mattriz" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://codeberg.org/JahsehJ/mattriz" target="_blank" rel="noreferrer">Codeberg</a>
          <a href="https://jahsehjaeger.com" target="_blank" rel="noreferrer">jahsehjaeger.com</a>
        </div>
        <small class="about-version">v${appVersion}</small>
      </footer>
    </dialog>
  </main>
`;

const canvas = root.querySelector<HTMLCanvasElement>(".scene-canvas");
const matrixStack = root.querySelector<HTMLElement>("[data-matrix-stack]");
const animationMode = root.querySelector<HTMLSelectElement>(
	"[data-animation-mode]",
);
const language = root.querySelector<HTMLSelectElement>("[data-language]");
const aboutDialog = root.querySelector<HTMLDialogElement>(".about-dialog");
if (!canvas || !matrixStack || !animationMode || !language || !aboutDialog) {
	throw new Error("Missing app controls");
}
const stackElement = matrixStack;
const animationModeElement = animationMode;
const languageElement = language;

const scene = new MatrixScene(canvas);

root.addEventListener("click", (event) => {
	const target = event.target as HTMLElement;
	const dimensionButton =
		target.closest<HTMLButtonElement>("[data-dimension]");
	const actionButton = target.closest<HTMLButtonElement>("[data-action]");

	if (dimensionButton) {
		state.activeDimension = Number(
			dimensionButton.dataset.dimension,
		) as Dimension;
		resetAnimation();
	}

	if (!actionButton) return;
	const action = actionButton.dataset.action;
	if (action === "add-matrix") addMatrix();
	if (action === "add-vector") addVector();
	if (action === "play") togglePlayback();
	if (action === "reset") resetTransform();
	if (action === "reset-view") resetView();
	if (action === "open-about") aboutDialog.showModal();
	if (action === "close-about") aboutDialog.close();
	if (action === "delete-matrix") deleteMatrix(actionButton.dataset.id ?? "");
	if (action === "delete-vector") deleteVector(actionButton.dataset.id ?? "");
});

aboutDialog.addEventListener("click", (event) => {
	if (event.target === aboutDialog) aboutDialog.close();
});

root.addEventListener("input", (event) => {
	if (event.target instanceof HTMLInputElement) handleInput(event.target);
});

animationModeElement.addEventListener("change", () => {
	state.animation.mode =
		animationModeElement.value === "composed" ? "composed" : "steps";
	resetAnimation(false);
	renderUi();
});

root.addEventListener("change", (event) => {
	const target = event.target as HTMLElement;
	if (target === languageElement) {
		locale = languageElement.value === "zh-Hant" ? "zh-Hant" : "en";
		document.documentElement.lang = locale;
		localizeStaticUi();
		renderUi();
	}
	if (
		target instanceof HTMLInputElement &&
		target.dataset.action === "toggle-basis"
	) {
		state.showBasis = target.checked;
		renderUi(false);
	}
});

stackElement.addEventListener("pointerdown", (event) => {
	const target = event.target as HTMLElement;
	if (target.closest("input")) {
		isInteractingWithInput = true;
	}
});

window.addEventListener("pointerup", () => {
	isInteractingWithInput = false;
});

window.addEventListener("pointercancel", () => {
	isInteractingWithInput = false;
});

stackElement.addEventListener("dragstart", (event) => {
	if (isInteractingWithInput) {
		event.preventDefault();
		return;
	}

	const target = event.target as HTMLElement;
	if (target.closest("input, button, select, textarea")) {
		event.preventDefault();
		return;
	}

	const vectorSource = getVectorSourceElement(target);
	if (vectorSource?.dataset.vectorColumnId) {
		dragState = { kind: "vector", id: vectorSource.dataset.vectorColumnId };
		setDraggingElement(vectorSource, event);
		return;
	}

	const card = target.closest<HTMLElement>(".matrix-item[data-matrix-id]");
	if (card?.dataset.matrixId) {
		dragState = { kind: "matrix", id: card.dataset.matrixId };
		setDraggingElement(card, event);
	}
});

stackElement.addEventListener("dragover", (event) => {
	if (!dragState) return;
	event.preventDefault();
	updateDropIndicator(event);
});

stackElement.addEventListener("drop", (event) => {
	event.preventDefault();
	if (dragState?.kind === "vector") {
		const vectorTarget = getVectorDropTarget(event);
		if (vectorTarget)
			moveVector(dragState.id, vectorTarget.id, vectorTarget.side);
	} else if (dragState?.kind === "matrix") {
		const matrixTarget = getMatrixDropTarget(event);
		if (matrixTarget)
			moveMatrix(dragState.id, matrixTarget.id, matrixTarget.side);
	}
	clearDropIndicator();
	clearDraggingElement();
	dragState = null;
});

stackElement.addEventListener("dragend", () => {
	clearDropIndicator();
	clearDraggingElement();
	dragState = null;
});

function addMatrix(): void {
	const workspace = getWorkspace(state);
	workspace.matrices.unshift(
		createMatrixNode(
			workspace.dimension,
			nextMatrixLabel(workspace.matrices.map((matrix) => matrix.label)),
		),
	);
	resetAnimation();
}

function addVector(): void {
	const workspace = getWorkspace(state);
	const color = vectorColors[workspace.vectors.length % vectorColors.length];
	workspace.vectors.push(
		createVectorNode(
			workspace.dimension,
			nextVectorLabel(workspace.vectors.map((vector) => vector.label)),
			color,
		),
	);
	resetAnimation();
}

function deleteMatrix(id: string): void {
	const workspace = getWorkspace(state);
	workspace.matrices = workspace.matrices.filter(
		(matrix) => matrix.id !== id,
	);
	resetAnimation();
}

function deleteVector(id: string): void {
	const workspace = getWorkspace(state);
	workspace.vectors = workspace.vectors.filter((vector) => vector.id !== id);
	resetAnimation();
}

function moveMatrix(id: string, targetId: string, side: DropSide): void {
	if (!moveItem(getWorkspace(state).matrices, id, targetId, side)) return;
	resetAnimation();
}

function moveVector(id: string, targetId: string, side: DropSide): void {
	if (!moveItem(getWorkspace(state).vectors, id, targetId, side)) return;
	resetAnimation();
}

function moveItem<T extends SortableNode>(
	items: T[],
	id: string,
	targetId: string,
	side: DropSide,
): boolean {
	if (id === targetId) return false;

	const fromIndex = items.findIndex((item) => item.id === id);
	const toIndex = items.findIndex((item) => item.id === targetId);
	if (fromIndex < 0 || toIndex < 0) return false;

	const [item] = items.splice(fromIndex, 1);
	const adjustedTargetIndex = items.findIndex(
		(candidate) => candidate.id === targetId,
	);
	if (adjustedTargetIndex < 0) return false;

	items.splice(
		side === "before" ? adjustedTargetIndex : adjustedTargetIndex + 1,
		0,
		item,
	);
	return true;
}

function handleInput(input: HTMLInputElement): void {
	if (input.dataset.durationId) {
		updateDuration(input.dataset.durationId, Number(input.value));
		return;
	}
	if (input.dataset.matrixId && input.dataset.entryIndex !== undefined) {
		updateMatrixEntry(
			input.dataset.matrixId,
			Number(input.dataset.entryIndex),
			input.value,
		);
		return;
	}
	if (input.dataset.vectorId && input.dataset.componentIndex !== undefined) {
		updateVectorComponent(
			input.dataset.vectorId,
			Number(input.dataset.componentIndex),
			input.value,
		);
	}
}

function updateMatrixEntry(
	id: string,
	entryIndex: number,
	value: string,
): void {
	const matrix = getWorkspace(state).matrices.find((item) => item.id === id);
	if (!matrix) return;

	updateNumericDraft({
		draft: matrix.draftValues,
		index: entryIndex,
		value,
		count: getWorkspace(state).dimension ** 2,
		inputSelector: `input[data-matrix-id="${cssEscape(id)}"]`,
		commit: (values) => {
			matrix.values = values as MatrixNode["values"];
		},
	});
}

function updateDuration(id: string, value: number): void {
	const matrix = getWorkspace(state).matrices.find((item) => item.id === id);
	if (!matrix || !Number.isFinite(value)) return;
	matrix.durationMs = Math.max(100, Math.min(3000, value));
	resetAnimation(false);
	const output = stackElement.querySelector<HTMLElement>(
		`[data-duration-output="${cssEscape(id)}"]`,
	);
	if (output) output.textContent = `${matrix.durationMs}ms`;
}

function updateVectorComponent(
	id: string,
	componentIndex: number,
	value: string,
): void {
	const vector = getWorkspace(state).vectors.find((item) => item.id === id);
	if (!vector) return;

	updateNumericDraft({
		draft: vector.draftComponents,
		index: componentIndex,
		value,
		count: getWorkspace(state).dimension,
		inputSelector: `input[data-vector-id="${cssEscape(id)}"]`,
		commit: (values) => {
			vector.components = values as VectorValues;
		},
	});
}

function updateNumericDraft({
	draft,
	index,
	value,
	count,
	inputSelector,
	commit,
}: {
	draft: string[];
	index: number;
	value: string;
	count: number;
	inputSelector: string;
	commit: (values: number[]) => void;
}): void {
	draft[index] = value;
	const parsed = draft
		.slice(0, count)
		.map((entry) => parseBoundedNumber(entry, maxAbsoluteInputValue));
	const inputs =
		stackElement.querySelectorAll<HTMLInputElement>(inputSelector);
	inputs.forEach((input, inputIndex) =>
		input.toggleAttribute("aria-invalid", parsed[inputIndex] === null),
	);

	if (!parsed.every((entry): entry is number => entry !== null)) return;
	commit(parsed);
	resetAnimation(false);
	updateResultOutputs();
}

function togglePlayback(): void {
	const now = performance.now();
	if (state.animation.status === "playing") {
		state.animation.status = "paused";
		state.animation.pausedAt = now;
	} else if (state.animation.status === "paused") {
		state.animation.status = "playing";
		state.animation.startedAt += now - state.animation.pausedAt;
	} else {
		state.animation.status = "playing";
		state.animation.startedAt = now;
		state.animation.pausedAt = 0;
	}
	renderUi(false);
}

function resetAnimation(renderStack = true): void {
	state.animation.status = "idle";
	state.animation.startedAt = 0;
	state.animation.pausedAt = 0;
	renderUi(renderStack);
}

function resetTransform(): void {
	getWorkspace(state).appliedTransform = identityMatrix(
		state.activeDimension,
	);
	resetAnimation(false);
}

function resetView(): void {
	scene.resetView(state.activeDimension);
}

function localizeStaticUi(): void {
	root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
		element.textContent = t(element.dataset.i18n as MessageKey);
	});
	root.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach(
		(element) => {
			element.setAttribute(
				"aria-label",
				t(element.dataset.i18nAria as MessageKey),
			);
		},
	);
	root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach(
		(element) => {
			element.title = t(element.dataset.i18nTitle as MessageKey);
		},
	);
}

function renderUi(renderStack = true): void {
	root.querySelectorAll<HTMLButtonElement>("[data-dimension]").forEach(
		(button) => {
			button.toggleAttribute(
				"aria-pressed",
				Number(button.dataset.dimension) === state.activeDimension,
			);
		},
	);

	updatePlaybackControl();
	const basisCheckbox = root.querySelector<HTMLInputElement>(
		"[data-action='toggle-basis']",
	);
	if (basisCheckbox) basisCheckbox.checked = state.showBasis;
	animationModeElement.value = state.animation.mode;

	if (renderStack) stackElement.innerHTML = renderEquation();
	updateAnimationHighlight(performance.now());
}

function updatePlaybackControl(): void {
	const playButton = root.querySelector<HTMLButtonElement>(
		"[data-action='play']",
	);
	if (playButton) {
		const playbackTextKey: MessageKey =
			state.animation.status === "playing"
				? "pause"
				: state.animation.status === "paused"
					? "resume"
					: "apply";
		const playbackLabelKey: MessageKey =
			state.animation.status === "playing"
				? "pauseAnimation"
				: state.animation.status === "paused"
					? "resumeAnimation"
					: "applyTransform";
		playButton.textContent = t(playbackTextKey);
		playButton.setAttribute("aria-label", t(playbackLabelKey));
		playButton.dataset.playbackStatus = state.animation.status;
	}
}

function renderEquation(): string {
	const workspace = getWorkspace(state);
	const hasVectors = workspace.vectors.length > 0;
	const results = hasVectors
		? `
      <math class="equation-equals" aria-label="${t("equals")}">
        <mo>=</mo>
      </math>
      <section class="equation-right" aria-label="${t("computedVectors")}">
        ${renderResultMatrix()}
      </section>
    `
		: "";

	return `
    <div class="equation-row ${hasVectors ? "" : "equation-row-input-only"}">
      <section class="equation-left" aria-label="${t("inputMatricesAndVectors")}">
        <ol class="matrix-stack" aria-label="${t("matrices")}">${renderAddMatrixOperand()}${workspace.matrices.map(renderMatrixCard).join("")}</ol>
        ${hasVectors ? renderVectorMatrix() : ""}
        ${hasVectors ? "" : renderAddVectorOperand()}
      </section>
      ${results}
    </div>
  `;
}

function renderAddMatrixOperand(): string {
	const dimension = getWorkspace(state).dimension;
	return `
    <li class="matrix-add-item">
      <button class="equation-add-button matrix-add-button matrix-add-button-${dimension}" type="button" data-action="add-matrix" aria-label="${t("addMatrix")}" title="${t("addMatrix")}">
        <math aria-hidden="true"><mo>+</mo><mi>M</mi></math>
      </button>
    </li>
  `;
}

function renderAddVectorOperand(): string {
	const dimension = getWorkspace(state).dimension;
	return `
    <button class="equation-add-button vector-add-button vector-add-button-${dimension}" type="button" data-action="add-vector" aria-label="${t("addVector")}" title="${t("addVector")}">
      <math aria-hidden="true"><mo>+</mo><mi>v</mi></math>
    </button>
  `;
}

function renderMatrixCard(matrix: MatrixNode): string {
	const dimension = getWorkspace(state).dimension;
	const columns = dimension;
	const entries = matrix.draftValues
		.map((value, entryIndex) => {
			const inputName = `matrix-${matrix.id}-entry-${entryIndex}`;
			return `
        <input
          name="${inputName}"
          type="text"
          inputmode="decimal"
          maxlength="${maxNumericInputLength}"
          autocomplete="off"
          value="${escapeHtml(value)}"
          data-matrix-id="${matrix.id}"
          data-entry-index="${entryIndex}"
          aria-label="${t("matrixEntry", { label: matrix.label, row: Math.floor(entryIndex / columns) + 1, column: (entryIndex % columns) + 1 })}"
        />
      `;
		})
		.join("");
	const durationName = `matrix-${matrix.id}-duration`;

	return `
    <li class="matrix-item" data-matrix-id="${matrix.id}" draggable="true">
      <article class="matrix-card matrix-card-${dimension}" aria-label="${t("matrix", { label: matrix.label })}">
        <header class="matrix-header">
          <math class="matrix-label" aria-label="${matrix.label}">
            <mi>${matrix.label}</mi>
          </math>
          <div class="matrix-actions">
            <button type="button" data-action="delete-matrix" data-id="${matrix.id}" aria-label="${t("deleteMatrix", { label: matrix.label })}" title="${t("deleteMatrix", { label: matrix.label })}">${renderCloseIcon()}</button>
          </div>
        </header>
        <div class="matrix-expression" role="group" aria-label="${t("matrixValues", { label: matrix.label })}">
          <div class="matrix-bracket">
            <div class="matrix-grid matrix-grid-${dimension}" role="group" aria-label="${t("matrixEntries", { label: matrix.label })}">
              ${entries}
            </div>
          </div>
        </div>
        <label class="duration-row" for="${durationName}">
          <span data-duration-output="${matrix.id}">${matrix.durationMs}ms</span>
          <input id="${durationName}" name="${durationName}" type="range" min="100" max="3000" step="100" value="${matrix.durationMs}" data-duration-id="${matrix.id}" aria-label="${t("matrixDuration", { label: matrix.label })}" />
        </label>
      </article>
    </li>
  `;
}

function renderVectorMatrix(): string {
	const workspace = getWorkspace(state);
	const columnWidth = 54;
	const columnTemplate = `repeat(${workspace.vectors.length}, ${columnWidth}px) 44px`;
	const labels = workspace.vectors
		.map(
			(vector) => `
        <div class="vector-column-label" data-vector-column-id="${vector.id}" draggable="true" style="--vector:${vector.color}">
          <math class="vector-label" aria-label="${vector.label}">
            ${renderVectorSymbol(vector.label)}
          </math>
          <span class="vector-color-label" aria-hidden="true"></span>
          <button type="button" data-action="delete-vector" data-id="${vector.id}" aria-label="${t("deleteVector", { label: vector.label })}" title="${t("deleteVector", { label: vector.label })}">${renderCloseIcon()}</button>
        </div>
      `,
		)
		.join("");
	const entries = Array.from(
		{ length: workspace.dimension },
		(_, componentIndex) =>
			`${workspace.vectors
				.map((vector) => {
					const value = vector.draftComponents[componentIndex] ?? "0";
					const inputName = `vector-${vector.id}-component-${componentIndex}`;
					return `
        <input
          name="${inputName}"
          type="text"
          inputmode="decimal"
          maxlength="${maxNumericInputLength}"
          autocomplete="off"
          value="${escapeHtml(value)}"
          data-vector-id="${vector.id}"
          data-vector-column-id="${vector.id}"
          data-component-index="${componentIndex}"
          aria-label="${t("vectorComponent", { label: vector.label, component: componentIndex + 1 })}"
        />
      `;
				})
				.join(
					"",
				)}<span class="vector-add-cell" aria-hidden="true"></span>`,
	).join("");

	return `
    <article class="vector-matrix-card vector-matrix-card-${workspace.dimension}" aria-label="${t("inputVectorMatrix")}">
      <div class="vector-column-labels" style="grid-template-columns:${columnTemplate}">
        ${labels}
        <button class="equation-add-button vector-add-button vector-add-button-inline" type="button" data-action="add-vector" aria-label="${t("addVector")}" title="${t("addVector")}">
          <math aria-hidden="true"><mo>+</mo><mi>v</mi></math>
        </button>
      </div>
      <div class="vector-expression vector-expression-${workspace.dimension}" style="grid-template-columns:${columnTemplate}" role="group" aria-label="${t("inputVectorColumns")}">
          ${entries}
      </div>
      <div class="card-balance-row" aria-hidden="true"></div>
    </article>
  `;
}

function renderResultMatrix(): string {
	const workspace = getWorkspace(state);
	const columnWidth = 54;
	const columnTemplate = `repeat(${workspace.vectors.length}, ${columnWidth}px)`;
	const totalTransform = getTotalTransform(workspace);
	const labels = workspace.vectors
		.map(
			(vector) => `
        <div class="result-column-label" style="--vector:${vector.color}">
          <math class="vector-label" aria-label="${t("transformedVector", { label: vector.label })}">
            ${renderVectorSymbol(vector.label, true)}
          </math>
          <span class="vector-color-label" aria-hidden="true"></span>
        </div>
      `,
		)
		.join("");
	const transformedVectors = workspace.vectors.map((vector) =>
		applyMatrixToVector(
			workspace.dimension,
			totalTransform,
			vector.components,
		).slice(0, workspace.dimension),
	);
	const entries = Array.from(
		{ length: workspace.dimension },
		(_, componentIndex) =>
			transformedVectors
				.map(
					(components, vectorIndex) =>
						`<output data-result-vector-index="${vectorIndex}" data-result-component-index="${componentIndex}">${formatNumber(components[componentIndex] ?? 0)}</output>`,
				)
				.join(""),
	).join("");

	return `
    <article class="result-matrix-card result-matrix-card-${workspace.dimension}" aria-label="${t("transformedVectorMatrix")}">
      <div class="result-column-labels" style="grid-template-columns:${columnTemplate}">
        ${labels}
      </div>
      <div class="result-expression result-expression-${workspace.dimension}" style="grid-template-columns:${columnTemplate}" role="group" aria-label="${t("transformedVectorColumns")}">
          ${entries}
      </div>
      <div class="card-balance-row" aria-hidden="true"></div>
    </article>
  `;
}

function updateDropIndicator(event: DragEvent): void {
	clearDropIndicator();
	if (!dragState) return;

	if (dragState.kind === "vector") {
		const vectorTarget = getVectorDropTarget(event);
		if (!vectorTarget || vectorTarget.id === dragState.id) return;
		setDropIndicator(vectorTarget.element, vectorTarget.side);
		return;
	}

	const matrixTarget = getMatrixDropTarget(event);
	if (!matrixTarget || matrixTarget.id === dragState.id) return;
	setDropIndicator(matrixTarget.element, matrixTarget.side);
}

function getMatrixDropTarget(event: DragEvent): DropTarget | null {
	const matrixStackElement =
		stackElement.querySelector<HTMLElement>(".matrix-stack");
	const matrixItems = Array.from(
		stackElement.querySelectorAll<HTMLElement>(
			".matrix-item[data-matrix-id]",
		),
	);
	const target = getSortableDropTarget(event, matrixItems, "matrixId");
	if (!target) return null;
	if (
		target.side === "before" &&
		target.element === matrixItems[0] &&
		matrixStackElement
	) {
		return { ...target, element: matrixStackElement };
	}
	return target;
}

function getVectorDropTarget(event: DragEvent): DropTarget | null {
	const vectorLabels = Array.from(
		stackElement.querySelectorAll<HTMLElement>(
			".vector-column-label[data-vector-column-id]",
		),
	);
	return getSortableDropTarget(event, vectorLabels, "vectorColumnId");
}

function getSortableDropTarget(
	event: DragEvent,
	items: HTMLElement[],
	datasetKey: "matrixId" | "vectorColumnId",
): DropTarget | null {
	if (items.length === 0) return null;

	let nearestItem = items[0];
	let nearestDistance = Number.POSITIVE_INFINITY;
	let nearestSide: DropSide = "before";

	for (const item of items) {
		const rect = item.getBoundingClientRect();
		const side =
			event.clientX < rect.left + rect.width / 2 ? "before" : "after";
		const edge = side === "before" ? rect.left : rect.right;
		const distance = Math.abs(event.clientX - edge);
		if (distance < nearestDistance) {
			nearestItem = item;
			nearestDistance = distance;
			nearestSide = side;
		}
	}

	const id = nearestItem.dataset[datasetKey];
	return id ? { element: nearestItem, id, side: nearestSide } : null;
}

function getVectorSourceElement(target: HTMLElement): HTMLElement | null {
	const vectorId = target.closest<HTMLElement>("[data-vector-column-id]")
		?.dataset.vectorColumnId;
	if (!vectorId) return null;
	return stackElement.querySelector<HTMLElement>(
		`.vector-column-label[data-vector-column-id="${cssEscape(vectorId)}"]`,
	);
}

function setDropIndicator(element: HTMLElement | null, side: DropSide): void {
	if (!element) return;
	element.dataset.dropPosition = side;
	dropIndicatorElement = element;
}

function clearDropIndicator(): void {
	if (!dropIndicatorElement) return;
	delete dropIndicatorElement.dataset.dropPosition;
	dropIndicatorElement = null;
}

function setDraggingElement(
	element: HTMLElement | null,
	event: DragEvent,
): void {
	clearDraggingElement();
	if (!element) return;
	element.dataset.dragging = "true";
	if (element.dataset.vectorColumnId) {
		stackElement
			.querySelectorAll<HTMLElement>(
				`.vector-expression [data-vector-column-id="${cssEscape(element.dataset.vectorColumnId)}"]`,
			)
			.forEach((item) => {
				item.dataset.dragging = "true";
			});
	}
	draggedElement = element;
	if (event.dataTransfer) {
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData(
			"text/plain",
			element.dataset.matrixId ?? element.dataset.vectorColumnId ?? "",
		);
		const preview = createDragPreview(element);
		event.dataTransfer.setDragImage(
			preview,
			getDragOffsetX(element, event, preview),
			getDragOffsetY(element, event, preview),
		);
	}
}

function clearDraggingElement(): void {
	if (draggedElement) delete draggedElement.dataset.dragging;
	stackElement
		.querySelectorAll<HTMLElement>(".vector-expression [data-dragging]")
		.forEach((item) => {
			delete item.dataset.dragging;
		});
	draggedElement = null;
	draggedPreviewElement?.remove();
	draggedPreviewElement = null;
}

function createDragPreview(element: HTMLElement): HTMLElement {
	draggedPreviewElement?.remove();
	const preview = element.dataset.vectorColumnId
		? createVectorDragPreview(element.dataset.vectorColumnId)
		: cloneDragPreview(element);
	preview.dataset.dragPreview = "true";
	Object.assign(preview.style, {
		position: "fixed",
		top: "-10000px",
		left: "-10000px",
		pointerEvents: "none",
	});
	document.body.append(preview);
	draggedPreviewElement = preview;
	return preview;
}

function cloneDragPreview(element: HTMLElement): HTMLElement {
	const preview = element.cloneNode(true) as HTMLElement;
	preview.removeAttribute("id");
	preview
		.querySelectorAll("[id]")
		.forEach((child) => child.removeAttribute("id"));
	return preview;
}

function createVectorDragPreview(vectorId: string): HTMLElement {
	const workspace = getWorkspace(state);
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
    <div class="vector-drag-preview-values" style="grid-template-columns:54px">
      ${vector.draftComponents
			.slice(0, workspace.dimension)
			.map(
				(component) =>
					`<output class="vector-drag-preview-cell">${escapeHtml(component)}</output>`,
			)
			.join("")}
    </div>
  `;
	return preview;
}

function getDragOffsetX(
	element: HTMLElement,
	event: DragEvent,
	preview: HTMLElement,
): number {
	const rect = element.getBoundingClientRect();
	const previewRect = preview.getBoundingClientRect();
	const x = event.clientX - rect.left;
	if (!element.dataset.vectorColumnId)
		return Math.max(0, Math.min(rect.width, x));
	return Math.max(
		0,
		Math.min(previewRect.width, (previewRect.width - rect.width) / 2 + x),
	);
}

function getDragOffsetY(
	element: HTMLElement,
	event: DragEvent,
	preview: HTMLElement,
): number {
	const rect = element.getBoundingClientRect();
	const previewRect = preview.getBoundingClientRect();
	const y = event.clientY - rect.top;
	if (!element.dataset.vectorColumnId)
		return Math.max(0, Math.min(rect.height, y));
	return Math.max(0, Math.min(previewRect.height, y));
}

function nextMatrixLabel(existingLabels: string[]): string {
	const labels = new Set(existingLabels);
	for (let index = 0; ; index += 1) {
		const label = alphabeticLabel(index);
		if (!labels.has(label)) return label;
	}
}

function nextVectorLabel(existingLabels: string[]): string {
	const labels = new Set(existingLabels);
	for (let index = 1; ; index += 1) {
		const label = `v${index}`;
		if (!labels.has(label)) return label;
	}
}

function alphabeticLabel(index: number): string {
	let value = index + 1;
	let label = "";
	while (value > 0) {
		value -= 1;
		label = String.fromCharCode(65 + (value % 26)) + label;
		value = Math.floor(value / 26);
	}
	return label;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function renderVectorSymbol(label: string, prime = false): string {
	const match = label.match(/^([a-zA-Z]+)(\d+)$/);
	const symbol = match
		? `<msub><mi>${escapeHtml(match[1])}</mi><mn>${escapeHtml(match[2])}</mn></msub>`
		: `<mi>${escapeHtml(label)}</mi>`;

	return prime ? `<msup>${symbol}<mo>&#x2032;</mo></msup>` : symbol;
}

function renderCloseIcon(): string {
	return `
    <svg class="close-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5" />
    </svg>
  `;
}

function cssEscape(value: string): string {
	return CSS.escape(value);
}

function formatNumber(value: number): string {
	const rounded = Math.abs(value) < 0.000001 ? 0 : value;
	return Number.isInteger(rounded)
		? String(rounded)
		: rounded.toFixed(3).replace(/\.?0+$/, "");
}

function updateAnimationHighlight(now: number): void {
	const workspace = getWorkspace(state);
	const activeStep = getActiveStepProgress(workspace, state.animation, now);
	const composedProgress =
		state.animation.status !== "idle" && state.animation.mode === "composed"
			? Math.max(
					0,
					Math.min(
						1,
						((state.animation.status === "paused"
							? state.animation.pausedAt
							: now) -
							state.animation.startedAt) /
							Math.max(1, getAnimationDuration(workspace)),
					),
				)
			: null;
	stackElement
		.querySelectorAll<HTMLElement>(".matrix-item[data-matrix-id]")
		.forEach((item) => {
			const isActive =
				composedProgress !== null
					? true
					: item.dataset.matrixId === activeStep?.matrixId;
			const progress =
				composedProgress ??
				(isActive && activeStep ? activeStep.progress : 0);
			item.toggleAttribute("data-active-step", isActive);
			if (isActive) item.setAttribute("aria-current", "step");
			else item.removeAttribute("aria-current");
			item.style.setProperty(
				"--step-progress",
				`${Math.max(0, Math.min(1, progress)) * 100}%`,
			);
		});
}

function updateResultOutputs(): void {
	const workspace = getWorkspace(state);
	const totalTransform = getTotalTransform(workspace);
	workspace.vectors.forEach((vector, vectorIndex) => {
		const transformed = applyMatrixToVector(
			workspace.dimension,
			totalTransform,
			vector.components,
		);
		for (
			let componentIndex = 0;
			componentIndex < workspace.dimension;
			componentIndex += 1
		) {
			const output = stackElement.querySelector<HTMLOutputElement>(
				`output[data-result-vector-index="${vectorIndex}"][data-result-component-index="${componentIndex}"]`,
			);
			if (output) {
				const formattedValue = formatNumber(
					transformed[componentIndex] ?? 0,
				);
				output.value = formattedValue;
				output.textContent = formattedValue;
			}
		}
	});
}

function tick(now: number): void {
	const workspace = getWorkspace(state);
	if (
		state.animation.status === "playing" &&
		now - state.animation.startedAt >= getAnimationDuration(workspace)
	) {
		workspace.appliedTransform = getTotalTransform(workspace);
		state.animation.status = "idle";
		renderUi(false);
	}
	updateAnimationHighlight(now);
	scene.render(getRenderState(state, now));
	requestAnimationFrame(tick);
}

renderUi();
requestAnimationFrame(tick);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		const baseUrl = new URL(import.meta.env.BASE_URL, window.location.href);
		void navigator.serviceWorker.register(new URL("sw.js", baseUrl), {
			scope: baseUrl.pathname,
		});
	});
}
