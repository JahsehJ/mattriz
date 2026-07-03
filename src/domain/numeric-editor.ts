import { evaluateBoundedExpression } from "./expression";
import { MAX_ABSOLUTE_INPUT_VALUE } from "./policy";

export type NumericCellError =
	| "invalid-expression"
	| "out-of-range"
	| "render-range-exceeded"
	| "constraint-rejected";

export type NumericCommitResult =
	| { accepted: true }
	| {
			accepted: false;
			error: Exclude<NumericCellError, "invalid-expression">;
	  };

export interface NumericCell {
	source: string;
	value: number;
	error?: NumericCellError;
}

export type NumericCells<T extends readonly number[]> = {
	[K in keyof T]: NumericCell;
};

export function createNumericCells<T extends readonly number[]>(
	values: T,
	sources: readonly string[],
): NumericCells<T> {
	return values.map((value, index) => {
		const source = sources[index] ?? String(value);
		return {
			source,
			value,
			...cellError(source, value),
		};
	}) as NumericCells<T>;
}

export function getNumericCellError(
	cell: NumericCell,
): NumericCellError | null {
	return cell.error ?? null;
}

export function updateNumericCellDraft(
	cells: NumericCell[],
	index: number,
	source: string,
	accept: (values: number[]) => NumericCommitResult | boolean,
): boolean {
	if (!cells[index]) return false;
	cells[index].source = source;
	const parsed = cells.map((cell) =>
		evaluateBoundedExpression(cell.source, MAX_ABSOLUTE_INPUT_VALUE),
	);
	if (parsed.some((value) => value === null)) {
		cells.forEach((cell, cellIndex) => {
			const value = parsed[cellIndex];
			if (value === null) {
				cell.error = "invalid-expression";
			} else {
				delete cell.error;
			}
		});
		return false;
	}

	const values = parsed as number[];
	const acceptance = normalizeAcceptance(accept(values));
	if (!acceptance.accepted) {
		cells.forEach((cell, cellIndex) => {
			if (values[cellIndex] !== cell.value) {
				cell.error = acceptance.error;
			} else {
				delete cell.error;
			}
		});
		return false;
	}

	cells.forEach((cell, cellIndex) => {
		cell.value = values[cellIndex];
		delete cell.error;
	});
	return true;
}

function normalizeAcceptance(
	acceptance: NumericCommitResult | boolean,
): NumericCommitResult {
	return typeof acceptance === "boolean"
		? acceptance
			? { accepted: true }
			: { accepted: false, error: "constraint-rejected" }
		: acceptance;
}

function cellError(source: string, value: number): Pick<NumericCell, "error"> {
	const evaluated = evaluateBoundedExpression(
		source,
		MAX_ABSOLUTE_INPUT_VALUE,
	);
	if (evaluated === null) return { error: "invalid-expression" };
	if (evaluated !== value) return { error: "constraint-rejected" };
	return {};
}
