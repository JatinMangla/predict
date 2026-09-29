// Offline service worker for Kundli Predict.
// Strategy: cache-first for hashed static assets (immutable), network-first
// with cache fallback for pages, so the app keeps working without internet.

// Bump on releases that change caching so old build assets are evicted.
const CACHE = "kundli-predict-v2";
/** On a slow or flaky connection, fall back to the cached page after this long */
const NETWORK_TIMEOUT_MS = 4000;
const OFFLINE_URLS = ["/", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache auth or AI endpoints
  if (url.pathname.startsWith("/api/")) return;

  // Hashed Next.js build assets: cache-first (they never change)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return res;
          })
      )
    );
    return;
  }

  // Pages and other assets: network-first. If the network is slow and a
  // cached copy exists, serve that after NETWORK_TIMEOUT_MS; with nothing
  // cached, keep waiting for the network rather than failing.
  event.respondWith(
    (async () => {
      const network = fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      });
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS)
      );
      try {
        return await Promise.race([network, timeout]);
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          return await network;
        } catch {
          // Last resort for navigations: the cached shell
          if (request.mode === "navigate") {
            const shell = await caches.match("/");
            if (shell) return shell;
          }
          return Response.error();
        }
      }
    })()
  );
});
