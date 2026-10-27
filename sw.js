// Offline support: the app and its files are cached on first visit.
// Network first (so updates arrive at once), cache when there is no reception
// or when the network is too slow to answer within a few seconds.
const C = 'mdd-v2';
const CORE = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
const WAIT = 3000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const fromCache = r => caches.match(r, { ignoreSearch: true })
  .then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : undefined));

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || !/^https?:/.test(r.url) || r.headers.has('range')) return;
  const net = fetch(r).then(res => {
    // Only full, readable responses are kept (opaque ones take several MB of the phone's quota each)
    if (res.ok && res.type !== 'opaque') { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); }
    return res;
  });
  e.respondWith(new Promise(done => {
    let settled = false;
    const finish = v => { if (!settled && v) { settled = true; done(v); } };
    // Weak reception: after WAIT ms answer from the cache if there is a copy
    const t = setTimeout(() => fromCache(r).then(finish), WAIT);
    net.then(res => { clearTimeout(t); finish(res); })
      .catch(() => { clearTimeout(t); fromCache(r).then(m => { if (m) finish(m); else { settled = true; done(Response.error()); } }); });
  }));
});
