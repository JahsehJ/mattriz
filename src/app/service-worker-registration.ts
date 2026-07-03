import { getAppRootUrl } from "./locale-routing";

interface ServiceWorkerRegistrationOptions {
	currentUrl: string;
	baseUrl: string;
	version: string;
	register: (
		scriptUrl: URL,
		options: RegistrationOptions,
	) => Promise<ServiceWorkerRegistration>;
}

type ServiceWorkerRegistrationErrorReporter = (error: unknown) => void;

export function registerAppServiceWorker({
	currentUrl,
	baseUrl,
	version,
	register,
}: ServiceWorkerRegistrationOptions): Promise<ServiceWorkerRegistration> {
	const appRootUrl = getAppRootUrl(currentUrl, baseUrl);
	const serviceWorkerUrl = new URL("sw.js", appRootUrl);
	serviceWorkerUrl.searchParams.set("v", version);
	return register(serviceWorkerUrl, {
		scope: appRootUrl.pathname,
	});
}

export async function registerAppServiceWorkerSafely(
	options: ServiceWorkerRegistrationOptions,
	reportError: ServiceWorkerRegistrationErrorReporter = (error) =>
		console.error("Service worker registration failed", error),
): Promise<ServiceWorkerRegistration | undefined> {
	try {
		return await registerAppServiceWorker(options);
	} catch (error) {
		reportError(error);
		return undefined;
	}
}
