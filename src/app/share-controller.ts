import {
	localeMetadata,
	type Locale,
	type MessageKey,
	type Translate,
} from "../i18n";
import { getAlternateLocaleUrl, getAppRootUrl } from "./locale-routing";
import {
	MAX_SHARE_FRAGMENT_LENGTH,
	encodeShareSession,
	type CameraSnapshots,
} from "../domain/share";
import { getAnimationElapsed, type AppState } from "../domain/state";

interface ShareControllerOptions {
	root: HTMLElement;
	language: HTMLSelectElement;
	shareDialog: HTMLDialogElement;
	shareLink: HTMLInputElement;
	locale: Locale;
	t: Translate;
	getState(): AppState;
	getCameras(): CameraSnapshots;
}

export class ShareController {
	private statusTimer = 0;

	constructor(private readonly options: ShareControllerOptions) {}

	async navigateToSelectedLocale(): Promise<void> {
		const metadata = localeMetadata.find(
			({ code }) => code === this.options.language.value,
		);
		if (!metadata) {
			this.options.language.value = this.options.locale;
			return;
		}
		const appRoot = getAppRootUrl(
			window.location.href,
			document.documentElement.dataset.appRootUrl ??
				import.meta.env.BASE_URL,
		);
		try {
			const url = getAlternateLocaleUrl(
				window.location.href,
				new URL(metadata.path, appRoot).href,
				await this.encodeCurrentSession(),
			);
			this.assertUrlFits(url);
			window.location.assign(url);
		} catch (error) {
			this.options.language.value = this.options.locale;
			this.setStatus(errorKey(error));
		}
	}

	async shareWorkspace(): Promise<void> {
		try {
			const url = new URL(window.location.href);
			url.hash = `s=${await this.encodeCurrentSession()}`;
			this.assertUrlFits(url.href);
			await navigator.clipboard.writeText(url.href);
			window.history.replaceState(window.history.state, "", url);
			this.setStatus("copied");
			this.options.shareLink.value = url.href;
			this.options.shareDialog.showModal();
			this.options.shareLink.select();
		} catch (error) {
			this.setStatus(errorKey(error));
		}
	}

	dispose(): void {
		window.clearTimeout(this.statusTimer);
	}

	private async encodeCurrentSession(): Promise<string> {
		const state = this.options.getState();
		const elapsedMs =
			state.animation.status === "idle"
				? 0
				: getAnimationElapsed(state.animation, performance.now());
		return encodeShareSession({
			state,
			elapsedMs,
			cameras: this.options.getCameras(),
		});
	}

	private assertUrlFits(url: string): void {
		if (url.length > MAX_SHARE_FRAGMENT_LENGTH) {
			throw new Error("Share payload is too large");
		}
	}

	private setStatus(key: MessageKey): void {
		window.clearTimeout(this.statusTimer);
		const button = this.options.root.querySelector<HTMLButtonElement>(
			"[data-action='share']",
		);
		const status = this.options.root.querySelector<HTMLElement>(
			"[data-share-status]",
		);
		if (button) button.textContent = this.options.t(key);
		if (status) status.textContent = this.options.t(key);
		this.statusTimer = window.setTimeout(() => {
			if (button) button.textContent = this.options.t("share");
			if (status) status.textContent = "";
		}, 2_000);
	}
}

function errorKey(error: unknown): MessageKey {
	return error instanceof Error &&
		error.message === "Share payload is too large"
		? "shareTooLarge"
		: "copyFailed";
}
