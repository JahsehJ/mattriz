import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "./state";
import { ShareController } from "./share-controller";

const encodeShareSession = vi.hoisted(() => vi.fn());

vi.mock("../infrastructure/session-codec", async (importOriginal) => ({
	...(await importOriginal<
		typeof import("../infrastructure/session-codec")
	>()),
	encodeShareSession,
}));

function setup() {
	const button = { textContent: "" };
	const status = { textContent: "" };
	const showModal = vi.fn();
	const selectShareLink = vi.fn();
	const root = {
		querySelector: vi.fn((selector: string) =>
			selector.includes("share-status") ? status : button,
		),
	} as unknown as HTMLElement;
	const language = { value: "en" } as HTMLSelectElement;
	const shareDialog = { showModal } as unknown as HTMLDialogElement;
	const shareLink = {
		value: "",
		select: selectShareLink,
	} as unknown as HTMLInputElement;
	const controller = new ShareController({
		root,
		language,
		shareDialog,
		shareLink,
		locale: "en",
		t: (key) => key,
		getState: createInitialState,
		getCameras: () => ({
			2: { position: [0, 0, 10], target: [0, 0, 0], zoom: 1 },
			3: { position: [7, 7, 7], target: [0, 0, 0], zoom: 1 },
		}),
	});
	return {
		controller,
		button,
		status,
		shareLink,
		showModal,
		selectShareLink,
	};
}

let replaceState: ReturnType<typeof vi.fn>;
let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.useFakeTimers();
	encodeShareSession.mockReset().mockResolvedValue("payload");
	replaceState = vi.fn();
	writeText = vi.fn().mockResolvedValue(undefined);
	vi.stubGlobal("window", {
		location: { href: "https://example.com/mattriz/" },
		history: { state: null, replaceState },
		setTimeout,
		clearTimeout,
	});
	vi.stubGlobal("navigator", {
		clipboard: { writeText },
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("share controller", () => {
	it("updates the URL, opens the dialog, and copies the share link", async () => {
		const { controller, button, status, shareLink, showModal } = setup();

		await controller.shareWorkspace();

		expect(replaceState).toHaveBeenCalledWith(
			null,
			"",
			expect.objectContaining({ hash: "#s=payload" }),
		);
		expect(shareLink.value).toBe("https://example.com/mattriz/#s=payload");
		expect(showModal).toHaveBeenCalledOnce();
		expect(writeText).toHaveBeenCalledWith(shareLink.value);
		expect(button.textContent).toBe("copied");
		expect(status.textContent).toBe("copied");

		vi.advanceTimersByTime(2_000);
		expect(button.textContent).toBe("share");
		expect(status.textContent).toBe("");
	});

	it("keeps the dialog available when clipboard permission is denied", async () => {
		writeText.mockRejectedValueOnce(new Error("denied"));
		const { controller, status, showModal } = setup();

		await controller.shareWorkspace();

		expect(showModal).toHaveBeenCalledOnce();
		expect(status.textContent).toBe("copyFailed");
	});

	it("does not count the deployment URL toward the payload limit", async () => {
		encodeShareSession.mockResolvedValue("x".repeat(32_768));
		const { controller, showModal } = setup();

		await controller.shareWorkspace();

		expect(replaceState).toHaveBeenCalledOnce();
		expect(showModal).toHaveBeenCalledOnce();
	});

	it("reports payload limits enforced by the codec", async () => {
		encodeShareSession.mockRejectedValue(
			new Error("Share payload is too large"),
		);
		const { controller, status, showModal } = setup();

		await controller.shareWorkspace();

		expect(replaceState).not.toHaveBeenCalled();
		expect(showModal).not.toHaveBeenCalled();
		expect(status.textContent).toBe("shareTooLarge");
	});

	it("clears pending status restoration when disposed", async () => {
		const { controller, button } = setup();
		await controller.shareWorkspace();

		controller.dispose();
		vi.advanceTimersByTime(2_000);

		expect(button.textContent).toBe("copied");
	});
});
