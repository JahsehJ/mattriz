export type Dimension = 2 | 3;
export type Mat2 = [number, number, number, number];
export type Mat3 = [
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
];
export type MatrixValues = Mat2 | Mat3;
export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type VectorValues = Vec2 | Vec3;

export const identity2 = (): Mat2 => [1, 0, 0, 1];
export const identity3 = (): Mat3 => [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function identityMatrix(dimension: Dimension): MatrixValues {
	return dimension === 2 ? identity2() : identity3();
}

export function multiply2(a: Mat2, b: Mat2): Mat2 {
	return [
		a[0] * b[0] + a[1] * b[2],
		a[0] * b[1] + a[1] * b[3],
		a[2] * b[0] + a[3] * b[2],
		a[2] * b[1] + a[3] * b[3],
	];
}

export function multiply3(a: Mat3, b: Mat3): Mat3 {
	return [
		a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
		a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
		a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
		a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
		a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
		a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
		a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
		a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
		a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
	];
}

export function multiplyMatrix(
	dimension: Dimension,
	a: MatrixValues,
	b: MatrixValues,
): MatrixValues {
	return dimension === 2
		? multiply2(a as Mat2, b as Mat2)
		: multiply3(a as Mat3, b as Mat3);
}

export function composeMathNotation(
	dimension: Dimension,
	matrices: MatrixValues[],
): MatrixValues {
	return matrices.reduce(
		(total, matrix) => multiplyMatrix(dimension, total, matrix),
		identityMatrix(dimension),
	);
}

export function lerpMatrix(
	dimension: Dimension,
	from: MatrixValues,
	to: MatrixValues,
	amount: number,
): MatrixValues {
	const t = clamp(amount, 0, 1);
	const length = dimension === 2 ? 4 : 9;
	return Array.from(
		{ length },
		(_, index) => from[index] + (to[index] - from[index]) * t,
	) as MatrixValues;
}

export function applyMatrixToVector(
	dimension: Dimension,
	matrix: MatrixValues,
	vector: VectorValues,
): Vec3 {
	if (dimension === 2) {
		const m = matrix as Mat2;
		const v = vector as Vec2;
		return [m[0] * v[0] + m[1] * v[1], m[2] * v[0] + m[3] * v[1], 0];
	}

	const m = matrix as Mat3;
	const v = vector as Vec3;
	return [
		m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
		m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
		m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
	];
}

export function parseFiniteNumber(value: string): number | null {
	const next = Number(value);
	return Number.isFinite(next) ? next : null;
}

export function parseBoundedNumber(
	value: string,
	maxAbsoluteValue: number,
): number | null {
	const next = parseFiniteNumber(value);
	return next !== null && Math.abs(next) <= maxAbsoluteValue ? next : null;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function getRealEigenbasis(
	dimension: Dimension,
	matrix: MatrixValues,
): VectorValues[] | null {
	const rows = toRows(dimension, matrix);
	const eigenvalues =
		dimension === 2 ? eigenvalues2(rows) : eigenvalues3(rows);
	if (!eigenvalues || eigenvalues.length !== dimension) return null;

	const scale = Math.max(1, ...matrix.map(Math.abs));
	const tolerance = matrixTolerance(scale, dimension);
	const groupingTolerance = 8 * Math.sqrt(Number.EPSILON) * scale * dimension;
	const groups: { value: number; count: number }[] = [];
	for (const value of eigenvalues.sort((a, b) => a - b)) {
		const group = groups[groups.length - 1];
		if (group && Math.abs(group.value - value) <= groupingTolerance) {
			group.value =
				(group.value * group.count + value) / (group.count + 1);
			group.count += 1;
		} else groups.push({ value, count: 1 });
	}

	const vectors: number[][] = [];
	for (const group of groups) {
		const eigenspace = nullspace(
			shiftByEigenvalue(rows, group.value),
			tolerance,
		);
		if (eigenspace.length < group.count) return null;
		vectors.push(...eigenspace.slice(0, group.count));
	}
	if (
		vectors.length !== dimension ||
		matrixRank(vectors, matrixTolerance(1, dimension)) !== dimension
	)
		return null;

	const normalized = vectors.map(normalizeDirection);
	return normalized.every((vector) =>
		isEigenvector(rows, vector, residualTolerance(scale, dimension)),
	)
		? (normalized as VectorValues[])
		: null;
}

export function getRepresentativeRealEigenvector(
	dimension: Dimension,
	matrix: MatrixValues,
): VectorValues | null {
	const rows = toRows(dimension, matrix);
	const eigenvalues =
		dimension === 2 ? eigenvalues2(rows) : eigenvalues3(rows);
	if (!eigenvalues) return null;
	const scale = Math.max(1, ...matrix.map(Math.abs));
	const tolerance = matrixTolerance(scale, dimension);
	for (const eigenvalue of eigenvalues.sort((a, b) => a - b)) {
		const vector = nullspace(
			shiftByEigenvalue(rows, eigenvalue),
			tolerance,
		)[0];
		if (!vector) continue;
		const normalized = normalizeDirection(vector);
		if (
			isEigenvector(rows, normalized, residualTolerance(scale, dimension))
		)
			return normalized as VectorValues;
	}
	return null;
}

function eigenvalues2(rows: number[][]): number[] | null {
	const trace = rows[0][0] + rows[1][1];
	const determinant = rows[0][0] * rows[1][1] - rows[0][1] * rows[1][0];
	const discriminant = trace * trace - 4 * determinant;
	const tolerance =
		64 *
		Number.EPSILON *
		Math.max(Math.abs(trace * trace), Math.abs(4 * determinant));
	if (discriminant < -tolerance) return null;
	const root = Math.sqrt(Math.max(0, discriminant));
	return [(trace - root) / 2, (trace + root) / 2];
}

function eigenvalues3(rows: number[][]): number[] | null {
	const trace = rows[0][0] + rows[1][1] + rows[2][2];
	const second =
		rows[0][0] * rows[1][1] +
		rows[0][0] * rows[2][2] +
		rows[1][1] * rows[2][2] -
		rows[0][1] * rows[1][0] -
		rows[0][2] * rows[2][0] -
		rows[1][2] * rows[2][1];
	const determinant =
		rows[0][0] * (rows[1][1] * rows[2][2] - rows[1][2] * rows[2][1]) -
		rows[0][1] * (rows[1][0] * rows[2][2] - rows[1][2] * rows[2][0]) +
		rows[0][2] * (rows[1][0] * rows[2][1] - rows[1][1] * rows[2][0]);
	const a = -trace;
	const b = second;
	const c = -determinant;
	const p = b - (a * a) / 3;
	const q = (2 * a * a * a) / 27 - (a * b) / 3 + c;
	const qTerm = (q * q) / 4;
	const pTerm = (p * p * p) / 27;
	const discriminant = qTerm + pTerm;
	const tolerance =
		128 * Number.EPSILON * Math.max(Math.abs(qTerm), Math.abs(pTerm));
	if (discriminant > tolerance) {
		return [
			Math.cbrt(-q / 2 + Math.sqrt(discriminant)) +
				Math.cbrt(-q / 2 - Math.sqrt(discriminant)) -
				a / 3,
		];
	}
	if (
		Math.abs(p) <= matrixTolerance(Math.abs(b) + Math.abs(a * a), 3) &&
		Math.abs(q) <=
			matrixTolerance(Math.abs(c) + Math.abs(a * b) + Math.abs(a ** 3), 3)
	) {
		return [-a / 3, -a / 3, -a / 3];
	}
	const radius = 2 * Math.sqrt(Math.max(0, -p / 3));
	if (radius === 0) return [-a / 3, -a / 3, -a / 3];
	const denominator = Math.sqrt(Math.max(0, -(p * p * p) / 27));
	if (denominator === 0) return [-a / 3, -a / 3, -a / 3];
	const cosine = clamp(-q / 2 / denominator, -1, 1);
	const angle = Math.acos(cosine) / 3;
	return [0, 1, 2].map(
		(index) => radius * Math.cos(angle - (2 * Math.PI * index) / 3) - a / 3,
	);
}

function shiftByEigenvalue(rows: number[][], eigenvalue: number): number[][] {
	return rows.map((row, rowIndex) =>
		row.map(
			(value, columnIndex) =>
				value - (rowIndex === columnIndex ? eigenvalue : 0),
		),
	);
}

function nullspace(matrix: number[][], tolerance: number): number[][] {
	const reduced = matrix.map((row) => [...row]);
	const columns = reduced[0].length;
	const pivots: number[] = [];
	let pivotRow = 0;
	for (
		let column = 0;
		column < columns && pivotRow < reduced.length;
		column += 1
	) {
		let bestRow = pivotRow;
		for (let row = pivotRow + 1; row < reduced.length; row += 1) {
			if (
				Math.abs(reduced[row][column]) >
				Math.abs(reduced[bestRow][column])
			)
				bestRow = row;
		}
		if (Math.abs(reduced[bestRow][column]) <= tolerance) continue;
		[reduced[pivotRow], reduced[bestRow]] = [
			reduced[bestRow],
			reduced[pivotRow],
		];
		const pivot = reduced[pivotRow][column];
		reduced[pivotRow] = reduced[pivotRow].map((value) => value / pivot);
		for (let row = 0; row < reduced.length; row += 1) {
			if (row === pivotRow) continue;
			const factor = reduced[row][column];
			reduced[row] = reduced[row].map(
				(value, index) => value - factor * reduced[pivotRow][index],
			);
		}
		pivots.push(column);
		pivotRow += 1;
	}
	const freeColumns = Array.from(
		{ length: columns },
		(_, index) => index,
	).filter((column) => !pivots.includes(column));
	return freeColumns.map((freeColumn) => {
		const vector = Array(columns).fill(0) as number[];
		vector[freeColumn] = 1;
		pivots.forEach((pivotColumn, row) => {
			vector[pivotColumn] = -reduced[row][freeColumn];
		});
		return vector;
	});
}

function normalizeDirection(vector: number[]): number[] {
	const magnitude = Math.hypot(...vector);
	const zeroTolerance = 128 * Number.EPSILON;
	const normalized = vector.map((value) =>
		Math.abs(value / magnitude) <= zeroTolerance ? 0 : value / magnitude,
	);
	const anchor = normalized.reduce(
		(best, value, index) =>
			Math.abs(value) > Math.abs(normalized[best]) ? index : best,
		0,
	);
	return normalized[anchor] < 0
		? normalized.map((value) => -value)
		: normalized;
}

function isEigenvector(
	rows: number[][],
	vector: number[],
	tolerance: number,
): boolean {
	const transformed = rows.map((row) =>
		row.reduce((sum, value, index) => sum + value * vector[index], 0),
	);
	const eigenvalue = dot(transformed, vector);
	const residual = transformed.map(
		(value, index) => value - eigenvalue * vector[index],
	);
	return Math.hypot(...residual) <= tolerance;
}

function matrixRank(rows: number[][], tolerance: number): number {
	return rows[0].length - nullspace(rows, tolerance).length;
}

function toRows(dimension: Dimension, matrix: MatrixValues): number[][] {
	return Array.from({ length: dimension }, (_, row) =>
		Array.from(
			{ length: dimension },
			(_, column) => matrix[row * dimension + column],
		),
	);
}

function dot(a: number[], b: number[]): number {
	return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function matrixTolerance(scale: number, dimension: Dimension): number {
	return 256 * Number.EPSILON * Math.max(1, scale) * dimension;
}

function residualTolerance(scale: number, dimension: Dimension): number {
	return 1024 * Number.EPSILON * Math.max(1, scale) * dimension;
}
