/**
 * ============================================================
 * SECURITY CONFIG - security-config.js
 * ============================================================
 * SATU-SATUNYA FILE KONFIGURASI.
 * Edit nilai di sini, tidak perlu menyentuh file lain.
 *
 * CARA PAKAI:
 *   <script src="security/security-config.js"></script>
 *   <script src="security/security-core.js"></script>
 *
 * Konfigurasi ini dibekukan (Object.freeze) agar tidak bisa
 * diubah oleh script lain saat runtime.
 * ============================================================
 */

window.SECURITY_CONFIG = Object.freeze({

  // ============================================================
  // REDIRECT TARGET — semua kondisi keamanan akan redirect ke sini
  // ============================================================
  REDIRECT_URL: "https://mukminnasri.com/",

  // ============================================================
  // [FITUR 1] AUTO LOGOUT — Idle 15 menit
  // ============================================================
  ENABLE_AUTO_LOGOUT: true,
  IDLE_TIMEOUT: 15 * 60 * 1000,        // 15 menit = 900.000 ms
  IDLE_WARNING_BEFORE: 60 * 1000,      // tampilkan warning 1 menit sebelum logout
  IDLE_THROTTLE_MS: 2000,              // throttle event aktivitas (jangan bebani browser)
  IDLE_CHECK_INTERVAL: 10000,          // cek idle setiap 10 detik

  // Grace period untuk perpindahan tab/window singkat (30 detik).
  // Selama ini, fokus hilang tidak langsung memicu logout.
  BRIEF_UNFOCUS_GRACE_MS: 30 * 1000,

  // ============================================================
  // [FITUR 2] SESSION MONITOR — validasi sesi berkala
  // ============================================================
  ENABLE_SESSION_MONITOR: true,
  SESSION_CHECK_INTERVAL: 60 * 1000,   // cek sesi setiap 60 detik (ringan)

  // Jika true, modul akan auto-detect Supabase (window.supabase)
  // Jika false, modul tidak akan subscribe ke Supabase auth
  USE_SUPABASE_AUTH: true,

  // ============================================================
  // [FITUR 3] SINGLE SESSION / TAB BROWSER MONITOR
  // ============================================================
  ENABLE_SINGLE_SESSION: true,
  TAB_HEARTBEAT_INTERVAL: 5 * 1000,    // heartbeat setiap 5 detik
  TAB_LOCK_TIMEOUT: 15 * 1000,         // 15 detik tanpa heartbeat = tab stale

  // ============================================================
  // [FITUR 4] DEVTOOLS PROTECTION
  // ============================================================
  ENABLE_DEVTOOLS_DETECTION: true,
  // "WARNING" = tampilkan overlay peringatan saja
  // "LOGOUT"   = picu secureLogout('DEVTOOLS_DETECTED')
  DEVTOOLS_ACTION: "WARNING",
  DEVTOOLS_CHECK_INTERVAL: 5 * 1000,   // cek setiap 5 detik
  DEVTOOLS_SIZE_THRESHOLD: 160,        // px selisih outer vs inner
  DEVTOOLS_DEBUGGER_TIMING_MS: 500,    // ambang delay debugger trap

  // ============================================================
  // [FITUR 5] ANTI-TAMPERING
  // ============================================================
  ENABLE_TAMPER_DETECTION: true,
  TAMPER_CHECK_INTERVAL: 60 * 1000,    // cek setiap 60 detik (ringan)

  // ============================================================
  // [FITUR 6] ANTI-CLICKJACKING (deteksi sisi client)
  // Catatan: proteksi utama wajib via header server (X-Frame-Options/CSP)
  // ============================================================
  ENABLE_CLICKJACK_PROTECTION: true,

  // ============================================================
  // [FITUR 7] ENTRY GUARD — akses pertama wajib dari mukminnasri.com
  // ============================================================
  ENABLE_ENTRY_GUARD: true,
  ENTRY_GUARD_MAIN_SITE: "https://mukminnasri.com/",
  ENTRY_GUARD_REFERRER_PATTERNS: ["mukminnasri.com"],
  ENTRY_GUARD_PARAM: "from",
  ENTRY_GUARD_PARAM_VALUE: "main",
  ENTRY_GUARD_STORAGE_KEY: "sec_entry_verified",
  ENTRY_GUARD_TTL_MS: 24 * 60 * 60 * 1000, // 24 jam
  ENTRY_GUARD_WHITELIST_PATHS: [],         // mis. ["/login", "/api/"]
  ENTRY_GUARD_STRICT_MODE: false,

  // ============================================================
  // SECURITY LOG — catatan insiden (tidak menyimpan data sensitif)
  // ============================================================
  ENABLE_SECURITY_LOG: true,
  SECURITY_LOG_MAX_ENTRIES: 100,
  SECURITY_LOG_STORAGE_KEY: "sec_log",
  SECURITY_LOG_CONSOLE_MIRROR: false,   // true = juga print ke console

  // ============================================================
  // BEHAVIOR
  // ============================================================
  REDIRECT_DELAY_MS: 500,               // jeda sebelum redirect (biar log sempat flush)
  SUPPRESS_IN_DEV: false,               // true = matikan seluruh modul (dev only)

  // ============================================================
  // PESAN (Bahasa Indonesia)
  // ============================================================
  MESSAGES: {
    IDLE_TIMEOUT:       "Sesi berakhir karena tidak ada aktivitas selama 15 menit.",
    INVALID_SESSION:    "Sesi tidak valid. Silakan login kembali.",
    SESSION_CHANGED:    "Sesi ini telah digantikan oleh login lain.",
    TAMPERING_DETECTED: "Manipulasi terdeteksi. Akses dihentikan.",
    DEVTOOLS_DETECTED:  "DevTools terdeteksi. Mohon tutup untuk melanjutkan.",
    CLICKJACK_DETECTED: "Halaman ini tidak dapat di-embed.",
    SIGNED_OUT:         "Anda telah keluar.",
    ENTRY_GUARD:        "Akses pertama harus melalui website utama.",
  },
});
