'use strict';
/* GitHub Actions injects the content fingerprint and verified asset list.
   Do not change version numbers manually. Publish with bozaid-pages.yml. */
var RELEASE = /* BOZAID_RELEASE */ null;
var PREFIX = 'bozaid-auto-' + encodeURIComponent(self.registration.scope) + '-';
var CACHE_NAME = PREFIX + (RELEASE ? RELEASE.id : 'not-built');
var BASE = new URL('./', self.location.href);
function hex(buffer) {
  return Array.prototype.map.call(new Uint8Array(buffer), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
}
function download(file) {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, 60000);
  var url = new URL(file.path, BASE);
  url.searchParams.set('bozaid-release', RELEASE.id);
  return fetch(url.href, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal }).then(function (response) {
    if (!response.ok || response.redirected) { throw new Error('Asset unavailable: ' + file.path); }
    return response.arrayBuffer().then(function (bytes) {
      return crypto.subtle.digest('SHA-256', bytes).then(function (digest) {
        if (hex(digest) !== file.sha256) { throw new Error('Deployment not complete: ' + file.path); }
        var headers = new Headers(response.headers);
        headers.delete('content-encoding'); headers.delete('content-length');
        return { path: file.path, response: new Response(bytes, { status: 200, headers: headers }) };
      });
    });
  }).then(function (result) { clearTimeout(timer); return result; }, function (error) { clearTimeout(timer); throw error; });
}
self.addEventListener('install', function (event) {
  event.waitUntil((async function () {
    if (!RELEASE) { throw new Error('Enable GitHub Actions publishing; this source must be built first.'); }
    /* Download and verify every file before making a new offline version available. */
    var files = await Promise.all(RELEASE.files.map(download));
    try {
      var cache = await caches.open(CACHE_NAME);
      await Promise.all(files.map(function (file) { return cache.put(new URL(file.path, BASE).href, file.response); }));
      await self.skipWaiting();
    } catch (error) { await caches.delete(CACHE_NAME); throw error; }
  }()));
});
self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    await self.clients.claim();
    /* Tell open pages to reload after the new complete release takes control. */
    var clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(clients.map(function (client) {
      var url = new URL(client.url);
      if (url.origin === BASE.origin && (url.pathname === BASE.pathname || url.pathname === BASE.pathname + 'index.html')) {
        client.postMessage({ type: 'BOZAID_UPDATE_READY' });
      }
    }));
    /* Only this site's caches are managed; retain one previous release too. */
    var keys = (await caches.keys()).filter(function (key) { return key.indexOf(PREFIX) === 0 && key !== CACHE_NAME; });
    await Promise.all(keys.slice(0, -1).map(function (key) { return caches.delete(key); }));
  }()));
});
self.addEventListener('message', function (event) {
  if (!event.source || !event.data || event.data.type !== 'CHECK_BOZAID_CACHE' || !RELEASE) { return; }
  event.waitUntil((async function () {
    var cache = await caches.open(CACHE_NAME);
    var files = await Promise.all(RELEASE.files.map(function (file) { return cache.match(new URL(file.path, BASE).href); }));
    event.source.postMessage({ type: files.every(Boolean) ? 'BOZAID_CACHE_READY' : 'BOZAID_CACHE_MISSING', release: RELEASE.id.slice(0, 8) });
  }()));
});
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET' || !RELEASE) { return; }
  var url = new URL(event.request.url);
  if (url.origin !== BASE.origin || url.pathname.indexOf(BASE.pathname) !== 0) { return; }
  var relative = url.pathname.slice(BASE.pathname.length);
  if (relative === '') { relative = 'index.html'; }
  var known = RELEASE.files.some(function (file) { return file.path === relative; });
  /* Never cache external destinations, the worker itself or unknown routes. */
  if (!known) { return; }
  event.respondWith((async function () {
    var cache = await caches.open(CACHE_NAME);
    var cached = await cache.match(new URL(relative, BASE).href);
    return cached || fetch(event.request);
  }()));
});
