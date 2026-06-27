export type Dimension = 2 | 3;
export type Mat2 = [number, number, number, number];
export type Mat3 = [number, number, number, number, number, number, number, number, number];
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
		a[2] * b[1] + a[3] * b[3]
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
		a[6] * b[2] + a[7] * b[5] + a[8] * b[8]
	];
}

export function multiplyMatrix(
	dimension: Dimension,
	a: MatrixValues,
	b: MatrixValues
): MatrixValues {
	return dimension === 2 ? multiply2(a as Mat2, b as Mat2) : multiply3(a as Mat3, b as Mat3);
}

export function composeMathNotation(dimension: Dimension, matrices: MatrixValues[]): MatrixValues {
	return matrices.reduce(
		(total, matrix) => multiplyMatrix(dimension, total, matrix),
		identityMatrix(dimension)
	);
}

export function lerpMatrix(
	dimension: Dimension,
	from: MatrixValues,
	to: MatrixValues,
	amount: number
): MatrixValues {
	const t = clamp(amount, 0, 1);
	const length = dimension === 2 ? 4 : 9;
	return Array.from(
		{ length },
		(_, index) => from[index] + (to[index] - from[index]) * t
	) as MatrixValues;
}

export function applyMatrixToVector(
	dimension: Dimension,
	matrix: MatrixValues,
	vector: VectorValues
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
		m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
	];
}

export function parseFiniteNumber(value: string): number | null {
	const next = Number(value);
	return Number.isFinite(next) ? next : null;
}

export function parseBoundedNumber(value: string, maxAbsoluteValue: number): number | null {
	const next = parseFiniteNumber(value);
	return next !== null && Math.abs(next) <= maxAbsoluteValue ? next : null;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
