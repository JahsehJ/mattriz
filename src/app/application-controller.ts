import {
	type Mat2,
	type Mat3,
	analyzeRealEigenbasis,
	analyzeRepresentativeRealEigenvector,
	identityMatrix,
} from "../domain/math";
import { getMatrixPresets } from "../domain/presets";
import {
	areWorkspaceMatricesValid,
	canAddWorkspaceNodes,
	createMatrixNode,
	createVectorNode,
	recomputeWorkspace,
} from "../domain/workspace";
import { type AppState, getWorkspace } from "./state";
import type { MessageKey, Translate } from "../i18n";
import {
	type MoveDirection,
	moveItemBy,
	moveItemTo,
	nextMatrixLabel,
	nextVectorLabel,
} from "./workspace-actions";
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

const VECTOR_COLORS = [
	"#f4b740",
	"#5bd8a6",
	"#ef6f6c",
	"#8fb4ff",
	"#d989ff",
	"#5ed5e8",
];

interface ApplicationControllerOptions {
	getState(): AppState;
	scheduleRender(): void;
	now(): number;
	createId(): string;
}

export class ApplicationController {
	private readonly equationRenderer: EquationRenderer;
	private readonly equationInputController: EquationInputController;

	constructor(
		private readonly root: HTMLElement,
		private readonly stack: HTMLElement,
		private readonly animationMode: HTMLSelectElement,
		private readonly t: Translate,
		private readonly options: ApplicationControllerOptions,
	) {
		this.equationRenderer = new EquationRenderer({
			root,
			t,
			getWorkspace: () => this.workspace,
			maxInputLength: 64,
		});
		this.equationInputController = new EquationInputController(stack, t, {
			getState: () => options.getState(),
			getWorkspace: () => this.workspace,
			render: (renderStack) => this.render(renderStack),
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
			this.stack.innerHTML = this.equationRenderer.render();
		} else if (
			this.root.querySelector(
				".preset-menu[open] [data-action='add-eigenvector']",
			)
		) {
			this.equationRenderer.updatePresetAvailability();
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

	createVectorPreview(vectorId: string): HTMLElement {
		return this.equationRenderer.createVectorDragPreview(vectorId);
	}

	updateVectorPresetAvailability(): void {
		this.equationRenderer.updatePresetAvailability();
	}

	addMatrix(): void {
		const workspace = this.workspace;
		if (!canAddWorkspaceNodes(workspace, "matrices")) return;
		this.mutateWorkspace(() => {
			workspace.matrices.unshift(
				createMatrixNode(
					workspace.dimension,
					nextMatrixLabel(
						workspace.matrices.map((matrix) => matrix.label),
					),
					undefined,
					undefined,
					this.options.createId(),
				),
			);
		});
	}

	addVector(): void {
		const workspace = this.workspace;
		if (!canAddWorkspaceNodes(workspace, "vectors")) return;
		const label = nextVectorLabel(
			workspace.vectors.map((vector) => vector.label),
		);
		this.mutateWorkspace(() => {
			workspace.vectors.push(
				createVectorNode(
					workspace.dimension,
					label,
					vectorColorForLabel(label),
					undefined,
					undefined,
					this.options.createId(),
				),
			);
		});
	}

	addMatrixPreset(presetId: string): void {
		const workspace = this.workspace;
		if (!canAddWorkspaceNodes(workspace, "matrices")) return;
		const preset = getMatrixPresets(workspace.dimension).find(
			(item) => item.id === presetId,
		);
		if (!preset) return;
		this.mutateWorkspace(() => {
			workspace.matrices.unshift(
				createMatrixNode(
					workspace.dimension,
					nextMatrixLabel(
						workspace.matrices.map((matrix) => matrix.label),
					),
					preset.values,
					preset.draftValues,
					this.options.createId(),
				),
			);
		});
	}

	addEigenbasis(): void {
		const workspace = this.workspace;
		if (!areWorkspaceMatricesValid(workspace)) return;
		const result = analyzeRealEigenbasis(
			workspace.dimension,
			workspace.lastValidEvaluation.totalTransform,
		);
		const basis = result.kind === "basis" ? result.vectors : null;
		if (!basis || !canAddWorkspaceNodes(workspace, "vectors", basis.length))
			return;
		const vectors = [...workspace.vectors];
		for (const components of basis) {
			const label = nextVectorLabel(
				vectors.map((vector) => vector.label),
			);
			vectors.push(
				createVectorNode(
					workspace.dimension,
					label,
					vectorColorForLabel(label),
					components,
					components.map(formatInputNumber),
					this.options.createId(),
				),
			);
		}
		this.mutateWorkspace(() => {
			workspace.vectors = vectors;
		});
	}

	addRepresentativeEigenvector(): void {
		const workspace = this.workspace;
		if (!areWorkspaceMatricesValid(workspace)) return;
		if (!canAddWorkspaceNodes(workspace, "vectors")) return;
		const result = analyzeRepresentativeRealEigenvector(
			workspace.dimension,
			workspace.lastValidEvaluation.totalTransform,
		);
		if (result.kind !== "vector") return;
		const vector = result.vector;
		const label = nextVectorLabel(
			workspace.vectors.map((item) => item.label),
		);
		const vectorNode = createVectorNode(
			workspace.dimension,
			label,
			vectorColorForLabel(label),
			vector,
			vector.map(formatInputNumber),
			this.options.createId(),
		);
		this.mutateWorkspace(() => {
			workspace.vectors.push(vectorNode);
		});
	}

	deleteMatrix(id: string): void {
		const workspace = this.workspace;
		const index = workspace.matrices.findIndex(
			(matrix) => matrix.id === id,
		);
		if (index === -1) return;
		this.mutateWorkspace(() => {
			workspace.matrices.splice(index, 1);
		});
	}

	deleteVector(id: string): void {
		const workspace = this.workspace;
		const index = workspace.vectors.findIndex((vector) => vector.id === id);
		if (index === -1) return;
		this.mutateWorkspace(() => {
			workspace.vectors.splice(index, 1);
		});
	}

	moveMatrix(id: string, targetId: string, side: "before" | "after"): void {
		const workspace = this.workspace;
		const matrices = [...workspace.matrices];
		if (!moveItemTo(matrices, id, targetId, side).changed) return;
		this.mutateWorkspace(() => {
			workspace.matrices = matrices;
		});
	}

	moveVector(id: string, targetId: string, side: "before" | "after"): void {
		const workspace = this.workspace;
		const vectors = [...workspace.vectors];
		if (!moveItemTo(vectors, id, targetId, side).changed) return;
		this.mutateWorkspace(() => {
			workspace.vectors = vectors;
		});
	}

	moveFocusedItem(element: HTMLElement, direction: MoveDirection): void {
		const matrixId = element.dataset.matrixId;
		const vectorId = element.dataset.vectorColumnId;
		const id = matrixId ?? vectorId;
		if (!id) return;
		const workspace = this.workspace;
		const matrices = [...workspace.matrices];
		const vectors = [...workspace.vectors];
		const result = matrixId
			? moveItemBy(matrices, matrixId, direction)
			: moveItemBy(vectors, id, direction);
		if (!result.changed) return;
		this.mutateWorkspace(() => {
			if (matrixId) workspace.matrices = matrices;
			else workspace.vectors = vectors;
		});
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

	handleInput(input: HTMLInputElement): void {
		this.equationInputController.handleInput(input);
	}

	private mutateWorkspace(mutate: () => void): void {
		mutate();
		recomputeWorkspace(this.workspace);
		const state = this.options.getState();
		state.animation = resetPlaybackState(state.animation);
		this.render();
	}

	private get workspace() {
		return getWorkspace(this.options.getState());
	}
}

function vectorColorForLabel(label: string): string {
	const number = Number(label.slice(1));
	const index =
		Number.isInteger(number) && number > 0 ? number - 1 : hashString(label);
	return VECTOR_COLORS[index % VECTOR_COLORS.length];
}

function hashString(value: string): number {
	let hash = 0;
	for (const character of value)
		hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
	return hash;
}

function formatInputNumber(value: number): string {
	const rounded = Math.abs(value) < 0.0000000001 ? 0 : value;
	return Number.isInteger(rounded)
		? String(rounded)
		: Number(rounded.toPrecision(8)).toString();
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
