/**
 * ============================================================
 * SESSION MONITOR - session-monitor.js
 * ============================================================
 * Memvalidasi sesi secara berkala.
 *
 * - Jika Supabase tersedia: subscribe ke onAuthStateChange +
 *   getSession() setiap 60 detik
 * - Jika tidak: monitor perubahan sessionStorage/localStorage
 *   untuk token sesi yang biasa dipakai platform
 *
 * Pada perubahan visibility/focus (kembali ke tab setelah lama):
 * - Jika sesi sudah tidak valid → secureLogout('INVALID_SESSION')
 * - Tidak langsung logout untuk perpindahan singkat (< 30 detik)
 *
 * Exposes: window.SecuritySessionMonitor.start(opts) => cleanup fn
 * ============================================================
 */

(function () {
  'use strict';

  if (window.__SECURITY_SESSION_MONITOR_LOADED__) return;
  window.__SECURITY_SESSION_MONITOR_LOADED__ = true;

  function start(opts) {
    var config = opts.config || {};
    var supabase = opts.supabase || null;
    var logout = opts.logout;
    var log = opts.log || function () {};

    var cleanupFns = [];
    var timers = [];
    var lastValidSession = null;
    var lastVisibilityChange = 0;
    var wasHidden = false;
    var authSubscription = null;

    log('SESSION_MONITOR_START', { hasSupabase: !!supabase });

    // ============================================================
    // PATH 1: SUPABASE AUTH INTEGRATION
    // ============================================================
    if (supabase && supabase.auth) {

      // 1a. Subscribe ke auth state changes
      try {
        var result = supabase.auth.onAuthStateChange(function (event, session) {
          log('AUTH_STATE_CHANGE', { event: event, hasSession: !!session });

          switch (event) {
            case 'SIGNED_OUT':
              // User sign-out di tab/server lain
              if (!opts._internalLogout) {
                logout('SIGNED_OUT');
              }
              break;

            case 'TOKEN_REFRESHED':
            case 'USER_UPDATED':
            case 'INITIAL_SESSION':
              lastValidSession = session;
              break;

            case 'PASSWORD_RECOVERY':
              // Tidak logout — biarkan platform handle
              break;
          }
        });

        // Simpan subscription untuk cleanup
        if (result && result.data && result.data.subscription) {
          authSubscription = result.data.subscription;
          if (typeof authSubscription.unsubscribe === 'function') {
            cleanupFns.push(function () {
              try { authSubscription.unsubscribe(); } catch (e) {}
            });
          }
        }
      } catch (e) {
        log('AUTH_SUBSCRIBE_FAILED', { error: e.message });
      }

      // 1b. Periodic session check (60 detik, ringan)
      var checkInterval = setInterval(function () {
        // Skip jika sudah logout
        if (opts._internalLogout) return;

        supabase.auth.getSession().then(function (response) {
          if (response.error) {
            log('SESSION_CHECK_ERROR', { error: response.error.message });
            // Jangan logout untuk error transient (network)
            return;
          }
          if (!response.data || !response.data.session) {
            // Tidak ada sesi
            if (lastValidSession) {
              log('SESSION_LOST', {});
              logout('INVALID_SESSION');
            }
          } else {
            lastValidSession = response.data.session;
          }
        }).catch(function (e) {
          // Silent — network error jangan picu logout
          log('SESSION_CHECK_EXCEPTION', { error: e.message });
        });
      }, config.SESSION_CHECK_INTERVAL || 60000);

      timers.push(checkInterval);
      cleanupFns.push(function () { clearInterval(checkInterval); });
    }

    // ============================================================
    // PATH 2: RE-VALIDATION SAAT USER KEMBALI KE TAB
    // ============================================================
    // visibilitychange: user pindah tab lalu kembali
    function onVisibilityChange() {
      var hidden = document.hidden;
      log('VISIBILITY_CHANGE', { hidden: hidden });

      if (hidden) {
        wasHidden = true;
        lastVisibilityChange = Date.now();
      } else if (wasHidden) {
        var awayMs = Date.now() - lastVisibilityChange;
        log('RETURNED_TO_PLATFORM', { awayMs: awayMs });

        // Hanya re-validate jika pergi cukup lama (> 30 detik default)
        var graceMs = config.BRIEF_UNFOCUS_GRACE_MS || 30000;
        if (awayMs > graceMs) {
          // Trigger session check segera
          if (supabase && supabase.auth) {
            supabase.auth.getSession().then(function (response) {
              if (!response.error && (!response.data || !response.data.session)) {
                if (lastValidSession) {
                  log('SESSION_INVALID_ON_RETURN', { awayMs: awayMs });
                  logout('INVALID_SESSION');
                }
              } else if (response.data && response.data.session) {
                lastValidSession = response.data.session;
              }
            }).catch(function () { /* silent */ });
          }
        }
        wasHidden = false;
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    cleanupFns.push(function () {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    });

    // ============================================================
    // PATH 3: FALLBACK TANPA SUPABASE
    // ============================================================
    if (!supabase) {
      // Pantau perubahan sessionStorage/localStorage untuk key sesi umum
      var sessionKeys = [
        'sb-auth-token',           // Supabase default
        'supabase.auth.token',     // Supabase lama
        'access_token',
        'session_token',
        'authToken',
      ];

      function checkSessionStorage() {
        var hasAny = false;
        for (var i = 0; i < sessionKeys.length; i++) {
          try {
            if (localStorage.getItem(sessionKeys[i]) ||
                sessionStorage.getItem(sessionKeys[i])) {
              hasAny = true;
              break;
            }
          } catch (e) {}
        }
        return hasAny;
      }

      var hadSession = checkSessionStorage();
      if (hadSession) {
        log('FALLBACK_SESSION_DETECTED', {});
      }

      var fallbackInterval = setInterval(function () {
        var hasNow = checkSessionStorage();
        if (hadSession && !hasNow) {
          log('FALLBACK_SESSION_LOST', {});
          logout('INVALID_SESSION');
        }
        hadSession = hasNow;
      }, config.SESSION_CHECK_INTERVAL || 60000);

      timers.push(fallbackInterval);
      cleanupFns.push(function () { clearInterval(fallbackInterval); });
    }

    // ============================================================
    // CLEANUP
    // ============================================================
    return function () {
      cleanupFns.forEach(function (fn) {
        try { fn(); } catch (e) {}
      });
      timers.forEach(function (t) {
        try { clearInterval(t); } catch (e) {}
      });
    };
  }

  window.SecuritySessionMonitor = Object.freeze({ start: start });
})();
