export const CACHE_PREFIX: string;
export const LOCALE_APP_SHELL_PATHS: string[];
export const STATIC_ASSET_PATHS: string[];

export interface ServiceWorkerPolicy {
	appShellUrl: URL;
	appShellUrls: URL[];
	cacheName: string;
	isOwnedCache(name: string): boolean;
	findNavigationShell(requestUrl: string | URL): URL | null;
}

export function createServiceWorkerPolicy(
	scope: string | URL,
	workerUrl: string | URL,
): ServiceWorkerPolicy;

export function collectStaticAssetUrls(
	htmlDocuments: string[],
	appShellUrls: URL[],
	appShellUrl: URL,
): string[];
