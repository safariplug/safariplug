const VERSION = "safariplug-pwa-v2";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_CACHE = `${VERSION}-offline`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/brand/safariplug-wordmark-light.png",
  "/brand/safariplug-wordmark.png",
];

const BLOCKED_PREFIXES = [
  "/admin",
  "/auth",
  "/api",
  "/account",
  "/driver",
  "/business",
  "/hotels",
  "/become-a-driver",
  "/become-a-service-provider",
  "/concierge",
];

const OFFLINE_SAFE_PREFIXES = ["/events", "/experiences", "/city", "/journal"];

function isBlockedPath(pathname) {
  return BLOCKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isOfflineSafeNavigation(pathname) {
  if (pathname === "/") return true;
  return OFFLINE_SAFE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("safariplug-pwa-") &&
                key !== STATIC_CACHE &&
                key !== OFFLINE_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isBlockedPath(url.pathname)) return;

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/brand/");

  if (isStaticAsset) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }),
    );
    return;
  }

  const isNavigation = request.mode === "navigate";
  if (!isNavigation || !isOfflineSafeNavigation(url.pathname)) return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      return cache.match(OFFLINE_URL);
    }),
  );
});
