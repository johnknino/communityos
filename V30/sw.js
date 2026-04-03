// CommUnity OS Service Worker v2.0
// Caches ALL pages and critical resources for offline access
// Strategy: Network-first with cache fallback + offline page

var CACHE_NAME = 'communityos-v30b';
var ALL_PAGES = [
  '/','/survive','/vitals','/understand','/connect','/govern','/learn','/grow',
  '/discuss','/needs','/evaluate','/assess','/audit','/dashboard','/intelligence',
  '/propose','/knowledge','/story','/share','/support','/contribute','/404.html'
];
var CRITICAL_ASSETS = [
  '/css/shared.css','/js/shared.js','/data/plant_database.json',
  '/icon-192.png','/icon-512.png','/favicon.png','/manifest.json'
];
var PRECACHE = ALL_PAGES.concat(CRITICAL_ASSETS);

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.allSettled(
        PRECACHE.map(function(url) {
          return cache.add(url).catch(function(e) { console.warn('SW cache miss: ' + url); });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;
  if (event.request.url.includes('script.google.com')) return;

  event.respondWith(
    fetch(event.request).then(function(response) {
      if (response.ok) {
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, responseClone); });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/404.html').then(function(fb) {
            return fb || new Response('<html><body style="font-family:system-ui;text-align:center;padding:60px"><h1>Offline</h1><p>Connect to the internet and try again.</p><a href="/">Home</a></body></html>', {headers:{'Content-Type':'text/html'}});
          });
        }
      });
    })
  );
});
