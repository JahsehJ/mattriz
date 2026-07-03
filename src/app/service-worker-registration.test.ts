import { describe, expect, it, vi } from "vitest";
import {
	registerAppServiceWorker,
	registerAppServiceWorkerSafely,
} from "./service-worker-registration";

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
			{ scope: "/mattriz/" },
		);
	});

	it("contains registration failures and reports them", async () => {
		const failure = new Error("registration denied");
		const reportError = vi.fn();
		const unhandled = vi.fn();
		process.on("unhandledRejection", unhandled);

		const result = await registerAppServiceWorkerSafely(
			{
				currentUrl: "https://example.com/mattriz/",
				baseUrl: "./",
				version: "1.2.0",
				register: vi.fn().mockRejectedValue(failure),
			},
			reportError,
		);
		await Promise.resolve();
		process.off("unhandledRejection", unhandled);

		expect(result).toBeUndefined();
		expect(reportError).toHaveBeenCalledWith(failure);
		expect(unhandled).not.toHaveBeenCalled();
	});
});
