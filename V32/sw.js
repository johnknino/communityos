// CommUnity OS Service Worker v3.0
// Network-first with cache fallback. No aggressive skipWaiting.
// Update activates on next full session, not mid-browse.

var CACHE_NAME = 'communityos-v32';

// National tier pages (always precache)
var NATIONAL = [
  '/','/neighborhood','/crisis','/journeys',
  '/benefits-screener','/benefits-check','/defend','/health-calc',
  '/drug-prices','/worker-rights','/school-rights','/court-nav',
  '/complaints','/lending','/environment','/disaster','/vitals',
  '/food-safety','/building-safety','/311',
  '/knowledge','/neighborhood','/how-it-works','/tos','/champion','/food-strategy','/health-strategy','/housing-strategy','/environment-strategy','/education-strategy','/workforce-strategy','/digital-strategy','/civic-strategy','/issues','/onboard','/issues','/404.html'
];

// Community tier pages (cache on visit, not precache)
// These may not work without backend — lazy cache only

var CRITICAL_ASSETS = [
  '/css/shared.css','/js/shared.js','/js/community-api.js',
  '/data/knowledge_guides.json','/data/config.json',
  '/icon-192.png','/icon-512.png','/favicon.png','/manifest.json'
];

var PRECACHE = NATIONAL.concat(CRITICAL_ASSETS);

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.allSettled(
        PRECACHE.map(function(url) {
          return cache.add(url).catch(function() {});
        })
      );
    })
  );
  // Do NOT call skipWaiting — let new SW activate on next session
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
  if (event.request.url.includes('workers.dev')) return;

  event.respondWith(
    fetch(event.request).then(function(response) {
      if (response.ok) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/404.html').then(function(fb) {
            return fb || new Response('<html><body style="font-family:system-ui;text-align:center;padding:60px"><h1>Offline</h1><p>Connect to the internet and try again.</p><p>The <a href="/disaster.html">Disaster Ready</a> page and all calculators work offline.</p></body></html>', {headers:{'Content-Type':'text/html'}});
          });
        }
      });
    })
  );
});
