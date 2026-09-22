/**
 * ============================================================
 * AUTO LOGOUT - auto-logout.js
 * ============================================================
 * Idle timeout 15 menit. Track aktivitas user via event yang throttled.
 *
 * EVENT YANG DIPANTAU:
 *   - mousemove, click, keydown, touchstart, scroll
 *   - pointerdown, pointermove
 *
 * PRINSIP:
 *   - Throttle 2 detik (tidak membebani browser)
 *   - visibilitychange & focus HANYA untuk RESET timer,
 *     TIDAK untuk trigger logout langsung
 *   - Tidak logout untuk perpindahan tab/window singkat
 *   - Optional: warning popup 1 menit sebelum logout
 *
 * Exposes: window.SecurityAutoLogout.start(opts) => cleanup fn
 * ============================================================
 */

(function () {
  'use strict';

  if (window.__SECURITY_AUTO_LOGOUT_LOADED__) return;
  window.__SECURITY_AUTO_LOGOUT_LOADED__ = true;

  function start(opts) {
    var config = opts.config || {};
    var logout = opts.logout;
    var log = opts.log || function () {};

    var cleanupFns = [];
    var timers = [];
    var lastActivity = Date.now();
    var idleCheckInterval = null;
    var warningTimer = null;
    var warningOverlay = null;
    var isThrottling = false;

    var timeoutMs = config.IDLE_TIMEOUT || (15 * 60 * 1000);
    var warningMs = config.IDLE_WARNING_BEFORE || (60 * 1000);
    var throttleMs = config.IDLE_THROTTLE_MS || 2000;
    var checkIntervalMs = config.IDLE_CHECK_INTERVAL || 10000;

    log('AUTO_LOGOUT_START', {
      timeout: timeoutMs,
      warning: warningMs,
      throttle: throttleMs,
    });

    // ============================================================
    // ACTIVITY HANDLER (THROTTLED)
    // ============================================================
    function onActivity() {
      // Throttle — abaikan event yang terlalu cepat
      if (isThrottling) return;
      isThrottling = true;

      lastActivity = Date.now();

      // Clear pending warning
      if (warningTimer) {
        clearTimeout(warningTimer);
        warningTimer = null;
      }
      // Remove warning overlay
      if (warningOverlay) {
        try { warningOverlay.remove(); } catch (e) {}
        warningOverlay = null;
      }

      // Reset throttle
      var resetTimer = setTimeout(function () {
        isThrottling = false;
      }, throttleMs);
      timers.push(resetTimer);
    }

    // ============================================================
    // IDLE CHECK LOOP (setiap 10 detik)
    // ============================================================
    function checkIdle() {
      var now = Date.now();
      var idleMs = now - lastActivity;

      if (idleMs >= timeoutMs) {
        // Fully idle — TRIGGER LOGOUT
        log('IDLE_TIMEOUT_REACHED', { idleMs: idleMs });
        logout('IDLE_TIMEOUT');
        return;
      }

      // Tampilkan warning N detik sebelum logout (sekali saja)
      var timeUntilLogout = timeoutMs - idleMs;
      if (warningMs > 0 && !warningTimer && timeUntilLogout <= warningMs) {
        showWarning(timeUntilLogout);
        warningTimer = setTimeout(function () {
          // Will be caught by next checkIdle
        }, warningMs);
      }
    }

    // ============================================================
    // WARNING OVERLAY (1 menit sebelum logout)
    // ============================================================
    function showWarning(remainingMs) {
      try {
        // Hapus overlay lama jika ada
        if (warningOverlay) {
          try { warningOverlay.remove(); } catch (e) {}
        }

        warningOverlay = document.createElement('div');
        warningOverlay.id = 'sec_idle_warning';
        warningOverlay.style.cssText = [
          'position:fixed', 'bottom:20px', 'right:20px',
          'background:rgba(20,20,40,0.95)',
          'color:#ffeb3b',
          'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
          'font-size:14px',
          'padding:16px 20px',
          'border-radius:8px',
          'border:1px solid #ffeb3b',
          'z-index:2147483647',
          'max-width:320px',
          'box-shadow:0 4px 12px rgba(0,0,0,0.4)',
        ].join(';');

        var secondsLeft = Math.ceil(remainingMs / 1000);
        warningOverlay.innerHTML =
          '<div style="font-weight:bold;margin-bottom:4px;">⏰ Sesi akan berakhir</div>' +
          '<div style="color:#ddd;line-height:1.4;margin-bottom:8px;">' +
          'Anda akan logout otomatis dalam <strong id="sec_idle_seconds">' + secondsLeft + '</strong> detik ' +
          'karena tidak ada aktivitas.</div>' +
          '<button id="sec_idle_stay" style="background:#ffeb3b;color:#000;border:none;padding:6px 12px;' +
          'border-radius:4px;cursor:pointer;font-weight:bold;">Tetap Masuk</button>';

        (document.body || document.documentElement).appendChild(warningOverlay);

        // Update countdown setiap 1 detik
        var countdownInterval = setInterval(function () {
          var el = document.getElementById('sec_idle_seconds');
          if (!el) {
            clearInterval(countdownInterval);
            return;
          }
          secondsLeft--;
          if (secondsLeft <= 0) {
            clearInterval(countdownInterval);
            return;
          }
          el.textContent = secondsLeft;
        }, 1000);
        timers.push(countdownInterval);

        // Tombol "Tetap Masuk" → reset timer
        var stayBtn = document.getElementById('sec_idle_stay');
        if (stayBtn) {
          stayBtn.addEventListener('click', function () {
            onActivity();
            try { warningOverlay.remove(); } catch (e) {}
            warningOverlay = null;
          });
        }
      } catch (e) {}
    }

    // ============================================================
    // REGISTER ACTIVITY EVENTS (passive, capture)
    // ============================================================
    var events = [
      'mousemove',
      'click',
      'keydown',
      'touchstart',
      'scroll',
      'pointerdown',
      'pointermove',
    ];

    events.forEach(function (evt) {
      // passive: true → jangan block scroll
      // capture: true → tangkap sebelum child elements
      document.addEventListener(evt, onActivity, { passive: true, capture: true });
      cleanupFns.push(function () {
        document.removeEventListener(evt, onActivity, { capture: true });
      });
    });

    // ============================================================
    // VISIBILITY & FOCUS — RESET timer (TIDAK trigger logout)
    // ============================================================
    function onVisibilityChange() {
      if (!document.hidden) {
        // User kembali ke tab — reset timer
        lastActivity = Date.now();
        log('VISIBILITY_RESET_IDLE', {});
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    cleanupFns.push(function () {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    });

    function onFocus() {
      // Window dapat fokus — reset timer
      lastActivity = Date.now();
    }
    window.addEventListener('focus', onFocus);
    cleanupFns.push(function () {
      window.removeEventListener('focus', onFocus);
    });

    // ============================================================
    // START IDLE CHECK
    // ============================================================
    idleCheckInterval = setInterval(checkIdle, checkIntervalMs);
    timers.push(idleCheckInterval);

    // ============================================================
    // CLEANUP
    // ============================================================
    return function () {
      cleanupFns.forEach(function (fn) {
        try { fn(); } catch (e) {}
      });
      timers.forEach(function (t) {
        try { clearInterval(t); } catch (e) {}
        try { clearTimeout(t); } catch (e) {}
      });
      if (warningTimer) {
        try { clearTimeout(warningTimer); } catch (e) {}
      }
      if (warningOverlay) {
        try { warningOverlay.remove(); } catch (e) {}
      }
    };
  }

  window.SecurityAutoLogout = Object.freeze({ start: start });
})();
