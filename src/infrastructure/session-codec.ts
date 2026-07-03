import type { Dimension, MatrixFor, VectorFor } from "../domain/math";
import { MAX_WORKSPACE_NODES } from "../domain/policy";
import type { AnimationMode } from "../domain/animation";
import {
	MAX_ABSOLUTE_INPUT_VALUE,
	MAX_MATRIX_DURATION_MS,
	MAX_SESSION_ELAPSED_MS,
	MIN_MATRIX_DURATION_MS,
} from "../domain/policy";
import { MAX_RENDER_TRANSFORM_VALUE } from "../rendering/capability";
import type {
	CameraSnapshot,
	SessionSnapshot,
	WorkspaceSnapshot,
} from "../app/session-snapshot";
export type {
	CameraSnapshot,
	CameraSnapshots,
	SessionSnapshot,
} from "../app/session-snapshot";

export const MAX_SHARE_FRAGMENT_LENGTH = 32_768;
const MAX_DECODED_BYTES = 262_144;
const MAX_CAMERA_VALUE = 1_000;
const MATRIX_LABEL = /^[A-Z]{1,2}$/;
const VECTOR_LABEL = /^v[1-9][0-9]{0,2}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const EXPRESSION = /^[0-9A-Za-z+\-*/^().\s]*$/;

type JsonValue =
	| null
	| boolean
	| number
	| string
	| JsonValue[]
	| { [key: string]: JsonValue };

type SharePayloadVersion = 1 | 2 | 3;
const CURRENT_SHARE_PAYLOAD_VERSION: SharePayloadVersion = 3;

export async function encodeShareSession(
	session: SessionSnapshot,
): Promise<string> {
	const serialized = encodeCurrentVersion(session);
	const json = JSON.stringify(serialized);
	const bytes = new TextEncoder().encode(json);
	const plain = `1j${toBase64Url(bytes)}`;
	if (typeof CompressionStream === "undefined") return assertFits(plain);

	const compressed = await transformBytes(
		bytes,
		new CompressionStream("gzip"),
	);
	const gzip = `1g${toBase64Url(compressed)}`;
	return assertFits(gzip.length < plain.length ? gzip : plain);
}

export async function decodeShareSession(
	fragment: string,
): Promise<SessionSnapshot> {
	if (fragment.length > MAX_SHARE_FRAGMENT_LENGTH)
		throw new Error("Share payload is too large");
	if (!fragment.startsWith("1j") && !fragment.startsWith("1g"))
		throw new Error("Unsupported share payload");

	const encoded = fragment.slice(2);
	const source = fromBase64Url(encoded);
	const bytes =
		fragment[1] === "g" ? await decompressBounded(source) : source;
	if (bytes.byteLength > MAX_DECODED_BYTES)
		throw new Error("Share payload is too large");

	let value: unknown;
	try {
		value = JSON.parse(
			new TextDecoder("utf-8", { fatal: true }).decode(bytes),
		);
	} catch {
		throw new Error("Malformed share payload");
	}
	return decodeVersionedTuple(value);
}

function encodeCurrentVersion(session: SessionSnapshot): JsonValue {
	return encodeVersion3(session);
}

function encodeVersion3(session: SessionSnapshot): JsonValue {
	const workspace = (dimension: Dimension): JsonValue => {
		const item = session.workspaces[dimension];
		return [
			item.matrices.map((matrix) => [
				matrix.label,
				matrix.sources,
				matrix.durationMs,
			]),
			item.vectors.map((vector) => [
				vector.label,
				vector.sources,
				vector.color,
			]),
			item.appliedTransform,
			[
				item.lastValidEvaluation.matrices.map((matrix) => [
					matrix.label,
					matrix.values,
					matrix.durationMs,
				]),
				item.lastValidEvaluation.vectors.map((vector) => [
					vector.label,
					vector.values,
					vector.color,
				]),
			],
		];
	};
	const camera = (dimension: Dimension): JsonValue => {
		const item = session.cameras[dimension];
		return [item.position, item.target, item.zoom];
	};
	return [
		CURRENT_SHARE_PAYLOAD_VERSION,
		session.activeDimension,
		session.showBasis ? 1 : 0,
		session.showGrid ? 1 : 0,
		session.animationMode === "composed" ? 1 : 0,
		session.animationActive ? 1 : 0,
		session.elapsedMs,
		workspace(2),
		workspace(3),
		camera(2),
		camera(3),
	];
}

function decodeVersionedTuple(value: unknown): SessionSnapshot {
	if (!Array.isArray(value)) throw new Error("Invalid share payload shape");
	const version: unknown = value[0];
	switch (version) {
		case 1:
			return decodeVersion1(value);
		case 2:
			return decodeVersion2(value);
		case 3:
			return decodeVersion3(value);
		default:
			throw new Error("Unsupported share payload");
	}
}

function decodeVersion1(value: unknown): SessionSnapshot {
	const root = tuple(value, 10);
	const activeDimension = dimension(root[1]);
	const showBasis = flag(root[2]);
	const mode: AnimationMode = flag(root[3]) ? "composed" : "steps";
	const paused = flag(root[4]);

	return createDecodedSession({
		activeDimension,
		showBasis,
		showGrid: true,
		mode,
		paused,
		elapsedMs: finiteNumber(root[5], 0, MAX_SESSION_ELAPSED_MS),
		workspace2: parseLegacyWorkspace(root[6], 2),
		workspace3: parseLegacyWorkspace(root[7], 3),
		camera2: parseCamera(root[8]),
		camera3: parseCamera(root[9]),
	});
}

function decodeVersion2(value: unknown): SessionSnapshot {
	const root = tuple(value, 11);
	const activeDimension = dimension(root[1]);
	const showBasis = flag(root[2]);
	const showGrid = flag(root[3]);
	const mode: AnimationMode = flag(root[4]) ? "composed" : "steps";
	const paused = flag(root[5]);

	return createDecodedSession({
		activeDimension,
		showBasis,
		showGrid,
		mode,
		paused,
		elapsedMs: finiteNumber(root[6], 0, MAX_SESSION_ELAPSED_MS),
		workspace2: parseLegacyWorkspace(root[7], 2),
		workspace3: parseLegacyWorkspace(root[8], 3),
		camera2: parseCamera(root[9]),
		camera3: parseCamera(root[10]),
	});
}

function decodeVersion3(value: unknown): SessionSnapshot {
	const root = tuple(value, 11);
	return createDecodedSession({
		activeDimension: dimension(root[1]),
		showBasis: flag(root[2]),
		showGrid: flag(root[3]),
		mode: flag(root[4]) ? "composed" : "steps",
		paused: flag(root[5]),
		elapsedMs: finiteNumber(root[6], 0, MAX_SESSION_ELAPSED_MS),
		workspace2: parseWorkspace(root[7], 2),
		workspace3: parseWorkspace(root[8], 3),
		camera2: parseCamera(root[9]),
		camera3: parseCamera(root[10]),
	});
}

function createDecodedSession({
	activeDimension,
	showBasis,
	showGrid,
	mode,
	paused,
	elapsedMs,
	workspace2,
	workspace3,
	camera2,
	camera3,
}: {
	activeDimension: Dimension;
	showBasis: boolean;
	showGrid: boolean;
	mode: AnimationMode;
	paused: boolean;
	elapsedMs: number;
	workspace2: WorkspaceSnapshot<2>;
	workspace3: WorkspaceSnapshot<3>;
	camera2: CameraSnapshot;
	camera3: CameraSnapshot;
}): SessionSnapshot {
	return {
		activeDimension,
		showBasis,
		showGrid,
		workspaces: { 2: workspace2, 3: workspace3 },
		animationMode: mode,
		animationActive: paused,
		elapsedMs,
		cameras: {
			2: camera2,
			3: camera3,
		},
	};
}

function parseLegacyWorkspace<D extends Dimension>(
	value: unknown,
	dimensionValue: D,
): WorkspaceSnapshot<D> {
	const item = tuple(value, 3);
	const matrices = boundedArray(item[0]).map((entry) => {
		const matrix = tuple(entry, 4);
		const label = matchedString(matrix[0], MATRIX_LABEL, 16);
		const draftValues = expressions(matrix[1], dimensionValue ** 2);
		const values = numbers(
			matrix[2],
			dimensionValue ** 2,
			MAX_ABSOLUTE_INPUT_VALUE,
		) as MatrixFor<D>;
		const durationMs = finiteNumber(
			matrix[3],
			MIN_MATRIX_DURATION_MS,
			MAX_MATRIX_DURATION_MS,
		);
		return {
			label,
			sources: draftValues,
			values,
			durationMs,
		};
	});
	const vectors = boundedArray(item[1]).map((entry) => {
		const vector = tuple(entry, 4);
		const label = matchedString(vector[0], VECTOR_LABEL, 4);
		const draftComponents = expressions(vector[1], dimensionValue);
		const components = numbers(
			vector[2],
			dimensionValue,
			MAX_ABSOLUTE_INPUT_VALUE,
		) as VectorFor<D>;
		const color = matchedString(vector[3], COLOR, 7).toLowerCase();
		return {
			label,
			sources: draftComponents,
			values: components,
			color,
		};
	});
	const appliedTransform = numbers(
		item[2],
		dimensionValue ** 2,
		MAX_RENDER_TRANSFORM_VALUE,
	) as MatrixFor<D>;
	const workspace: WorkspaceSnapshot<D> = {
		matrices: matrices.map((matrix) => ({
			label: matrix.label,
			sources: matrix.sources,
			durationMs: matrix.durationMs,
		})),
		vectors: vectors.map((vector) => ({
			label: vector.label,
			sources: vector.sources,
			color: vector.color,
		})),
		appliedTransform,
		lastValidEvaluation: {
			matrices: matrices.map((matrix) => ({
				label: matrix.label,
				values: matrix.values,
				durationMs: matrix.durationMs,
			})),
			vectors: vectors.map((vector) => ({
				label: vector.label,
				values: vector.values,
				color: vector.color,
			})),
		},
	};
	return workspace;
}

function parseWorkspace<D extends Dimension>(
	value: unknown,
	dimensionValue: D,
): WorkspaceSnapshot<D> {
	const item = tuple(value, 4);
	const matrices = boundedArray(item[0]).map((entry) => {
		const matrix = tuple(entry, 3);
		return {
			label: matchedString(matrix[0], MATRIX_LABEL, 16),
			sources: expressions(matrix[1], dimensionValue ** 2),
			durationMs: finiteNumber(
				matrix[2],
				MIN_MATRIX_DURATION_MS,
				MAX_MATRIX_DURATION_MS,
			),
		};
	});
	const vectors = boundedArray(item[1]).map((entry) => {
		const vector = tuple(entry, 3);
		return {
			label: matchedString(vector[0], VECTOR_LABEL, 4),
			sources: expressions(vector[1], dimensionValue),
			color: matchedString(vector[2], COLOR, 7).toLowerCase(),
		};
	});
	const appliedTransform = numbers(
		item[2],
		dimensionValue ** 2,
		MAX_RENDER_TRANSFORM_VALUE,
	) as MatrixFor<D>;
	const evaluation = tuple(item[3], 2);
	const evaluatedMatrices = boundedArray(evaluation[0]).map((entry) => {
		const matrix = tuple(entry, 3);
		return {
			label: matchedString(matrix[0], MATRIX_LABEL, 16),
			values: numbers(
				matrix[1],
				dimensionValue ** 2,
				MAX_ABSOLUTE_INPUT_VALUE,
			) as MatrixFor<D>,
			durationMs: finiteNumber(
				matrix[2],
				MIN_MATRIX_DURATION_MS,
				MAX_MATRIX_DURATION_MS,
			),
		};
	});
	const evaluatedVectors = boundedArray(evaluation[1]).map((entry) => {
		const vector = tuple(entry, 3);
		return {
			label: matchedString(vector[0], VECTOR_LABEL, 4),
			values: numbers(
				vector[1],
				dimensionValue,
				MAX_ABSOLUTE_INPUT_VALUE,
			) as VectorFor<D>,
			color: matchedString(vector[2], COLOR, 7).toLowerCase(),
		};
	});
	return {
		matrices,
		vectors,
		appliedTransform,
		lastValidEvaluation: {
			matrices: evaluatedMatrices,
			vectors: evaluatedVectors,
		},
	};
}

function parseCamera(value: unknown): CameraSnapshot {
	const camera = tuple(value, 3);
	return {
		position: numbers(camera[0], 3, MAX_CAMERA_VALUE) as [
			number,
			number,
			number,
		],
		target: numbers(camera[1], 3, MAX_CAMERA_VALUE) as [
			number,
			number,
			number,
		],
		zoom: finiteNumber(camera[2], 0.01, 100),
	};
}

function tuple(value: unknown, length: number): unknown[] {
	if (!Array.isArray(value) || value.length !== length)
		throw new Error("Invalid share payload shape");
	return value;
}

function boundedArray(value: unknown): unknown[] {
	if (!Array.isArray(value) || value.length > MAX_WORKSPACE_NODES)
		throw new Error("Invalid share collection");
	return value;
}

function expressions(value: unknown, length: number): string[] {
	return tuple(value, length).map((entry) =>
		matchedString(entry, EXPRESSION, 64),
	);
}

function numbers(
	value: unknown,
	length: number,
	absoluteLimit: number,
): number[] {
	return tuple(value, length).map((entry) =>
		finiteNumber(entry, -absoluteLimit, absoluteLimit),
	);
}

function finiteNumber(
	value: unknown,
	minimum: number,
	maximum: number,
): number {
	if (
		typeof value !== "number" ||
		!Number.isFinite(value) ||
		value < minimum ||
		value > maximum
	)
		throw new Error("Invalid numeric value");
	return value;
}

function dimension(value: unknown): Dimension {
	if (value !== 2 && value !== 3) throw new Error("Invalid dimension");
	return value;
}

function flag(value: unknown): boolean {
	if (value !== 0 && value !== 1) throw new Error("Invalid flag");
	return value === 1;
}

function matchedString(
	value: unknown,
	pattern: RegExp,
	maximumLength: number,
): string {
	if (
		typeof value !== "string" ||
		value.length > maximumLength ||
		!pattern.test(value)
	)
		throw new Error("Invalid text value");
	return value;
}

function assertFits(payload: string): string {
	if (payload.length > MAX_SHARE_FRAGMENT_LENGTH)
		throw new Error("Share payload is too large");
	return payload;
}

function toBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (let index = 0; index < bytes.length; index += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
	if (!/^[A-Za-z0-9_-]+$/.test(value))
		throw new Error("Malformed share payload");
	try {
		const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
		const binary = atob(
			base64.padEnd(Math.ceil(base64.length / 4) * 4, "="),
		);
		return Uint8Array.from(binary, (character) => character.charCodeAt(0));
	} catch {
		throw new Error("Malformed share payload");
	}
}

async function transformBytes(
	bytes: Uint8Array,
	transform: CompressionStream,
): Promise<Uint8Array> {
	const writer = transform.writable.getWriter();
	const writing = writer
		.write(new Uint8Array(bytes))
		.then(() => writer.close());
	const [result] = await Promise.all([
		readBounded(transform.readable, MAX_DECODED_BYTES),
		writing,
	]);
	return result;
}

async function decompressBounded(bytes: Uint8Array): Promise<Uint8Array> {
	if (typeof DecompressionStream === "undefined")
		throw new Error("Compressed share payload is unsupported");
	const transform = new DecompressionStream("gzip");
	const writer = transform.writable.getWriter();
	const writing = writer
		.write(new Uint8Array(bytes))
		.then(() => writer.close());
	try {
		const [result] = await Promise.all([
			readBounded(transform.readable, MAX_DECODED_BYTES),
			writing,
		]);
		return result;
	} catch (error) {
		await Promise.allSettled([writing]);
		if (isPayloadTooLargeError(error)) throw error;
		throw malformedPayloadError(error);
	}
}

async function readBounded(
	stream: ReadableStream<Uint8Array>,
	limit: number,
): Promise<Uint8Array> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > limit) {
				await reader.cancel();
				throw new Error("Share payload is too large");
			}
			chunks.push(value);
		}
	} catch (error) {
		if (isPayloadTooLargeError(error)) throw error;
		throw malformedPayloadError(error);
	}
	const output = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return output;
}

function isPayloadTooLargeError(error: unknown): error is Error {
	return (
		error instanceof Error && error.message === "Share payload is too large"
	);
}

function malformedPayloadError(cause: unknown): Error {
	const error = new Error("Malformed share payload");
	(error as Error & { cause: unknown }).cause = cause;
	return error;
}
