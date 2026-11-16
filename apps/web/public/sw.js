// budgy's service worker: lets the tools open with no signal.
//
// - Pages: network first, so anyone online always gets the latest rules (new
//   tax rates each July). The last copy is kept for when there's no network.
// - /_next/static: cache first. Those files are hashed, so they never change.
// - Everything else on this site (icons, fonts, the manifest): the cached copy
//   straight away, refreshed in the background.
//
// Only same-origin GET requests are handled. Nothing you type is ever in a
// request, and pages are cached by path, without any query string.

const PAGES = "budgy-pages-v1";
const STATIC = "budgy-static-v1";
const ASSETS = "budgy-assets-v1";
const KEEP = [PAGES, STATIC, ASSETS];
// Old builds' chunks pile up in the static cache, so it keeps the newest few hundred.
const STATIC_LIMIT = 400;

const scope = new URL(self.registration.scope);
const base = scope.pathname.replace(/\/$/, "");

self.addEventListener("install", (event) => {
  // The home page, so there's always something to open offline.
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) => c.add(`${base}/`))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("budgy-") && !KEEP.includes(name)) await caches.delete(name);
      }
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(`${base}/`)) return;

  if (request.mode === "navigate") {
    event.respondWith(page(event, url));
  } else if (url.pathname.startsWith(`${base}/_next/static/`)) {
    event.respondWith(cacheFirst(request));
  } else if (url.searchParams.has("_rsc") || url.pathname.endsWith(".txt")) {
    // The data Next fetches when you move between tools: treat it like a page.
    event.respondWith(networkFirst(request, pathKey(url)));
  } else {
    event.respondWith(staleWhileRevalidate(event, request));
  }
});

/** Cache key for a page or its data: the path, with no query string. */
function pathKey(url) {
  return new URL(url.pathname, url.origin).href;
}

async function page(event, url) {
  const key = pathKey(url);
  try {
    const response = (await event.preloadResponse) || (await fetch(event.request));
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(PAGES).then((c) => c.put(key, copy)));
    }
    return response;
  } catch {
    const cached = await caches.match(key, { cacheName: PAGES, ignoreVary: true });
    return cached || offlinePage();
  }
}

async function networkFirst(request, key) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      caches.open(PAGES).then((c) => c.put(key, copy));
    }
    return response;
  } catch {
    const cached = await caches.match(key, { cacheName: PAGES, ignoreVary: true });
    if (cached) return cached;
    throw new Error("offline");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    trim(cache);
  }
  return response;
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  const fresh = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    event.waitUntil(fresh.catch(() => {}));
    return cached;
  }
  return fresh;
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - STATIC_LIMIT))) await cache.delete(key);
}

function offlinePage() {
  const html = `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Offline · budgy</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem}a{color:inherit}</style></head><body><h1>You're offline</h1><p>This page hasn't been saved on this device yet. Open it once with a connection and it will work offline after that.</p><p><a href="${base}/">Go to the home page</a></p></body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
    status: 503,
  });
}
