const CACHE_NAME = "mattriz-v1";
const APP_SHELL_URL = new URL("./", self.registration.scope);
const STATIC_ASSETS = [
  "manifest.webmanifest",
  "favicon.svg",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const response = await fetch(APP_SHELL_URL, { cache: "reload" });
      if (!response.ok) throw new Error(`Unable to cache app shell: ${response.status}`);

      await cache.put(APP_SHELL_URL, response.clone());
      const html = await response.text();
      const assetUrls = Array.from(html.matchAll(/(?:href|src)="([^"]+)"/g), ([, path]) => new URL(path, APP_SHELL_URL));
      const sameOriginAssets = assetUrls.filter((url) => url.origin === APP_SHELL_URL.origin);
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
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(APP_SHELL_URL, response.clone());
          }
          return response;
        } catch {
          return caches.match(APP_SHELL_URL);
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
