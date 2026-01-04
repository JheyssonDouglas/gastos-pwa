const CACHE_NAME = "gastos-pwa-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/db.js",
  "./js/ui.js",
  "./js/utils.js",
  "./js/charts.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Network-first para libs CDN (dexie/chart) e fallback cache
  if (req.url.startsWith("https://")) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first para assets locais
  event.respondWith(
    caches.match(req).then(res => res || fetch(req))
  );
});
