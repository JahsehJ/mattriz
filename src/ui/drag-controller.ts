type DragKind = "matrix" | "vector";
type DragState = { kind: DragKind; id: string };
type DropSide = "before" | "after";
type DropTarget = { element: HTMLElement; id: string; side: DropSide };

interface DragControllerOptions {
	moveMatrix(id: string, targetId: string, side: DropSide): void;
	moveVector(id: string, targetId: string, side: DropSide): void;
	createVectorPreview(vectorId: string): HTMLElement;
}

export class DragController {
	private dragState: DragState | null = null;
	private draggedElement: HTMLElement | null = null;
	private draggedPreviewElement: HTMLElement | null = null;
	private dropIndicatorElement: HTMLElement | null = null;
	private isInteractingWithInput = false;

	constructor(
		private readonly stack: HTMLElement,
		private readonly options: DragControllerOptions,
	) {
		this.stack.addEventListener("pointerdown", this.handlePointerDown);
		window.addEventListener("pointerup", this.finishInputInteraction);
		window.addEventListener("pointercancel", this.finishInputInteraction);
		this.stack.addEventListener("dragstart", this.handleDragStart);
		this.stack.addEventListener("dragover", this.handleDragOver);
		this.stack.addEventListener("drop", this.handleDrop);
		this.stack.addEventListener("dragend", this.finishDragging);
	}

	dispose(): void {
		this.finishDragging();
		this.stack.removeEventListener("pointerdown", this.handlePointerDown);
		window.removeEventListener("pointerup", this.finishInputInteraction);
		window.removeEventListener(
			"pointercancel",
			this.finishInputInteraction,
		);
		this.stack.removeEventListener("dragstart", this.handleDragStart);
		this.stack.removeEventListener("dragover", this.handleDragOver);
		this.stack.removeEventListener("drop", this.handleDrop);
		this.stack.removeEventListener("dragend", this.finishDragging);
	}

	private readonly handlePointerDown = (event: PointerEvent): void => {
		if ((event.target as HTMLElement).closest("input")) {
			this.isInteractingWithInput = true;
		}
	};

	private readonly finishInputInteraction = (): void => {
		this.isInteractingWithInput = false;
	};

	private readonly handleDragStart = (event: DragEvent): void => {
		if (this.isInteractingWithInput) {
			event.preventDefault();
			return;
		}

		const target = event.target as HTMLElement;
		if (target.closest("input, button, select, textarea")) {
			event.preventDefault();
			return;
		}

		const vectorSource = this.getVectorSourceElement(target);
		if (vectorSource?.dataset.vectorColumnId) {
			this.dragState = {
				kind: "vector",
				id: vectorSource.dataset.vectorColumnId,
			};
			this.setDraggingElement(vectorSource, event);
			return;
		}

		const card = target.closest<HTMLElement>(
			".matrix-item[data-matrix-id]",
		);
		if (card?.dataset.matrixId) {
			this.dragState = { kind: "matrix", id: card.dataset.matrixId };
			this.setDraggingElement(card, event);
		}
	};

	private readonly handleDragOver = (event: DragEvent): void => {
		if (!this.dragState) return;
		event.preventDefault();
		this.updateDropIndicator(event);
	};

	private readonly handleDrop = (event: DragEvent): void => {
		event.preventDefault();
		if (this.dragState?.kind === "vector") {
			const target = this.getVectorDropTarget(event);
			if (target) {
				this.options.moveVector(
					this.dragState.id,
					target.id,
					target.side,
				);
			}
		} else if (this.dragState?.kind === "matrix") {
			const target = this.getMatrixDropTarget(event);
			if (target) {
				this.options.moveMatrix(
					this.dragState.id,
					target.id,
					target.side,
				);
			}
		}
		this.finishDragging();
	};

	private readonly finishDragging = (): void => {
		this.clearDropIndicator();
		this.clearDraggingElement();
		this.dragState = null;
	};

	private updateDropIndicator(event: DragEvent): void {
		this.clearDropIndicator();
		if (!this.dragState) return;
		const target =
			this.dragState.kind === "matrix"
				? this.getMatrixDropTarget(event)
				: this.getVectorDropTarget(event);
		if (!target || target.id === this.dragState.id) return;
		target.element.dataset.dropPosition = target.side;
		this.dropIndicatorElement = target.element;
	}

	private getMatrixDropTarget(event: DragEvent): DropTarget | null {
		const matrixStack =
			this.stack.querySelector<HTMLElement>(".matrix-stack");
		const items = [
			...this.stack.querySelectorAll<HTMLElement>(
				".matrix-item[data-matrix-id]",
			),
		];
		const target = getSortableDropTarget(event, items, "matrixId");
		if (
			target?.side === "before" &&
			target.element === items[0] &&
			matrixStack
		) {
			return { ...target, element: matrixStack };
		}
		return target;
	}

	private getVectorDropTarget(event: DragEvent): DropTarget | null {
		const items = [
			...this.stack.querySelectorAll<HTMLElement>(
				".vector-column-label[data-vector-column-id]",
			),
		];
		return getSortableDropTarget(event, items, "vectorColumnId");
	}

	private getVectorSourceElement(target: HTMLElement): HTMLElement | null {
		const id = target.closest<HTMLElement>("[data-vector-column-id]")
			?.dataset.vectorColumnId;
		if (!id) return null;
		return this.stack.querySelector<HTMLElement>(
			`.vector-column-label[data-vector-column-id="${CSS.escape(id)}"]`,
		);
	}

	private clearDropIndicator(): void {
		if (!this.dropIndicatorElement) return;
		delete this.dropIndicatorElement.dataset.dropPosition;
		this.dropIndicatorElement = null;
	}

	private setDraggingElement(element: HTMLElement, event: DragEvent): void {
		this.clearDraggingElement();
		element.dataset.dragging = "true";
		const vectorId = element.dataset.vectorColumnId;
		if (vectorId) {
			this.stack
				.querySelectorAll<HTMLElement>(
					`.vector-expression [data-vector-column-id="${CSS.escape(vectorId)}"]`,
				)
				.forEach((item) => {
					item.dataset.dragging = "true";
				});
		}
		this.draggedElement = element;
		if (!event.dataTransfer) return;
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData(
			"text/plain",
			element.dataset.matrixId ?? vectorId ?? "",
		);
		const preview = this.createDragPreview(element);
		event.dataTransfer.setDragImage(
			preview,
			getDragOffsetX(element, event, preview),
			getDragOffsetY(element, event, preview),
		);
	}

	private clearDraggingElement(): void {
		if (this.draggedElement) delete this.draggedElement.dataset.dragging;
		this.stack
			.querySelectorAll<HTMLElement>(".vector-expression [data-dragging]")
			.forEach((item) => {
				delete item.dataset.dragging;
			});
		this.draggedElement = null;
		this.draggedPreviewElement?.remove();
		this.draggedPreviewElement = null;
	}

	private createDragPreview(element: HTMLElement): HTMLElement {
		this.draggedPreviewElement?.remove();
		const vectorId = element.dataset.vectorColumnId;
		const preview = vectorId
			? this.options.createVectorPreview(vectorId)
			: cloneDragPreview(element);
		preview.dataset.dragPreview = "true";
		Object.assign(preview.style, {
			position: "fixed",
			top: "-10000px",
			left: "-10000px",
			pointerEvents: "none",
		});
		document.body.append(preview);
		this.draggedPreviewElement = preview;
		return preview;
	}
}

function getSortableDropTarget(
	event: DragEvent,
	items: HTMLElement[],
	datasetKey: "matrixId" | "vectorColumnId",
): DropTarget | null {
	let nearestItem = items[0];
	let nearestDistance = Number.POSITIVE_INFINITY;
	let nearestSide: DropSide = "before";
	if (!nearestItem) return null;

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

function cloneDragPreview(element: HTMLElement): HTMLElement {
	const preview = element.cloneNode(true) as HTMLElement;
	preview.removeAttribute("id");
	preview
		.querySelectorAll("[id]")
		.forEach((child) => child.removeAttribute("id"));
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
	return Math.max(0, Math.min(previewRect.height, event.clientY - rect.top));
}
