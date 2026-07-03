import { describe, expect, it } from "vitest";
import { escapeHtml, renderVectorSymbol } from "./rendering";

describe("HTML rendering helpers", () => {
	it("escapes attribute and element delimiters", () => {
		expect(escapeHtml(`A&B"<tag>`)).toBe("A&amp;B&quot;&lt;tag&gt;");
	});

	it("renders numbered and primed vector symbols", () => {
		expect(renderVectorSymbol("v12")).toBe(
			"<msub><mi>v</mi><mn>12</mn></msub>",
		);
		expect(renderVectorSymbol("v1", true)).toContain("&#x2032;");
	});

	it("escapes labels that do not match the vector naming convention", () => {
		expect(renderVectorSymbol("<unsafe>")).toBe("<mi>&lt;unsafe&gt;</mi>");
	});
});
