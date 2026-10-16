// Cartridge Studio's service worker: after the first visit the whole app —
// editor, 7800basic/dasm toolchain, js7800 emulator core, audio worklet and
// fonts — comes from one versioned cache, so making, building and playing
// games works with no network.
//
// The build (pwa/vite-plugin.ts) replaces the two placeholders below with the
// list of every file in dist/ and a hash of their contents. A new build means
// a new cache: it installs alongside the old one and waits until the page
// asks it to take over ("A new version is ready"), so a running editor never
// mixes files from two builds.

const VERSION = "__CS_VERSION__";
const PRECACHE = /* __CS_PRECACHE__ */ [];
const CACHE = `cartridge-studio-${VERSION}`;
const INDEX = new URL("./", self.location.href).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Bypass the HTTP cache so a new version never precaches stale files.
      await cache.addAll(PRECACHE.map((path) => new Request(new URL(path, self.location.href), { cache: "reload" })));
      // The first install has nothing to replace: take over straight away so
      // the first visit is already enough to work offline.
      if (!self.registration.active) await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("cartridge-studio-") && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "skip-waiting") void self.skipWaiting();
  else if (event.data?.type === "version") event.ports[0]?.postMessage({ version: VERSION });
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Every page of the app is the same single-page shell.
  const key = req.mode === "navigate" ? INDEX : url.origin + url.pathname;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(key);
      return hit ?? fetch(req);
    })(),
  );
});
