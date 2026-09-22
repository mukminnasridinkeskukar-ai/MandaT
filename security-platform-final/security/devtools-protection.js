/**
 * ============================================================
 * DEVTOOLS PROTECTION - devtools-protection.js
 * ============================================================
 * Deteksi DevTools via 2 metode aman:
 *   1. Viewport size difference (outer - inner > threshold)
 *   2. Debugger timing trap (single statement, interval 5 detik)
 *
 * Action (dari security-config.js):
 *   - "WARNING": tampilkan overlay peringatan saja
 *   - "LOGOUT" : picu secureLogout('DEVTOOLS_DETECTED')
 *
 * JANGAN gunakan:
 *   - while(true) {}
 *   - Infinite debugger loop
 *   - Polling < 5 detik (membebani browser)
 *
 * Exposes: window.SecurityDevtoolsProtection.start(opts) => cleanup fn
 * ============================================================
 */

(function () {
  'use strict';

  if (window.__SECURITY_DEVTOOLS_LOADED__) return;
  window.__SECURITY_DEVTOOLS_LOADED__ = true;

  function start(opts) {
    var config = opts.config || {};
    var logout = opts.logout;
    var log = opts.log || function () {};

    var cleanupFns = [];
    var timers = [];
    var devtoolsOpen = false;
    var warningShown = false;
    var lastWarningTime = 0;

    var action = (config.DEVTOOLS_ACTION || 'WARNING').toUpperCase();
    var interval = config.DEVTOOLS_CHECK_INTERVAL || 5000;
    var sizeThreshold = config.DEVTOOLS_SIZE_THRESHOLD || 160;
    var debuggerThreshold = config.DEVTOOLS_DEBUGGER_TIMING_MS || 500;

    log('DEVTOOLS_PROTECTION_START', { action: action, interval: interval });

    // ============================================================
    // METHOD 1: VIEWPORT SIZE DIFFERENCE
    // ============================================================
    function checkSize() {
      try {
        // Skip jika window terlalu kecil (minimized atau baru loading)
        if (window.outerWidth < 200 || window.outerHeight < 200) return;

        var wDiff = window.outerWidth - window.innerWidth;
        var hDiff = window.outerHeight - window.innerHeight;

        if (wDiff > sizeThreshold || hDiff > sizeThreshold) {
          handleDevtoolsOpen('size_difference', { wDiff: wDiff, hDiff: hDiff });
        }
      } catch (e) {}
    }

    // ============================================================
    // METHOD 2: DEBUGGER TIMING TRAP
    // (Hanya untuk mode LOGOUT — WARNING mode tidak pakai ini
    //  untuk hindari pause yang mengganggu dev UX sah)
    // ============================================================
    function checkDebugger() {
      try {
        var start = performance.now();
        // Single debugger statement — hanya pause jika DevTools terbuka
        // TIDAK ada loop, TIDAK ada rekursi
        // eslint-disable-next-line no-debugger
        debugger;
        var elapsed = performance.now() - start;
        if (elapsed > debuggerThreshold) {
          handleDevtoolsOpen('debugger_trap', { elapsed: elapsed });
        }
      } catch (e) {}
    }

    // ============================================================
    // HANDLER
    // ============================================================
    function handleDevtoolsOpen(method, detail) {
      // Cooldown 5 detik antara trigger
      var now = Date.now();
      if (devtoolsOpen && (now - lastWarningTime) < 5000) return;
      devtoolsOpen = true;
      lastWarningTime = now;

      log('DEVTOOLS_DETECTED', { method: method, detail: detail });

      if (action === 'LOGOUT') {
        logout('DEVTOOLS_DETECTED');
        return;
      }

      // WARNING action — tampilkan overlay (tidak destroy aplikasi)
      if (action === 'WARNING') {
        showWarning();
      }
    }

    function showWarning() {
      // Hanya tampilkan sekali per 30 detik untuk hindari spam
      if (warningShown && (Date.now() - lastWarningTime) < 30000) return;
      warningShown = true;

      try {
        // Hapus warning lama jika ada
        var existing = document.getElementById('sec_devtools_warning');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'sec_devtools_warning';
        overlay.style.cssText = [
          'position:fixed', 'top:20px', 'right:20px',
          'background:rgba(20,20,40,0.95)',
          'color:#ff9800',
          'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
          'font-size:14px',
          'padding:16px 20px',
          'border-radius:8px',
          'border:1px solid #ff9800',
          'z-index:2147483647',
          'max-width:320px',
          'box-shadow:0 4px 12px rgba(0,0,0,0.4)',
        ].join(';');
        overlay.innerHTML =
          '<div style="font-weight:bold;margin-bottom:4px;">⚠️ DevTools Terdeteksi</div>' +
          '<div style="color:#ddd;line-height:1.4;">' +
          (config.MESSAGES?.DEVTOOLS_DETECTED || 'Aktivitas inspeksi terdeteksi.') +
          '</div>';

        (document.body || document.documentElement).appendChild(overlay);

        // Auto-remove after 8 seconds
        var removeTimer = setTimeout(function () {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 8000);
        timers.push(removeTimer);
      } catch (e) {}
    }

    // ============================================================
    // START TIMERS
    // ============================================================
    // Resize handler (debounced 500ms)
    var resizeTimer = null;
    function onResize() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(checkSize, 500);
    }
    window.addEventListener('resize', onResize);
    cleanupFns.push(function () {
      window.removeEventListener('resize', onResize);
      if (resizeTimer) clearTimeout(resizeTimer);
    });

    // Initial check setelah 2 detik (biar browser settle)
    var initTimer = setTimeout(checkSize, 2000);
    timers.push(initTimer);

    // Periodic size check (5 detik)
    var sizeInterval = setInterval(checkSize, interval);
    timers.push(sizeInterval);

    // Debugger trap (hanya jika LOGOUT mode)
    if (action === 'LOGOUT') {
      var dbgInterval = setInterval(checkDebugger, interval);
      timers.push(dbgInterval);
    }

    cleanupFns.push(function () {
      timers.forEach(function (t) {
        try { clearInterval(t); } catch (e) {}
        try { clearTimeout(t); } catch (e) {}
      });
    });

    // ============================================================
    // CLEANUP
    // ============================================================
    return function () {
      cleanupFns.forEach(function (fn) {
        try { fn(); } catch (e) {}
      });
    };
  }

  window.SecurityDevtoolsProtection = Object.freeze({ start: start });
})();
