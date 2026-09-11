'use strict';
var CACHE_VERSION = 'bozaid-v3';
var FILES = ['./', 'index.html', 'style.css', 'config.js', 'app.js', 'assets/logo.png', 'assets/background.png', 'assets/facebook-qr.svg', 'assets/tiktok-qr.svg'];
self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE_VERSION).then(function (cache) {
    return cache.addAll(FILES.map(function (file) { return new Request(file, { cache: 'reload' }); }));
  }));
});
self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key.indexOf('bozaid-') === 0 && key !== CACHE_VERSION; }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (event) {
  if (!event.data || event.data.type !== 'CHECK_BOZAID_CACHE' || !event.source) { return; }
  event.waitUntil(caches.open(CACHE_VERSION).then(function (cache) {
    return Promise.all(FILES.map(function (file) { return cache.match(file); }));
  }).then(function (responses) {
    event.source.postMessage({ type: responses.every(function (response) { return !!response; }) ? 'BOZAID_CACHE_READY' : 'BOZAID_CACHE_MISSING' });
  }));
});
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') { return; }
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) { return; }
  event.respondWith(caches.open(CACHE_VERSION).then(function (cache) {
    return cache.match(event.request).then(function (cached) {
      if (cached) { return cached; }
      return fetch(event.request).catch(function () {
        /* Only the real home route falls back; unknown routes must not look successful. */
        var home = new URL('./', self.location.href).pathname;
        if (event.request.mode === 'navigate' && (url.pathname === home || url.pathname === home + 'index.html')) { return cache.match('index.html'); }
        return Response.error();
      });
    });
  }));
});
