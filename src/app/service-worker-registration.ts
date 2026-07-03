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
		type: "module",
	});
}
