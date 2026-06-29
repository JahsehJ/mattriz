const CACHE_NAME = "mattriz-v2";
const APP_SHELL_URL = new URL("./", self.registration.scope);
const LOCALE_APP_SHELL_PATHS = ["zh-hant/"];
const LOCALE_APP_SHELL_URLS = LOCALE_APP_SHELL_PATHS.map(
  (path) => new URL(path, self.registration.scope)
);
const APP_SHELL_URLS = [APP_SHELL_URL, ...LOCALE_APP_SHELL_URLS];
const STATIC_ASSETS = [
  "favicon.svg",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const responses = await Promise.all(
        APP_SHELL_URLS.map((url) => fetch(url, { cache: "reload" }))
      );
      const failedResponse = responses.find((response) => !response.ok);
      if (failedResponse) {
        throw new Error(`Unable to cache app shell: ${failedResponse.status}`);
      }

      await Promise.all(
        responses.map((response, index) =>
          cache.put(APP_SHELL_URLS[index], response.clone())
        )
      );
      const htmlDocuments = await Promise.all(
        responses.map((response) => response.text())
      );
      const assetUrls = htmlDocuments.flatMap((html, index) =>
        Array.from(
          html.matchAll(/(?:href|src)="([^"]+)"/g),
          ([, path]) => new URL(path, APP_SHELL_URLS[index])
        )
      );
      const sameOriginAssets = assetUrls.filter(
        (url) => url.origin === APP_SHELL_URL.origin
      );
      const urls = [
        ...new Set([...STATIC_ASSETS.map((path) => new URL(path, APP_SHELL_URL)), ...sameOriginAssets].map(String))
      ];
      await cache.addAll(urls);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const appShellUrl =
          LOCALE_APP_SHELL_URLS.find((localeUrl) =>
            url.pathname.startsWith(localeUrl.pathname)
          ) ?? APP_SHELL_URL;
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(appShellUrl, response.clone());
          }
          return response;
        } catch {
          return caches.match(appShellUrl);
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })()
  );
});
