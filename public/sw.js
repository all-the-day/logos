// Service Worker for Logos — network-first with cache fallback
const CACHE = "logos-v1";

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Skip non-GET and API routes
  if (request.method !== "GET") return;
  if (request.url.includes("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const cloned = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, cloned));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
