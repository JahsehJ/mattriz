import { describe, expect, it, vi } from "vitest";
import { recomputeWorkspace } from "../app/workspace";
import { createInitialState } from "../app/state";
import { EquationRenderer } from "./equation-renderer";

const t = (key: string) => key;

describe("equation renderer", () => {
	it("renders operands, presets, vectors, and results", () => {
		const workspace = createInitialState().workspaces[3];
		const renderer = new EquationRenderer({
			root: {} as HTMLElement,
			t,
			getWorkspace: () => workspace,
			maxInputLength: 64,
		});

		const html = renderer.render();

		expect(html).toContain('class="matrix-stack"');
		expect(html).toContain('data-action="add-matrix-preset"');
		expect(html).toContain('data-action="add-eigenbasis"');
		expect(html).toContain('class="result-matrix-card');
	});

	it("renders an input-only equation when vectors are absent", () => {
		const workspace = createInitialState().workspaces[2];
		workspace.vectors = [];
		recomputeWorkspace(workspace);
		const renderer = new EquationRenderer({
			root: {} as HTMLElement,
			t,
			getWorkspace: () => workspace,
			maxInputLength: 64,
		});

		const html = renderer.render();

		expect(html).toContain("equation-row-input-only");
		expect(html).not.toContain("result-matrix-card");
	});

	it("updates eigenvector preset availability", () => {
		const workspace = createInitialState().workspaces[2];
		const basisButton = { disabled: true };
		const vectorButton = { disabled: true };
		const basisMessage = { toggleAttribute: vi.fn() };
		const vectorMessage = { toggleAttribute: vi.fn() };
		const root = {
			querySelectorAll: (selector: string) => {
				if (selector.includes("add-eigenbasis")) return [basisButton];
				if (selector.includes("add-eigenvector")) return [vectorButton];
				if (selector.includes("eigenbasis-unavailable"))
					return [basisMessage];
				return [vectorMessage];
			},
		} as unknown as HTMLElement;
		const renderer = new EquationRenderer({
			root,
			t,
			getWorkspace: () => workspace,
			maxInputLength: 64,
		});

		renderer.updatePresetAvailability();

		expect(basisButton.disabled).toBe(false);
		expect(vectorButton.disabled).toBe(false);
		expect(basisMessage.toggleAttribute).toHaveBeenCalledWith(
			"hidden",
			true,
		);
		expect(vectorMessage.toggleAttribute).toHaveBeenCalledWith(
			"hidden",
			true,
		);
	});

	it("defers eigenvector preset availability until the menu opens", () => {
		const workspace = createInitialState().workspaces[2];
		workspace.matrices[0].entries[0] = "invalid";
		recomputeWorkspace(workspace);
		const renderer = new EquationRenderer({
			root: {} as HTMLElement,
			t,
			getWorkspace: () => workspace,
			maxInputLength: 64,
		});

		const html = renderer.render();

		expect(html).toContain('data-action="add-eigenvector" disabled');
		expect(html).toContain('data-action="add-eigenbasis" disabled');
		expect(html).toContain('role="status" aria-live="polite"');
		expect(html).toContain("staleResults");
		expect(html).toContain('aria-describedby="stale-result-status"');
	});
});
