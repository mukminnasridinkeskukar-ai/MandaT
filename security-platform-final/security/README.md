# 🔒 Security Module

Modul keamanan **standalone, modular, ringan** untuk platform web. Kompatibel dengan **GitHub Pages + Supabase** maupun platform PHP/Node sejenis.

> **Prinsip utama:** Tidak mengganggu platform existing. Tidak membuat loop tak terhingga. Tidak membebani browser. Defense-in-depth — keamanan sebenarnya tetap di server-side/RLS.

---

## 🚀 Cara Pakai (1 menit)

### Langkah 1 — Letakkan folder `security/` di root platform

```
public_html/                  ← root platform Anda
├── security/                 ← folder ini (hasil extract zip)
│   ├── security-config.js    ⭐ konfigurasi tunggal
│   ├── security-core.js      ⭐ orchestrator + secureLogout()
│   ├── session-monitor.js    # cek sesi Supabase/storage
│   ├── tab-browser-monitor.js # single-session antar tab
│   ├── devtools-protection.js # deteksi DevTools
│   ├── auto-logout.js        # idle 15 menit
│   └── README.md             # file ini
├── index.html
└── ... (file platform lain)
```

### Langkah 2 — Tambahkan 2 baris ini di halaman yang ingin diamankan

```html
<script src="security/security-config.js"></script>
<script src="security/security-core.js"></script>
```

**Selesai.** Semua fitur otomatis aktif. Sisanya dimuat otomatis oleh `security-core.js`.

> 💡 **Tip:** Letakkan 2 baris ini sebelum `</body>` agar tidak block rendering.

---

## ✨ Fitur yang Aktif

| Fitur | Status Default | Fungsi |
|-------|----------------|--------|
| **Auto Logout (15 menit idle)** | ✅ Aktif | Logout otomatis jika user idle 15 menit |
| **Session Monitor** | ✅ Aktif | Validasi sesi Supabase/storage setiap 60 detik |
| **Single Session / Tab Guard** | ✅ Aktif | Tab kedua di origin sama → logout |
| **DevTools Detection** | ✅ Aktif | Deteksi F12/DevTools (mode WARNING) |
| **Anti-Tampering** | ✅ Aktif | Cek modul tidak dimanipulasi (60 detik) |
| **Anti-Clickjacking** | ✅ Aktif | Break out dari iframe lintas origin |
| **Entry Guard** | ✅ Aktif | Akses pertama wajib dari mukminnasri.com |
| **Security Log** | ✅ Aktif | Catat insiden di sessionStorage |

---

## ⚙️ Konfigurasi

Semua parameter ada di `security-config.js`. Edit di sana, tidak perlu sentuh file lain.

### Konfigurasi Penting

```javascript
// Redirect target — semua kondisi keamanan akan ke sini
REDIRECT_URL: "https://mukminnasri.com/",

// Idle timeout
IDLE_TIMEOUT: 15 * 60 * 1000,        // 15 menit
IDLE_WARNING_BEFORE: 60 * 1000,      // warning 1 menit sebelum

// DevTools action: "WARNING" atau "LOGOUT"
DEVTOOLS_ACTION: "WARNING",

// Single session
ENABLE_SINGLE_SESSION: true,

// Entry Guard
ENABLE_ENTRY_GUARD: true,
ENTRY_GUARD_MAIN_SITE: "https://mukminnasri.com/",
```

### Matikan Fitur Tertentu

Edit `security-config.js`, set ke `false`:

```javascript
ENABLE_AUTO_LOGOUT: false,           // matikan idle timeout
ENABLE_SESSION_MONITOR: false,       // matikan cek sesi
ENABLE_SINGLE_SESSION: false,        // izinkan multi-tab
ENABLE_DEVTOOLS_DETECTION: false,    // matikan deteksi DevTools
ENABLE_ENTRY_GUARD: false,           // matikan wajib dari main site
```

---

## 🚪 Entry Guard — Akses Wajib dari mukminnasri.com

Modul memastikan akses pertama ke platform **WAJIB lewat `https://mukminnasri.com/`**.

### Alur:

```
User buka platform → cek berurutan:
1. Path masuk whitelist?           → ALLOW (skip)
2. ?sec.bypass=1 di URL?           → ALLOW (testing)
3. localStorage flag valid?        → ALLOW (24 jam terakhir)
4. document.referrer dari mukminnasri.com? → SET flag + ALLOW
5. ?from=main di URL?              → SET flag + ALLOW
6. Selain itu                      → REDIRECT ke mukminnasri.com/
```

### Cara Main Site Link ke Platform

Di `https://mukminnasri.com/`, link ke platform harus sertakan `?from=main`:

```html
<a href="https://platform-anda.com/dashboard?from=main">Buka Platform</a>
```

Setelah verifikasi, flag disimpan di localStorage (TTL 24 jam). User bisa navigasi bebas selama TTL belum habis.

### URL Parameter Testing

| Parameter | Efek |
|-----------|------|
| `?from=main` | Simulasi akses dari mukminnasri.com |
| `?sec.bypass=1` | Bypass Entry Guard sekali ini |
| `?sec.off=1` | (via SUPPRESS_IN_DEV) Matikan seluruh modul |

---

## 🛡️ secureLogout(reason) — Fungsi Pusat

Semua kondisi keamanan memanggil fungsi ini. **Idempoten** — tidak akan eksekusi 2x.

```javascript
secureLogout("IDLE_TIMEOUT");
secureLogout("INVALID_SESSION");
secureLogout("SESSION_CHANGED");
secureLogout("TAMPERING_DETECTED");
secureLogout("DEVTOOLS_DETECTED");
secureLogout("SIGNED_OUT");
```

### Yang dilakukan secureLogout:

1. ✅ Cegah eksekusi ganda (flag `loggedOut`)
2. ✅ Catat alasan ke security log (tanpa data sensitif)
3. ✅ Hentikan semua timer (clearInterval/clearTimeout)
4. ✅ Jalankan cleanup dari semua modul (removeEventListener)
5. ✅ Sign-out Supabase jika tersedia (`scope: 'local'`)
6. ✅ Bersihkan storage terkait keamanan (tidak hapus semua)
7. ✅ Redirect ke `REDIRECT_URL?reason=...&from=platform`

---

## 🔄 Auto Logout (Idle 15 Menit)

### Event yang Dipantau (Throttled 2 Detik)

- `mousemove`, `click`, `keydown`, `touchstart`, `scroll`
- `pointerdown`, `pointermove`

### Yang TIDAK Memicu Logout

- ✅ User pindah aplikasi sebentar (< 30 detik)
- ✅ User buka menu Start
- ✅ User menerima notifikasi
- ✅ User pindah window sebentar
- ✅ Tab di background (visibilitychange reset timer)

### Warning 1 Menit Sebelum Logout

Popup di pojok kanan bawah dengan countdown + tombol "Tetap Masuk".

---

## 🔄 Session Monitor

### Jika Pakai Supabase (auto-detected)

- Subscribe `supabase.auth.onAuthStateChange`
- Cek `getSession()` setiap 60 detik
- Saat user kembali ke tab setelah > 30 detik → re-validate
- Jika sesi hilang → `secureLogout('INVALID_SESSION')`

### Jika Tanpa Supabase

- Pantau sessionStorage/localStorage untuk key sesi umum
- Jika sebelumnya ada sesi lalu hilang → logout

### Yang TIDAK Memicu False Logout

- ✅ Network error transient (silent)
- ✅ Brief unfocus (< 30 detik)
- ✅ Tab di background

---

## 🔄 Tab Browser Monitor (Single Session)

### Strategi

- Tab pertama yang init → CLAIM master di localStorage
- Tab kedua di origin yang sama → terima YIELD → logout
- Heartbeat setiap 5 detik
- Master stale (> 15 detik tanpa heartbeat) → tab lain bisa claim

### Yang TIDAK Memicu False Logout

- ✅ Reload tab (sessionStorage preserve tab ID)
- ✅ Navigasi internal antar halaman
- ✅ Tab pause di background (heartbeat tetap jalan)

---

## 🛠️ DevTools Protection

### Metode Deteksi (TANPA Infinite Loop)

1. **Viewport size difference** — `outerWidth - innerWidth > 160px` (interval 5 detik)
2. **Debugger timing trap** — single `debugger` statement, cek delay (hanya mode LOGOUT)

### Action

- `"WARNING"` (default): Tampilkan overlay peringatan sekali per 30 detik
- `"LOGOUT"`: Picu `secureLogout('DEVTOOLS_DETECTED')`

### Yang TIDAK Dilakukan

- ❌ `while(true) {}` — merusak browser
- ❌ Infinite debugger loop — merusak UX
- ❌ Polling < 5 detik — membebani CPU

---

## 🛡️ Anti-Tampering

Cek setiap 60 detik:

1. `window.secureLogout` masih function?
2. `window.SecurityCore` masih `Object.isFrozen()`?
3. `SECURITY_CONFIG.REDIRECT_URL` masih sama dengan snapshot?

Jika ada yang berubah → log + (untuk kasus kritis) `secureLogout('TAMPERING_DETECTED')`.

---

## 🛡️ Anti-Clickjacking

- Jika di-iframe lintas origin → coba break out (`window.top.location = ...`)
- Jika tidak bisa → tampilkan overlay "403 Halaman ini tidak dapat di-embed"

**Penting:** Proteksi utama wajib via header server:

```apache
Header always set X-Frame-Options "SAMEORIGIN"
Header always set Content-Security-Policy "frame-ancestors 'self';"
```

---

## 📊 Security Log

Semua insiden dicatat di sessionStorage (key `sec_log`):

```javascript
// Lihat log via console
SecurityCore.getLog()

// Atau langsung baca sessionStorage
JSON.parse(sessionStorage.getItem('sec_log'))
```

### Field yang TIDAK Pernah Disimpan

- ❌ Password, token, secret, key, credential
- ❌ Data pribadi user
- ❌ Detail sesi Supabase

### Format Entry

```json
{
  "ts": 1695000000000,
  "event": "DEVTOOLS_DETECTED",
  "detail": "{\"method\":\"size_difference\",\"wDiff\":200}"
}
```

---

## 🐘 Integrasi dengan PHP/Platform Umum

### Pola 1: Header Global (rekomendasi)

```php
<!-- header.php — di-include di semua halaman -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title><?= $page_title ?? 'Platform' ?></title>
</head>
<body>
  <nav><!-- menu --></nav>
  <main>
    <!-- konten halaman -->

  <!-- Taruh di akhir body supaya tidak block render -->
  <script src="/security/security-config.js"></script>
  <script src="/security/security-core.js"></script>
</body>
</html>
```

### Pola 2: Hanya di Halaman Protected

```php
<?php
// dashboard.php
session_start();
if (!isset($_SESSION['user'])) {
    header('Location: /login.php');
    exit;
}
?>
<!DOCTYPE html>
<html>
<head><title>Dashboard</title></head>
<body>
  <h1>Dashboard</h1>

  <script src="/security/security-config.js"></script>
  <script src="/security/security-core.js"></script>
</body>
</html>
```

---

## ⚙️ Integrasi dengan Supabase

Modul akan **auto-detect** `window.supabase`. Jika ada:

1. Subscribe `onAuthStateChange` untuk event SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED
2. Cek `getSession()` setiap 60 detik
3. Saat `signOut({ scope: 'local' })` di secureLogout — hanya hapus sesi browser ini

### Yang TIDAK Dilakukan Modul

- ❌ Membuat sistem autentikasi kedua
- ❌ Menyimpan service role key
- ❌ Mengubah tabel/RLS Supabase
- ❌ Mengganggu alur login Supabase

### Jika Supabase Dimuat Setelah Modul

Modul akan retry deteksi setiap 10 detik (maks 6x = 60 detik). Setelah itu, modul tetap jalan tanpa integrasi Supabase.

---

## 🚨 Troubleshooting

### Modul Tidak Aktif

1. Cek `window.SECURITY_CONFIG` ada di console
2. Cek `window.SecurityCore` ada di console
3. Cek `window.secureLogout` adalah function
4. Cek console untuk error `[security] ...`

### Logout Terus-Menerus (False Positive)

1. Set `ENABLE_SINGLE_SESSION: false` (matikan tab guard)
2. Set `BRIEF_UNFOCUS_GRACE_MS: 5 * 60 * 1000` (5 menit grace)
3. Set `ENABLE_ENTRY_GUARD: false` (matikan entry guard)
4. Set `SUPPRESS_IN_DEV: true` untuk development

### DevTools Warning Terus Muncul

1. Set `DEVTOOLS_ACTION: "WARNING"` (default, tidak logout)
2. Set `ENABLE_DEVTOOLS_DETECTION: false` untuk matikan total
3. Set `DEVTOOLS_SIZE_THRESHOLD: 250` untuk kurang sensitif

### Tab Kedua Selalu Logout

1. Set `ENABLE_SINGLE_SESSION: false`
2. Atau tingkatkan `TAB_LOCK_TIMEOUT` ke 30 detik

---

## 🔒 Catatan Keamanan Penting

### Yang TIDAK Bisa Dilakukan Frontend

> **Semua kode JavaScript yang dikirim ke browser pada dasarnya dapat diperoleh oleh pengguna yang memiliki akses ke halaman.**

Modul ini **TIDAK mengklaim**:
- ❌ "Platform tidak dapat dibajak"
- ❌ "Script tidak dapat dilihat"
- ❌ "Kode 100% aman"

### Yang DILAKUKAN Modul

- ✅ Mencegah akses tidak sah via session monitoring
- ✅ Membatasi penyalahgunaan session (idle timeout, single tab)
- ✅ Mendeteksi manipulasi runtime (tamper detection)
- ✅ Mengurangi risiko duplikasi (entry guard)
- ✅ Menjaga integritas platform (clickjacking protection)
- ✅ Defense-in-depth — lapisan tambahan, bukan satu-satunya

### Prioritas Keamanan (Wajib Diimplementasikan di Server)

```
Server-side security        ← paling penting
        ↓
Authentication              ← Supabase Auth / session server
        ↓
Authorization / RLS         ← Supabase Row Level Security
        ↓
Session validation          ← server-side session check
        ↓
Client-side security monitoring  ← modul ini
        ↓
UI protection               ← modul ini
```

### Jangan Simpan di Frontend

- ❌ Supabase Service Role Key
- ❌ Password
- ❌ Private API key
- ❌ Encryption master key
- ❌ Credential administrator

Frontend hanya boleh pakai credential yang aman untuk client-side (anon key Supabase, dll).

---

## 📋 Struktur File

```
security/
├── security-config.js        ⭐ Konfigurasi tunggal (edit di sini)
├── security-core.js          ⭐ Orchestrator + secureLogout()
├── session-monitor.js        # Cek sesi Supabase/storage
├── tab-browser-monitor.js    # Single-session antar tab
├── devtools-protection.js    # Deteksi DevTools (WARNING/LOGOUT)
├── auto-logout.js            # Idle 15 menit + warning
└── README.md                 # File ini
```

### Dependency Graph

```
security-config.js  (harus dimuat pertama)
        ↓
security-core.js    (orchestrator, dimuat kedua)
        ↓ auto-load
    ├── session-monitor.js
    ├── tab-browser-monitor.js
    ├── auto-logout.js
    └── devtools-protection.js
```

---

## 📜 Lisensi

MIT — bebas dipakai untuk platform pribadi maupun komersial.

---

## 🤝 Kontribusi

Pull request welcome. Pastikan:
- ✅ Tidak ada infinite loop
- ✅ Timer minimal 5 detik
- ✅ Setiap modul bisa di-cleanup
- ✅ Tidak menyimpan data sensitif di log
- ✅ Tidak mengganggu platform existing
