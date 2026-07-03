import type { Dimension, MatrixFor, VectorFor } from "../domain/math";
import { MAX_EXPRESSION_LENGTH, MAX_WORKSPACE_NODES } from "../domain/policy";
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
import {
	decodeSharePayload,
	encodeSharePayload,
} from "./share-payload-transport";
export { MAX_SHARE_FRAGMENT_LENGTH } from "./share-payload-transport";
export type {
	CameraSnapshot,
	CameraSnapshots,
	SessionSnapshot,
} from "../app/session-snapshot";

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
	return encodeSharePayload(encodeVersion3(session));
}

export async function decodeShareSession(
	fragment: string,
): Promise<SessionSnapshot> {
	return decodeVersionedTuple(await decodeSharePayload(fragment));
}

function encodeVersion3(session: SessionSnapshot): JsonValue {
	const workspace = (dimension: Dimension): JsonValue => {
		const item = session.workspaces[dimension];
		return [
			item.matrices.map(encodeMatrix),
			item.vectors.map(encodeVector),
			item.appliedTransform,
			[
				item.lastValidEvaluation.matrices.map(encodeEvaluatedMatrix),
				item.lastValidEvaluation.vectors.map(encodeEvaluatedVector),
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

function encodeMatrix(
	matrix: WorkspaceSnapshot<Dimension>["matrices"][number],
): JsonValue {
	return [matrix.label, matrix.entries, matrix.durationMs];
}

function encodeVector(
	vector: WorkspaceSnapshot<Dimension>["vectors"][number],
): JsonValue {
	return [vector.label, vector.coordinates, vector.color];
}

function encodeEvaluatedMatrix(
	matrix: WorkspaceSnapshot<Dimension>["lastValidEvaluation"]["matrices"][number],
): JsonValue {
	return [matrix.label, matrix.values, matrix.durationMs];
}

function encodeEvaluatedVector(
	vector: WorkspaceSnapshot<Dimension>["lastValidEvaluation"]["vectors"][number],
): JsonValue {
	return [vector.label, vector.values, vector.color];
}

function decodeVersionedTuple(value: unknown): SessionSnapshot {
	if (!Array.isArray(value)) throw new Error("Invalid share payload shape");
	const version: unknown = value[0];
	switch (version) {
		case 1:
			return decodeCurrentTuple(upgradeVersion1(value));
		case 2:
			return decodeCurrentTuple(upgradeVersion2(value));
		case 3:
			return decodeCurrentTuple(value);
		default:
			throw new Error("Unsupported share payload");
	}
}

function upgradeVersion1(value: unknown): unknown[] {
	const [
		,
		activeDimension,
		showBasis,
		animationMode,
		animationActive,
		elapsedMs,
		workspace2,
		workspace3,
		camera2,
		camera3,
	] = tuple(value, 10);
	return [
		CURRENT_SHARE_PAYLOAD_VERSION,
		activeDimension,
		showBasis,
		1,
		animationMode,
		animationActive,
		elapsedMs,
		upgradeLegacyWorkspace(workspace2),
		upgradeLegacyWorkspace(workspace3),
		camera2,
		camera3,
	];
}

function upgradeVersion2(value: unknown): unknown[] {
	const [
		,
		activeDimension,
		showBasis,
		showGrid,
		animationMode,
		animationActive,
		elapsedMs,
		workspace2,
		workspace3,
		camera2,
		camera3,
	] = tuple(value, 11);
	return [
		CURRENT_SHARE_PAYLOAD_VERSION,
		activeDimension,
		showBasis,
		showGrid,
		animationMode,
		animationActive,
		elapsedMs,
		upgradeLegacyWorkspace(workspace2),
		upgradeLegacyWorkspace(workspace3),
		camera2,
		camera3,
	];
}

function decodeCurrentTuple(value: unknown): SessionSnapshot {
	const [
		version,
		activeDimension,
		showBasis,
		showGrid,
		animationMode,
		animationActive,
		elapsedMs,
		workspace2,
		workspace3,
		camera2,
		camera3,
	] = tuple(value, 11);
	if (version !== CURRENT_SHARE_PAYLOAD_VERSION)
		throw new Error("Unsupported share payload");
	return createDecodedSession({
		activeDimension: dimension(activeDimension),
		showBasis: flag(showBasis),
		showGrid: flag(showGrid),
		mode: flag(animationMode) ? "composed" : "steps",
		paused: flag(animationActive),
		elapsedMs: finiteNumber(elapsedMs, 0, MAX_SESSION_ELAPSED_MS),
		workspace2: parseWorkspace(workspace2, 2),
		workspace3: parseWorkspace(workspace3, 3),
		camera2: parseCamera(camera2),
		camera3: parseCamera(camera3),
	});
}

function upgradeLegacyWorkspace(value: unknown): unknown[] {
	const workspace = tuple(value, 3);
	const matrices = boundedArray(workspace[0]).map((entry) => {
		const matrix = tuple(entry, 4);
		return {
			document: [matrix[0], matrix[1], matrix[3]],
			evaluation: [matrix[0], matrix[2], matrix[3]],
		};
	});
	const vectors = boundedArray(workspace[1]).map((entry) => {
		const vector = tuple(entry, 4);
		return {
			document: [vector[0], vector[1], vector[3]],
			evaluation: [vector[0], vector[2], vector[3]],
		};
	});
	return [
		matrices.map((matrix) => matrix.document),
		vectors.map((vector) => vector.document),
		workspace[2],
		[
			matrices.map((matrix) => matrix.evaluation),
			vectors.map((vector) => vector.evaluation),
		],
	];
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

function parseWorkspace<D extends Dimension>(
	value: unknown,
	dimensionValue: D,
): WorkspaceSnapshot<D> {
	const item = tuple(value, 4);
	const matrices = boundedArray(item[0]).map((entry) => {
		const matrix = tuple(entry, 3);
		return {
			label: matchedString(matrix[0], MATRIX_LABEL, 16),
			entries: expressions(matrix[1], dimensionValue ** 2),
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
			coordinates: expressions(vector[1], dimensionValue),
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
		matchedString(entry, EXPRESSION, MAX_EXPRESSION_LENGTH),
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
