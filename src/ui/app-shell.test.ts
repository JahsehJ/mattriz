import { describe, expect, it } from "vitest";
import { renderAppShell } from "./app-shell";

describe("application shell rendering", () => {
	it("renders localized controls, dialogs, routes, and version metadata", () => {
		const html = renderAppShell((key) => `translated:${key}`, "1.2.3");

		expect(html).toContain('data-action="share"');
		expect(html).toContain('data-action="confirm-reset-workspace"');
		expect(html).toContain('option value="zh-Hant"');
		expect(html).toContain("translated:transformationViewport");
		expect(html).toContain("v1.2.3");
		expect(html).toContain("https://github.com/JahsehJ/mattriz");
	});
});
