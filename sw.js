// Offline support: cache the app shell, serve it when offline, refresh in background.
const CACHE = 'happy-parenthood-v4';
const SHELL = ['./', 'index.html', 'css/styles.css', 'js/app.js', 'js/db.js', 'js/util.js', 'js/catalog.js', 'js/stages.js', 'js/guide.js', 'js/charts.js', 'js/sync.js', 'js/photos.js', 'js/voice.js', 'js/devdata.js', 'js/growth.js', 'js/who-data.js', 'js/pronouns.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first (so updates arrive), fall back to cache when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
