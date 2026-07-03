import {
  collectStaticAssetUrls,
  createServiceWorkerPolicy
} from "./sw-policy.js";

const policy = createServiceWorkerPolicy(
  self.registration.scope,
  self.location.href
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(policy.cacheName);
      const responses = await Promise.all(
        policy.appShellUrls.map((url) => fetch(url, { cache: "reload" }))
      );
      const failedResponse = responses.find((response) => !response.ok);
      if (failedResponse) {
        throw new Error(`Unable to cache app shell: ${failedResponse.status}`);
      }

      await Promise.all(
        responses.map((response, index) =>
          cache.put(policy.appShellUrls[index], response.clone())
        )
      );
      const htmlDocuments = await Promise.all(
        responses.map((response) => response.text())
      );
      const urls = collectStaticAssetUrls(
        htmlDocuments,
        policy.appShellUrls,
        policy.appShellUrl
      );
      await cache.addAll(urls);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (name) => policy.isOwnedCache(name) && name !== policy.cacheName
          )
          .map((name) => caches.delete(name))
      );
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
    const appShellUrl = policy.findNavigationShell(url);
    if (!appShellUrl) return;
    event.respondWith(
      (async () => {
        const cache = await caches.open(policy.cacheName);
        try {
          const response = await fetch(request);
          if (response.ok) {
            await cache.put(appShellUrl, response.clone());
          }
          return response;
        } catch {
          return (
            (await cache.match(appShellUrl)) ??
            new Response("Mattriz is unavailable offline.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" }
            })
          );
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(policy.cacheName);
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })()
  );
});
