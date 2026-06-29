/* FemFit Diary — service worker (PWA shell + offline fallback).
   Работает на GitHub Pages под подпутём /MitoFit/ за счёт относительных путей.
   TODO: расширить офлайн-кеширование (изображения /assets/img, шрифты) и стратегию обновления при росте приложения.
   TODO: добавить версионирование кеша при каждом релизе (менять CACHE).
*/
const CACHE = 'femfit-v1';
const ASSETS = [
  './',
  './index.html',
  './app.html',
  './guide.html',
  './legal.html',
  './offline.html',
  './manifest.json',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return; // не вмешиваемся в сторонние запросы (напр. Google Fonts)

  // Навигация: сначала сеть, при офлайне — кеш или offline.html
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || caches.match('./offline.html')))
    );
    return;
  }

  // Прочие свои GET-запросы: cache-first с дозаписью в кеш
  e.respondWith(
    caches.match(req).then((r) => r || fetch(req).then((resp) => {
      const copy = resp.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return resp;
    }).catch(() => caches.match('./offline.html')))
  );
});
