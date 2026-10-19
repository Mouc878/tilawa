/* Tilāwa — service worker : app shell en cache-first (ouverture hors ligne),
   reste en réseau-d'abord avec repli sur le cache. */
const VERSION = "tilawa-v1";
const CACHE_COEUR = VERSION + "-coeur";
const CACHE_FLUX = VERSION + "-flux";

/* App shell : tout ce qu'il faut pour ouvrir l'application sans réseau. */
const APP_SHELL = [
  "./",
  "index.html",
  "assets/data.js",
  "assets/trans2.js",
  "manifest.webmanifest",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-maskable-192.png",
  "assets/icon-maskable-512.png",
  "assets/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_COEUR)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(
        cles.filter((c) => c.indexOf(VERSION) !== 0)
            .map((c) => caches.delete(c))
      ))
      .then(() => self.clients.claim())
  );
});

function estAppShell(url) {
  const chemin = url.pathname.replace(/\/+$/, "");
  return APP_SHELL.some((f) => {
    const cible = new URL(f, self.registration.scope).pathname.replace(/\/+$/, "");
    return chemin === cible;
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* App shell (même origine) : cache d'abord, pour une ouverture instantanée hors ligne. */
  if (url.origin === self.location.origin && (req.mode === "navigate" || estAppShell(url))) {
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then((enCache) => {
        if (enCache) return enCache;
        return fetch(req).then((rep) => {
          const copie = rep.clone();
          caches.open(CACHE_COEUR).then((cache) => cache.put(req, copie));
          return rep;
        }).catch(() => caches.match("index.html"));
      })
    );
    return;
  }

  /* Tout le reste : réseau d'abord, repli sur le cache si le réseau échoue. */
  e.respondWith(
    fetch(req).then((rep) => {
      if (rep && (rep.status === 200 || rep.type === "opaque")) {
        const copie = rep.clone();
        caches.open(CACHE_FLUX).then((cache) => cache.put(req, copie));
      }
      return rep;
    }).catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
