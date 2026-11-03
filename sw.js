/* Algebra gyakorló — service worker: offline működés + gyors indulás.
 * Új verziónál elég a VERSION-t átírni (az index.html ?v= értékével együtt). */
const VERSION = '20261103g';
const CACHE = 'algebra-' + VERSION;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/style.css?v=' + VERSION,
  'js/parser.js?v=' + VERSION, 'js/poly.js?v=' + VERSION, 'js/generators.js?v=' + VERSION,
  'js/checker.js?v=' + VERSION, 'js/ai.js?v=' + VERSION, 'js/app.js?v=' + VERSION,
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('algebra-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // az AI-hívásokat soha nem tároljuk
  if (url.hostname.endsWith('googleapis.com') && !url.hostname.startsWith('fonts.')) return;

  // az oldal maga: előbb a hálózat (hogy a frissítés megérkezzen), offline a tárolt példány
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put('index.html', c)); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  // betűtípusok: tárolt példány, közben frissítés
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  // a saját fájlok: tárolt példány, ha nincs, hálózat
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok && !url.pathname.endsWith('.apk')) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
      return r;
    })));
  }
});
