import { beforeAll, describe, expect, it, vi } from "vitest";
import { recomputeWorkspace } from "../domain/workspace";
import { createInitialState } from "../app/state";
import {
	renderMatrixCard,
	renderResultMatrix,
	renderVectorMatrix,
	updateMatrixGridWidth,
	updateVectorColumnWidths,
} from "./equation-cards";

const t = (key: string, values?: Record<string, string | number>) =>
	`${key}:${JSON.stringify(values ?? {})}`;

beforeAll(() => {
	vi.stubGlobal("CSS", { escape: (value: string) => value });
});

describe("equation card rendering", () => {
	it("renders matrix drafts, errors, duration, and accessible labels", () => {
		const workspace = createInitialState().workspaces[2];
		const matrix = workspace.matrices[0];
		matrix.entries[0] = "<invalid>";
		recomputeWorkspace(workspace);

		const html = renderMatrixCard(workspace.matrices[0], workspace, t, 64);

		expect(html).toContain('value="&lt;invalid&gt;"');
		expect(html).toContain("aria-invalid");
		expect(html).toContain(`data-duration-id="${matrix.id}"`);
		expect(html).toContain("matrixEntry:");
	});

	it("renders input and transformed vector columns", () => {
		const workspace = createInitialState().workspaces[3];

		const inputs = renderVectorMatrix(workspace, t, 64, () => "<add />");
		const results = renderResultMatrix(workspace, t);

		expect(inputs).toContain('data-component-index="2"');
		expect(inputs).toContain("<add />");
		expect(results).toContain('data-result-vector-index="0"');
		expect(results).toContain(">1</output>");
	});
});

describe("equation card sizing", () => {
	it("updates matrix and vector column templates from current values", () => {
		const matrixStyle = { gridTemplateColumns: "" };
		const matrixGrid = {
			classList: { contains: () => false },
			querySelectorAll: () => [{ value: "1" }, { value: "12345" }],
			style: matrixStyle,
		};
		updateMatrixGridWidth({
			closest: () => matrixGrid,
		} as unknown as HTMLInputElement);
		expect(matrixStyle.gridTemplateColumns).toContain("5 * 1ch");

		const label = { dataset: { vectorColumnId: "v1" } };
		const vectorStyle = { gridTemplateColumns: "" };
		const card = {
			querySelectorAll: (selector: string) => {
				if (selector === ".vector-column-label") return [label];
				if (selector.includes("input")) return [{ value: "123456" }];
				return [{ style: vectorStyle }];
			},
		};
		updateVectorColumnWidths({
			closest: () => card,
		} as unknown as HTMLInputElement);
		expect(vectorStyle.gridTemplateColumns).toContain("6 * 1ch");
	});
});
