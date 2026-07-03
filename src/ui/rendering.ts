export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

export function renderVectorSymbol(label: string, prime = false): string {
	const match = label.match(/^([a-zA-Z]+)(\d+)$/);
	const symbol = match
		? `<msub><mi>${escapeHtml(match[1])}</mi><mn>${escapeHtml(match[2])}</mn></msub>`
		: `<mi>${escapeHtml(label)}</mi>`;

	return prime ? `<msup>${symbol}<mo>&#x2032;</mo></msup>` : symbol;
}

export function renderCloseIcon(): string {
	return `
    <svg class="close-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5" />
    </svg>
  `;
}
