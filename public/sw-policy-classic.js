// Classic-worker adapter kept dependency-free for Safari/WebKit compatibility.
/* global self, URL */
(() => {
  const CACHE_PREFIX = "mattriz-";
  const STATIC_ASSET_PATHS = [
    "favicon.svg",
    "icon-192.png",
    "icon-512.png",
    "apple-touch-icon.png"
  ];

  function createServiceWorkerPolicy(scope, workerUrl) {
    const appShellUrl = new URL("./", scope);
    const appShellUrls = [
      appShellUrl,
      ...self.MATTRIZ_LOCALE_APP_SHELL_PATHS.map(
        (path) => new URL(path, scope)
      )
    ];
    const releaseVersion =
      new URL(workerUrl).searchParams.get("v") ?? "development";

    return {
      appShellUrl,
      appShellUrls,
      cacheName: `${CACHE_PREFIX}${releaseVersion}`,
      isOwnedCache(name) {
        return name.startsWith(CACHE_PREFIX);
      },
      findNavigationShell(requestUrl) {
        const url = new URL(requestUrl);
        return (
          appShellUrls.find(
            (shellUrl) =>
              url.pathname === shellUrl.pathname ||
              url.pathname === `${shellUrl.pathname}index.html`
          ) ?? null
        );
      }
    };
  }

  function collectStaticAssetUrls(htmlDocuments, appShellUrls, appShellUrl) {
    const documentAssets = htmlDocuments.flatMap((html, index) =>
      Array.from(
        html.matchAll(/(?:href|src)="([^"]+)"/g),
        ([, path]) => new URL(path, appShellUrls[index])
      )
    );
    const sameOriginAssets = documentAssets.filter(
      (url) => url.origin === appShellUrl.origin
    );
    return [
      ...new Set(
        [
          ...STATIC_ASSET_PATHS.map((path) => new URL(path, appShellUrl)),
          ...sameOriginAssets
        ].map(String)
      )
    ];
  }

  self.MattrizServiceWorker = {
    collectStaticAssetUrls,
    createServiceWorkerPolicy
  };
})();
