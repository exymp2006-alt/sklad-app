// Service Worker для СКЛАД — обеспечивает офлайн-работу приложения.
// При обновлении приложения меняйте CACHE_VERSION, чтобы пользователи
// получили новую версию вместо закешированной старой.
var CACHE_VERSION = 'sklad-v2';
var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.5/JsBarcode.all.min.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      return Promise.all(
        APP_SHELL.map(function(url) {
          return cache.add(url).catch(function() {
            // Не валим всю установку, если один ресурс (например, внешний CDN) не загрузился
          });
        })
      );
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_VERSION; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  // Навигация по страницам приложения: сначала пытаемся обновить из сети,
  // при неудаче — отдаём закешированную версию (офлайн-режим).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function(res) {
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function(cache) { cache.put('./index.html', copy); });
        return res;
      }).catch(function() {
        return caches.match('./index.html');
      })
    );
    return;
  }

  // Остальные ресурсы (CDN-скрипты, иконки): кеш сначала, сеть — запасной вариант.
  event.respondWith(
    caches.match(req).then(function(cached) {
      if (cached) return cached;
      return fetch(req).then(function(res) {
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function(cache) { cache.put(req, copy); });
        return res;
      }).catch(function() {
        // Нет сети и нет в кеше — отдаём пустой ответ, чтобы не падать с ошибкой
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
