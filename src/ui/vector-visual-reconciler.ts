/**
 * Reconciles keyed, owned visuals without coupling their ownership policy to
 * Three.js primitives.
 */
export function reconcileOwnedVisuals<TItem, TVisual>(
	visuals: Map<string, TVisual>,
	items: readonly TItem[],
	getId: (item: TItem) => string,
	create: (item: TItem) => TVisual,
	update: (visual: TVisual, item: TItem) => void,
	remove: (visual: TVisual) => void,
): void {
	const activeIds = new Set(items.map(getId));
	for (const [id, visual] of visuals) {
		if (activeIds.has(id)) continue;
		remove(visual);
		visuals.delete(id);
	}

	for (const item of items) {
		const id = getId(item);
		let visual = visuals.get(id);
		if (!visual) {
			visual = create(item);
			visuals.set(id, visual);
		}
		update(visual, item);
	}
}
