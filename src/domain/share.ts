import type { Dimension, MatrixValues, VectorValues } from "./math";
import {
	MAX_WORKSPACE_NODES,
	type AnimationMode,
	type AppState,
} from "./state";

export const MAX_SHARE_FRAGMENT_LENGTH = 32_768;
const MAX_DECODED_BYTES = 262_144;
const MAX_ABSOLUTE_VALUE = 100;
const MAX_CAMERA_VALUE = 1_000;
const MATRIX_LABEL = /^[A-Z]{1,2}$/;
const VECTOR_LABEL = /^v[1-9][0-9]{0,2}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const EXPRESSION = /^[0-9A-Za-z+\-*/^().\s]*$/;

export interface CameraSnapshot {
	position: [number, number, number];
	target: [number, number, number];
	zoom: number;
}

export interface CameraSnapshots {
	2: CameraSnapshot;
	3: CameraSnapshot;
}

export interface ShareSession {
	state: AppState;
	elapsedMs: number;
	cameras: CameraSnapshots;
}

type JsonValue =
	| null
	| boolean
	| number
	| string
	| JsonValue[]
	| { [key: string]: JsonValue };

export async function encodeShareSession(
	session: ShareSession,
): Promise<string> {
	const serialized = toTuple(session);
	fromTuple(serialized);
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
): Promise<ShareSession> {
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
	return fromTuple(value);
}

function toTuple(session: ShareSession): JsonValue {
	const state = session.state;
	const workspace = (dimension: Dimension): JsonValue => {
		const item = state.workspaces[dimension];
		return [
			item.matrices.map((matrix) => [
				matrix.label,
				matrix.draftValues,
				matrix.values,
				matrix.durationMs,
			]),
			item.vectors.map((vector) => [
				vector.label,
				vector.draftComponents,
				vector.components,
				vector.color,
			]),
			item.appliedTransform,
		];
	};
	const camera = (dimension: Dimension): JsonValue => {
		const item = session.cameras[dimension];
		return [item.position, item.target, item.zoom];
	};
	return [
		2,
		state.activeDimension,
		state.showBasis ? 1 : 0,
		state.showGrid ? 1 : 0,
		state.animation.mode === "composed" ? 1 : 0,
		state.animation.status === "idle" ? 0 : 1,
		session.elapsedMs,
		workspace(2),
		workspace(3),
		camera(2),
		camera(3),
	];
}

function fromTuple(value: unknown): ShareSession {
	if (!Array.isArray(value)) throw new Error("Invalid share payload shape");
	const version: unknown = value[0];
	if (version !== 1 && version !== 2)
		throw new Error("Unsupported share payload");
	const root = tuple(value, version === 1 ? 10 : 11);
	const offset = version === 1 ? 0 : 1;
	const activeDimension = dimension(root[1]);
	const showBasis = flag(root[2]);
	const showGrid = version === 1 ? true : flag(root[3]);
	const mode: AnimationMode = flag(root[3 + offset]) ? "composed" : "steps";
	const paused = flag(root[4 + offset]);
	const elapsedMs = finiteNumber(root[5 + offset], 0, 384_000);
	const workspace2 = parseWorkspace(root[6 + offset], 2);
	const workspace3 = parseWorkspace(root[7 + offset], 3);

	return {
		state: {
			activeDimension,
			showBasis,
			showGrid,
			workspaces: { 2: workspace2, 3: workspace3 },
			animation: {
				mode,
				status: paused ? "paused" : "idle",
				startedAt: 0,
				pausedAt: 0,
			},
		},
		elapsedMs,
		cameras: {
			2: parseCamera(root[8 + offset]),
			3: parseCamera(root[9 + offset]),
		},
	};
}

function parseWorkspace(value: unknown, dimensionValue: Dimension) {
	const item = tuple(value, 3);
	const matrices = boundedArray(item[0]).map((entry) => {
		const matrix = tuple(entry, 4);
		const label = matchedString(matrix[0], MATRIX_LABEL, 16);
		const draftValues = expressions(matrix[1], dimensionValue ** 2);
		const values = numbers(
			matrix[2],
			dimensionValue ** 2,
			MAX_ABSOLUTE_VALUE,
		) as MatrixValues;
		const durationMs = finiteNumber(matrix[3], 100, 3_000);
		return {
			id: crypto.randomUUID(),
			label,
			draftValues,
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
			MAX_ABSOLUTE_VALUE,
		) as VectorValues;
		const color = matchedString(vector[3], COLOR, 7).toLowerCase();
		return {
			id: crypto.randomUUID(),
			label,
			draftComponents,
			components,
			color,
		};
	});
	const appliedTransform = finiteNumbers(
		item[2],
		dimensionValue ** 2,
	) as MatrixValues;
	return { dimension: dimensionValue, matrices, vectors, appliedTransform };
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

function finiteNumbers(value: unknown, length: number): number[] {
	return tuple(value, length).map((entry) => {
		if (typeof entry !== "number" || !Number.isFinite(entry))
			throw new Error("Invalid numeric value");
		return entry;
	});
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
	} catch {
		await Promise.allSettled([writing]);
		throw new Error("Malformed share payload");
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
	} catch {
		throw new Error("Malformed share payload");
	}
	const output = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return output;
}
