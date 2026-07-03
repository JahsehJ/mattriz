import "./styles.css";
import packageJson from "../package.json";
import { MatrixScene } from "./ui/scene";
import { AppState, createInitialState } from "./app/state";
import { getRenderState } from "./app/render-state";
import { Dimension } from "./domain/math";
import { Locale, MessageKey, translate } from "./i18n";
import { getLocaleFromLanguageTag } from "./app/locale-routing";
import { registerAppServiceWorker } from "./app/service-worker-registration";
import { decodeShareSession } from "./infrastructure/session-codec";
import { restoreSessionSnapshot } from "./app/session-snapshot";
import { ApplicationController } from "./app/application-controller";
import { ShareController } from "./app/share-controller";
import { renderAppShell } from "./ui/app-shell";
import { DragController } from "./ui/drag-controller";

const createId = (): string => crypto.randomUUID();
let state: AppState = createInitialState(createId);
const appVersion = packageJson.version;
const locale: Locale = getLocaleFromLanguageTag(document.documentElement.lang);
const t = (key: MessageKey, values?: Record<string, string | number>): string =>
	translate(locale, key, values);

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
	throw new Error("Missing #app root");
}
const root = app;

root.innerHTML = renderAppShell(t, appVersion);
root.inert = true;
root.setAttribute("aria-busy", "true");

function requireElement<T extends Element>(selector: string): T {
	const element = root.querySelector<T>(selector);
	if (!element) throw new Error(`Missing app control: ${selector}`);
	return element;
}

const canvas = requireElement<HTMLCanvasElement>(".scene-canvas");
const matrixStack = requireElement<HTMLElement>("[data-matrix-stack]");
const animationMode = requireElement<HTMLSelectElement>(
	"[data-animation-mode]",
);
const language = requireElement<HTMLSelectElement>("[data-language]");
const aboutDialog = requireElement<HTMLDialogElement>(".about-dialog");
const shareDialog = requireElement<HTMLDialogElement>(".share-dialog");
const shareLink = requireElement<HTMLInputElement>("[data-share-link]");
const shareErrorDialog = requireElement<HTMLDialogElement>(
	".share-error-dialog",
);
const resetWorkspaceDialog = requireElement<HTMLDialogElement>(
	".reset-workspace-dialog",
);
language.value = locale;

let animationFrame = 0;
let disposed = false;
const scene = new MatrixScene(canvas, scheduleRender);
const appController = new ApplicationController(
	root,
	matrixStack,
	animationMode,
	t,
	{
		getState: () => state,
		scheduleRender,
		now: () => performance.now(),
		createId,
	},
);
const shareController = new ShareController({
	root,
	language,
	shareDialog,
	shareLink,
	locale,
	t,
	getState: () => state,
	getCameras: () => scene.getCameraSnapshots(),
});
const dragController = new DragController(matrixStack, {
	moveMatrix: (id, targetId, side) =>
		appController.moveMatrix(id, targetId, side),
	moveVector: (id, targetId, side) =>
		appController.moveVector(id, targetId, side),
	createVectorPreview: (id) => appController.createVectorPreview(id),
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
		appController.resetPlayback();
	}

	if (!actionButton) return;
	const action = actionButton.dataset.action;
	if (action === "add-matrix") appController.addMatrix();
	if (action === "add-vector") appController.addVector();
	if (action === "add-matrix-preset" && actionButton.dataset.presetId)
		appController.addMatrixPreset(actionButton.dataset.presetId);
	if (action === "add-eigenbasis") appController.addEigenbasis();
	if (action === "add-eigenvector")
		appController.addRepresentativeEigenvector();
	if (action === "play") appController.togglePlayback();
	if (action === "reset") appController.resetTransform();
	if (action === "reset-view") resetView();
	if (action === "open-reset-workspace") resetWorkspaceDialog.showModal();
	if (action === "close-reset-workspace") resetWorkspaceDialog.close();
	if (action === "confirm-reset-workspace") resetWorkspace();
	if (action === "share") void shareController.shareWorkspace();
	if (action === "close-share-dialog") shareDialog.close();
	if (action === "open-about") aboutDialog.showModal();
	if (action === "close-about") aboutDialog.close();
	if (action === "close-share-error") shareErrorDialog.close();
	if (action === "delete-matrix" && actionButton.dataset.id)
		appController.deleteMatrix(actionButton.dataset.id);
	if (action === "delete-vector" && actionButton.dataset.id)
		appController.deleteVector(actionButton.dataset.id);
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
			appController.moveFocusedItem(
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
		if (menu.querySelector("[data-action='add-eigenvector']"))
			appController.updateVectorPresetAvailability();
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
		appController.handleInput(event.target);
});

root.addEventListener("change", (event) => {
	const target = event.target as HTMLElement;
	if (target === animationMode) {
		state.animation.mode =
			animationMode.value === "composed" ? "composed" : "steps";
		appController.resetPlayback();
	}
	if (target === language) {
		void shareController.navigateToSelectedLocale();
	}
	if (
		target instanceof HTMLInputElement &&
		target.dataset.action === "toggle-basis"
	) {
		state.showBasis = target.checked;
		appController.render(false);
	}
	if (
		target instanceof HTMLInputElement &&
		target.dataset.action === "toggle-grid"
	) {
		state.showGrid = target.checked;
		appController.render(false);
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
	state = createInitialState(createId);
	scene.resetView(2);
	scene.resetView(3);
	resetWorkspaceDialog.close();
	const url = new URL(window.location.href);
	url.hash = "";
	window.history.replaceState(window.history.state, "", url);
	appController.render();
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
	appController.completePlayback();
	appController.updateAnimationHighlight(now);
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
			state = restoreSessionSnapshot(restored, createId);
			scene.restoreCameraSnapshots(restored.cameras);
		} catch {
			state = createInitialState(createId);
			shareErrorDialog.showModal();
		}
	}
	appController.render();
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
		if (appController.pauseForVisibility()) {
			appController.updatePlaybackControl();
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
