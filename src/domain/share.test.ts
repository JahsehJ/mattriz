import { describe, expect, it } from "vitest";
import {
	MAX_RENDER_TRANSFORM_VALUE,
	MAX_WORKSPACE_NODES,
	createNumericCells,
	createInitialState,
	createMatrixNode,
	getNumericCellError,
} from "./state";
import {
	CameraSnapshots,
	MAX_SHARE_FRAGMENT_LENGTH,
	ShareSession,
	decodeShareSession,
	encodeShareSession,
} from "./share";

const cameras: CameraSnapshots = {
	2: { position: [0, 0, 10], target: [1, 2, 0], zoom: 1.5 },
	3: { position: [7, 7, 7], target: [0, 0, 0], zoom: 1 },
};

function session(): ShareSession {
	const state = createInitialState();
	state.activeDimension = 2;
	state.showBasis = false;
	state.showGrid = false;
	state.animation.mode = "composed";
	state.animation.status = "playing";
	state.workspaces[2].matrices[0].entries = createNumericCells(
		[Math.SQRT1_2, -0.5, Math.SQRT2, 1],
		["cos(pi/4)", "-1/2", "sqrt(2)", "1"],
	);
	state.workspaces[2].matrices[0].durationMs = 1_300;
	return { state, elapsedMs: 425, cameras };
}

function plainPayload(value: unknown): string {
	const bytes = new TextEncoder().encode(JSON.stringify(value));
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return `1j${btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "")}`;
}

async function compressedPayload(value: unknown): Promise<string> {
	const bytes = new TextEncoder().encode(JSON.stringify(value));
	const buffer = await new Response(
		new Blob([new Uint8Array(bytes)])
			.stream()
			.pipeThrough(new CompressionStream("gzip")),
	).arrayBuffer();
	let binary = "";
	for (const byte of new Uint8Array(buffer)) {
		binary += String.fromCharCode(byte);
	}
	return `1g${btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "")}`;
}

describe("share session codec", () => {
	it("round-trips persisted workspace and camera state", async () => {
		const source = session();
		const payload = await encodeShareSession(source);
		const restored = await decodeShareSession(payload);

		expect(payload).toMatch(/^1[jg][A-Za-z0-9_-]+$/);
		expect(restored.state).toMatchObject({
			activeDimension: 2,
			showBasis: false,
			showGrid: false,
			animation: { mode: "composed", status: "paused" },
		});
		expect(persistedWorkspaces(restored)).toEqual(
			persistedWorkspaces(source),
		);
		expect(restored.elapsedMs).toBe(425);
		expect(restored.cameras).toEqual(cameras);
	});

	it("decodes version 1 with its compatibility defaults", async () => {
		const source = session();
		const version2 = decodePlainTuple(
			await encodeShareSessionWithoutCompression(source),
		);
		const version1 = [
			1,
			version2[1],
			version2[2],
			version2[4],
			version2[5],
			version2[6],
			version2[7],
			version2[8],
			version2[9],
			version2[10],
		];

		const restored = await decodeShareSession(plainPayload(version1));

		expect(restored.state.showGrid).toBe(true);
		expect(restored.state.animation).toMatchObject({
			mode: "composed",
			status: "paused",
		});
		expect(persistedWorkspaces(restored)).toEqual(
			persistedWorkspaces(source),
		);
		expect(restored.elapsedMs).toBe(source.elapsedMs);
		expect(restored.cameras).toEqual(cameras);
	});

	it("preserves a rejected overflow draft across a share round trip", async () => {
		const source = session();
		const entry = source.state.workspaces[2].matrices[0].entries[0];
		entry.source = "100";

		const restored = await decodeShareSession(
			await encodeShareSession(source),
		);

		expect(restored.state.workspaces[2].matrices[0].entries[0]).toEqual({
			source: "100",
			value: Math.SQRT1_2,
		});
		expect(
			getNumericCellError(
				restored.state.workspaces[2].matrices[0].entries[0],
			),
		).toBe("transform-overflow");
	});

	it("round-trips applied transforms across the full rendering range", async () => {
		const source = session();
		source.state.workspaces[2].appliedTransform = [1e8, 0, 0, 1e8];

		const restored = await decodeShareSession(
			await encodeShareSession(source),
		);

		expect(restored.state.workspaces[2].appliedTransform).toEqual([
			1e8, 0, 0, 1e8,
		]);
	});

	it("rejects applied transforms outside the rendering bound", async () => {
		const source = session();
		source.state.workspaces[2].appliedTransform = [
			MAX_RENDER_TRANSFORM_VALUE * 10,
			0,
			0,
			1,
		];

		await expect(encodeShareSession(source)).rejects.toThrow(
			"Invalid numeric value",
		);
	});

	it("accepts the UI node limit and rejects collections above it", async () => {
		const source = session();
		source.state.workspaces[2].matrices = Array.from(
			{ length: MAX_WORKSPACE_NODES },
			() => createMatrixNode(2, "A"),
		);
		await expect(encodeShareSession(source)).resolves.toMatch(/^1[jg]/);

		source.state.workspaces[2].matrices.push(createMatrixNode(2, "A"));
		await expect(encodeShareSession(source)).rejects.toThrow(
			"Invalid share collection",
		);
	});

	it.each([
		["unknown version", "9jAAAA"],
		["invalid base64", "1j<script>"],
		["corrupt gzip", "1gAAAA"],
		["wrong root shape", plainPayload({ __proto__: { polluted: true } })],
		["deep input", plainPayload([[[[[[[["x"]]]]]]]])],
	])("rejects %s", async (_name, payload) => {
		await expect(decodeShareSession(payload)).rejects.toThrow();
		expect(Object.prototype).not.toHaveProperty("polluted");
	});

	it("rejects hostile expression strings before creating runtime state", async () => {
		const valid = await decodeShareSession(
			await encodeShareSession(session()),
		);
		const state = valid.state;
		state.workspaces[2].matrices[0].entries[0].source =
			'<img src=x onerror="alert(1)">';

		await expect(encodeShareSession({ ...valid, state })).rejects.toThrow(
			"Invalid text value",
		);
	});

	it("rejects payloads over the encoded size limit", async () => {
		const oversizedPayload = "1j".padEnd(
			MAX_SHARE_FRAGMENT_LENGTH + 1,
			"A",
		);

		await expect(decodeShareSession(oversizedPayload)).rejects.toThrow(
			"too large",
		);
	});

	it("stops compressed payloads that exceed the decompression budget", async () => {
		const bomb = await compressedPayload(" ".repeat(300_000));

		expect(bomb.length).toBeLessThan(1_000);
		await expect(decodeShareSession(bomb)).rejects.toThrow(
			"Share payload is too large",
		);
	});
});

async function encodeShareSessionWithoutCompression(
	source: ShareSession,
): Promise<string> {
	const compressionStream = globalThis.CompressionStream;
	// Exercise the production encoder while making its tuple observable.
	Object.defineProperty(globalThis, "CompressionStream", {
		value: undefined,
		configurable: true,
	});
	try {
		return await encodeShareSession(source);
	} finally {
		Object.defineProperty(globalThis, "CompressionStream", {
			value: compressionStream,
			configurable: true,
		});
	}
}

function decodePlainTuple(payload: string): unknown[] {
	const encoded = payload.slice(2).replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="));
	const bytes = Uint8Array.from(binary, (character) =>
		character.charCodeAt(0),
	);
	return JSON.parse(new TextDecoder().decode(bytes)) as unknown[];
}

function persistedWorkspaces({ state }: ShareSession) {
	return Object.fromEntries(
		([2, 3] as const).map((dimension) => {
			const workspace = state.workspaces[dimension];
			return [
				dimension,
				{
					dimension: workspace.dimension,
					matrices: workspace.matrices.map(
						({ label, entries, durationMs }) => ({
							label,
							draftValues: entries.map((entry) => entry.source),
							values: entries.map((entry) => entry.value),
							durationMs,
						}),
					),
					vectors: workspace.vectors.map(
						({ label, coordinates, color }) => ({
							label,
							draftComponents: coordinates.map(
								(coordinate) => coordinate.source,
							),
							components: coordinates.map(
								(coordinate) => coordinate.value,
							),
							color,
						}),
					),
					appliedTransform: workspace.appliedTransform,
				},
			];
		}),
	);
}
