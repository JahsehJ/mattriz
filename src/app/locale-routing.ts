import { localeMetadata, Locale } from "../i18n";

export function getLocaleFromLanguageTag(languageTag: string): Locale {
	const normalizedTag = languageTag.toLowerCase();
	return (
		localeMetadata.find(({ languageTags }) =>
			languageTags.some((tag) => normalizedTag === tag.toLowerCase()),
		)?.code ?? "en"
	);
}

export function getAlternateLocaleUrl(
	currentUrl: string,
	alternateLocaleUrl: string,
	workspacePayload?: string,
): string {
	const current = new URL(currentUrl);
	const alternate = new URL(alternateLocaleUrl, current);
	alternate.search = current.search;
	alternate.hash =
		workspacePayload === undefined ? current.hash : `s=${workspacePayload}`;
	return alternate.href;
}

export function getAppRootUrl(currentUrl: string, appRootUrl: string): URL {
	return new URL(appRootUrl, currentUrl);
}
