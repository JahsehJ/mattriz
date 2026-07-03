export type MoveDirection = -1 | 1;

export interface MoveResult {
	changed: boolean;
	index: number;
}

export function removeItem<T extends { id: string }>(
	items: T[],
	id: string,
): MoveResult {
	const index = items.findIndex((item) => item.id === id);
	if (index < 0) return { changed: false, index };
	items.splice(index, 1);
	return { changed: true, index };
}

export function moveItemBy<T extends { id: string }>(
	items: T[],
	id: string,
	direction: MoveDirection,
): MoveResult {
	const index = items.findIndex((item) => item.id === id);
	if (index < 0) return { changed: false, index: -1 };

	const targetIndex = index + direction;
	if (targetIndex < 0 || targetIndex >= items.length) {
		return { changed: false, index };
	}

	[items[index], items[targetIndex]] = [items[targetIndex], items[index]];
	return { changed: true, index: targetIndex };
}

export function moveItemTo<T extends { id: string }>(
	items: T[],
	id: string,
	targetId: string,
	side: "before" | "after",
): MoveResult {
	if (id === targetId) {
		return {
			changed: false,
			index: items.findIndex((item) => item.id === id),
		};
	}

	const fromIndex = items.findIndex((item) => item.id === id);
	const toIndex = items.findIndex((item) => item.id === targetId);
	if (fromIndex < 0 || toIndex < 0) {
		return { changed: false, index: fromIndex };
	}

	const [item] = items.splice(fromIndex, 1);
	const adjustedTargetIndex = items.findIndex(
		(candidate) => candidate.id === targetId,
	);
	if (adjustedTargetIndex < 0) {
		items.splice(fromIndex, 0, item);
		return { changed: false, index: fromIndex };
	}

	const index =
		side === "before" ? adjustedTargetIndex : adjustedTargetIndex + 1;
	items.splice(index, 0, item);
	return { changed: true, index };
}

export function nextMatrixLabel(existingLabels: string[]): string {
	const labels = new Set(existingLabels);
	for (let index = 0; ; index += 1) {
		const label = alphabeticLabel(index);
		if (!labels.has(label)) return label;
	}
}

export function nextVectorLabel(existingLabels: string[]): string {
	const labels = new Set(existingLabels);
	for (let index = 1; ; index += 1) {
		const label = `v${index}`;
		if (!labels.has(label)) return label;
	}
}

export function alphabeticLabel(index: number): string {
	let value = index + 1;
	let label = "";
	while (value > 0) {
		value -= 1;
		label = String.fromCharCode(65 + (value % 26)) + label;
		value = Math.floor(value / 26);
	}
	return label;
}
