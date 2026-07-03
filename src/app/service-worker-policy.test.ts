import { describe, expect, it } from "vitest";
import {
	collectStaticAssetUrls,
	createServiceWorkerPolicy,
} from "../../public/sw-policy.js";

describe("service worker policy", () => {
	it("versions and scopes application-owned caches", () => {
		const policy = createServiceWorkerPolicy(
			"https://example.com/mattriz/",
			"https://example.com/mattriz/sw.js?v=1.2.0",
		);

		expect(policy.cacheName).toBe("mattriz-1.2.0");
		expect(policy.isOwnedCache("mattriz-old")).toBe(true);
		expect(policy.isOwnedCache("another-app")).toBe(false);
	});

	it("matches only root and localized application shells", () => {
		const policy = createServiceWorkerPolicy(
			"https://example.com/mattriz/",
			"https://example.com/mattriz/sw.js",
		);

		expect(
			policy.findNavigationShell(
				"https://example.com/mattriz/zh-hant/index.html",
			)?.href,
		).toBe("https://example.com/mattriz/zh-hant/");
		expect(
			policy.findNavigationShell("https://example.com/mattriz/docs/"),
		).toBeNull();
	});

	it("collects static and same-origin document assets", () => {
		const policy = createServiceWorkerPolicy(
			"https://example.com/mattriz/",
			"https://example.com/mattriz/sw.js",
		);
		const urls = collectStaticAssetUrls(
			[
				'<link href="./assets/app.css"><script src="https://cdn.example/ignored.js"></script>',
				'<script src="../assets/app.js"></script>',
			],
			policy.appShellUrls,
			policy.appShellUrl,
		);

		expect(urls).toContain("https://example.com/mattriz/assets/app.css");
		expect(urls).toContain("https://example.com/mattriz/assets/app.js");
		expect(urls).not.toContain("https://cdn.example/ignored.js");
		expect(new Set(urls).size).toBe(urls.length);
	});
});
