const CACHE_NAME = 'locatrust-pwa-v3';
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/locatrust-official-logo.png'
];

// Install: cache only static image assets, NEVER index.html
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[LocaTrust SW] Warning static precache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up ALL older caches immediately to avoid stale bundle lock
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[LocaTrust SW] Purging old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Message handler to skip waiting on new version deploy
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: Always Network-First for HTML and JS/CSS assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests or external API calls (e.g. Supabase, analytics, auth)
  if (req.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // 1. Navigation requests (HTML pages) : Network-only with offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-cache' }).catch(() => {
        return caches.match('/index.html') || new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>LocaTrust - Hors ligne</title></head><body style="font-family:sans-serif;text-align:center;padding:40px;"><h2>Vous êtes actuellement hors connexion</h2><p>Vérifiez votre connexion Internet et réessayez.</p><button onclick="window.location.reload()" style="padding:10px 20px;background:#1e40af;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Réessayer</button></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })
    );
    return;
  }

  // 2. JS & CSS assets (/assets/*) : Network first, do NOT serve stale or HTML fallbacks
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // 3. Static icons & images : Stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, responseToCache));
        }
        return networkResponse;
      }).catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});
