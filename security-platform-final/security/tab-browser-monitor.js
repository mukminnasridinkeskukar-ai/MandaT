/**
 * ============================================================
 * TAB BROWSER MONITOR - tab-browser-monitor.js
 * ============================================================
 * Enforce single-session via BroadcastChannel + localStorage.
 *
 * Strategi:
 *   - Tab pertama yang init → CLAIM master
 *   - Tab kedua di origin sama → kirim YIELD, lalu secureLogout
 *   - Heartbeat setiap 5 detik (ringan)
 *   - Master stale (> 15 detik tanpa heartbeat) → tab lain bisa claim
 *
 * TIDAK false-positive untuk:
 *   - Reload tab (sessionStorage preserve tab ID)
 *   - Tab navigasi internal
 *   - Tab pause di background (heartbeat tetap jalan via setInterval)
 *
 * Exposes: window.SecurityTabBrowserMonitor.start(opts) => cleanup fn
 * ============================================================
 */

(function () {
  'use strict';

  if (window.__SECURITY_TAB_BROWSER_LOADED__) return;
  window.__SECURITY_TAB_BROWSER_LOADED__ = true;

  function start(opts) {
    var config = opts.config || {};
    var logout = opts.logout;
    var log = opts.log || function () {};

    var cleanupFns = [];
    var timers = [];
    var channel = null;
    var tabId = null;
    var isMaster = false;

    log('TAB_MONITOR_START', {});

    // ============================================================
    // GENERATE / RECOVER TAB ID (via sessionStorage — survive reload)
    // ============================================================
    try {
      tabId = sessionStorage.getItem('sec_tab_id');
      if (!tabId) {
        tabId = 'tab_' + Date.now() + '_' +
                Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem('sec_tab_id', tabId);
      }
    } catch (e) {
      tabId = 'tab_' + Date.now() + '_' +
              Math.random().toString(36).slice(2, 10);
    }

    // ============================================================
    // BROADCAST CHANNEL (utama) + localStorage event (fallback)
    // ============================================================
    var CHANNEL_NAME = 'sec_tab_channel';
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch (e) {
      log('BROADCAST_CHANNEL_UNAVAILABLE', { error: e.message });
      // Lanjut tanpa BroadcastChannel — pakai localStorage event saja
    }

    // ============================================================
    // MASTER ELECTION
    // ============================================================
    var MASTER_KEY = 'sec_master_tab';
    var HEARTBEAT_KEY = 'sec_master_heartbeat';

    function claimMaster() {
      try {
        var masterData = localStorage.getItem(MASTER_KEY);
        var heartbeat = parseInt(localStorage.getItem(HEARTBEAT_KEY) || '0', 10);
        var now = Date.now();
        var lockTimeout = config.TAB_LOCK_TIMEOUT || 15000;

        if (masterData && (now - heartbeat) < lockTimeout) {
          // Master aktif — cek apakah kita atau orang lain
          var master = JSON.parse(masterData);
          if (master.tabId !== tabId) {
            // Bukan kita — YIELD (logout)
            log('YIELD_TO_MASTER', { masterTabId: master.tabId });
            logout('SESSION_CHANGED');
            return false;
          }
          // Kita sendiri yang master — refresh
        }

        // Claim master
        localStorage.setItem(MASTER_KEY, JSON.stringify({ tabId: tabId, ts: now }));
        localStorage.setItem(HEARTBEAT_KEY, String(now));
        isMaster = true;
        log('CLAIMED_MASTER', { tabId: tabId });
        return true;
      } catch (e) {
        log('MASTER_CLAIM_FAILED', { error: e.message });
        return false;
      }
    }

    function heartbeat() {
      if (!isMaster) return;
      try {
        localStorage.setItem(HEARTBEAT_KEY, String(Date.now()));
      } catch (e) {}
    }

    function releaseMaster() {
      if (!isMaster) return;
      try {
        localStorage.removeItem(MASTER_KEY);
        localStorage.removeItem(HEARTBEAT_KEY);
        log('RELEASED_MASTER', { tabId: tabId });
      } catch (e) {}
      isMaster = false;
    }

    // ============================================================
    // INITIAL CLAIM (delay 500ms — kasih waktu master lama release)
    // ============================================================
    var initTimer = setTimeout(function () {
      claimMaster();
    }, 500);
    timers.push(initTimer);

    // ============================================================
    // HEARTBEAT TIMER (5 detik)
    // ============================================================
    var hbInterval = setInterval(function () {
      if (isMaster) {
        heartbeat();
      } else {
        // Non-master: cek apakah master masih hidup
        try {
          var hb = parseInt(localStorage.getItem(HEARTBEAT_KEY) || '0', 10);
          var now = Date.now();
          if (now - hb > (config.TAB_LOCK_TIMEOUT || 15000)) {
            log('MASTER_STALE_CLAIMING', {});
            claimMaster();
          }
        } catch (e) {}
      }
    }, config.TAB_HEARTBEAT_INTERVAL || 5000);
    timers.push(hbInterval);

    // ============================================================
    // BROADCAST CHANNEL HANDLER
    // ============================================================
    if (channel) {
      channel.onmessage = function (event) {
        var msg = event.data;
        if (!msg || !msg.type) return;

        log('TAB_MESSAGE', { type: msg.type, from: msg.tabId });

        if (msg.type === 'NEW_TAB') {
          // Tab baru muncul — jika kita master, suruh yield
          if (isMaster && msg.tabId !== tabId) {
            try {
              channel.postMessage({
                type: 'YIELD',
                tabId: tabId,
                targetTabId: msg.tabId,
              });
            } catch (e) {}
          }
        } else if (msg.type === 'YIELD') {
          // Master suruh kita yield
          if (msg.targetTabId === tabId) {
            log('YIELDED_BY_MASTER', {});
            logout('SESSION_CHANGED');
          }
        } else if (msg.type === 'MASTER_LEFT') {
          // Master tutup — coba claim
          if (!isMaster) {
            setTimeout(function () { claimMaster(); }, 100);
          }
        }
      };

      // Umumkan ke tab lain bahwa kita hadir
      try {
        channel.postMessage({ type: 'NEW_TAB', tabId: tabId });
      } catch (e) {}
    }

    // ============================================================
    // STORAGE EVENT (fallback / cross-tab via localStorage)
    // ============================================================
    function onStorage(event) {
      if (event.key === MASTER_KEY) {
        if (event.newValue) {
          try {
            var master = JSON.parse(event.newValue);
            if (master.tabId !== tabId && isMaster) {
              // Master diambil alih
              log('MASTER_TAKEN_OVER', { newMaster: master.tabId });
              logout('SESSION_CHANGED');
            }
          } catch (e) {}
        }
      }
    }
    window.addEventListener('storage', onStorage);
    cleanupFns.push(function () {
      window.removeEventListener('storage', onStorage);
    });

    // ============================================================
    // CLEANUP ON UNLOAD
    // ============================================================
    function onUnload() {
      releaseMaster();
      if (channel) {
        try {
          channel.postMessage({ type: 'MASTER_LEFT', tabId: tabId });
          channel.close();
        } catch (e) {}
      }
    }
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);
    cleanupFns.push(function () {
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
    });

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
      onUnload();
    };
  }

  window.SecurityTabBrowserMonitor = Object.freeze({ start: start });
})();
