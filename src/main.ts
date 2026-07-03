import "./styles.css";
import packageJson from "../package.json";
import { MatrixScene } from "./ui/scene";
import { AppState, createInitialState, getWorkspace } from "./app/state";
import { getAnimationDuration } from "./domain/animation";
import { getPlaybackElapsed, resetPlayback } from "./app/playback-state";
import { getRenderState } from "./app/render-state";
import { Dimension } from "./domain/math";
import { Locale, MessageKey, translate } from "./i18n";
import { getLocaleFromLanguageTag } from "./app/locale-routing";
import { registerAppServiceWorker } from "./app/service-worker-registration";
import { decodeShareSession } from "./infrastructure/session-codec";
import { restoreSessionSnapshot } from "./app/session-snapshot";
import { WorkspaceController } from "./app/workspace-controller";
import { ShareController } from "./app/share-controller";
import { PlaybackController } from "./app/playback-controller";
import { renderAppShell } from "./ui/app-shell";
import { DragController } from "./ui/drag-controller";
import { UiController } from "./ui/ui-controller";
import {
	updateMatrixGridWidth,
	updateVectorColumnWidths,
} from "./ui/equation-cards";
import { EquationRenderer } from "./ui/equation-renderer";

let state: AppState = createInitialState(() => crypto.randomUUID());
const appVersion = packageJson.version;
const locale: Locale = getLocaleFromLanguageTag(document.documentElement.lang);
const t = (key: MessageKey, values?: Record<string, string | number>): string =>
	translate(locale, key, values);
const maxNumericInputLength = 64;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
	throw new Error("Missing #app root");
}
const root = app;

root.innerHTML = renderAppShell(t, appVersion);
root.inert = true;
root.setAttribute("aria-busy", "true");

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

let animationFrame = 0;
let disposed = false;
const scene = new MatrixScene(canvas, scheduleRender);
const equationRenderer = new EquationRenderer({
	root,
	t,
	getWorkspace: () => getWorkspace(state),
	maxInputLength: maxNumericInputLength,
});
const uiController = new UiController({
	root,
	stack: stackElement,
	animationMode: animationModeElement,
	t,
	getState: () => state,
	renderEquation: () => equationRenderer.render(),
	updatePresetAvailability: () => equationRenderer.updatePresetAvailability(),
	scheduleRender,
});
const playbackController = new PlaybackController({
	getState: () => state,
	render: (renderStack) => uiController.render(renderStack),
	now: () => performance.now(),
});
const workspaceController = new WorkspaceController(root, stackElement, t, {
	getState: () => state,
	commit: ({ renderStack = true, updateResults = false } = {}) => {
		state.animation = resetPlayback(state.animation);
		uiController.render(renderStack);
		if (updateResults) uiController.updateResults();
	},
	updateMatrixWidth: updateMatrixGridWidth,
	updateVectorWidths: updateVectorColumnWidths,
});
const shareController = new ShareController({
	root,
	language: languageElement,
	shareDialog: shareDialogElement,
	shareLink: shareLinkElement,
	locale,
	t,
	getState: () => state,
	getCameras: () => scene.getCameraSnapshots(),
});
const dragController = new DragController(stackElement, {
	moveMatrix: (id, targetId, side) =>
		workspaceController.moveMatrix(id, targetId, side),
	moveVector: (id, targetId, side) =>
		workspaceController.moveVector(id, targetId, side),
	createVectorPreview: (id) => equationRenderer.createVectorDragPreview(id),
});

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
		playbackController.reset();
	}

	if (!actionButton) return;
	const action = actionButton.dataset.action;
	if (action === "add-matrix") workspaceController.addMatrix();
	if (action === "add-vector") workspaceController.addVector();
	if (action === "add-matrix-preset" && actionButton.dataset.presetId)
		workspaceController.addMatrixPreset(actionButton.dataset.presetId);
	if (action === "add-eigenbasis") workspaceController.addEigenbasis();
	if (action === "add-eigenvector")
		workspaceController.addRepresentativeEigenvector();
	if (action === "play") playbackController.toggle();
	if (action === "reset") playbackController.resetTransform();
	if (action === "reset-view") resetView();
	if (action === "open-reset-workspace")
		resetWorkspaceDialogElement.showModal();
	if (action === "close-reset-workspace") resetWorkspaceDialogElement.close();
	if (action === "confirm-reset-workspace") resetWorkspace();
	if (action === "share") void shareController.shareWorkspace();
	if (action === "close-share-dialog") shareDialog.close();
	if (action === "open-about") aboutDialog.showModal();
	if (action === "close-about") aboutDialog.close();
	if (action === "close-share-error") shareErrorDialog.close();
	if (action === "delete-matrix" && actionButton.dataset.id)
		workspaceController.deleteMatrix(actionButton.dataset.id);
	if (action === "delete-vector" && actionButton.dataset.id)
		workspaceController.deleteVector(actionButton.dataset.id);
});

document.addEventListener("click", (event) => {
	if ((event.target as HTMLElement).closest(".popup-menu")) return;
	closePopupMenus();
});

document.addEventListener("keydown", (event) => {
	if (
		event.altKey &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.shiftKey &&
		(event.key === "ArrowLeft" || event.key === "ArrowRight") &&
		event.target instanceof HTMLElement
	) {
		const sortable = event.target.closest<HTMLElement>(
			".matrix-item[data-matrix-id], .vector-column-label[data-vector-column-id]",
		);
		if (sortable === event.target) {
			event.preventDefault();
			workspaceController.moveFocusedItem(
				sortable,
				event.key === "ArrowLeft" ? -1 : 1,
			);
			return;
		}
	}
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
	if (event.target instanceof HTMLInputElement)
		workspaceController.handleInput(event.target);
});

root.addEventListener("change", (event) => {
	const target = event.target as HTMLElement;
	if (target === animationModeElement) {
		state.animation.mode =
			animationModeElement.value === "composed" ? "composed" : "steps";
		playbackController.reset(false);
		uiController.render();
	}
	if (target === languageElement) {
		void shareController.navigateToSelectedLocale();
	}
	if (
		target instanceof HTMLInputElement &&
		target.dataset.action === "toggle-basis"
	) {
		state.showBasis = target.checked;
		uiController.render(false);
	}
	if (
		target instanceof HTMLInputElement &&
		target.dataset.action === "toggle-grid"
	) {
		state.showGrid = target.checked;
		uiController.render(false);
	}
});

function closePopupMenus(): void {
	root.querySelectorAll<HTMLDetailsElement>(".popup-menu[open]").forEach(
		(menu) => {
			menu.open = false;
		},
	);
}

function resetWorkspace(): void {
	state = createInitialState(() => crypto.randomUUID());
	scene.resetView(2);
	scene.resetView(3);
	resetWorkspaceDialogElement.close();
	const url = new URL(window.location.href);
	url.hash = "";
	window.history.replaceState(window.history.state, "", url);
	uiController.render();
}

function resetView(): void {
	scene.resetView(state.activeDimension);
	scheduleRender();
}

function scheduleRender(): void {
	if (
		disposed ||
		animationFrame !== 0 ||
		document.visibilityState === "hidden"
	)
		return;
	animationFrame = requestAnimationFrame(renderFrame);
}

function renderFrame(now: number): void {
	animationFrame = 0;
	const workspace = getWorkspace(state);
	if (
		state.animation.status === "playing" &&
		getPlaybackElapsed(state.animation, now) >=
			getAnimationDuration(
				workspace.lastValidEvaluation,
				state.animation.mode,
			)
	) {
		playbackController.complete();
	}
	uiController.updateAnimationHighlight(now);
	const controlsChanged = scene.render(getRenderState(state, now));
	if (state.animation.status === "playing" || controlsChanged) {
		scheduleRender();
	}
}

async function initialize(): Promise<void> {
	const hash = window.location.hash;
	if (hash.startsWith("#s=")) {
		try {
			const restored = await decodeShareSession(hash.slice(3));
			state = restoreSessionSnapshot(restored);
			scene.restoreCameraSnapshots(restored.cameras);
		} catch {
			state = createInitialState(() => crypto.randomUUID());
			shareErrorDialogElement.showModal();
		}
	}
	uiController.render();
	root.inert = false;
	root.removeAttribute("aria-busy");
}

void initialize();

canvas.addEventListener("pointerdown", scheduleRender);
canvas.addEventListener("wheel", scheduleRender, { passive: true });
canvas.addEventListener("touchstart", scheduleRender, { passive: true });
window.addEventListener("resize", scheduleRender);
window.addEventListener("pageshow", scheduleRender);
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "hidden") {
		if (animationFrame !== 0) cancelAnimationFrame(animationFrame);
		animationFrame = 0;
		if (playbackController.pauseForVisibility()) {
			uiController.updatePlaybackControl();
		}
		return;
	}
	scheduleRender();
});
window.addEventListener("pagehide", (event) => {
	if (event.persisted || disposed) return;
	disposed = true;
	if (animationFrame !== 0) cancelAnimationFrame(animationFrame);
	animationFrame = 0;
	shareController.dispose();
	dragController.dispose();
	scene.dispose();
});

if (import.meta.env.PROD && "serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		void registerAppServiceWorker({
			currentUrl: window.location.href,
			baseUrl:
				document.documentElement.dataset.appRootUrl ??
				import.meta.env.BASE_URL,
			version: appVersion,
			register: (scriptUrl, options) =>
				navigator.serviceWorker.register(scriptUrl, options),
		});
	});
}
