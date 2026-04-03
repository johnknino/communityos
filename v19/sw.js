// CommUnity OS Service Worker v1.0
// Caches critical pages and hotline info for offline access
// Strategy: Network-first with cache fallback

var CACHE_NAME = 'communityos-v25';
var CRITICAL_URLS = [
  '/',
  '/css/shared.css',
  '/js/shared.js',
  '/survive.html',
  '/support.html',
  '/share.html',
  '/story.html',
  '/404.html',
  '/icon-192.png',
  '/favicon.png'
];

// Install — precache critical resources
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CRITICAL_URLS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME; })
             .map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — network first, cache fallback
self.addEventListener('fetch', function(event) {
  // Only handle GET requests for our own origin
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Cache successful responses for HTML and CSS
        if (response.ok) {
          var url = event.request.url;
          if (url.endsWith('.html') || url.endsWith('.css') || url.endsWith('.js') || url.endsWith('/')) {
            var responseClone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseClone);
            });
          }
        }
        return response;
      })
      .catch(function() {
        // Offline — serve from cache
        return caches.match(event.request).then(function(cached) {
          if (cached) return cached;
          // If requesting an HTML page not in cache, show 404
          if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/404.html');
          }
        });
      })
  );
});
