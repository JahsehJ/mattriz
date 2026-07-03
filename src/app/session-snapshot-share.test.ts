import { describe, expect, it } from "vitest";
import { recomputeWorkspace } from "../domain/workspace";
import { createInitialState } from "./state";
import {
	captureSessionSnapshot,
	restoreSessionSnapshot,
	type CameraSnapshots,
} from "./session-snapshot";
import {
	decodeShareSession,
	encodeShareSession,
} from "../infrastructure/session-codec";

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
		expect(decoded.workspaces[2].matrices[0].sources[0]).toBe("2 + 3");
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
		expect(decoded.workspaces[2].matrices[0].sources[0]).toBe("1/");
		expect(decoded.workspaces[2].vectors[0].sources[0]).toBe("999999");
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
				sources: ["100", "0", "0", "0", "100", "0", "0", "0", "100"],
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
