// Offline support: cache the app shell, serve it when offline, refresh in background.
const CACHE = 'happy-parenthood-v19';
const SHELL = ['./', 'index.html', 'css/styles.css', 'js/app.js', 'js/db.js', 'js/util.js', 'js/catalog.js', 'js/stages.js', 'js/guide.js', 'js/charts.js', 'js/sync.js', 'js/photos.js', 'js/voice.js', 'js/devdata.js', 'js/growth.js', 'js/who-data.js', 'js/pronouns.js', 'js/drive.js', 'js/config.js', 'js/assistant.js', 'js/assistant-kb.js', 'js/learning.js', 'js/i18n.js',
  'manifest.webmanifest', 'icons/favicon-64.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'hp-bell').map(k => caches.delete(k)))).then(() => self.clients.claim()));
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

// Tapping a reminder opens the app (or brings it to the front) on the right screen.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  let go = e.notification.data?.go || '';
  if (go.startsWith('stop:') && e.action !== 'stop') go = ''; // tapping the running-timer note just opens the app
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const c = list[0];
    if (c) { c.postMessage({ go }); return c.focus(); }
    return self.clients.openWindow(go ? `./?go=${go}` : './');
  }));
});

// The family's bell (bell/worker.js) wakes the phone at reminder time; ask it what is due and show it.
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let items = [];
    try {
      const res = await (await caches.open('hp-bell')).match('bell-config');
      const cfg = res && await res.json();
      if (cfg?.url) items = await (await fetch(`${cfg.url}/due?id=${encodeURIComponent(cfg.id)}`, { cache: 'no-store' })).json();
    } catch (err) { /* offline */ }
    if (!Array.isArray(items) || !items.length) items = [{ title: 'Happy Parenthood', body: 'You have a reminder. Tap to open.', tag: 'hp-reminder' }];
    for (const it of items) {
      await self.registration.showNotification(it.title, { body: it.body, icon: 'icons/icon-192.png', tag: it.tag || undefined, renotify: !!it.tag,
        data: { go: it.go || '' }, vibrate: [300, 150, 300, 150, 300], requireInteraction: it.go === 'learn' });
    }
  })());
});
