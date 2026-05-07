const CACHE_NAME = 'mirror-chess-v2';
const CORE_ASSETS = ['./', './index.html', './style.css', './game.js', './manifest.json'];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.allSettled(
            CORE_ASSETS.map((asset) => cache.add(new Request(asset, { cache: 'reload' })))
        );
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter((key) => key !== CACHE_NAME)
                .map((key) => caches.delete(key))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;

    // Keep HTML/CSS/JS fresh while still allowing offline fallback.
    const isAppShellRequest =
        request.mode === 'navigate' ||
        request.destination === 'style' ||
        request.destination === 'script';

    if (isAppShellRequest) {
        event.respondWith((async () => {
            try {
                const networkResponse = await fetch(request);
                const cache = await caches.open(CACHE_NAME);
                cache.put(request, networkResponse.clone());
                return networkResponse;
            } catch (error) {
                const cached = await caches.match(request);
                if (cached) return cached;
                if (request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                throw error;
            }
        })());
        return;
    }

    // For other assets, prefer cache for speed.
    event.respondWith((async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return fetch(request);
    })());
});
