import { describe, expect, it } from "vitest";
import {
	getAlternateLocaleUrl,
	getAppRootUrl,
	getLocaleFromLanguageTag,
} from "./locale-routing";

describe("locale routing", () => {
	it("derives the initial locale from the document language", () => {
		expect(getLocaleFromLanguageTag("zh-Hant")).toBe("zh-Hant");
		expect(getLocaleFromLanguageTag("zh-TW")).toBe("zh-Hant");
		expect(getLocaleFromLanguageTag("en")).toBe("en");
	});

	it("preserves query parameters and shared-workspace fragments", () => {
		expect(
			getAlternateLocaleUrl(
				"https://example.com/mattriz/#s=workspace",
				"./zh-hant/",
			),
		).toBe("https://example.com/mattriz/zh-hant/#s=workspace");

		expect(
			getAlternateLocaleUrl(
				"https://example.com/mattriz/zh-hant/?mode=embed#s=workspace",
				"../",
			),
		).toBe("https://example.com/mattriz/?mode=embed#s=workspace");
	});

	it("replaces an existing fragment with the current workspace", () => {
		expect(
			getAlternateLocaleUrl(
				"https://example.com/mattriz/#s=old-workspace",
				"./zh-hant/",
				"current-workspace",
			),
		).toBe("https://example.com/mattriz/zh-hant/#s=current-workspace");
	});

	it("resolves the application root from nested locale pages", () => {
		expect(
			getAppRootUrl("https://example.com/mattriz/zh-hant/", "../").href,
		).toBe("https://example.com/mattriz/");
	});
});
