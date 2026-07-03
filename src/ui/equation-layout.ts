export function groupEntriesByColumn(
	values: readonly string[],
	columnCount: number,
): string[][] {
	return Array.from({ length: columnCount }, (_, column) =>
		values.filter((_, index) => index % columnCount === column),
	);
}

export function renderEntryColumnTemplate(
	columns: readonly (readonly string[])[],
	trailingTracks: readonly string[] = [],
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

export function applyEntryColumnTemplate(
	elements: readonly HTMLElement[],
	columns: readonly (readonly string[])[],
	trailingTracks: readonly string[] = [],
): void {
	const template = renderEntryColumnTemplate(columns, trailingTracks);
	elements.forEach((element) => {
		element.style.gridTemplateColumns = template;
	});
}
