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
export type MatrixFor<D extends Dimension> = D extends 2 ? Mat2 : Mat3;
export type VectorFor<D extends Dimension> = D extends 2 ? Vec2 : Vec3;

export const identity2 = (): Mat2 => [1, 0, 0, 1];
export const identity3 = (): Mat3 => [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function identityMatrix<D extends Dimension>(
	dimension: D,
): MatrixFor<D> {
	return (dimension === 2 ? identity2() : identity3()) as MatrixFor<D>;
}

export function cloneMatrix<D extends Dimension>(
	matrix: Readonly<MatrixFor<D>>,
): MatrixFor<D> {
	return [...matrix] as unknown as MatrixFor<D>;
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

export function multiplyMatrix<D extends Dimension>(
	dimension: D,
	a: MatrixFor<D>,
	b: MatrixFor<D>,
): MatrixFor<D> {
	return (
		dimension === 2
			? multiply2(a as Mat2, b as Mat2)
			: multiply3(a as Mat3, b as Mat3)
	) as MatrixFor<D>;
}

export function composeMathNotation<D extends Dimension>(
	dimension: D,
	matrices: MatrixFor<D>[],
): MatrixFor<D> {
	return matrices.reduce(
		(total, matrix) => multiplyMatrix(dimension, total, matrix),
		identityMatrix(dimension),
	);
}

export function applyMatrixToVector<D extends Dimension>(
	dimension: D,
	matrix: MatrixFor<D>,
	vector: VectorFor<D>,
): VectorFor<D> {
	if (dimension === 2) {
		const m = matrix as Mat2;
		const v = vector as Vec2;
		return [
			m[0] * v[0] + m[1] * v[1],
			m[2] * v[0] + m[3] * v[1],
		] as VectorFor<D>;
	}

	const m = matrix as Mat3;
	const v = vector as Vec3;
	return [
		m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
		m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
		m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
	] as VectorFor<D>;
}
