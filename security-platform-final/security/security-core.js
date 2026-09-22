/**
 * ============================================================
 * SECURITY CORE - security-core.js
 * ============================================================
 * ORCHESTRATOR UTAMA. Memuat semua modul keamanan & menyediakan
 * fungsi pusat secureLogout(reason).
 *
 * Semua kondisi keamanan (idle, devtools, tampering, dll) MEMANGGIL
 * secureLogout(reason). Fungsi ini:
 *   1. Idempoten — tidak akan eksekusi dua kali
 *   2. Mencatat alasan ke security log (tanpa data sensitif)
 *   3. Menghentikan semua timer & monitor
 *   4. Sign-out Supabase jika tersedia (scope: local)
 *   5. Membersihkan session storage relevan
 *   6. Redirect ke REDIRECT_URL
 *
 * CARA PAKAI (sudah cukup 2 baris ini di halaman HTML):
 *   <script src="security/security-config.js"></script>
 *   <script src="security/security-core.js"></script>
 *
 * PRINSIP:
 *   - Tidak mengganggu platform existing
 *   - Tidak membuat loop tak terhingga
 *   - Tidak membebani browser (semua timer ≥ 5 detik)
 *   - Setiap modul dibungkus try/catch — satu modul gagal tidak
 *     merusak modul lain
 * ============================================================
 */

(function () {
  'use strict';

  // Cegah double-load
  if (window.__SECURITY_CORE_LOADED__) return;
  window.__SECURITY_CORE_LOADED__ = true;

  var CONFIG = window.SECURITY_CONFIG || {};
  if (!CONFIG.REDIRECT_URL) {
    console.warn('[security] SECURITY_CONFIG tidak ditemukan. Module nonaktif.');
    return;
  }

  // Matikan sepenuhnya di mode dev
  if (CONFIG.SUPPRESS_IN_DEV) {
    console.info('[security] Suppressed via SUPPRESS_IN_DEV.');
    return;
  }

  // ============================================================
  // STATE INTERNAL
  // ============================================================
  var state = {
    booted: false,
    loggedOut: false,           // flag idempotensi secureLogout
    supabase: null,             // akan di-deteksi
    cleanupFns: [],             // daftar fungsi cleanup dari modul
    timers: [],                 // daftar timer untuk di-clear saat logout
    log: [],                    // security log (in-memory)
  };

  // ============================================================
  // LOGGING — catat insiden tanpa data sensitif
  // ============================================================
  function logSecurity(event, detail) {
    if (!CONFIG.ENABLE_SECURITY_LOG) return;

    var entry = {
      ts: Date.now(),
      event: String(event || 'UNKNOWN').slice(0, 50),
    };

    // Sanitize detail — hapus field sensitif
    if (detail) {
      try {
        var safe = {};
        Object.keys(detail).forEach(function (k) {
          // Skip field yang mungkin sensitif
          if (/password|token|secret|key|credential|auth/i.test(k)) return;
          var v = detail[k];
          if (typeof v === 'object') v = JSON.stringify(v);
          safe[k] = String(v).slice(0, 200);
        });
        entry.detail = JSON.stringify(safe);
      } catch (e) {
        entry.detail = '[unserializable]';
      }
    }

    state.log.push(entry);
    if (state.log.length > (CONFIG.SECURITY_LOG_MAX_ENTRIES || 100)) {
      state.log.shift();
    }

    // Persist ke sessionStorage (bukan localStorage — hilang saat tab tutup)
    try {
      sessionStorage.setItem(
        CONFIG.SECURITY_LOG_STORAGE_KEY || 'sec_log',
        JSON.stringify(state.log)
      );
    } catch (e) { /* silent */ }

    // Mirror ke console jika diaktifkan
    if (CONFIG.SECURITY_LOG_CONSOLE_MIRROR && console.debug) {
      console.debug('[security]', event, detail || '');
    }
  }

  // ============================================================
  // SECURE LOGOUT — FUNGSI PUSAT (IDEMPOTEN)
  // ============================================================
  function secureLogout(reason) {
    // 1. Cegah eksekusi ganda
    if (state.loggedOut) return;
    state.loggedOut = true;

    logSecurity('SECURE_LOGOUT', { reason: reason || 'UNKNOWN' });

    // 2. Hentikan semua timer
    state.timers.forEach(function (t) {
      try { clearInterval(t); } catch (e) {}
      try { clearTimeout(t); } catch (e) {}
    });
    state.timers = [];

    // 3. Jalankan cleanup dari semua modul
    state.cleanupFns.forEach(function (fn) {
      try { fn(); } catch (e) { /* silent */ }
    });
    state.cleanupFns = [];

    // 4. Sign-out Supabase jika tersedia
    if (state.supabase && state.supabase.auth) {
      try {
        // scope: 'local' — hanya hapus sesi di browser ini, tidak di server
        // (gunakan 'global' jika ingin logout dari semua perangkat)
        var p = state.supabase.auth.signOut({ scope: 'local' });
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (e) { /* silent */ }
    }

    // 5. Bersihkan storage terkait keamanan (JANGAN hapus semua —
    //    data user yang sah mungkin perlu dipertahankan)
    try {
      var keysToClean = [
        CONFIG.SECURITY_LOG_STORAGE_KEY || 'sec_log',
        'sec_tab_id',
        'sec_master_tab',
        'sec_master_heartbeat',
        'sec_session_token',
        'sec_heartbeat',
        CONFIG.ENTRY_GUARD_STORAGE_KEY || 'sec_entry_verified',
      ];
      keysToClean.forEach(function (k) {
        try { localStorage.removeItem(k); } catch (e) {}
        try { sessionStorage.removeItem(k); } catch (e) {}
      });
    } catch (e) { /* silent */ }

    // 6. Redirect ke REDIRECT_URL dengan parameter reason
    var delay = CONFIG.REDIRECT_DELAY_MS || 500;
    setTimeout(function () {
      try {
        var url = new URL(CONFIG.REDIRECT_URL);
        url.searchParams.set('reason', String(reason || 'UNKNOWN'));
        url.searchParams.set('from', 'platform');
        window.location.replace(url.toString());
      } catch (e) {
        window.location.href = CONFIG.REDIRECT_URL;
      }
    }, delay);
  }

  // Expose secureLogout secara global (read-only, tidak bisa ditimpa)
  try {
    Object.defineProperty(window, 'secureLogout', {
      value: secureLogout,
      writable: false,
      configurable: false,
    });
  } catch (e) { /* silent */ }

  // Expose SecurityCore API untuk debugging (read-only)
  try {
    Object.defineProperty(window, 'SecurityCore', {
      value: Object.freeze({
        version: '1.0.0',
        config: CONFIG,
        log: function (e, d) { logSecurity(e, d); },
        getLog: function () { return state.log.slice(); },
        logout: secureLogout,
        isLoggedOut: function () { return state.loggedOut; },
        getSupabase: function () { return state.supabase; },
      }),
      writable: false,
      configurable: false,
    });
  } catch (e) { /* silent */ }

  // ============================================================
  // DETEKSI SUPABASE (auto-detect, retry 6x selama 60 detik)
  // ============================================================
  function detectSupabase() {
    var candidates = ['supabase', 'supabaseClient', 'sb', '_supabase'];
    for (var i = 0; i < candidates.length; i++) {
      try {
        var v = window[candidates[i]];
        if (v && v.auth && typeof v.auth.getSession === 'function') {
          return v;
        }
      } catch (e) {}
    }
    return null;
  }

  function tryDetectSupabase(retries) {
    retries = retries || 0;
    var sb = detectSupabase();
    if (sb) {
      state.supabase = sb;
      logSecurity('SUPABASE_DETECTED', {});
      // Lanjut init
      scheduleInit();
      return;
    }
    if (retries < 6) {
      // Retry setiap 10 detik, maksimum 6x (60 detik total)
      var t = setTimeout(function () {
        tryDetectSupabase(retries + 1);
      }, 10000);
      state.timers.push(t);
    } else {
      logSecurity('NO_SUPABASE_FOUND', {});
      // Tetap init meski tanpa Supabase — fitur lain tetap jalan
      scheduleInit();
    }
  }

  // ============================================================
  // ENTRY GUARD — akses pertama wajib dari mukminnasri.com
  // ============================================================
  function runEntryGuard() {
    if (!CONFIG.ENABLE_ENTRY_GUARD) return true;

    var mainUrl = CONFIG.ENTRY_GUARD_MAIN_SITE || 'https://mukminnasri.com/';
    var patterns = CONFIG.ENTRY_GUARD_REFERRER_PATTERNS || ['mukminnasri.com'];
    var param = CONFIG.ENTRY_GUARD_PARAM || 'from';
    var paramValue = CONFIG.ENTRY_GUARD_PARAM_VALUE || 'main';
    var storageKey = CONFIG.ENTRY_GUARD_STORAGE_KEY || 'sec_entry_verified';
    var ttlMs = CONFIG.ENTRY_GUARD_TTL_MS || (24 * 60 * 60 * 1000);
    var whitelist = CONFIG.ENTRY_GUARD_WHITELIST_PATHS || [];

    // 1. Whitelist path
    var path = window.location.pathname;
    for (var i = 0; i < whitelist.length; i++) {
      var p = whitelist[i];
      if (p.endsWith('*')) {
        if (path.startsWith(p.slice(0, -1))) return true;
      } else if (path === p || path.startsWith(p + '/')) {
        return true;
      }
    }

    // 2. Bypass param (testing)
    try {
      var url = new URL(window.location.href);
      if (url.searchParams.get('sec.bypass') === '1') return true;
    } catch (e) {}

    // 3. Flag localStorage valid
    try {
      var raw = localStorage.getItem(storageKey);
      if (raw) {
        var data = JSON.parse(raw);
        if (data && typeof data.ts === 'number' && (Date.now() - data.ts) < ttlMs) {
          return true;
        }
      }
    } catch (e) {}

    // 4. Referrer dari main site
    try {
      var ref = document.referrer || '';
      if (ref) {
        var refHost = new URL(ref).hostname.toLowerCase();
        for (var j = 0; j < patterns.length; j++) {
          var pattern = patterns[j].toLowerCase().replace(/^\./, '');
          if (refHost === pattern || refHost.endsWith('.' + pattern)) {
            // Set flag
            try {
              localStorage.setItem(storageKey, JSON.stringify({ ts: Date.now() }));
            } catch (e) {}
            return true;
          }
        }
      }
    } catch (e) {}

    // 5. URL param ?from=main
    try {
      var url2 = new URL(window.location.href);
      if (url2.searchParams.get(param) === paramValue) {
        // Set flag + hapus param dari URL
        try {
          localStorage.setItem(storageKey, JSON.stringify({ ts: Date.now() }));
        } catch (e) {}
        url2.searchParams.delete(param);
        window.history.replaceState(null, '', url2.toString());
        return true;
      }
    } catch (e) {}

    // 6. Strict mode: tanpa referrer = tolak
    if (CONFIG.ENTRY_GUARD_STRICT_MODE && !document.referrer) {
      logSecurity('ENTRY_GUARD_REDIRECT', { reason: 'strict_no_referrer' });
      redirectToMain(mainUrl, 'entry_strict');
      return false;
    }

    // 7. Default: redirect ke main site
    logSecurity('ENTRY_GUARD_REDIRECT', { reason: 'no_entry' });
    redirectToMain(mainUrl, 'entry_no_token');
    return false;
  }

  function redirectToMain(mainUrl, reason) {
    try {
      var url = new URL(mainUrl);
      url.searchParams.set('return_url', window.location.href);
      url.searchParams.set('from', 'platform');
      url.searchParams.set('reason', reason);
      window.location.replace(url.toString());
    } catch (e) {
      window.location.href = mainUrl;
    }
  }

  // ============================================================
  // INIT — jalankan setelah DOM siap & Supabase terdeteksi
  // ============================================================
  var initScheduled = false;
  function scheduleInit() {
    if (initScheduled) return;
    initScheduled = true;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      // Beri jeda 50ms supaya script lain sempat load
      setTimeout(init, 50);
    }
  }

  function init() {
    if (state.booted) return;
    state.booted = true;

    // 1. Entry guard pertama — jika gagal, hentikan init
    if (!runEntryGuard()) {
      // Sedang redirect ke main site
      return;
    }

    logSecurity('CORE_INIT', {
      hasSupabase: !!state.supabase,
      modules: {
        sessionMonitor: CONFIG.ENABLE_SESSION_MONITOR,
        tabMonitor: CONFIG.ENABLE_SINGLE_SESSION,
        autoLogout: CONFIG.ENABLE_AUTO_LOGOUT,
        devtools: CONFIG.ENABLE_DEVTOOLS_DETECTION,
        tamper: CONFIG.ENABLE_TAMPER_DETECTION,
        clickjack: CONFIG.ENABLE_CLICKJACK_PROTECTION,
      },
    });

    // Helper untuk start modul dengan aman (try/catch)
    function startModule(name, fn) {
      try {
        var cleanup = fn();
        if (typeof cleanup === 'function') {
          state.cleanupFns.push(cleanup);
        }
        logSecurity('MODULE_STARTED', { name: name });
      } catch (e) {
        logSecurity('MODULE_INIT_FAILED', { name: name, error: e.message });
      }
    }

    // 2. Start modul (urutan penting):
    //    a. Session monitor — subscribe ke Supabase auth state
    //    b. Tab browser monitor — claim master
    //    c. Auto logout — idle timer
    //    d. DevTools protection — deteksi
    //    e. Tamper detection — built-in
    //    f. Clickjack protection — built-in

    if (CONFIG.ENABLE_SESSION_MONITOR && window.SecuritySessionMonitor) {
      startModule('session-monitor', function () {
        return window.SecuritySessionMonitor.start({
          config: CONFIG,
          supabase: state.supabase,
          logout: secureLogout,
          log: logSecurity,
        });
      });
    }

    if (CONFIG.ENABLE_SINGLE_SESSION && window.SecurityTabBrowserMonitor) {
      startModule('tab-browser-monitor', function () {
        return window.SecurityTabBrowserMonitor.start({
          config: CONFIG,
          supabase: state.supabase,
          logout: secureLogout,
          log: logSecurity,
        });
      });
    }

    if (CONFIG.ENABLE_AUTO_LOGOUT && window.SecurityAutoLogout) {
      startModule('auto-logout', function () {
        return window.SecurityAutoLogout.start({
          config: CONFIG,
          logout: secureLogout,
          log: logSecurity,
        });
      });
    }

    if (CONFIG.ENABLE_DEVTOOLS_DETECTION && window.SecurityDevtoolsProtection) {
      startModule('devtools-protection', function () {
        return window.SecurityDevtoolsProtection.start({
          config: CONFIG,
          logout: secureLogout,
          log: logSecurity,
        });
      });
    }

    if (CONFIG.ENABLE_TAMPER_DETECTION) {
      startModule('tamper-detection', function () {
        return startTamperDetection();
      });
    }

    if (CONFIG.ENABLE_CLICKJACK_PROTECTION) {
      startModule('clickjack-protection', function () {
        return startClickjackProtection();
      });
    }

    logSecurity('CORE_READY', { modules: state.cleanupFns.length });
  }

  // ============================================================
  // TAMPER DETECTION (built-in, ringan)
  // ============================================================
  function startTamperDetection() {
    var snapshot = {
      REDIRECT_URL: CONFIG.REDIRECT_URL,
      IDLE_TIMEOUT: CONFIG.IDLE_TIMEOUT,
      secureLogoutType: typeof window.secureLogout,
    };

    var interval = setInterval(function () {
      try {
        // 1. Cek apakah secureLogout masih function asli
        if (typeof window.secureLogout !== 'function') {
          logSecurity('TAMPER_SECURE_LOGOUT_REMOVED', {});
          // Tidak bisa logout karena secureLogout hilang — redirect manual
          try {
            window.location.replace(CONFIG.REDIRECT_URL + '?reason=TAMPERING_DETECTED&from=platform');
          } catch (e) {
            window.location.href = CONFIG.REDIRECT_URL;
          }
          return;
        }

        // 2. Cek apakah SecurityCore masih frozen
        if (!Object.isFrozen(window.SecurityCore)) {
          logSecurity('TAMPER_CORE_UNFROZEN', {});
          secureLogout('TAMPERING_DETECTED');
          return;
        }

        // 3. Cek apakah config masih konsisten
        var current = window.SECURITY_CONFIG || {};
        if (current.REDIRECT_URL !== snapshot.REDIRECT_URL) {
          logSecurity('TAMPER_CONFIG_CHANGED', {
            field: 'REDIRECT_URL',
            expected: snapshot.REDIRECT_URL,
            actual: current.REDIRECT_URL,
          });
          // Hanya log, jangan auto-logout — mungkin user sengaja ubah
        }
      } catch (e) {
        // Silent — jangan crash
      }
    }, CONFIG.TAMPER_CHECK_INTERVAL || 60000);

    state.timers.push(interval);
    return function () { clearInterval(interval); };
  }

  // ============================================================
  // CLICKJACK PROTECTION (built-in, client-side)
  // ============================================================
  function startClickjackProtection() {
    // Jika sedang di-iframe oleh origin berbeda → break out
    if (window.top === window.self) {
      return function () {}; // no-op — tidak di-iframe
    }

    try {
      // Coba break out
      window.top.location = window.self.location;
      logSecurity('CLICKJACK_BREAKOUT', {});
    } catch (e) {
      // Cross-origin — tidak bisa break out
      logSecurity('CLICKJACK_DETECTED', { referrer: document.referrer });

      // Tampilkan overlay blokir
      var overlay = document.createElement('div');
      overlay.id = 'sec_clickjack_block';
      overlay.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'width:100vw', 'height:100vh',
        'background:#1a0000', 'color:#ff4444', 'z-index:2147483647',
        'display:flex', 'align-items:center', 'justify-content:center',
        'font-family:monospace', 'text-align:center', 'padding:20px',
      ].join(';');
      overlay.innerHTML = '<div><h1 style="margin:0 0 8px;">403</h1><p>' +
        (CONFIG.MESSAGES?.CLICKJACK_DETECTED || 'Halaman ini tidak dapat di-embed.') +
        '</p></div>';
      try {
        (document.body || document.documentElement).appendChild(overlay);
      } catch (e2) {}

      return function () {
        try { overlay.remove(); } catch (e) {}
      };
    }

    return function () {};
  }

  // ============================================================
  // BOOT — mulai deteksi Supabase (yang akan trigger init)
  // ============================================================
  tryDetectSupabase();

})();
