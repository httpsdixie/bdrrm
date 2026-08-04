// ========================================================
// SECTION 13.2: PWA SERVICE WORKER (OFFLINE-FIRST & SYNC)
// ========================================================

const CACHE_NAME = 'drrm-v1.0.1-cache';
const STATIC_ASSETS = [
  '/',
  '/dashboard.html',
  '/incidents.html',
  '/evacuation.html',
  '/resources.html',
  '/reports.html',
  '/directory.html',
  '/public.html',
  '/assets/css/style.css',
  '/assets/js/api.js',
  '/assets/js/auth.js',
  '/assets/js/dashboard.js',
  '/assets/js/i18n.js',
  '/assets/js/manual-fallback.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[PWA SW] Pre-caching static assets shell');
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[PWA SW] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy for APIs, JS, and CSS so updates reflect instantly
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('/auth/') ||
    event.request.url.includes('.css') ||
    event.request.url.includes('.js')
  ) {
    event.respondWith(
      fetch(event.request).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const cloneRes = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request.url, cloneRes));
        }
        return networkRes;
      }).catch(() => {
        return caches.match(event.request);
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((fetchRes) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request.url, fetchRes.clone());
            return fetchRes;
          });
        });
      })
    );
  }
});

// Background Auto-Sync Event
self.addEventListener('sync', (event) => {
  if (event.tag === 'drrm-auto-sync') {
    console.log('[PWA SW] Background auto-sync triggered for offline queue');
  }
});
