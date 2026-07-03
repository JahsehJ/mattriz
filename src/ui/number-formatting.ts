export function formatDisplayNumber(value: number): string {
	const rounded = Math.abs(value) < 0.000001 ? 0 : value;
	return Number.isInteger(rounded)
		? String(rounded)
		: rounded.toFixed(3).replace(/\.?0+$/, "");
}
