// @ts-check
/* global URL */

import { LOCALE_APP_SHELL_PATHS } from "./sw-locales.js";

export const CACHE_PREFIX = "mattriz-";
export const STATIC_ASSET_PATHS = [
	"favicon.svg",
	"icon-192.png",
	"icon-512.png",
	"apple-touch-icon.png",
];

/**
 * @param {string | URL} scope
 * @param {string | URL} workerUrl
 */
export function createServiceWorkerPolicy(scope, workerUrl) {
	const appShellUrl = new URL("./", scope);
	const appShellUrls = [
		appShellUrl,
		...LOCALE_APP_SHELL_PATHS.map((path) => new URL(path, scope)),
	];
	const releaseVersion =
		new URL(workerUrl).searchParams.get("v") ?? "development";

	return {
		appShellUrl,
		appShellUrls,
		cacheName: `${CACHE_PREFIX}${releaseVersion}`,
		isOwnedCache(/** @type {string} */ name) {
			return name.startsWith(CACHE_PREFIX);
		},
		findNavigationShell(/** @type {string | URL} */ requestUrl) {
			const url = new URL(requestUrl);
			return (
				appShellUrls.find(
					(shellUrl) =>
						url.pathname === shellUrl.pathname ||
						url.pathname === `${shellUrl.pathname}index.html`,
				) ?? null
			);
		},
	};
}

/**
 * @param {string[]} htmlDocuments
 * @param {URL[]} appShellUrls
 * @param {URL} appShellUrl
 */
export function collectStaticAssetUrls(
	htmlDocuments,
	appShellUrls,
	appShellUrl,
) {
	const documentAssets = htmlDocuments.flatMap((html, index) =>
		Array.from(
			html.matchAll(/(?:href|src)="([^"]+)"/g),
			([, path]) => new URL(path, appShellUrls[index]),
		),
	);
	const sameOriginAssets = documentAssets.filter(
		(url) => url.origin === appShellUrl.origin,
	);
	return [
		...new Set(
			[
				...STATIC_ASSET_PATHS.map(
					(path) => new URL(path, appShellUrl),
				),
				...sameOriginAssets,
			].map(String),
		),
	];
}
