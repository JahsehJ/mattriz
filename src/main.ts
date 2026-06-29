import "./styles.css";
import packageJson from "../package.json";
import { MatrixScene } from "./scene";
import {
	AppState,
	MatrixNode,
	canAddWorkspaceNodes,
	createInitialState,
	createMatrixNode,
	createVectorNode,
	getAnimationElapsed,
	getAnimationDuration,
	getAnimationProgress,
	getRenderState,
	getTotalTransform,
	getTransformedVectors,
	getWorkspace,
} from "./state";
import {
	Dimension,
	VectorValues,
	getRealEigenbasis,
	getRepresentativeRealEigenvector,
	identityMatrix,
} from "./math";
import { localeMetadata, Locale, MessageKey, translate } from "./i18n";
import {
	getAlternateLocaleUrl,
	getAppRootUrl,
	getLocaleFromLanguageTag,
} from "./locale-routing";
import { evaluateBoundedExpression } from "./expression";
import { MatrixPreset, getMatrixPresets } from "./presets";
import {
	MAX_SHARE_FRAGMENT_LENGTH,
	decodeShareSession,
	encodeShareSession,
} from "./share";

let state: AppState = createInitialState();
const appVersion = packageJson.version;
const locale: Locale = getLocaleFromLanguageTag(document.documentElement.lang);
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
const maxNumericInputLength = 64;
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
          ${localeMetadata.map(({ code, label }) => `<option value="${code}">${label}</option>`).join("")}
        </select>
        <button type="button" data-action="reset-view" data-i18n="resetView">${t("resetView")}</button>
        <button type="button" data-action="open-reset-workspace" aria-haspopup="dialog" data-i18n="resetWorkspace">${t("resetWorkspace")}</button>
        <button type="button" data-action="share" aria-haspopup="dialog" data-i18n="share">${t("share")}</button>
        <button type="button" data-action="open-about" aria-haspopup="dialog" data-i18n="about">${t("about")}</button>
        <span class="share-status" data-share-status role="status" aria-live="polite"></span>
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
        <div class="visibility-toggles">
          <label class="toggle-row" for="show-basis">
            <span class="toggle-label" data-i18n="basis">${t("basis")}</span>
            <input id="show-basis" name="show-basis" type="checkbox" data-action="toggle-basis" checked />
          </label>
          <label class="toggle-row" for="show-grid">
            <span class="toggle-label" data-i18n="grid">${t("grid")}</span>
            <input id="show-grid" name="show-grid" type="checkbox" data-action="toggle-grid" checked />
          </label>
        </div>
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
        <div role="row"><span role="cell"><kbd data-i18n="grid">${t("grid")}</kbd></span><span role="cell" data-i18n="gridDescription">${t("gridDescription")}</span></div>
        <div role="row">
          <span class="guide-add-controls" role="cell">
            <span class="preset-split guide-add-split" aria-label="${t("addMatrix")}" data-i18n-aria="addMatrix">
              <span class="equation-add-button preset-main guide-add-button"><math aria-hidden="true"><mo>+</mo><mi>M</mi></math></span>
              <span class="preset-menu" aria-hidden="true"><span class="preset-toggle"></span></span>
            </span>
            <span class="preset-split guide-add-split" aria-label="${t("addVector")}" data-i18n-aria="addVector">
              <span class="equation-add-button preset-main guide-add-button"><math aria-hidden="true"><mo>+</mo><mi>v</mi></math></span>
              <span class="preset-menu" aria-hidden="true"><span class="preset-toggle"></span></span>
            </span>
          </span>
          <span role="cell" data-i18n="addDescription">${t("addDescription")}</span>
        </div>
      </div>
      <section class="interaction-guide expression-guide" aria-labelledby="expression-guide-title">
        <h2 id="expression-guide-title" data-i18n="expressions">${t("expressions")}</h2>
        <p data-i18n="expressionsDescription">${t("expressionsDescription")}</p>
        <dl>
          <div><dt data-i18n="expressionOperators">${t("expressionOperators")}</dt><dd><span class="expression-tokens"><code>+</code><code>-</code><code>*</code><code>/</code><code>^</code><code>( )</code></span><span data-i18n="expressionOperatorsDescription">${t("expressionOperatorsDescription")}</span></dd></div>
          <div><dt data-i18n="expressionFunctions">${t("expressionFunctions")}</dt><dd><span class="expression-tokens"><code>pi</code><code>sqrt(x)</code><code>sin(x)</code><code>cos(x)</code><code>tan(x)</code></span><span data-i18n="expressionFunctionsDescription">${t("expressionFunctionsDescription")}</span></dd></div>
          <div><dt data-i18n="expressionExamples">${t("expressionExamples")}</dt><dd><span class="expression-tokens"><code>1/2</code><code>sqrt(2)/2</code><code>cos(pi/4)</code><code>2^(-3)</code></span></dd></div>
        </dl>
      </section>
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
    <dialog class="share-dialog" aria-labelledby="share-dialog-title">
      <div class="share-dialog-content">
        <h1 id="share-dialog-title" data-i18n="shareCopiedTitle">${t("shareCopiedTitle")}</h1>
        <p data-i18n="shareCopiedDescription">${t("shareCopiedDescription")}</p>
        <input class="share-link" type="text" name="share-link" readonly data-share-link aria-label="${t("shareLink")}" data-i18n-aria="shareLink" />
        <button type="button" data-action="close-share-dialog" data-i18n="close">${t("close")}</button>
      </div>
    </dialog>
    <dialog class="share-error-dialog" aria-labelledby="share-error-title">
      <div class="share-error-content">
        <h1 id="share-error-title" data-i18n="invalidShareTitle">${t("invalidShareTitle")}</h1>
        <p data-i18n="invalidShareDescription">${t("invalidShareDescription")}</p>
        <button type="button" data-action="close-share-error" data-i18n="close">${t("close")}</button>
      </div>
    </dialog>
    <dialog class="reset-workspace-dialog" aria-labelledby="reset-workspace-title">
      <div class="reset-workspace-content">
        <h1 id="reset-workspace-title" data-i18n="resetWorkspaceTitle">${t("resetWorkspaceTitle")}</h1>
        <p data-i18n="resetWorkspaceDescription">${t("resetWorkspaceDescription")}</p>
        <div class="reset-workspace-actions">
          <button type="button" data-action="close-reset-workspace" data-i18n="cancel">${t("cancel")}</button>
          <button class="danger-button" type="button" data-action="confirm-reset-workspace" data-i18n="confirmResetWorkspace">${t("confirmResetWorkspace")}</button>
        </div>
      </div>
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
const shareDialog = root.querySelector<HTMLDialogElement>(".share-dialog");
const shareLink = root.querySelector<HTMLInputElement>("[data-share-link]");
const shareErrorDialog = root.querySelector<HTMLDialogElement>(
	".share-error-dialog",
);
const resetWorkspaceDialog = root.querySelector<HTMLDialogElement>(
	".reset-workspace-dialog",
);
if (
	!canvas ||
	!matrixStack ||
	!animationMode ||
	!language ||
	!aboutDialog ||
	!shareDialog ||
	!shareLink ||
	!shareErrorDialog ||
	!resetWorkspaceDialog
) {
	throw new Error("Missing app controls");
}
const stackElement = matrixStack;
const animationModeElement = animationMode;
const languageElement = language;
languageElement.value = locale;
const shareDialogElement = shareDialog;
const shareLinkElement = shareLink;
const shareErrorDialogElement = shareErrorDialog;
const resetWorkspaceDialogElement = resetWorkspaceDialog;

const scene = new MatrixScene(canvas);

root.addEventListener("click", (event) => {
	const target = event.target as HTMLElement;
	if (target === aboutDialog) {
		aboutDialog.close();
		return;
	}
	if (target === shareDialog) {
		shareDialog.close();
		return;
	}
	if (target === shareErrorDialog) return;
	if (target === resetWorkspaceDialog) {
		resetWorkspaceDialog.close();
		return;
	}
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
	if (action === "add-matrix-preset" && actionButton.dataset.presetId)
		addMatrixPreset(actionButton.dataset.presetId);
	if (action === "add-eigenbasis") addEigenbasis();
	if (action === "add-eigenvector") addRepresentativeEigenvector();
	if (action === "play") togglePlayback();
	if (action === "reset") resetTransform();
	if (action === "reset-view") resetView();
	if (action === "open-reset-workspace")
		resetWorkspaceDialogElement.showModal();
	if (action === "close-reset-workspace") resetWorkspaceDialogElement.close();
	if (action === "confirm-reset-workspace") resetWorkspace();
	if (action === "share") void shareWorkspace();
	if (action === "close-share-dialog") shareDialog.close();
	if (action === "open-about") aboutDialog.showModal();
	if (action === "close-about") aboutDialog.close();
	if (action === "close-share-error") shareErrorDialog.close();
	if (action === "delete-matrix" && actionButton.dataset.id)
		deleteMatrix(actionButton.dataset.id);
	if (action === "delete-vector" && actionButton.dataset.id)
		deleteVector(actionButton.dataset.id);
});

document.addEventListener("click", (event) => {
	if ((event.target as HTMLElement).closest(".popup-menu")) return;
	closePopupMenus();
});

document.addEventListener("keydown", (event) => {
	const menuPanel = (event.target as HTMLElement).closest<HTMLElement>(
		".popup-menu-panel",
	);
	if (
		menuPanel &&
		["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
	) {
		const items = [
			...menuPanel.querySelectorAll<HTMLButtonElement>(
				"button:not(:disabled)",
			),
		];
		if (items.length === 0) return;
		const current = items.indexOf(
			document.activeElement as HTMLButtonElement,
		);
		const index =
			event.key === "Home"
				? 0
				: event.key === "End"
					? items.length - 1
					: event.key === "ArrowDown"
						? (current + 1) % items.length
						: (current - 1 + items.length) % items.length;
		event.preventDefault();
		items[index].focus();
		return;
	}
	if (event.key !== "Escape") return;
	const openMenu =
		root.querySelector<HTMLDetailsElement>(".popup-menu[open]");
	if (!openMenu) return;
	openMenu.open = false;
	openMenu.querySelector<HTMLElement>("summary")?.focus();
});

root.addEventListener(
	"toggle",
	(event) => {
		const menu = event.target;
		if (
			!(menu instanceof HTMLDetailsElement) ||
			!menu.matches(".popup-menu")
		)
			return;
		menu.querySelector("summary")?.setAttribute(
			"aria-expanded",
			String(menu.open),
		);
		if (!menu.open) return;
		root.querySelectorAll<HTMLDetailsElement>(".popup-menu[open]").forEach(
			(other) => {
				if (other !== menu) other.open = false;
			},
		);
	},
	true,
);

root.addEventListener("input", (event) => {
	if (event.target instanceof HTMLInputElement) handleInput(event.target);
});

root.addEventListener("change", (event) => {
	const target = event.target as HTMLElement;
	if (target === animationModeElement) {
		state.animation.mode =
			animationModeElement.value === "composed" ? "composed" : "steps";
		resetAnimation(false);
		renderUi();
	}
	if (target === languageElement) {
		void navigateToAlternateLocale();
	}
	if (
		target instanceof HTMLInputElement &&
		target.dataset.action === "toggle-basis"
	) {
		state.showBasis = target.checked;
		renderUi(false);
	}
	if (
		target instanceof HTMLInputElement &&
		target.dataset.action === "toggle-grid"
	) {
		state.showGrid = target.checked;
		renderUi(false);
	}
});

stackElement.addEventListener("pointerdown", (event) => {
	const target = event.target as HTMLElement;
	if (target.closest("input")) {
		isInteractingWithInput = true;
	}
});

const finishInputInteraction = (): void => {
	isInteractingWithInput = false;
};
window.addEventListener("pointerup", finishInputInteraction);
window.addEventListener("pointercancel", finishInputInteraction);

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
	finishDragging();
});

stackElement.addEventListener("dragend", finishDragging);

function finishDragging(): void {
	clearDropIndicator();
	clearDraggingElement();
	dragState = null;
}

function addMatrix(): void {
	const workspace = getWorkspace(state);
	if (!canAddWorkspaceNodes(workspace, "matrices")) return;
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
	if (!canAddWorkspaceNodes(workspace, "vectors")) return;
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

function addMatrixPreset(presetId: string): void {
	const workspace = getWorkspace(state);
	const preset = getMatrixPresets(workspace.dimension).find(
		(item) => item.id === presetId,
	);
	if (!preset || !canAddWorkspaceNodes(workspace, "matrices")) return;
	workspace.matrices.unshift(
		createMatrixNode(
			workspace.dimension,
			nextMatrixLabel(workspace.matrices.map((matrix) => matrix.label)),
			preset.values,
			preset.draftValues,
		),
	);
	resetAnimation();
}

function addEigenbasis(): void {
	const workspace = getWorkspace(state);
	const basis = getRealEigenbasis(
		workspace.dimension,
		getTotalTransform(workspace),
	);
	if (!basis || !canAddWorkspaceNodes(workspace, "vectors", basis.length))
		return;
	for (const components of basis) {
		const color =
			vectorColors[workspace.vectors.length % vectorColors.length];
		workspace.vectors.push(
			createVectorNode(
				workspace.dimension,
				nextVectorLabel(
					workspace.vectors.map((vector) => vector.label),
				),
				color,
				components,
				components.map(formatInputNumber),
			),
		);
	}
	resetAnimation();
}

function addRepresentativeEigenvector(): void {
	const workspace = getWorkspace(state);
	if (!canAddWorkspaceNodes(workspace, "vectors")) return;
	const vector = getRepresentativeRealEigenvector(
		workspace.dimension,
		getTotalTransform(workspace),
	);
	if (!vector) return;
	const color = vectorColors[workspace.vectors.length % vectorColors.length];
	workspace.vectors.push(
		createVectorNode(
			workspace.dimension,
			nextVectorLabel(workspace.vectors.map((item) => item.label)),
			color,
			vector,
			vector.map(formatInputNumber),
		),
	);
	resetAnimation();
}

function closePopupMenus(): void {
	root.querySelectorAll<HTMLDetailsElement>(".popup-menu[open]").forEach(
		(menu) => {
			menu.open = false;
		},
	);
}

function resetWorkspace(): void {
	window.location.replace(
		`${window.location.pathname}${window.location.search}`,
	);
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
		updateMatrixGridWidth(input);
		updateMatrixEntry(
			input.dataset.matrixId,
			Number(input.dataset.entryIndex),
			input.value,
		);
		return;
	}
	if (input.dataset.vectorId && input.dataset.componentIndex !== undefined) {
		updateVectorColumnWidths(input);
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
		inputSelector: `input[data-matrix-id="${CSS.escape(id)}"]`,
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
		`[data-duration-output="${CSS.escape(id)}"]`,
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
		inputSelector: `input[data-vector-id="${CSS.escape(id)}"]`,
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
		.map((entry) =>
			evaluateBoundedExpression(entry, maxAbsoluteInputValue),
		);
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

let shareStatusTimer = 0;

async function encodeCurrentSession(): Promise<string> {
	const now = performance.now();
	const elapsedMs =
		state.animation.status === "idle"
			? 0
			: getAnimationElapsed(state.animation, now);
	return encodeShareSession({
		state,
		elapsedMs,
		cameras: scene.getCameraSnapshots(),
	});
}

async function navigateToAlternateLocale(): Promise<void> {
	const selectedLocale = languageElement.value;
	const selectedLocaleMetadata = localeMetadata.find(
		({ code }) => code === selectedLocale,
	);
	if (!selectedLocaleMetadata) {
		languageElement.value = locale;
		return;
	}
	const appRootUrl = getAppRootUrl(
		window.location.href,
		document.documentElement.dataset.appRootUrl ?? import.meta.env.BASE_URL,
	);
	const alternateLocaleUrl = new URL(selectedLocaleMetadata.path, appRootUrl)
		.href;

	try {
		const payload = await encodeCurrentSession();
		const url = getAlternateLocaleUrl(
			window.location.href,
			alternateLocaleUrl,
			payload,
		);
		if (url.length > MAX_SHARE_FRAGMENT_LENGTH)
			throw new Error("Share payload is too large");
		window.location.assign(url);
	} catch (error) {
		languageElement.value = locale;
		setShareStatus(
			error instanceof Error &&
				error.message === "Share payload is too large"
				? "shareTooLarge"
				: "copyFailed",
		);
	}
}

async function shareWorkspace(): Promise<void> {
	try {
		const payload = await encodeCurrentSession();
		const url = new URL(window.location.href);
		url.hash = `s=${payload}`;
		if (url.href.length > MAX_SHARE_FRAGMENT_LENGTH)
			throw new Error("Share payload is too large");
		await navigator.clipboard.writeText(url.href);
		window.history.replaceState(window.history.state, "", url);
		setShareStatus("copied");
		shareLinkElement.value = url.href;
		shareDialogElement.showModal();
		shareLinkElement.select();
	} catch (error) {
		setShareStatus(
			error instanceof Error &&
				error.message === "Share payload is too large"
				? "shareTooLarge"
				: "copyFailed",
		);
	}
}

function setShareStatus(key: MessageKey): void {
	window.clearTimeout(shareStatusTimer);
	const button = root.querySelector<HTMLButtonElement>(
		"[data-action='share']",
	);
	const status = root.querySelector<HTMLElement>("[data-share-status]");
	if (button) button.textContent = t(key);
	if (status) status.textContent = t(key);
	shareStatusTimer = window.setTimeout(() => {
		if (button) button.textContent = t("share");
		if (status) status.textContent = "";
	}, 2_000);
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
	const gridCheckbox = root.querySelector<HTMLInputElement>(
		"[data-action='toggle-grid']",
	);
	if (gridCheckbox) gridCheckbox.checked = state.showGrid;
	animationModeElement.value = state.animation.mode;

	if (renderStack) stackElement.innerHTML = renderEquation();
	else updateVectorPresetAvailability();
	updateAnimationHighlight(performance.now());
}

function updatePlaybackControl(): void {
	const playButton = root.querySelector<HTMLButtonElement>(
		"[data-action='play']",
	);
	if (!playButton) return;
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
      ${renderMatrixAddControl(`matrix-add-button-${dimension}`)}
    </li>
  `;
}

function renderAddVectorOperand(): string {
	const dimension = getWorkspace(state).dimension;
	return `
    ${renderVectorAddControl(`vector-add-button-${dimension}`)}
  `;
}

function renderMatrixAddControl(positionClass: string): string {
	const workspace = getWorkspace(state);
	const addDisabled = canAddWorkspaceNodes(workspace, "matrices")
		? ""
		: "disabled";
	return `
    <div class="preset-split matrix-add-button ${positionClass}">
      <button class="equation-add-button preset-main" type="button" data-action="add-matrix" aria-label="${t("addMatrix")}" title="${t("addMatrix")}" ${addDisabled}>
        <math aria-hidden="true"><mo>+</mo><mi>M</mi></math>
      </button>
      <details class="preset-menu popup-menu">
        <summary class="preset-toggle" aria-label="${t("matrixPresets")}" title="${t("matrixPresets")}" aria-haspopup="menu" aria-expanded="false"></summary>
        <div class="preset-menu-panel popup-menu-panel" role="menu" aria-label="${t("matrixPresets")}">
          ${getMatrixPresets(getWorkspace(state).dimension)
				.map(
					(preset) => `
            <button type="button" role="menuitem" data-action="add-matrix-preset" data-preset-id="${preset.id}" ${addDisabled}>
              ${escapeHtml(matrixPresetName(preset))}
            </button>`,
				)
				.join("")}
        </div>
      </details>
    </div>
  `;
}

function renderVectorAddControl(positionClass: string): string {
	const workspace = getWorkspace(state);
	const transform = getTotalTransform(workspace);
	const vectorCapacity = canAddWorkspaceNodes(workspace, "vectors");
	const basis = getRealEigenbasis(workspace.dimension, transform);
	const basisAvailable = Boolean(
		basis && canAddWorkspaceNodes(workspace, "vectors", basis.length),
	);
	const vectorAvailable =
		Boolean(
			getRepresentativeRealEigenvector(workspace.dimension, transform),
		) && vectorCapacity;
	const addDisabled = vectorCapacity ? "" : "disabled";
	return `
    <div class="preset-split vector-add-button ${positionClass}">
      <button class="equation-add-button preset-main" type="button" data-action="add-vector" aria-label="${t("addVector")}" title="${t("addVector")}" ${addDisabled}>
        <math aria-hidden="true"><mo>+</mo><mi>v</mi></math>
      </button>
      <details class="preset-menu popup-menu">
        <summary class="preset-toggle" aria-label="${t("vectorPresets")}" title="${t("vectorPresets")}" aria-haspopup="menu" aria-expanded="false"></summary>
        <div class="preset-menu-panel popup-menu-panel" role="menu" aria-label="${t("vectorPresets")}">
          <button type="button" role="menuitem" data-action="add-eigenvector" ${vectorAvailable ? "" : "disabled"}>${t("oneEigenvector")}</button>
          <span class="preset-unavailable" data-eigenvector-unavailable ${vectorAvailable ? "hidden" : ""}>${t("eigenvectorUnavailable")}</span>
          <button type="button" role="menuitem" data-action="add-eigenbasis" ${basisAvailable ? "" : "disabled"}>${t("allEigenbasis")}</button>
          <span class="preset-unavailable" data-eigenbasis-unavailable ${basisAvailable ? "hidden" : ""}>${t("eigenbasisUnavailable")}</span>
        </div>
      </details>
    </div>
  `;
}

function updateVectorPresetAvailability(): void {
	const workspace = getWorkspace(state);
	const transform = getTotalTransform(workspace);
	const basis = getRealEigenbasis(workspace.dimension, transform);
	const basisAvailable = Boolean(
		basis && canAddWorkspaceNodes(workspace, "vectors", basis.length),
	);
	const vectorAvailable =
		Boolean(
			getRepresentativeRealEigenvector(workspace.dimension, transform),
		) && canAddWorkspaceNodes(workspace, "vectors");
	root.querySelectorAll<HTMLButtonElement>(
		"[data-action='add-eigenbasis']",
	).forEach((button) => {
		button.disabled = !basisAvailable;
	});
	root.querySelectorAll<HTMLElement>("[data-eigenbasis-unavailable]").forEach(
		(message) => {
			message.toggleAttribute("hidden", basisAvailable);
		},
	);
	root.querySelectorAll<HTMLButtonElement>(
		"[data-action='add-eigenvector']",
	).forEach((button) => {
		button.disabled = !vectorAvailable;
	});
	root.querySelectorAll<HTMLElement>(
		"[data-eigenvector-unavailable]",
	).forEach((message) => {
		message.toggleAttribute("hidden", vectorAvailable);
	});
}

function matrixPresetName(preset: MatrixPreset): string {
	if (preset.kind === "identity") return t("identityPreset");
	if (preset.kind === "reflection")
		return t(
			getWorkspace(state).dimension === 2
				? "reflectionAxisPreset"
				: "reflectionPlanePreset",
			{ axis: preset.axis },
		);
	return t("rotationPreset", {
		angle: preset.angle ?? 0,
		axis: preset.axis ? ` ${t("aroundAxis", { axis: preset.axis })}` : "",
	});
}

function renderMatrixCard(matrix: MatrixNode): string {
	const dimension = getWorkspace(state).dimension;
	const columns = dimension;
	const columnTemplate = renderEntryColumnTemplate(
		groupEntriesByColumn(matrix.draftValues, columns),
	);
	const entries = matrix.draftValues
		.map((value, entryIndex) => {
			const inputName = `matrix-${matrix.id}-entry-${entryIndex}`;
			return `
        <input
          name="${inputName}"
          type="text"
          inputmode="text"
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
            <div class="matrix-grid matrix-grid-${dimension}" style="grid-template-columns:${columnTemplate}" role="group" aria-label="${t("matrixEntries", { label: matrix.label })}">
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

function updateMatrixGridWidth(input: HTMLInputElement): void {
	const grid = input.closest<HTMLElement>(".matrix-grid");
	if (!grid) return;
	const values = [...grid.querySelectorAll<HTMLInputElement>("input")].map(
		(entry) => entry.value,
	);
	const columns = grid.classList.contains("matrix-grid-3") ? 3 : 2;
	applyEntryColumnTemplate([grid], groupEntriesByColumn(values, columns));
}

function renderVectorMatrix(): string {
	const workspace = getWorkspace(state);
	const columnTemplate = renderEntryColumnTemplate(
		workspace.vectors.map((vector) => vector.draftComponents),
		["60px"],
	);
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
          inputmode="text"
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
        ${renderVectorAddControl("vector-add-button-inline")}
      </div>
      <div class="vector-expression vector-expression-${workspace.dimension}" style="grid-template-columns:${columnTemplate}" role="group" aria-label="${t("inputVectorColumns")}">
          ${entries}
      </div>
      <div class="card-balance-row" aria-hidden="true"></div>
    </article>
  `;
}

function updateVectorColumnWidths(input: HTMLInputElement): void {
	const card = input.closest<HTMLElement>(".vector-matrix-card");
	if (!card) return;
	const columns = [
		...card.querySelectorAll<HTMLElement>(".vector-column-label"),
	].map((label) => {
		const vectorId = label.dataset.vectorColumnId;
		if (!vectorId) return [];
		return [
			...card.querySelectorAll<HTMLInputElement>(
				`input[data-vector-id="${CSS.escape(vectorId)}"]`,
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

function groupEntriesByColumn(
	values: string[],
	columnCount: number,
): string[][] {
	return Array.from({ length: columnCount }, (_, column) =>
		values.filter((_, index) => index % columnCount === column),
	);
}

function renderEntryColumnTemplate(
	columns: string[][],
	trailingTracks: string[] = [],
): string {
	const tracks = columns.map((values) => {
		const width = Math.min(
			36,
			Math.max(4, ...values.map((value) => Array.from(value).length)),
		);
		return `max(var(--matrix-column-width), calc(${width} * 1ch + 10px))`;
	});
	return [...tracks, ...trailingTracks].join(" ");
}

function applyEntryColumnTemplate(
	elements: HTMLElement[],
	columns: string[][],
	trailingTracks: string[] = [],
): void {
	const template = renderEntryColumnTemplate(columns, trailingTracks);
	elements.forEach((element) => {
		element.style.gridTemplateColumns = template;
	});
}

function renderResultMatrix(): string {
	const workspace = getWorkspace(state);
	const formattedVectors = getTransformedVectors(workspace).map(
		(components) => components.map(formatNumber),
	);
	const columnTemplate = renderEntryColumnTemplate(formattedVectors);
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
	const entries = Array.from(
		{ length: workspace.dimension },
		(_, componentIndex) =>
			formattedVectors
				.map(
					(components, vectorIndex) =>
						`<output data-result-vector-index="${vectorIndex}" data-result-component-index="${componentIndex}">${components[componentIndex] ?? "0"}</output>`,
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
		`.vector-column-label[data-vector-column-id="${CSS.escape(vectorId)}"]`,
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
				`.vector-expression [data-vector-column-id="${CSS.escape(element.dataset.vectorColumnId)}"]`,
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
    <div class="vector-drag-preview-values">
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

function formatNumber(value: number): string {
	const rounded = Math.abs(value) < 0.000001 ? 0 : value;
	return Number.isInteger(rounded)
		? String(rounded)
		: rounded.toFixed(3).replace(/\.?0+$/, "");
}

function formatInputNumber(value: number): string {
	const rounded = Math.abs(value) < 0.0000000001 ? 0 : value;
	return Number.isInteger(rounded)
		? String(rounded)
		: Number(rounded.toPrecision(8)).toString();
}

function updateAnimationHighlight(now: number): void {
	const workspace = getWorkspace(state);
	const progress = getAnimationProgress(workspace, state.animation, now);
	const items = stackElement.querySelectorAll<HTMLElement>(
		".matrix-item[data-matrix-id]",
	);

	if (!progress) {
		items.forEach((item) => setAnimationHighlight(item, false, 0));
		return;
	}

	if (progress.mode === "composed") {
		items.forEach((item) =>
			setAnimationHighlight(item, true, progress.progress),
		);
		return;
	}

	items.forEach((item) => {
		const isActive = item.dataset.matrixId === progress.matrixId;
		setAnimationHighlight(item, isActive, isActive ? progress.progress : 0);
	});
}

function setAnimationHighlight(
	item: HTMLElement,
	isActive: boolean,
	progress: number,
): void {
	item.toggleAttribute("data-active-step", isActive);
	if (isActive) item.setAttribute("aria-current", "step");
	else item.removeAttribute("aria-current");
	item.style.setProperty(
		"--step-progress",
		`${Math.max(0, Math.min(1, progress)) * 100}%`,
	);
}

function updateResultOutputs(): void {
	const workspace = getWorkspace(state);
	const formattedVectors = getTransformedVectors(workspace).map(
		(components) => components.map(formatNumber),
	);
	formattedVectors.forEach((transformed, vectorIndex) => {
		for (
			let componentIndex = 0;
			componentIndex < workspace.dimension;
			componentIndex += 1
		) {
			const output = stackElement.querySelector<HTMLOutputElement>(
				`output[data-result-vector-index="${vectorIndex}"][data-result-component-index="${componentIndex}"]`,
			);
			if (output) {
				const formattedValue = transformed[componentIndex] ?? "0";
				output.value = formattedValue;
				output.textContent = formattedValue;
			}
		}
	});
	const card = stackElement.querySelector<HTMLElement>(".result-matrix-card");
	if (!card) return;
	applyEntryColumnTemplate(
		[
			...card.querySelectorAll<HTMLElement>(
				".result-column-labels, .result-expression",
			),
		],
		formattedVectors,
	);
}

function tick(now: number): void {
	const workspace = getWorkspace(state);
	if (
		state.animation.status === "playing" &&
		getAnimationElapsed(state.animation, now) >=
			getAnimationDuration(workspace, state.animation.mode)
	) {
		workspace.appliedTransform = getTotalTransform(workspace);
		state.animation.status = "idle";
		renderUi(false);
	}
	updateAnimationHighlight(now);
	scene.render(getRenderState(state, now));
	requestAnimationFrame(tick);
}

async function initialize(): Promise<void> {
	const hash = window.location.hash;
	if (hash.startsWith("#s=")) {
		try {
			const restored = await decodeShareSession(hash.slice(3));
			state = restored.state;
			if (state.animation.status === "paused") {
				const now = performance.now();
				state.animation.startedAt = now - restored.elapsedMs;
				state.animation.pausedAt = now;
			}
			scene.restoreCameraSnapshots(restored.cameras);
		} catch {
			state = createInitialState();
			shareErrorDialogElement.showModal();
		}
	}
	renderUi();
	requestAnimationFrame(tick);
}

void initialize();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		const appRootUrl = getAppRootUrl(
			window.location.href,
			document.documentElement.dataset.appRootUrl ??
				import.meta.env.BASE_URL,
		);
		void navigator.serviceWorker.register(new URL("sw.js", appRootUrl), {
			scope: appRootUrl.pathname,
		});
	});
}
