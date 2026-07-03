import { describe, expect, it } from "vitest";
import { recomputeWorkspace } from "./workspace";
import { createInitialState } from "./state";
import {
	captureSessionSnapshot,
	restoreSessionSnapshot,
	type CameraSnapshots,
} from "./session-snapshot";
import {
	decodeShareSession,
	encodeShareSession,
} from "../infrastructure/share/session-codec";

const cameras: CameraSnapshots = {
	2: { position: [0, 0, 5], target: [0, 0, 0], zoom: 1 },
	3: { position: [4, 4, 4], target: [0, 0, 0], zoom: 1 },
};

describe("workspace sharing", () => {
	it("round trips valid sessions", async () => {
		const state = createInitialState();
		const workspace = state.workspaces[2];
		workspace.matrices[0].entries[0] = "2 + 3";
		recomputeWorkspace(workspace);
		const snapshot = captureSessionSnapshot(state, 0, cameras);
		const decoded = await decodeShareSession(
			await encodeShareSession(snapshot),
		);
		expect(decoded.workspaces[2].matrices[0].entries[0]).toBe("2 + 3");
		expect(
			decoded.workspaces[2].lastValidEvaluation.matrices[0].values[0],
		).toBe(5);
	});

	it("round trips invalid text with an independent stale evaluation", async () => {
		const state = createInitialState();
		const workspace = state.workspaces[2];
		const stale = workspace.lastValidEvaluation;
		workspace.matrices[0].entries[0] = "1/";
		workspace.vectors[0].coordinates[0] = "999999";
		recomputeWorkspace(workspace);
		const decoded = await decodeShareSession(
			await encodeShareSession(captureSessionSnapshot(state, 0, cameras)),
		);
		expect(decoded.workspaces[2].matrices[0].entries[0]).toBe("1/");
		expect(decoded.workspaces[2].vectors[0].coordinates[0]).toBe("999999");
		expect(
			decoded.workspaces[2].lastValidEvaluation.matrices[0].values,
		).toEqual(stale.matrices[0].values);

		const restored = restoreSessionSnapshot(decoded);
		expect(restored.workspaces[2].matrices[0].entries[0]).toBe("1/");
		expect(
			restored.workspaces[2].lastValidEvaluation.matrices[0].values,
		).toEqual(stale.matrices[0].values);
		expect(restored.animation.status).toBe("idle");
	});

	it("recomputes valid sources instead of trusting a persisted evaluation", async () => {
		const state = createInitialState();
		const workspace = state.workspaces[2];
		workspace.matrices[0].entries[0] = "2 + 3";
		recomputeWorkspace(workspace);
		const decoded = await decodeShareSession(
			await encodeShareSession(captureSessionSnapshot(state, 0, cameras)),
		);
		decoded.workspaces[2].lastValidEvaluation.matrices[0].values[0] = 999;

		const restored = restoreSessionSnapshot(decoded);

		expect(restored.workspaces[2].matrices[0].entries[0]).toBe("2 + 3");
		expect(
			restored.workspaces[2].lastValidEvaluation.matrices[0].values[0],
		).toBe(5);
	});

	it.each([
		{ version: 1, showGrid: true },
		{ version: 2, showGrid: false },
	])("upgrades version $version payloads", async ({ version, showGrid }) => {
		const state = createInitialState();
		state.workspaces[2].matrices[0].entries[0] = "2 + 3";
		recomputeWorkspace(state.workspaces[2]);
		const snapshot = captureSessionSnapshot(state, 250, cameras);
		const workspace = (dimension: 2 | 3) => {
			const item = snapshot.workspaces[dimension];
			return [
				item.matrices.map((matrix, index) => [
					matrix.label,
					matrix.entries,
					item.lastValidEvaluation.matrices[index].values,
					matrix.durationMs,
				]),
				item.vectors.map((vector, index) => [
					vector.label,
					vector.coordinates,
					item.lastValidEvaluation.vectors[index].values,
					vector.color,
				]),
				item.appliedTransform,
			];
		};
		const camera = (dimension: 2 | 3) => {
			const item = snapshot.cameras[dimension];
			return [item.position, item.target, item.zoom];
		};
		const sharedFields = [
			snapshot.activeDimension,
			snapshot.showBasis ? 1 : 0,
		];
		const payload =
			version === 1
				? [
						1,
						...sharedFields,
						0,
						0,
						snapshot.elapsedMs,
						workspace(2),
						workspace(3),
						camera(2),
						camera(3),
					]
				: [
						2,
						...sharedFields,
						0,
						0,
						0,
						snapshot.elapsedMs,
						workspace(2),
						workspace(3),
						camera(2),
						camera(3),
					];

		const decoded = await decodeShareSession(asPlainPayload(payload));

		expect(decoded.showGrid).toBe(showGrid);
		expect(decoded.workspaces[2].matrices[0].entries[0]).toBe("2 + 3");
		expect(
			decoded.workspaces[2].lastValidEvaluation.matrices[0].values[0],
		).toBe(5);
	});

	it("keeps an unrenderable animated session idle", () => {
		const snapshot = captureSessionSnapshot(
			createInitialState(),
			500,
			cameras,
		);
		const matrix = snapshot.workspaces[3].matrices[0];
		snapshot.animationActive = true;
		snapshot.workspaces[3].matrices = Array.from(
			{ length: 16 },
			(_, index) => ({
				...matrix,
				label: `A${index}`,
				entries: ["100", "0", "0", "0", "100", "0", "0", "0", "100"],
			}),
		);

		const restored = restoreSessionSnapshot(snapshot);

		expect(restored.animation.status).toBe("idle");
	});

	it("rejects malformed and unsupported payloads", async () => {
		await expect(decodeShareSession("bad")).rejects.toThrow();
		await expect(decodeShareSession("1j%%%")).rejects.toThrow();
	});
});

function asPlainPayload(value: unknown): string {
	const bytes = new TextEncoder().encode(JSON.stringify(value));
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return `1j${btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "")}`;
}
