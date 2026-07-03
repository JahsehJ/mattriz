import type { MessageKey, Translate } from "../i18n";
import { getTransformedVectors } from "../domain/workspace";
import { type AppState, getWorkspace } from "../app/state";
import { getAnimationProgress } from "../domain/animation";
import { getAnimationFrame } from "../app/playback-state";
import { applyEntryColumnTemplate } from "./equation-layout";
import { formatDisplayNumber } from "./number-formatting";
import { canRenderWorkspace } from "../rendering/capability";

interface UiControllerOptions {
	root: HTMLElement;
	stack: HTMLElement;
	animationMode: HTMLSelectElement;
	t: Translate;
	getState(): AppState;
	renderEquation(): string;
	updatePresetAvailability(): void;
	scheduleRender(): void;
}

export class UiController {
	constructor(private readonly options: UiControllerOptions) {}

	render(renderStack = true): void {
		const state = this.options.getState();
		this.options.root
			.querySelectorAll<HTMLButtonElement>("[data-dimension]")
			.forEach((button) => {
				button.toggleAttribute(
					"aria-pressed",
					Number(button.dataset.dimension) === state.activeDimension,
				);
			});
		this.updatePlaybackControl();
		const basis = this.options.root.querySelector<HTMLInputElement>(
			"[data-action='toggle-basis']",
		);
		if (basis) basis.checked = state.showBasis;
		const grid = this.options.root.querySelector<HTMLInputElement>(
			"[data-action='toggle-grid']",
		);
		if (grid) grid.checked = state.showGrid;
		this.options.animationMode.value = state.animation.mode;

		if (renderStack) {
			this.options.stack.innerHTML = this.options.renderEquation();
		} else {
			this.options.updatePresetAvailability();
		}
		this.updateAnimationHighlight(performance.now());
		this.options.scheduleRender();
	}

	updatePlaybackControl(): void {
		const button = this.options.root.querySelector<HTMLButtonElement>(
			"[data-action='play']",
		);
		if (!button) return;
		const status = this.options.getState().animation.status;
		const textKey: MessageKey =
			status === "playing"
				? "pause"
				: status === "paused"
					? "resume"
					: "apply";
		const labelKey: MessageKey =
			status === "playing"
				? "pauseAnimation"
				: status === "paused"
					? "resumeAnimation"
					: "applyTransform";
		button.textContent = this.options.t(textKey);
		button.setAttribute("aria-label", this.options.t(labelKey));
		button.dataset.playbackStatus = status;
		const workspace = getWorkspace(this.options.getState());
		button.disabled =
			!workspace.validity.valid || !canRenderWorkspace(workspace);
	}

	updateAnimationHighlight(now: number): void {
		const state = this.options.getState();
		const workspace = getWorkspace(state);
		const progress = getAnimationProgress(
			workspace.lastValidEvaluation,
			getAnimationFrame(state.animation, now),
		);
		const items = this.options.stack.querySelectorAll<HTMLElement>(
			".matrix-item[data-matrix-id]",
		);
		if (!progress) {
			items.forEach((item) => setHighlight(item, false, 0));
			return;
		}
		if (progress.mode === "composed") {
			items.forEach((item) =>
				setHighlight(item, true, progress.progress),
			);
			return;
		}
		items.forEach((item) => {
			const active = item.dataset.matrixId === progress.matrixId;
			setHighlight(item, active, active ? progress.progress : 0);
		});
	}

	updateResults(): void {
		const workspace = getWorkspace(this.options.getState());
		const vectors = getTransformedVectors(
			workspace.lastValidEvaluation,
		).map((components) => components.map(formatDisplayNumber));
		vectors.forEach((components, vectorIndex) => {
			for (let index = 0; index < workspace.dimension; index += 1) {
				const output =
					this.options.stack.querySelector<HTMLOutputElement>(
						`output[data-result-vector-index="${vectorIndex}"][data-result-component-index="${index}"]`,
					);
				if (!output) continue;
				const value = components[index] ?? "0";
				output.value = value;
				output.textContent = value;
			}
		});
		const card = this.options.stack.querySelector<HTMLElement>(
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
}

function setHighlight(
	item: HTMLElement,
	active: boolean,
	progress: number,
): void {
	item.toggleAttribute("data-active-step", active);
	if (active) item.setAttribute("aria-current", "step");
	else item.removeAttribute("aria-current");
	item.style.setProperty(
		"--step-progress",
		`${Math.max(0, Math.min(1, progress)) * 100}%`,
	);
}
