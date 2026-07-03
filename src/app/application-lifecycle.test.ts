import { describe, expect, it, vi } from "vitest";
import { ApplicationLifecycle } from "./application-lifecycle";

describe("application lifecycle", () => {
	it("releases every listener and owned resource exactly once", () => {
		const lifecycle = new ApplicationLifecycle();
		const target = new EventTarget();
		const listener = vi.fn();
		const resource = { dispose: vi.fn() };

		lifecycle.listen(target, "change", listener);
		lifecycle.own(resource);
		target.dispatchEvent(new Event("change"));
		lifecycle.dispose();
		lifecycle.dispose();
		target.dispatchEvent(new Event("change"));

		expect(listener).toHaveBeenCalledOnce();
		expect(resource.dispose).toHaveBeenCalledOnce();
	});
});
