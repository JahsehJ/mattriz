import { describe, expect, it } from "vitest";
import {
	MAX_WORKSPACE_NODES,
	createInitialState,
	createMatrixNode,
} from "./state";
import {
	CameraSnapshots,
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
	state.workspaces[2].matrices[0].draftValues = [
		"cos(pi/4)",
		"-1/2",
		"sqrt(2)",
		"1",
	];
	state.workspaces[2].matrices[0].values = [
		Math.SQRT1_2,
		-0.5,
		Math.SQRT2,
		1,
	];
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
	it("round-trips complete workspace and camera state", async () => {
		const payload = await encodeShareSession(session());
		const restored = await decodeShareSession(payload);

		expect(payload).toMatch(/^1[jg][A-Za-z0-9_-]+$/);
		expect(restored.state).toMatchObject({
			activeDimension: 2,
			showBasis: false,
			showGrid: false,
			animation: { mode: "composed", status: "paused" },
		});
		expect(restored.state.workspaces[2].matrices[0]).toMatchObject({
			label: "A",
			draftValues: ["cos(pi/4)", "-1/2", "sqrt(2)", "1"],
			values: [Math.SQRT1_2, -0.5, Math.SQRT2, 1],
			durationMs: 1_300,
		});
		expect(restored.elapsedMs).toBe(425);
		expect(restored.cameras).toEqual(cameras);
	});

	it("allows applied transforms composed beyond the input value bound", async () => {
		const source = session();
		source.state.workspaces[2].appliedTransform = [400, 0, 0, 400];

		const restored = await decodeShareSession(
			await encodeShareSession(source),
		);

		expect(restored.state.workspaces[2].appliedTransform).toEqual([
			400, 0, 0, 400,
		]);
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
		state.workspaces[2].matrices[0].draftValues[0] =
			'<img src=x onerror="alert(1)">';

		await expect(encodeShareSession({ ...valid, state })).rejects.toThrow(
			"Invalid text value",
		);
	});

	it("rejects payloads over the encoded size limit", async () => {
		await expect(
			decodeShareSession(`1j${"A".repeat(32_769)}`),
		).rejects.toThrow("too large");
	});

	it("stops compressed payloads that exceed the decompression budget", async () => {
		const bomb = await compressedPayload(" ".repeat(300_000));

		expect(bomb.length).toBeLessThan(1_000);
		await expect(decodeShareSession(bomb)).rejects.toThrow();
	});
});
