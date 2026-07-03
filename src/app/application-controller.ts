import { type Mat2, type Mat3, identityMatrix } from "../domain/math";
import { MAX_EXPRESSION_LENGTH } from "../domain/policy";
import { type AppState, getWorkspace } from "./state";
import type { MessageKey, Translate } from "../i18n";
import { type MoveDirection } from "./workspace-actions";
import {
	getAnimationDuration,
	getAnimationProgress,
} from "../domain/animation";
import {
	canRenderTransform,
	canRenderWorkspace,
} from "../rendering/capability";
import {
	getAnimationFrame,
	getPlaybackElapsed,
	pausePlayback,
	resetPlayback as resetPlaybackState,
	togglePlayback as togglePlaybackState,
} from "./playback-state";
import { EquationRenderer } from "../ui/equation-renderer";
import { EquationInputController } from "./equation-input-controller";
import { WorkspaceEditor } from "./workspace-editor";

interface ApplicationControllerOptions {
	getState(): AppState;
	scheduleRender(): void;
	now(): number;
	createId(): string;
}

export class ApplicationController {
	readonly equations: EquationRenderer;
	readonly inputs: EquationInputController;
	readonly editor: WorkspaceEditor;

	constructor(
		private readonly root: HTMLElement,
		private readonly stack: HTMLElement,
		private readonly animationMode: HTMLSelectElement,
		private readonly t: Translate,
		private readonly options: ApplicationControllerOptions,
	) {
		this.equations = new EquationRenderer({
			root,
			t,
			getWorkspace: () => this.workspace,
			maxInputLength: MAX_EXPRESSION_LENGTH,
		});
		this.inputs = new EquationInputController(stack, t, {
			getState: () => options.getState(),
			getWorkspace: () => this.workspace,
			render: (renderStack) => this.render(renderStack),
		});
		this.editor = new WorkspaceEditor({
			getWorkspace: () => this.workspace,
			createId: () => options.createId(),
			commit: () => this.resetPlayback(),
		});
	}

	render(renderStack = true): void {
		const state = this.options.getState();
		this.root
			.querySelectorAll<HTMLButtonElement>("[data-dimension]")
			.forEach((button) => {
				button.toggleAttribute(
					"aria-pressed",
					Number(button.dataset.dimension) === state.activeDimension,
				);
			});
		this.updatePlaybackControl();
		const basis = this.root.querySelector<HTMLInputElement>(
			"[data-action='toggle-basis']",
		);
		if (basis) basis.checked = state.showBasis;
		const grid = this.root.querySelector<HTMLInputElement>(
			"[data-action='toggle-grid']",
		);
		if (grid) grid.checked = state.showGrid;
		this.animationMode.value = state.animation.mode;

		if (renderStack) {
			this.stack.innerHTML = this.equations.render();
		} else if (
			this.root.querySelector(
				".preset-menu[open] [data-action='add-eigenvector']",
			)
		) {
			this.equations.updatePresetAvailability();
		}
		this.updateAnimationHighlight(this.options.now());
		this.options.scheduleRender();
	}

	updatePlaybackControl(): void {
		const button = this.root.querySelector<HTMLButtonElement>(
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
		button.textContent = this.t(textKey);
		button.setAttribute("aria-label", this.t(labelKey));
		button.dataset.playbackStatus = status;
		button.disabled =
			!this.workspace.validity.valid ||
			!canRenderWorkspace(this.workspace);
	}

	updateAnimationHighlight(now: number): void {
		const state = this.options.getState();
		const progress = getAnimationProgress(
			this.workspace.lastValidEvaluation,
			getAnimationFrame(state.animation, now),
		);
		const items = this.stack.querySelectorAll<HTMLElement>(
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

	togglePlayback(): void {
		const state = this.options.getState();
		state.animation = togglePlaybackState(
			state.animation,
			this.options.now(),
		);
		this.render(false);
	}

	resetPlayback(renderStack = true): void {
		const state = this.options.getState();
		state.animation = resetPlaybackState(state.animation);
		this.render(renderStack);
	}

	resetTransform(): void {
		const state = this.options.getState();
		if (this.workspace.dimension === 2)
			state.appliedTransforms[2] = identityMatrix(2);
		else state.appliedTransforms[3] = identityMatrix(3);
		this.resetPlayback(false);
	}

	pauseForVisibility(): boolean {
		const state = this.options.getState();
		if (state.animation.status !== "playing") return false;
		state.animation = pausePlayback(state.animation, this.options.now());
		return true;
	}

	completePlayback(): boolean {
		const state = this.options.getState();
		if (state.animation.status !== "playing") return false;
		const workspace = this.workspace;
		const now = this.options.now();
		const transform = workspace.lastValidEvaluation.totalTransform;
		if (
			!Number.isFinite(now) ||
			getPlaybackElapsed(state.animation, now) <
				getAnimationDuration(
					workspace.lastValidEvaluation,
					state.animation.mode,
				) ||
			!canRenderTransform(transform)
		)
			return false;
		if (workspace.dimension === 2)
			state.appliedTransforms[2] = [...transform] as Mat2;
		else state.appliedTransforms[3] = [...transform] as Mat3;
		state.animation = resetPlaybackState(state.animation);
		this.render(false);
		return true;
	}

	moveFocusedItem(element: HTMLElement, direction: MoveDirection): void {
		const matrixId = element.dataset.matrixId;
		const vectorId = element.dataset.vectorColumnId;
		const id = matrixId ?? vectorId;
		if (!id) return;
		const workspace = this.workspace;
		const result = this.editor.moveItem(
			id,
			matrixId ? "matrix" : "vector",
			direction,
		);
		if (!result.changed) return;
		const items = matrixId ? workspace.matrices : workspace.vectors;
		const label = items[result.index].label;

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

	private get workspace() {
		return getWorkspace(this.options.getState());
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
