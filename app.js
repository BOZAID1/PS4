(function () {
  'use strict';
  var status = document.getElementById('cache-status');
  var light = document.getElementById('status-light');
  var notice = document.getElementById('link-notice');
  var links = window.BOZAID_LINKS || [];
  var buttons = [], selected = 0, configured = 0, saved = false;
  function message(text, state) { status.textContent = text; light.className = 'status-light ' + (state || ''); }
  function ready() { saved = true; message(navigator.onLine === false ? 'بدون إنترنت · النسخة محفوظة' : 'تم الحفظ', 'ready'); }
  function fail() { if (saved) { message('النسخة محفوظة · تعذّر التحقق من التحديث', 'ready'); } else { message('لم يكتمل الحفظ · أعد الفتح مع الإنترنت', 'error'); } }
  function safeURL(url) {
    if (!url || typeof url !== 'string') { return ''; }
    /* Absolute HTTP(S) URLs only: disallow script/data URLs. */
    if (!/^https?:\/\/[^\s]+$/i.test(url)) { return ''; }
    var parsed = document.createElement('a'); parsed.href = url;
    return parsed.hostname ? parsed.href : '';
  }
  function go(button, event) {
    if (button.getAttribute('aria-disabled') === 'true') {
      if (event) { event.preventDefault(); }
      notice.textContent = 'هذا الرابط غير مفعّل بعد.';
      return false;
    }
    if (navigator.onLine === false) {
      if (event) { event.preventDefault(); }
      notice.textContent = 'الصفحة محفوظة، لكن فتح هذه الوجهة الخارجية يحتاج إلى إنترنت.';
      return false;
    }
    return true;
  }
  for (var i = 0; i < 3; i++) {
    (function (index) {
      var button = document.getElementById('destination-' + index);
      buttons.push(button);
      var item = links[index] || {}, url = safeURL(item.url);
      if (typeof item.title === 'string' && item.title.replace(/\s/g, '')) { button.querySelector('.card-title').textContent = item.title; }
      if (url) { button.href = url; button.removeAttribute('aria-disabled'); configured++; }
      button.addEventListener('click', function (e) { go(button, e); });
      button.addEventListener('focus', function () { selected = index; });
    }(i));
  }
  if (configured === 3) { notice.textContent = ''; }
  function focusStep(step) { selected = (selected + step + 3) % 3; buttons[selected].focus(); }
  document.addEventListener('keydown', function (e) {
    var key = e.keyCode;
    if (key === 37 || key === 40) { e.preventDefault(); focusStep(1); }
    if (key === 39 || key === 38) { e.preventDefault(); focusStep(-1); }
    if (key === 13 && (!document.activeElement || document.activeElement === document.body || document.activeElement === document.documentElement)) { e.preventDefault(); buttons[selected].click(); }
  });
  /* Optional Gamepad API support; normal links remain usable if PS4 reserves inputs. */
  if (navigator.getGamepads) {
    var last = 0, confirmHeld = false;
    setInterval(function () {
      if (document.hidden) { return; }
      var pads;
      try { pads = navigator.getGamepads(); } catch (e) { return; }
      var pad = null;
      for (var p = 0; p < pads.length; p++) { if (pads[p] && pads[p].connected) { pad = pads[p]; break; } }
      if (!pad || pad.mapping !== 'standard') { return; }
      function pressed(n) { return pad.buttons[n] && pad.buttons[n].pressed; }
      var now = new Date().getTime(), x = pad.axes[0] || 0, y = pad.axes[1] || 0;
      if (now - last > 220) {
        if (pressed(14) || pressed(13) || x < -0.6 || y > 0.6) { focusStep(1); last = now; }
        else if (pressed(15) || pressed(12) || x > 0.6 || y < -0.6) { focusStep(-1); last = now; }
      }
      var confirm = !!pressed(0);
      if (confirm && !confirmHeld) { buttons[selected].click(); }
      confirmHeld = confirm;
    }, 80);
  }
  document.addEventListener('visibilitychange', function () { document.body.className = document.hidden ? 'motion-paused' : ''; });
  window.addEventListener('online', function () { if (saved) { ready(); } });
  window.addEventListener('offline', function () { if (saved) { ready(); } else { fail(); } });
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    message('جارٍ حفظ الصفحة للاستخدام دون إنترنت…');
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'BOZAID_CACHE_READY') { ready(); }
      if (e.data && e.data.type === 'BOZAID_CACHE_MISSING') { fail(); }
    });
    navigator.serviceWorker.register('sw.js').then(function (registration) {
      if (registration.installing) {
        registration.installing.addEventListener('statechange', function (event) {
          if (event.target.state === 'redundant' && !registration.active) { fail(); }
        });
      }
      return navigator.serviceWorker.ready;
    }).then(function (registration) {
      if (registration.active) { registration.active.postMessage({ type: 'CHECK_BOZAID_CACHE' }); }
    }).catch(fail);
    setTimeout(function () { if (!saved) { message('لم يتم تأكيد الحفظ · أبقِ الإنترنت متصلًا وأعد الفتح', 'error'); } }, 45000);
  } else if (window.applicationCache && location.protocol !== 'file:') {
    var cache = window.applicationCache;
    message('جارٍ حفظ الصفحة للاستخدام دون إنترنت…');
    cache.addEventListener('checking', function () { if (!saved) { message('جارٍ التحقق من النسخة المحفوظة…'); } });
    cache.addEventListener('downloading', function () { message('جارٍ حفظ الصفحة… أبقِ الإنترنت متصلًا'); });
    cache.addEventListener('progress', function (e) { if (e.total) { message('جارٍ الحفظ… ' + Math.round(e.loaded / e.total * 100) + '٪'); } });
    cache.addEventListener('cached', ready);
    cache.addEventListener('noupdate', function () { if (cache.status === 1) { ready(); } });
    cache.addEventListener('updateready', function () { saved = true; message('التحديث محفوظ · أغلق الصفحة وافتحها لتطبيقه', 'ready'); });
    cache.addEventListener('error', fail);
    cache.addEventListener('obsolete', function () { saved = false; fail(); });
    if (cache.status === 1 || cache.status === 4) { ready(); }
  } else {
    message(location.protocol === 'file:' ? 'معاينة محلية · الحفظ يعمل بعد النشر' : 'هذا المتصفح لا يتيح حفظ الصفحة دون إنترنت', 'error');
  }
}());
