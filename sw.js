/* Increase VERSION whenever application files or book data change. */
const VERSION = '2026-11-21-hgt-v1-final2';
const CACHE_PREFIX = 'hanh-gung-toi-';
const SHELL_CACHE = `${CACHE_PREFIX}shell-${VERSION}`;
const SOURCE_CACHE = `${CACHE_PREFIX}source-${VERSION}`;
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/lib/search.mjs',
  '/lib/storage.mjs',
  '/data/book.json',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/assets/cover.webp',
];
const SHELL_PATHS = new Set(APP_SHELL);
const SOURCE_LIMIT = 200;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const existed = await caches.has(SHELL_CACHE);
    const cache = await caches.open(SHELL_CACHE);
    try {
      // addAll commits the complete set; a failed asset keeps the previous worker active.
      await cache.addAll(APP_SHELL.map((path) => new Request(path, {
        cache: 'reload',
        credentials: 'same-origin',
      })));
    } catch (error) {
      if (!existed) await caches.delete(SHELL_CACHE);
      throw error;
    }
    // Updates wait until the user accepts, or all pages using the old worker close.
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== SHELL_CACHE && name !== SOURCE_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) client.postMessage({ type: 'CACHE_READY', version: VERSION });
  })());
});

async function shellResponse(request, url) {
  const cache = await caches.open(SHELL_CACHE);
  const key = url.pathname === '/' ? '/index.html' : url.pathname;
  const cached = await cache.match(key);
  if (cached) return cached;
  // Normally every shell file is already present. This repairs an evicted cache entry.
  const response = await fetch(request);
  if (response.ok && response.status === 200 && response.type === 'basic') {
    try { await cache.put(key, response.clone()); } catch { /* Storage limits must not block reading. */ }
  }
  return response;
}

async function limitSourceCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= SOURCE_LIMIT) return;
  await Promise.all(keys.slice(0, keys.length - SOURCE_LIMIT).map((key) => cache.delete(key)));
}

async function respondToRange(request, cached) {
  const range = request.headers.get('range');
  if (!range) return cached;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match) return cached;
  const bytes = await cached.arrayBuffer();
  const total = bytes.byteLength;
  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : total - 1;
  if (!match[1] && match[2]) {
    start = Math.max(0, total - Number(match[2]));
    end = total - 1;
  }
  end = Math.min(end, total - 1);
  if (start >= total || start > end || start < 0) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  }
  const headers = new Headers(cached.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
  headers.set('Content-Length', String(end - start + 1));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}

async function sourceResponse(request, url) {
  const cache = await caches.open(SOURCE_CACHE);
  const key = url.pathname;
  const cached = await cache.match(key);
  if (cached) return respondToRange(request, cached);
  const response = await fetch(request);
  // Never put a partial PDF response in the cache as if it were the whole document.
  if (response.ok && response.status === 200 && response.type === 'basic') {
    try {
      await cache.put(key, response.clone());
      await limitSourceCache(cache);
    } catch { /* A quota error leaves the fetched page readable. */ }
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (SHELL_PATHS.has(url.pathname)) {
    event.respondWith(shellResponse(request, url));
    return;
  }
  if (url.pathname.startsWith('/source/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(sourceResponse(request, url));
    return;
  }
  // Book links use hash routes. Other files keep their original status and MIME type.
});

async function cacheStatus() {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await Promise.all(APP_SHELL.map((path) => cache.match(path)));
  const source = await caches.open(SOURCE_CACHE);
  const keys = await source.keys();
  return {
    type: 'CACHE_STATUS',
    version: VERSION,
    offlineReady: cached.every(Boolean),
    cachedSourcePages: keys.filter((key) => /\/source\/pages\/page-\d+\.webp$/.test(new URL(key.url).pathname)).length,
    sourcePdfCached: Boolean(await source.match('/source/book.pdf')),
  };
}

self.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') return;
  if (event.data.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (event.data.type === 'GET_CACHE_STATUS') {
    event.waitUntil((async () => {
      let status;
      try { status = await cacheStatus(); }
      catch { status = { type: 'CACHE_STATUS', version: VERSION, offlineReady: false, error: 'storage-unavailable' }; }
      status.requestId = event.data.requestId ?? null;
      const recipient = event.ports?.[0] || event.source;
      recipient?.postMessage(status);
    })());
  }
});
