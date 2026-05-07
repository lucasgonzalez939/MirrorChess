/**
 * sw.js — Service Worker de Ajedrez Espejo
 *
 * Responsabilidades:
 *   1. Pre-cachear todos los assets del juego durante la instalación para
 *      permitir uso offline completo.
 *   2. Servir los assets desde caché cuando la red no está disponible.
 *   3. Eliminar cachés de versiones anteriores al activarse.
 *
 * Estrategias de caché por tipo de recurso:
 *   - HTML / CSS / JS (app shell): **Network-first**.
 *     Intenta obtener la versión más reciente de la red; si falla (offline),
 *     sirve desde caché. Esto garantiza que los usuarios siempre reciban
 *     actualizaciones de código cuando tienen conexión.
 *   - Otros assets (iconos, imágenes, etc.): **Cache-first**.
 *     Sirve desde caché si está disponible; si no, va a la red.
 *     Apropiado para recursos estáticos que rara vez cambian.
 *
 * Versionado: incrementar CACHE_NAME al desplegar cambios importantes para
 * forzar que los clientes existentes descarguen los nuevos assets.
 */

/** Nombre del caché activo. Cambiar al publicar una nueva versión. */
const CACHE_NAME = 'mirror-chess-v3';

/** Lista de assets pre-cacheados durante la instalación del SW. */
const CORE_ASSETS = ['./', './index.html', './style.css', './game.js', './manifest.json', './icon.svg'];

/**
 * Evento install: pre-cachea todos los CORE_ASSETS.
 *
 * Usa Promise.allSettled (en lugar de Promise.all) para que un fallo al
 * descargar un asset individual no aborte toda la instalación. El SW se
 * activa igualmente y usará la red como fallback para los assets fallidos.
 *
 * self.skipWaiting() hace que el nuevo SW tome el control inmediatamente
 * sin esperar a que las pestañas actuales se cierren.
 */
self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.allSettled(
            CORE_ASSETS.map((asset) => cache.add(new Request(asset, { cache: 'reload' })))
        );
        await self.skipWaiting();
    })());
});

/**
 * Evento activate: limpia cachés de versiones anteriores.
 *
 * Elimina cualquier caché cuyo nombre no coincida con CACHE_NAME.
 * self.clients.claim() hace que el SW activo tome el control de todas las
 * pestañas abiertas sin necesidad de recargar la página.
 */
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

/**
 * Evento fetch: intercepta todas las peticiones GET y aplica la estrategia
 * de caché apropiada según el tipo de recurso.
 *
 * Las peticiones que no son GET (POST, etc.) se ignoran y pasan directamente
 * al navegador sin que el SW intervenga.
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;

    /*
     * Detecta si la petición es parte del app shell (navegación + CSS + JS).
     * Estas peticiones usan estrategia Network-first para mantener el código
     * siempre actualizado cuando hay conexión.
     */
    const isAppShellRequest =
        request.mode === 'navigate' ||
        request.destination === 'style' ||
        request.destination === 'script';

    if (isAppShellRequest) {
        event.respondWith((async () => {
            try {
                // Intento de red: si tiene éxito, actualiza el caché y devuelve la respuesta.
                const networkResponse = await fetch(request);
                const cache = await caches.open(CACHE_NAME);
                cache.put(request, networkResponse.clone());
                return networkResponse;
            } catch (error) {
                // Sin red: sirve desde caché.
                const cached = await caches.match(request);
                if (cached) return cached;
                // Si no hay caché y es navegación, devuelve index.html como fallback.
                if (request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                throw error;
            }
        })());
        return;
    }

    /*
     * Para el resto de assets (iconos, imágenes, etc.): Cache-first.
     * Si el asset no está en caché, va a la red (y lo almacena implícitamente
     * si fue pre-cacheado durante la instalación).
     */
    event.respondWith((async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return fetch(request);
    })());
});
