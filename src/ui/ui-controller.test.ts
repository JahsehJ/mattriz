import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "../app/state";
import { UiController } from "./ui-controller";

function toggleElement(dataset: Record<string, string> = {}) {
	return {
		dataset,
		checked: false,
		textContent: "",
		value: "",
		style: { setProperty: vi.fn() },
		toggleAttribute: vi.fn(),
		setAttribute: vi.fn(),
		removeAttribute: vi.fn(),
	};
}

function setup() {
	const state = createInitialState();
	const dimensions = [
		toggleElement({ dimension: "2" }),
		toggleElement({ dimension: "3" }),
	];
	const play = toggleElement();
	const basis = toggleElement();
	const grid = toggleElement();
	const animationMode = toggleElement() as unknown as HTMLSelectElement;
	const stack = {
		innerHTML: "",
		querySelectorAll: vi.fn(() => []),
		querySelector: vi.fn(() => null),
	} as unknown as HTMLElement;
	const root = {
		querySelectorAll: vi.fn(() => dimensions),
		querySelector: vi.fn((selector: string) => {
			if (selector.includes("'play'")) return play;
			if (selector.includes("toggle-basis")) return basis;
			if (selector.includes("toggle-grid")) return grid;
			return null;
		}),
	} as unknown as HTMLElement;
	const options = {
		root,
		stack,
		animationMode,
		t: (key: string) => key,
		getState: () => state,
		renderEquation: vi.fn(() => "<equation />"),
		updatePresetAvailability: vi.fn(),
		scheduleRender: vi.fn(),
	};
	return {
		state,
		dimensions,
		play,
		basis,
		grid,
		stack,
		options,
		controller: new UiController(options),
	};
}

describe("UI controller", () => {
	it("synchronizes controls and renders the equation stack", () => {
		const { controller, dimensions, play, basis, grid, stack, options } =
			setup();

		controller.render();

		expect(dimensions[1].toggleAttribute).toHaveBeenCalledWith(
			"aria-pressed",
			true,
		);
		expect(play.textContent).toBe("apply");
		expect(basis.checked).toBe(true);
		expect(grid.checked).toBe(true);
		expect(stack.innerHTML).toBe("<equation />");
		expect(options.scheduleRender).toHaveBeenCalledOnce();
	});

	it("updates preset state without replacing the equation stack", () => {
		const { controller, stack, options } = setup();
		stack.innerHTML = "existing";

		controller.render(false);

		expect(stack.innerHTML).toBe("existing");
		expect(options.updatePresetAvailability).toHaveBeenCalledOnce();
	});

	it.each([
		["playing", "pause", "pauseAnimation"],
		["paused", "resume", "resumeAnimation"],
	] as const)("renders %s playback state", (status, text, label) => {
		const { controller, state, play } = setup();
		state.animation = { ...state.animation, status };

		controller.updatePlaybackControl();

		expect(play.textContent).toBe(text);
		expect(play.setAttribute).toHaveBeenCalledWith("aria-label", label);
		expect(play.dataset.playbackStatus).toBe(status);
	});
});
