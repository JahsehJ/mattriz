import { describe, expect, it, vi } from "vitest";
import { registerAppServiceWorker } from "./service-worker-registration";

describe("service worker registration", () => {
	it("registers a versioned module worker at the application root", async () => {
		const register = vi.fn().mockResolvedValue({});

		await registerAppServiceWorker({
			currentUrl: "https://example.com/mattriz/zh-hant/",
			baseUrl: "../",
			version: "1.2.0",
			register,
		});

		expect(register).toHaveBeenCalledWith(
			new URL("https://example.com/mattriz/sw.js?v=1.2.0"),
			{ scope: "/mattriz/", type: "module" },
		);
	});
});
