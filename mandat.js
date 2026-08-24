/**
 * MandaT - Manajemen Data SDM Kesehatan
 * Main JavaScript File with Supabase Integration & Optional Admin Auth
 * 
 * Architecture:
 * - Bagian 1 (Dashboard) & Bagian 2 (Layanan): PUBLIC ACCESS (No Login Required)
 * - Bagian 3 (Panel Admin): REQUIRES LOGIN (Role-Based Access Control)
 * 
 * Configuration: Update SUPABASE_URL and SUPABASE_ANON_KEY below
 */

// ============ SUPABASE CONFIGURATION ============
// TODO: Replace with your actual Supabase credentials
const SUPABASE_URL = 'https://ftsqrfqsbhwivyphogbv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0c3FyZnFzYmh3aXZ5cGhvZ2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjE0MDQsImV4cCI6MjEwMzEzNzQwNH0.Zb_ukPoJXfDFzfSS--at4CDBK7VI2_-gLU6N7BVnoCs';

// Initialize Supabase Client
let supabaseClient = null;

function initSupabase() {
    if (SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase initialized successfully');
        return true;
    } else {
        console.warn('⚠️ Supabase not configured. Using demo mode.');
        initDemoData();
        return false;
    }
}

// ============ AUTHENTICATION & USER MANAGEMENT (Admin Only) ============

// User Roles Definition
const ROLES = {
    SUPER_ADMIN: 'super_admin',  // Full access to everything
    OPERATOR: 'operator',        // Access to Dashboard (view) + Data SDMK (CRUD)
    DOKTER: 'dokter',            // Access to Dashboard (view) + Dokter Spesialis & TPM (CRUD)
    VIEWER: 'viewer'             // Read-only access (legacy)
};

// Role Permissions Map (For Admin Panel Only)
const ROLE_PERMISSIONS = {
    [ROLES.SUPER_ADMIN]: {
        admin: true  // Super admin has full admin access
    },
    
    [ROLES.OPERATOR]: {
        'admin-data-sdmk': ['create', 'edit', 'delete'],
        'admin-rasio': ['view'],
        'admin-distribusi': ['view'],
        'admin-profil-faskes': ['view']
    },
    
    [ROLES.DOKTER]: {
        'admin-dokter-spesialis': ['create', 'edit', 'delete'],
        'admin-tpm': ['create', 'edit', 'delete'],
        'admin-rasio': ['view'],
        'admin-distribusi': ['view']
    },
    
    [ROLES.VIEWER]: {}
};

// Current User Session (null = not logged in / guest mode)
let currentUser = null;

// Demo Users Database (used when Supabase is not configured)
const DEMO_USERS = [
    { id: 1, username: 'superadmin', password: 'super123', role: ROLES.SUPER_ADMIN, nama: 'Super Administrator', status: 'aktif' },
    { id: 2, username: 'operator', password: 'op123', role: ROLES.OPERATOR, nama: 'Operator Dinkes', status: 'aktif' },
    { id: 3, username: 'dokter', password: 'doc123', role: ROLES.DOKTER, nama: 'dr. Ahmad Fauzi', status: 'aktif' },
    { id: 4, username: 'viewer', password: 'view123', role: ROLES.VIEWER, nama: 'Viewer Umum', status: 'aktif' }
];

// ============ AUTHENTICATION FUNCTIONS (Admin Only) ============

/**
 * Handle login form submission (for admin panel access)
 */
async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const loginBtn = document.getElementById('loginBtn');
    const loginError = document.getElementById('loginError');
    const loginErrorMsg = document.getElementById('loginErrorMsg');
    
    // Disable button and show loading state
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    loginError.classList.remove('show');
    
    try {
        let user = null;
        
        if (supabaseClient) {
            const { data, error } = await supabaseClient
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .eq('status', 'aktif')
                .single();
            
            if (error) throw error;
            user = data;
        } else {
            // Demo mode authentication
            await new Promise(resolve => setTimeout(resolve, 800));
            
            user = DEMO_USERS.find(u => u.username === username && u.password === password);
            
            if (!user) {
                throw new Error('INVALID_CREDENTIALS');
            }
        }
        
        // Set session
        setSession(user);
        
        // Close modal and unlock admin panel
        closeLoginModal();
        unlockAdminPanel(user);
        
        showToast(`Selamat datang, ${user.nama}!`, 'success');
        
    } catch (error) {
        console.error('Login error:', error);
        
        if (error.message === 'INVALID_CREDENTIALS') {
            loginErrorMsg.textContent = 'Username atau password salah!';
        } else {
            loginErrorMsg.textContent = 'Terjadi kesalahan. Silakan coba lagi.';
        }
        
        loginError.classList.add('show');
        
        // Re-enable button
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Masuk ke Panel Admin';
    }
}

/**
 * Quick login for demo accounts
 */
function quickLogin(username, password) {
    document.getElementById('loginUsername').value = username;
    document.getElementById('loginPassword').value = password;
    handleLogin(new Event('submit'));
}

/**
 * Open login modal
 */
function openLoginModal() {
    document.getElementById('loginModal').classList.add('active');
    document.getElementById('loginUsername').focus();
}

/**
 * Close login modal
 */
function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('active');
    document.getElementById('loginForm').reset();
    document.getElementById('loginError').classList.remove('show');
}

/**
 * Set user session in localStorage
 */
function setSession(user) {
    currentUser = user;
    
    const sessionData = {
        userId: user.id,
        username: user.username,
        nama: user.nama,
        role: user.role,
        loginTime: new Date().toISOString()
    };
    
    localStorage.setItem('mandat_admin_session', JSON.stringify(sessionData));
    
    console.log(`🔐 Admin session created: ${user.nama} (${user.role})`);
}

/**
 * Get current admin session from localStorage
 */
function getAdminSession() {
    const sessionStr = localStorage.getItem('mandat_admin_session');
    if (sessionStr) {
        try {
            return JSON.parse(sessionStr);
        } catch (e) {
            clearSession();
        }
    }
    return null;
}

/**
 * Clear user session
 */
function clearSession() {
    currentUser = null;
    localStorage.removeItem('mandat_admin_session');
    console.log('🚪 Admin session cleared');
}

/**
 * Handle logout
 */
function handleLogout() {
    if (!confirm('Apakah Anda yakin ingin logout dari Panel Admin?')) return;
    
    clearSession();
    lockAdminPanel();
    
    showToast('Anda telah logout dari Panel Admin', 'info');
    
    // Go back to dashboard
    loadPage('dashboard');
}

/**
 * Check if user has specific permission (for admin pages only)
 */
function hasPermission(resource, action = 'view') {
    if (!currentUser) return false;
    
    const permissions = ROLE_PERMISSIONS[currentUser.role];
    if (!permissions || permissions.admin === true) return Boolean(permissions.admin);
    
    const resourcePerms = permissions[resource] || permissions[`admin-${resource}`];
    
    if (resourcePerms === undefined) return false;
    if (Array.isArray(resourcePerms)) {
        return resourcePerms.includes(action);
    }
    
    return Boolean(resourcePerms);
}

/**
 * Check if user can access admin panel for specific table
 */
function canAccessAdmin(table) {
    if (!currentUser) return false;
    
    const permissions = ROLE_PERMISSIONS[currentUser.role];
    if (!permissions) return false;
    
    if (permissions.admin === true) return true;
    
    return permissions[`admin-${table}`] || permissions[table];
}

/**
 * Unlock admin panel after successful login
 */
function unlockAdminPanel(user) {
    // Show unlocked state
    document.getElementById('adminLockedState').style.display = 'none';
    document.getElementById('adminUnlockedState').style.display = 'block';
    
    // Show user session bar in sidebar
    document.getElementById('userSessionBar').classList.add('active');
    
    // Update sidebar user info
    const initial = user.nama.charAt(0).toUpperCase();
    const roleLabels = {
        [ROLES.SUPER_ADMIN]: 'Super Admin',
        [ROLES.OPERATOR]: 'Operator',
        [ROLES.DOKTER]: 'Dokter'
    };
    const roleClasses = {
        [ROLES.SUPER_ADMIN]: 'role-super-admin',
        [ROLES.OPERATOR]: 'role-operator',
        [ROLES.DOKTER]: 'role-dokter'
    };
    
    document.getElementById('sessionAvatar').textContent = initial;
    document.getElementById('sessionName').textContent = user.nama;
    document.getElementById('sessionRole').textContent = roleLabels[user.role] || user.role;
    
    // Update admin badge
    const adminBadge = document.getElementById('adminRoleBadge');
    adminBadge.textContent = roleLabels[user.role] || user.role;
    adminBadge.className = `role-indicator-inline ${roleClasses[user.role] || ''}`;
    
    // Update topbar - show logged in state
    document.getElementById('guestBadge').style.display = 'none';
    document.getElementById('loggedInState').style.display = 'flex';
    document.getElementById('topbarUserAvatar').textContent = initial;
    document.getElementById('topbarUserName').textContent = user.nama;
    
    const topbarRoleBadge = document.getElementById('topbarUserRole');
    topbarRoleBadge.textContent = roleLabels[user.role] || user.role;
    topbarRoleBadge.className = `role-indicator-inline ${roleClasses[user.role] || ''}`;
    
    // Update menu visibility based on role
    updateSidebarPermissions(user.role);
}

/**
 * Lock admin panel (logout state)
 */
function lockAdminPanel() {
    // Show locked state
    document.getElementById('adminLockedState').style.display = 'block';
    document.getElementById('adminUnlockedState').style.display = 'none';
    
    // Hide user session bar
    document.getElementById('userSessionBar').classList.remove('active');
    
    // Update topbar - show guest state
    document.getElementById('guestBadge').style.display = 'flex';
    document.getElementById('loggedInState').style.display = 'none';
    
    // Reset all admin menu items to hidden
    document.querySelectorAll('#adminUnlockedState .sidebar-menu-item').forEach(item => {
        item.classList.add('hidden-item');
    });
}

/**
 * Update sidebar admin menu visibility based on role
 */
function updateSidebarPermissions(role) {
    const menuItems = document.querySelectorAll('#adminUnlockedState .sidebar-menu-item[data-permission]');
    
    menuItems.forEach(item => {
        const allowedRoles = item.getAttribute('data-roles')?.split(',') || [];
        
        if (allowedRoles.includes(role)) {
            item.classList.remove('hidden-item');
        } else {
            item.classList.add('hidden-item');
        }
    });
}

/**
 * Restore admin session on page load (if exists)
 */
function restoreAdminSession() {
    const session = getAdminSession();
    
    if (session) {
        // Find user data
        let user = null;
        
        if (supabaseClient) {
            // Would need async call, simplified here
            user = {
                id: session.userId,
                username: session.username,
                nama: session.nama,
                role: session.role
            };
        } else {
            user = DEMO_USERS.find(u => u.id === session.userId);
        }
        
        if (user) {
            currentUser = user;
            unlockAdminPanel(user);
            console.log(`🔓 Admin session restored: ${user.nama}`);
            return true;
        }
    }
    
    return false;
}

// ============ DEMO DATA (Used when Supabase is not configured) ============
let demoData = {
    dashboard: [
        { metric: 'total_sdmk', value: 1250, updated: '2026-08-24' },
        { metric: 'total_dokter', value: 185, updated: '2026-08-24' },
        { metric: 'total_perawat', value: 420, updated: '2026-08-24' }
    ],
    pengumuman: [
        { id: 1, tanggal: '2026-08-20', judul: 'Pendaftaran Ulang SIP Dokter', isi: 'Diberitahukan kepada seluruh dokter untuk segera melakukan pendaftaran ulang SIP sebelum tanggal 30 September 2026.', status: 'aktif' },
        { id: 2, tanggal: '2026-08-18', judul: 'Pelatihan Pelayanan Prima', isi: 'Pelatihan pelayanan prima akan diselenggarakan pada tanggal 5 September 2026 di Aula Dinas Kesehatan.', status: 'aktif' },
        { id: 3, tanggal: '2026-08-15', judul: 'Update Data Kepegawaian', isi: 'Seluruh tenaga kesehatan diharapkan memperbarui data kepegawaian melalui sistem MandaT.', status: 'nonaktif' }
    ],
    renbut: [
        { id: 1, nama_unit: 'Puskesmas Kota', jenis: 'Dokter Umum', kebutuhan: 15, existing: 12, kekurangan: 3, prioritas: 'Tinggi', tahun: 2026, keterangan: 'Kurang dokter spesialis' },
        { id: 2, nama_unit: 'RSUD Utama', jenis: 'Perawat', kebutuhan: 50, existing: 45, kekurangan: 5, prioritas: 'Sedang', tahun: 2026, keterangan: 'Butuh perawat ICU' },
        { id: 3, nama_unit: 'Puskesmas Pembantu', jenis: 'Bidan', kebutuhan: 20, existing: 18, kekurangan: 2, prioritas: 'Rendah', tahun: 2026, keterangan: '' }
    ],
    anjab_abk: [
        { id: 1, jabatan: 'Dokter Spesialis', unit: 'RSUD Utama', beban: 40, kebutuhan: 10, existing: 8, gap: 2, dokumen: 'SK Bupati No. 44/2026' },
        { id: 2, jabatan: 'Perawat', unit: 'RSUD Utama', beban: 35, kebutuhan: 50, existing: 45, gap: 5, dokumen: 'SK Bupati No. 45/2026' },
        { id: 3, jabatan: 'Bidan', unit: 'Puskesmas Kota', beban: 30, kebutuhan: 25, existing: 22, gap: 3, dokumen: 'SK Bupati No. 46/2026' }
    ],
    bezetting: [
        { id: 1, unit_kerja: 'RSUD Utama', download_bazetting: 'bezetting_rsud.pdf', updated_tahun: 2026 },
        { id: 2, unit_kerja: 'Puskesmas Kota', download_bazetting: 'bezetting_puskesmas.pdf', updated_tahun: 2026 }
    ],
    dokter_spesialis: [
        { id: 1, nama_lengkap: 'dr. Ahmad Fauzi, Sp.PD', unit_kerja: 'RSUD Utama', spesialisasi: 'Penyakit Dalam', jenis_kelamin: 'Laki-laki', nomor_STR: 'STR-001234', nomor_SIP: 'SIP-001234', tanggal_SIP_Expired: '2027-06-15', status_pegawai: 'PNS', NIK: '3201010101010001', NIP: '198501012010011001', praktik_ke_1: 'Klinik Sehat', praktik_ke_2: '-', praktik_ke_3: '-' },
        { id: 2, nama_lengkap: 'dr. Siti Nurhaliza, Sp.OG', unit_kerja: 'RSUD Utama', spesialisasi: 'Obstetri & Ginekologi', jenis_kelamin: 'Perempuan', nomor_STR: 'STR-002345', nomor_SIP: 'SIP-002345', tanggal_SIP_Expired: '2027-03-20', status_pegawai: 'PNS', NIK: '3201010202010002', NIP: '198802022012022002', praktik_ke_1: 'RS Permata', praktik_ke_2: '-', praktik_ke_3: '-' },
        { id: 3, nama_lengkap: 'dr. Budi Santoso, Sp.An', unit_kerja: 'RSUD Utama', spesialisasi: 'Anestesi', jenis_kelamin: 'Laki-laki', nomor_STR: 'STR-003456', nomor_SIP: 'SIP-003456', tanggal_SIP_Expired: '2026-12-10', status_pegawai: 'PPPK', NIK: '3201010303030003', NIP: '-', praktik_ke_1: '-', praktik_ke_2: '-', praktik_ke_3: '-' }
    ],
    rasio: [
        { id: 1, kec: 'Kecamatan A', penduduk: 45000, dokter_spesialis_kklip: 12, dokter: 25, dokter_gigi: 8, perawat: 85, bidan: 45, apoteker: 10, tenaga_promosi_kesehatan_dan_ilmu_perilaku: 15, epidemiolog_kesehatan: 3, tenaga_sanitasi_lingkungan: 12, nutrisionis: 8, tenaga_teknologi_laboratorium_medik: 18, psikolog_klinis: 4, fisioterapis: 6, terapis_gigi_dan_mulut: 5 },
        { id: 2, kec: 'Kecamatan B', penduduk: 38000, dokter_spesialis_kklip: 8, dokter: 18, dokter_gigi: 6, perawat: 65, bidan: 38, apoteker: 7, tenaga_promosi_kesehatan_dan_ilmu_perilaku: 12, epidemiolog_kesehatan: 2, tenaga_sanitasi_lingkungan: 9, nutrisionis: 6, tenaga_teknologi_laboratorium_medik: 14, psikolog_klinis: 3, fisioterapis: 4, terapis_gigi_dan_mulut: 3 },
        { id: 3, kec: 'Kecamatan C', penduduk: 52000, dokter_spesialis_kklip: 15, dokter: 32, dokter_gigi: 10, perawat: 95, bidan: 52, apoteker: 12, tenaga_promosi_kesehatan_dan_ilmu_perilaku: 18, epidemiolog_kesehatan: 4, tenaga_sanitasi_lingkungan: 14, nutrisionis: 10, tenaga_teknologi_laboratorium_medik: 22, psikolog_klinis: 5, fisioterapis: 8, terapis_gigi_dan_mulut: 6 }
    ],
    distribusi: [
        { id: 1, kecamatan: 'Kecamatan A', total: 190, dokter: 37, perawat: 85, bidan: 45, nakes_lainnya: 23, lat: -6.9175, lng: 107.6191 },
        { id: 2, kecamatan: 'Kecamatan B', total: 148, dokter: 26, perawat: 65, bidan: 38, nakes_lainnya: 19, lat: -6.9275, lng: 107.6291 },
        { id: 3, kecamatan: 'Kecamatan C', total: 235, dokter: 47, perawat: 95, bidan: 52, nakes_lainnya: 41, lat: -6.9075, lng: 107.6091 }
    ],
    profil_faskes: [
        { id: 1, kode_unit: 'F001', nama_fasyankes: 'RSUD Utama', jenis: 'Rumah Sakit', kecamatan: 'Kecamatan A', desa_kelurahan: 'Kelurahan Kota', alamat: 'Jl. Kesehatan No. 1', kepala: 'dr. Rina Marlina', maps: 'https://maps.example.com/rsud', nomor_telpon: '021-12345678', email: 'info@rsud.go.id', alamat_website: 'www.rsud.go.id' },
        { id: 2, kode_unit: 'F002', nama_fasyankes: 'Puskesmas Kota', jenis: 'Puskesmas', kecamatan: 'Kecamatan A', desa_kelurahan: 'Kelurahan Kota', alamat: 'Jl. Merdeka No. 10', kepala: 'dr. Joko Widodo', maps: 'https://maps.example.com/puskesmas', nomor_telpon: '021-87654321', email: 'puskesmas@dinkes.go.id', alamat_website: '-' },
        { id: 3, kode_unit: 'F003', nama_fasyankes: 'Klinik Pratama Sehat', jenis: 'Klinik', kecamatan: 'Kecamatan B', desa_kelurahan: 'Desa Makmur', alamat: 'Jl. Raya Desa No. 5', kepala: 'dr. Dewi Lestari', maps: 'https://maps.example.com/klinik', nomor_telpon: '021-11223344', email: 'kliniksehat@gmail.com', alamat_website: '-' }
    ],
    tpm: [
        { id: 1, foto: '', nama_lengkap: 'dr. Ahmad Fauzi, Sp.PD', jenis_profesi: 'Dokter Spesialis', nama_praktik_mandiri: 'Praktik dr. Ahmad', alamat: 'Jl. Sudirman No. 25', maps: 'https://maps.example.com/praktik1', jam_praktik: 'Senin-Sabtu, 17.00-20.00 WIB', nomor_telpon: '08123456789', tanggal_terbit_sip: '2024-01-15', tanggal_expired_sip: '2027-01-15', link_sip_mandiri: '#' },
        { id: 2, foto: '', nama_lengkap: 'drg. Maya Sari', jenis_profesi: 'Dokter Gigi', nama_praktik_mandiri: 'Klinik Gigi Maya', alamat: 'Jl. Gatot Subroto No. 15', maps: 'https://maps.example.com/praktik2', jam_praktik: 'Selasa-Minggu, 10.00-14.00 WIB', nomor_telpon: '08234567890', tanggal_terbit_sip: '2024-03-20', tanggal_expired_sip: '2027-03-20', link_sip_mandiri: '#' },
        { id: 3, foto: '', nama_lengkap: 'Bidan Ratna Dewi', jenis_profesi: 'Bidan', nama_praktik_mandiri: 'Praktik Bidan Ratna', alamat: 'Jl. Ahmad Yani No. 8', maps: 'https://maps.example.com/praktik3', jam_praktik: 'Setiap Hari, 08.00-15.00 WIB', nomor_telpon: '08345678901', tanggal_terbit_sip: '2024-06-10', tanggal_expired_sip: '2027-06-10', link_sip_mandiri: '#' }
    ],
    users: [
        { id: 1, username: 'superadmin', password: 'super123', role: 'super_admin', nama: 'Super Administrator', status: 'aktif' },
        { id: 2, username: 'operator', password: 'op123', role: 'operator', nama: 'Operator Dinkes', status: 'aktif' },
        { id: 3, username: 'dokter', password: 'doc123', role: 'dokter', nama: 'dr. Ahmad Fauzi', status: 'aktif' },
        { id: 4, username: 'viewer', password: 'view123', role: 'viewer', nama: 'Viewer Umum', status: 'aktif' }
    ],
    data_sdmk: [
        { id: 1, nik: '3201010101010001', nama_lengkap: 'Ahmad Fauzi', nip: '198501012010011001', jenis_tenaga: 'Dokter Spesialis', pendidikan: 'S2 Kedokteran', unit_kerja: 'RSUD Utama', status_kepegawaian: 'PNS', tanggal_mulai: '2010-01-15', no_telepon: '08123456789', alamat: 'Jl. Merdeka No. 1' },
        { id: 2, nik: '3201010202010002', nama_lengkap: 'Siti Nurhaliza', nip: '198802022012022002', jenis_tenaga: 'Dokter Spesialis', pendidikan: 'S2 Kedokteran', unit_kerja: 'RSUD Utama', status_kepegawaian: 'PNS', tanggal_mulai: '2012-02-01', no_telepon: '08234567890', alamat: 'Jl. Sudirman No. 5' },
        { id: 3, nik: '3201010303030003', nama_lengkap: 'Budi Santoso', nip: '-', jenis_tenaga: 'Dokter Spesialis', pendidikan: 'S1 Kedokteran', unit_kerja: 'RSUD Utama', status_kepegawaian: 'PPPK', tanggal_mulai: '2020-05-15', no_telepon: '08345678901', alamat: 'Jl. Gatot Subroto No. 10' }
    ]
};

function initDemoData() {
    console.log('📊 Demo mode activated with sample data');
}

// ============ STATE MANAGEMENT ============
let currentPage = 'dashboard';
let currentTable = '';
let editingId = null;

// ============ PAGE TITLES ============
const pageTitles = {
    'dashboard': 'Dashboard',
    'pengumuman': 'Pengumuman',
    'renbut': 'Kebutuhan Personil (Renbut)',
    'anjab-abk': 'Analisis Jabatan & Beban Kerja (Anjab-ABK)',
    'bezetting': 'Bezetting',
    'dokter-spesialis': 'Data Dokter Spesialis',
    'rasio': 'Rasio Tenaga Kesehatan',
    'distribusi': 'Distribusi Tenaga Kesehatan',
    'profil-faskes': 'Profil Fasilitas Kesehatan',
    'tpm': 'Tempat Praktik Mandiri',
    'admin-dashboard': 'Admin - Dashboard',
    'admin-pengumuman': 'Admin - Pengumuman',
    'admin-renbut': 'Admin - Renbut',
    'admin-anjab-abk': 'Admin - Anjab-ABK',
    'admin-bezetting': 'Admin - Bezetting',
    'admin-dokter-spesialis': 'Admin - Dokter Spesialis',
    'admin-rasio': 'Admin - Rasio',
    'admin-distribusi': 'Admin - Distribusi',
    'admin-profil-faskes': 'Admin - Profil Faskes',
    'admin-tpm': 'Admin - Tempat Praktik Mandiri',
    'admin-users': 'Admin - Kelola Users',
    'admin-data-sdmk': 'Admin - Data SDMK'
};

// ============ CARD COLORS ============
const cardColors = ['blue', 'green', 'orange', 'purple', 'pink', 'teal', 'red', 'indigo', 'cyan', 'amber'];

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Supabase
    initSupabase();
    
    // Try to restore admin session (optional)
    restoreAdminSession();
    
    // Setup Event Listeners
    setupEventListeners();
    
    // Start landing page timer (3 seconds then show app)
    setTimeout(() => {
        document.getElementById('landingPage').classList.add('hidden');
        document.getElementById('appContainer').classList.add('active');
        loadPage('dashboard');
    }, 3000);
});

// ============ EVENT LISTENERS ============
function setupEventListeners() {
    // Menu Toggle (Mobile)
    document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
    document.getElementById('sidebarOverlay').addEventListener('click', toggleSidebar);

    // Sidebar Menu Links
    document.querySelectorAll('.sidebar-menu-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            
            // Check if this is an admin page
            const isAdminPage = page.startsWith('admin-');
            
            if (isAdminPage) {
                // Check if user is logged in
                if (!currentUser) {
                    // Not logged in - show login modal
                    showToast('Silakan login terlebihulu untuk mengakses Panel Admin', 'warning');
                    openLoginModal();
                    return;
                }
                
                // Check permission
                const resource = page.replace('admin-', '');
                if (!canAccessAdmin(resource)) {
                    showToast('Anda tidak memiliki akses ke halaman ini!', 'warning');
                    return;
                }
            }
            
            // Update active state
            document.querySelectorAll('.sidebar-menu-link').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Load page
            loadPage(page);
            
            // Close sidebar on mobile
            if (window.innerWidth <= 1024) {
                toggleSidebar();
            }
        });
    });

    // Close modals on overlay click
    document.getElementById('modal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
    
    document.getElementById('lightbox').addEventListener('click', function(e) {
        if (e.target === this) closeLightbox();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
            closeLightbox();
            closeLoginModal();
        }
    });
}

// ============ SIDEBAR TOGGLE ============
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

// ============ PAGE LOADER ============
async function loadPage(page) {
    currentPage = page;
    
    // Update title
    document.getElementById('pageTitle').textContent = pageTitles[page] || 'Dashboard';
    
    const contentArea = document.getElementById('contentArea');
    
    // Show loading state
    contentArea.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; min-height: 400px;">
            <div style="text-align: center;">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: var(--secondary);"></i>
                <p style="margin-top: 15px; color: var(--text-secondary);">Memuat data...</p>
            </div>
        </div>
    `;

    try {
        let html = '';
        
        switch(page) {
            case 'dashboard':
            case 'admin-dashboard':
                html = await renderDashboard();
                break;
            case 'pengumuman':
                html = await renderPengumuman(false);
                break;
            case 'admin-pengumuman':
                html = await renderPengumuman(true);
                break;
            case 'renbut':
                html = await renderRenbut(false);
                break;
            case 'admin-renbut':
                html = await renderRenbut(true);
                break;
            case 'anjab-abk':
                html = await renderAnjabAbk(false);
                break;
            case 'admin-anjab-abk':
                html = await renderAnjabAbk(true);
                break;
            case 'bezetting':
                html = await renderBezetting(false);
                break;
            case 'admin-bezetting':
                html = await renderBezetting(true);
                break;
            case 'dokter-spesialis':
                html = await renderDokterSpesialis(false);
                break;
            case 'admin-dokter-spesialis':
                html = await renderDokterSpesialis(true);
                break;
            case 'rasio':
                html = await renderRasio(false);
                break;
            case 'admin-rasio':
                html = await renderRasio(true);
                break;
            case 'distribusi':
                html = await renderDistribusi(false);
                break;
            case 'admin-distribusi':
                html = await renderDistribusi(true);
                break;
            case 'profil-faskes':
                html = await renderProfilFaskes(false);
                break;
            case 'admin-profil-faskes':
                html = await renderProfilFaskes(true);
                break;
            case 'tpm':
                html = await renderTPM(false);
                break;
            case 'admin-tpm':
                html = await renderTPM(true);
                break;
            case 'admin-users':
                html = await renderUsers();
                break;
            case 'admin-data-sdmk':
                html = await renderDataSDMK();
                break;
            default:
                html = '<div class="empty-state"><i class="fas fa-folder-open"></i><h3>Halaman tidak ditemukan</h3></div>';
        }
        
        contentArea.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading page:', error);
        contentArea.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i>
                <h3>Error Memuat Data</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// ============ ACCESS DENIED RENDERER ============
function renderAccessDenied() {
    return `
        <div class="access-denied">
            <div class="access-denied-icon">
                <i class="fas fa-lock"></i>
            </div>
            <h2>Akses Ditolak</h2>
            <p>Anda tidak memiliki izin untuk mengakses halaman ini.</p>
            <p style="font-size: 0.9rem;">Hubungi administrator untuk mendapatkan akses.</p>
            <button class="btn btn-primary" onclick="loadPage('dashboard')" style="margin-top: 20px;">
                <i class="fas fa-home"></i> Kembali ke Dashboard
            </button>
        </div>
    `;
}

// ============ DATA FETCHING ============
async function fetchData(table) {
    if (supabaseClient) {
        const { data, error } = await supabaseClient.from(table).select('*');
        if (error) throw error;
        return data || [];
    }
    return demoData[table] || [];
}

// ============ RENDER FUNCTIONS ============

// Dashboard (Public - Always accessible)
async function renderDashboard() {
    const dashboardData = await fetchData('dashboard');
    
    const metrics = {
        total_sdmk: dashboardData.find(d => d.metric === 'total_sdmk')?.value || 0,
        total_dokter: dashboardData.find(d => d.metric === 'total_dokter')?.value || 0,
        total_perawat: dashboardData.find(d => d.metric === 'total_perawat')?.value || 0,
        total_faskes: 25,
        total_puskesmas: 12,
        total_tpm: 48
    };

    // Add welcome message based on auth state
    let welcomeMessage = '';
    if (currentUser) {
        const roleMessages = {
            [ROLES.SUPER_ADMIN]: 'Selamat datang, Administrator! Anda memiliki akses penuh.',
            [ROLES.OPERATOR]: 'Selamat datang! Anda dapat mengelola Data SDMK.',
            [ROLES.DOKTER]: 'Selamat datang, Dokter! Anda dapat mengelola data Dokter Spesialis & TPM.'
        };
        welcomeMessage = roleMessages[currentUser.role] || '';
    }

    return `
        ${welcomeMessage ? `
        <div class="view-container" style="margin-bottom: 25px; background: linear-gradient(135deg, #f0fdf4, #dcfce7); border-left: 4px solid var(--success);">
            <div style="display: flex; align-items: center; gap: 15px;">
                <i class="fas fa-user-check" style="font-size: 2rem; color: var(--success);"></i>
                <div>
                    <strong style="color: var(--success);">${welcomeMessage}</strong>
                    <p style="margin-top: 5px; font-size: 0.9rem; color: var(--text-secondary);">
                        Role: <span class="role-indicator-inline ${currentUser.role === ROLES.SUPER_ADMIN ? 'role-super-admin' : currentUser.role === ROLES.OPERATOR ? 'role-operator' : 'role-dokter'}">${currentUser.role}</span>
                    </p>
                </div>
            </div>
        </div>
        ` : ''}
        
        <div class="dashboard-grid">
            <div class="stat-card blue">
                <div class="stat-icon"><i class="fas fa-users"></i></div>
                <div class="stat-info">
                    <h3>Total SDMK</h3>
                    <p>${metrics.total_sdmk.toLocaleString()}</p>
                </div>
            </div>
            <div class="stat-card green">
                <div class="stat-icon"><i class="fas fa-user-md"></i></div>
                <div class="stat-info">
                    <h3>Total Dokter</h3>
                    <p>${metrics.total_dokter.toLocaleString()}</p>
                </div>
            </div>
            <div class="stat-card orange">
                <div class="stat-icon"><i class="fas fa-user-nurse"></i></div>
                <div class="stat-info">
                    <h3>Total Perawat</h3>
                    <p>${metrics.total_perawat.toLocaleString()}</p>
                </div>
            </div>
            <div class="stat-card purple">
                <div class="stat-icon"><i class="fas fa-hospital"></i></div>
                <div class="stat-info">
                    <h3>Fasilitas Kesehatan</h3>
                    <p>${metrics.total_faskes}</p>
                </div>
            </div>
            <div class="stat-card pink">
                <div class="stat-icon"><i class="fas fa-clinic-medical"></i></div>
                <div class="stat-info">
                    <h3>Puskesmas</h3>
                    <p>${metrics.total_puskesmas}</p>
                </div>
            </div>
            <div class="stat-card teal">
                <div class="stat-icon"><i class="fas fa-stethoscope"></i></div>
                <div class="stat-info">
                    <h3>Praktik Mandiri</h3>
                    <p>${metrics.total_tpm}</p>
                </div>
            </div>
        </div>

        <div class="table-container" style="margin-top: 25px;">
            <div class="table-header">
                <div class="table-title">
                    <i class="fas fa-bullhorn" style="color: var(--secondary);"></i> Pengumuman Terbaru
                </div>
            </div>
            <div class="announcement-grid" style="padding: 20px;">
                ${await renderRecentAnnouncements()}
            </div>
        </div>
    `;
}

async function renderRecentAnnouncements() {
    const data = await fetchData('pengumuman');
    const recent = data.slice(0, 3);
    
    if (recent.length === 0) {
        return '<div class="empty-state"><i class="fas fa-bell-slash"></i><h3>Belum ada pengumuman</h3></div>';
    }

    return recent.map((item, index) => `
        <div class="announcement-card ${cardColors[index % cardColors.length]}">
            <div class="announcement-card-header">
                <div class="announcement-date">
                    <i class="fas fa-calendar-alt"></i>
                    ${formatDate(item.tanggal)}
                </div>
            </div>
            <div class="announcement-card-body">
                <h4>${item.judul}</h4>
                <p>${truncateText(item.isi, 100)}</p>
            </div>
        </div>
    `).join('');
}

// Pengumuman (Public View vs Admin CRUD)
async function renderPengumuman(isAdmin) {
    const data = await fetchdata('pengumuman');
    const canEdit = isAdmin && hasPermission('pengumuman', 'edit');
    const canDelete = isAdmin && hasPermission('pengumuman', 'delete');
    const canCreate = isAdmin && hasPermission('pengumuman', 'create');
    
    if (!isAdmin || (!canEdit && !canCreate)) {
        return `
            <div class="view-container">
                <div class="view-header">
                    <h2><i class="fas fa-bullhorn" style="color: var(--secondary);"></i> Daftar Pengumuman</h2>
                    <p>Berikut adalah daftar pengumuman dari Dinas Kesehatan</p>
                </div>
                ${data.length === 0 ? 
                    '<div class="empty-state"><i class="fas fa-bell-slash"></i><h3>Belum ada pengumuman</h3></div>' :
                    `<div class="announcement-grid">
                        ${data.map((item, i) => `
                            <div class="announcement-card ${cardColors[i % cardColors.length]}">
                                <div class="announcement-card-header">
                                    <div class="announcement-date">
                                        <i class="fas fa-calendar-alt"></i>
                                        ${formatDate(item.tanggal)}
                                    </div>
                                    <span class="badge badge-${item.status === 'aktif' ? 'success' : 'warning'}" style="margin-left: auto;">
                                        ${item.status}
                                    </span>
                                </div>
                                <div class="announcement-card-body">
                                    <h4>${item.judul}</h4>
                                    <p>${item.isi}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>`
                }
            </div>
        `;
    }
    
    return buildAdminTable('pengumuman', data, ['tanggal', 'judul', 'isi', 'status'], 
        ['Tanggal', 'Judul', 'Isi', 'Status'], canCreate, canEdit, canDelete);
}

// Renbut
async function renderRenbut(isAdmin) {
    const data = await fetchdata('renbut');
    const canEdit = isAdmin && hasPermission('renbut', 'edit');
    const canDelete = isAdmin && hasPermission('renbut', 'delete');
    const canCreate = isAdmin && hasPermission('renbut', 'create');
    
    if (!isAdmin || (!canEdit && !canCreate)) {
        return `
            <div class="view-container">
                <div class="view-header">
                    <h2><i class="fas fa-clipboard-list" style="color: var(--secondary);"></i> Kebutuhan Personil</h2>
                    <p>Data kebutuhan personil tenaga kesehatan</p>
                </div>
                <div class="dashboard-grid">
                    ${data.slice(0, 4).map((item, i) => `
                        <div class="stat-card ${cardColors[i % cardColors.length]}">
                            <div class="stat-icon"><i class="fas fa-hospital-user"></i></div>
                            <div class="stat-info">
                                <h3>${item.nama_unit}</h3>
                                <p>${item.jenis}: Kurang ${item.kekurangan} orang</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    return buildAdminTable('renbut', data, ['nama_unit', 'jenis', 'kebutuhan', 'existing', 'kekurangan', 'prioritas', 'tahun', 'keterangan'], 
        ['Unit Kerja', 'Jenis', 'Kebutuhan', 'Existing', 'Kekurangan', 'Prioritas', 'Tahun', 'Keterangan'], canCreate, canEdit, canDelete);
}

// Anjab-ABK
async function renderAnjabAbk(isAdmin) {
    const data = await fetchdata('anjab_abk');
    const canEdit = isAdmin && hasPermission('anjab-abk', 'edit');
    const canDelete = isAdmin && hasPermission('anjab-abk', 'delete');
    const canCreate = isAdmin && hasPermission('anjab-abk', 'create');
    
    if (!isAdmin || (!canEdit && !canCreate)) {
        return `
            <div class="view-container">
                <div class="view-header">
                    <h2><i class="fas fa-file-alt" style="color: var(--secondary);"></i> Analisis Jabatan & Beban Kerja</h2>
                    <p>Data Analisis Jabatan dan Analisis Beban Kerja</p>
                </div>
                <div class="info-grid">
                    ${data.map(item => `
                        <div class="info-card">
                            <h4>${item.jabatan} - ${item.unit}</h4>
                            <p>Beban: ${item.beban} | Gap: ${item.gap}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    return buildAdminTable('anjab_abk', data, ['jabatan', 'unit', 'beban', 'kebutuhan', 'existing', 'gap', 'dokumen'],
        ['Jabatan', 'Unit', 'Beban', 'Kebutuhan', 'Existing', 'Gap', 'Dokumen'], canCreate, canEdit, canDelete);
}

// Bezetting
async function renderBezetting(isAdmin) {
    const data = await fetchdata('bezetting');
    const canEdit = isAdmin && hasPermission('bezetting', 'edit');
    const canDelete = isAdmin && hasPermission('bezetting', 'delete');
    const canCreate = isAdmin && hasPermission('bezetting', 'create');
    
    if (!isAdmin || (!canEdit && !canCreate)) {
        return `
            <div class="view-container">
                <div class="view-header">
                    <h2><i class="fas fa-users-cog" style="color: var(--secondary);"></i> Data Bezetting</h2>
                    <p>Dokumen bezetting penempatan tenaga kesehatan</p>
                </div>
                <div class="dashboard-grid">
                    ${data.map((item, i) => `
                        <div class="stat-card ${cardColors[i % cardColors.length]}">
                            <div class="stat-icon"><i class="fas fa-file-pdf"></i></div>
                            <div class="stat-info">
                                <h3>${item.unit_kerja}</h3>
                                <p>Updated: ${item.updated_tahun}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    return buildAdminTable('bezetting', data, ['unit_kerja', 'download_bazetting', 'updated_tahun'],
        ['Unit Kerja', 'Download File', 'Tahun Update'], canCreate, canEdit, canDelete);
}

// Dokter Spesialis
async function renderDokterSpesialis(isAdmin) {
    const data = await fetchdata('dokter_spesialis');
    const canEdit = isAdmin && hasPermission('dokter-spesialis', 'edit');
    const canDelete = isAdmin && hasPermission('dokter-spesialis', 'delete');
    const canCreate = isAdmin && hasPermission('dokter-spesialis', 'create');
    
    if (!isAdmin || (!canEdit && !canCreate)) {
        return `
            <div class="view-container">
                <div class="view-header">
                    <h2><i class="fas fa-user-md" style="color: var(--secondary);"></i> Data Dokter Spesialis</h2>
                    <p>Informasi lengkap dokter spesialis</p>
                </div>
                <div class="dashboard-grid">
                    ${data.map((doc, i) => `
                        <div class="stat-card ${cardColors[i % cardColors.length]}" style="cursor: pointer;" onclick="showLightbox('dokter_spesialis', ${doc.id})">
                            <div class="stat-icon"><i class="fas fa-user-md"></i></div>
                            <div class="stat-info">
                                <h3>${doc.nama_lengkap}</h3>
                                <p>${doc.spesialisasi} - ${doc.unit_kerja}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    return buildAdminTable('dokter_spesialis', data, 
        ['nama_lengkap', 'unit_kerja', 'spesialisasi', 'jenis_kelamin', 'nomor_STR', 'nomor_SIP', 'tanggal_SIP_Expired', 'status_pegawai'],
        ['Nama Lengkap', 'Unit Kerja', 'Spesialisasi', 'Jenis Kelamin', 'No. STR', 'No. SIP', 'SIP Expired', 'Status'], canCreate, canEdit, canDelete);
}

// Rasio
async function renderRasio(isAdmin) {
    const data = await fetchdata('rasio');
    const canEdit = isAdmin && hasPermission('rasio', 'edit');
    const canDelete = isAdmin && hasPermission('rasio', 'delete');
    const canCreate = isAdmin && hasPermission('rasio', 'create');
    
    if (!isAdmin || (!canEdit && !canCreate)) {
        return `
            <div class="view-container">
                <div class="view-header">
                    <h2><i class="fas fa-calculator" style="color: var(--secondary);"></i> Rasio Tenaga Kesehatan</h2>
                    <p>Rasio tenaga kesehatan per kecamatan</p>
                </div>
                <div class="chart-container">
                    <div class="chart-title"><i class="fas fa-chart-bar"></i> Statistik Rasio per Kecamatan</div>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Kecamatan</th>
                                    <th>Penduduk</th>
                                    <th>Dokter</th>
                                    <th>Perawat</th>
                                    <th>Bidan</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.map(item => `
                                    <tr>
                                        <td><strong>${item.kec}</strong></td>
                                        <td>${item.penduduk.toLocaleString()}</td>
                                        <td>${item.dokter}</td>
                                        <td>${item.perawat}</td>
                                        <td>${item.bidan}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }
    
    return buildAdminTable('rasio', data, 
        ['kec', 'penduduk', 'dokter_spesialis_kklip', 'dokter', 'dokter_gigi', 'perawat', 'bidan', 'apoteker'],
        ['Kecamatan', 'Penduduk', 'Dr. Spesialis KKLP', 'Dokter', 'Dr. Gigi', 'Perawat', 'Bidan', 'Apoteker'], canCreate, canEdit, canDelete);
}

// Distribusi
async function renderDistribusi(isAdmin) {
    const data = await fetchdata('distribusi');
    const canEdit = isAdmin && hasPermission('distribusi', 'edit');
    const canDelete = isAdmin && hasPermission('distribusi', 'delete');
    const canCreate = isAdmin && hasPermission('distribusi', 'create');
    
    if (!isAdmin || (!canEdit && !canCreate)) {
        return `
            <div class="view-container">
                <div class="view-header">
                    <h2><i class="fas fa-map-marked-alt" style="color: var(--secondary);"></i> Distribusi Tenaga Kesehatan</h2>
                    <p>Sebaran tenaga kesehatan per wilayah</p>
                </div>
                <div class="dashboard-grid">
                    ${data.map((item, i) => `
                        <div class="stat-card ${cardColors[i % cardColors.length]}">
                            <div class="stat-icon"><i class="fas fa-map-marker-alt"></i></div>
                            <div class="stat-info">
                                <h3>${item.kecamatan}</h3>
                                <p>Total: ${item.total} nakes</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    return buildAdminTable('distribusi', data, 
        ['kecamatan', 'total', 'dokter', 'perawat', 'bidan', 'nakes_lainnya'],
        ['Kecamatan', 'Total', 'Dokter', 'Perawat', 'Bidan', 'Nakes Lainnya'], canCreate, canEdit, canDelete);
}

// Profil Faskes
async function renderProfilFaskes(isAdmin) {
    const data = await fetchdata('profil_faskes');
    const canEdit = isAdmin && hasPermission('profil-faskes', 'edit');
    const canDelete = isAdmin && hasPermission('profil-faskes', 'delete');
    const canCreate = isAdmin && hasPermission('profil-faskes', 'create');
    
    if (!isAdmin || (!canEdit && !canCreate)) {
        return `
            <div class="view-container">
                <div class="view-header">
                    <h2><i class="fas fa-hospital" style="color: var(--secondary");"></i> Profil Fasilitas Kesehatan</h2>
                    <p>Daftar fasilitas kesehatan</p>
                </div>
                <div class="dashboard-grid">
                    ${data.map((faskes, i) => `
                        <div class="stat-card ${cardColors[i % cardColors.length]}" style="cursor: pointer;" onclick="showLightbox('profil_faskes', ${faskes.id})">
                            <div class="stat-icon"><i class="fas fa-hospital"></i></div>
                            <div class="stat-info">
                                <h3>${faskes.nama_fasyankes}</h3>
                                <p>${faskes.jenis} - ${faskes.kecamatan}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    return buildAdminTable('profil_faskes', data, 
        ['kode_unit', 'nama_fasyankes', 'jenis', 'kecamatan', 'desa_kelurahan', 'kepala', 'nomor_telpon'],
        ['Kode', 'Nama Fasyankes', 'Jenis', 'Kecamatan', 'Desa/Kelurahan', 'Kepala', 'Telepon'], canCreate, canEdit, canDelete);
}

// Tempat Praktik Mandiri (TPM)
async function renderTPM(isAdmin) {
    const data = await fetchdata('tpm');
    const canEdit = isAdmin && hasPermission('tpm', 'edit');
    const canDelete = isAdmin && hasPermission('tpm', 'delete');
    const canCreate = isAdmin && hasPermission('tpm', 'create');
    
    if (!isAdmin || (!canEdit && !canCreate)) {
        return `
            <div class="view-container">
                <div class="view-header">
                    <h2><i class="fas fa-clinic-medical" style="color: var(--secondary);"></i> Tempat Praktik Mandiri</h2>
                    <p>Daftar tempat praktik mandiri tenaga kesehatan</p>
                </div>
                <div class="dashboard-grid">
                    ${data.map((tpm, i) => `
                        <div class="stat-card ${cardColors[i % cardColors.length]}" style="cursor: pointer;" onclick="showLightbox('tpm', ${tpm.id})">
                            <div class="stat-icon"><i class="fas fa-stethoscope"></i></div>
                            <div class="stat-info">
                                <h3>${tpm.nama_praktik_mandiri}</h3>
                                <p>${tpm.nama_lengkap} - ${tpm.jenis_profesi}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    return buildAdminTable('tpm', data, 
        ['nama_lengkap', 'jenis_profesi', 'nama_praktik_mandiri', 'alamat', 'jam_praktik', 'nomor_telpon'],
        ['Nama Lengkap', 'Profesi', 'Nama Praktik', 'Alamat', 'Jam Praktik', 'Telepon'], canCreate, canEdit, canDelete);
}

// Users Admin (Super Admin Only)
async function renderUsers() {
    if (!hasPermission('users', 'edit')) {
        return renderAccessDenied();
    }
    
    const data = await fetchdata('users');
    
    return buildAdminTable('users', data, 
        ['username', 'role', 'nama', 'status'],
        ['Username', 'Role', 'Nama Lengkap', 'Status'], true, true, true);
}

// Data SDMK Admin (Operator+)
async function renderDataSDMK() {
    if (!canAccessAdmin('data-sdmk')) {
        return renderAccessDenied();
    }
    
    const data = await fetchdata('data_sdmk');
    const canEdit = canAccessAdmin('data-sdmk');
    
    return buildAdminTable('data_sdmk', data, 
        ['nik', 'nama_lengkap', 'nip', 'jenis_tenaga', 'pendidikan', 'unit_kerja', 'status_kepegawaian'],
        ['NIK', 'Nama Lengkap', 'NIP', 'Jenis Tenaga', 'Pendidikan', 'Unit Kerja', 'Status'], canEdit, canEdit, canEdit);
}

// ============ HELPER: Build Admin Table ============
function buildAdminTable(table, data, columns, headers, canCreate = true, canEdit = true, canDelete = true) {
    return `
        <div class="table-container">
            <div class="table-header">
                <div class="table-title">
                    <i class="fas fa-table" style="color: var(--secondary);"></i> Kelola Data ${formatTableName(table)}
                </div>
                ${canCreate ? `
                <div class="table-actions">
                    <button class="btn btn-primary" onclick="openModal('${table}')">
                        <i class="fas fa-plus"></i> Tambah Data
                    </button>
                </div>
                ` : ''}
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>No</th>
                            ${headers.map(h => `<th>${h}</th>`).join('')}
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.length === 0 ? 
                            `<tr><td colspan="${columns.length + 2}" class="empty-state"><i class="fas fa-inbox"></i><h3>Belum ada data</h3></td></tr>` :
                            data.map((item, i) => `
                                <tr>
                                    <td>${i + 1}</td>
                                    ${columns.map(col => `<td>${item[col] || '-'}</td>`).join('')}
                                    <td>
                                        <div class="action-buttons">
                                            <button class="btn btn-info btn-sm btn-icon" onclick="viewItem('${table}', ${item.id})" title="Lihat">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                            ${canEdit ? `
                                            <button class="btn btn-warning btn-sm btn-icon" onclick="openModal('${table}', ${item.id})" title="Edit">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            ` : ''}
                                            ${canDelete ? `
                                            <button class="btn btn-danger btn-sm btn-icon" onclick="deleteItem('${table}', ${item.id})" title="Hapus">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                            ` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `).join('')
                        }
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Fix typo
async function fetchdata(table) {
    return fetchData(table);
}

// ============ MODAL FUNCTIONS ============
function openModal(table, id = null) {
    const action = id ? 'edit' : 'create';
    const resource = table;
    
    if (!hasPermission(resource, action) && !canAccessAdmin(resource)) {
        showToast('Anda tidak memiliki izin untuk melakukan operasi ini!', 'warning');
        return;
    }
    
    editingId = id;
    currentTable = table;
    
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const footer = document.getElementById('modalFooter');
    
    title.textContent = id ? `Edit Data ${formatTableName(table)}` : `Tambah Data ${formatTableName(table)}`;
    body.innerHTML = generateFormFields(table, id);
    
    footer.innerHTML = `
        <button class="btn btn-cancel" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="saveItem('${table}')">
            <i class="fas fa-save"></i> ${id ? 'Update' : 'Simpan'}
        </button>
    `;
    
    modal.classList.add('active');
    
    if (id) {
        populateForm(table, id);
    }
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
    editingId = null;
    currentTable = '';
}

// ============ FORM GENERATION ============
function generateFormFields(table, isEdit) {
    const forms = {
        pengumuman: `
            <div class="form-group">
                <label>Tanggal</label>
                <input type="date" id="form-tanggal" required>
            </div>
            <div class="form-group">
                <label>Judul</label>
                <input type="text" id="form-judul" placeholder="Masukkan judul pengumuman" required>
            </div>
            <div class="form-group">
                <label>Isi Pengumuman</label>
                <textarea id="form-isi" placeholder="Tulis isi pengumuman..." rows="4" required></textarea>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="form-status">
                    <option value="aktif">Aktif</option>
                    <option value="nonaktif">Non-Aktif</option>
                </select>
            </div>
        `,
        renbut: `
            <div class="form-group">
                <label>Nama Unit</label>
                <input type="text" id="form-nama_unit" placeholder="Nama unit kerja" required>
            </div>
            <div class="form-group">
                <label>Jenis</label>
                <select id="form-jenis">
                    <option value="Dokter Umum">Dokter Umum</option>
                    <option value="Dokter Spesialis">Dokter Spesialis</option>
                    <option value="Perawat">Perawat</option>
                    <option value="Bidan">Bidan</option>
                    <option value="Tenaga Lainnya">Tenaga Lainnya</option>
                </select>
            </div>
            <div class="form-group">
                <label>Kebutuhan</label>
                <input type="number" id="form-kebutuhan" placeholder="Jumlah kebutuhan" required>
            </div>
            <div class="form-group">
                <label>Existing</label>
                <input type="number" id="form-existing" placeholder="Jumlah existing" required>
            </div>
            <div class="form-group">
                <label>Prioritas</label>
                <select id="form-prioritas">
                    <option value="Tinggi">Tinggi</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Rendah">Rendah</option>
                </select>
            </div>
            <div class="form-group">
                <label>Tahun</label>
                <input type="number" id="form-tahun" placeholder="Tahun" required>
            </div>
            <div class="form-group">
                <label>Keterangan</label>
                <textarea id="form-keterangan" placeholder="Keterangan tambahan..."></textarea>
            </div>
        `,
        anjab_abk: `
            <div class="form-group">
                <label>Jabatan</label>
                <input type="text" id="form-jabatan" placeholder="Nama jabatan" required>
            </div>
            <div class="form-group">
                <label>Unit</label>
                <input type="text" id="form-unit" placeholder="Unit kerja" required>
            </div>
            <div class="form-group">
                <label>Beban Kerja</label>
                <input type="number" id="form-beban" placeholder="Beban kerja" required>
            </div>
            <div class="form-group">
                <label>Kebutuhan</label>
                <input type="number" id="form-kebutuhan" placeholder="Kebutuhan" required>
            </div>
            <div class="form-group">
                <label>Existing</label>
                <input type="number" id="form-existing" placeholder="Existing" required>
            </div>
            <div class="form-group">
                <label>Dokumen</label>
                <input type="text" id="form-dokumen" placeholder="Nomor/dokumen referensi">
            </div>
        `,
        bezetting: `
            <div class="form-group">
                <label>Unit Kerja</label>
                <input type="text" id="form-unit_kerja" placeholder="Nama unit kerja" required>
            </div>
            <div class="form-group">
                <label>File Bezetting</label>
                <input type="text" id="form-download_bazetting" placeholder="Nama file atau URL">
            </div>
            <div class="form-group">
                <label>Tahun Update</label>
                <input type="number" id="form-updated_tahun" placeholder="Tahun update" required>
            </div>
        `,
        dokter_spesialis: `
            <div class="form-group">
                <label>Nama Lengkap</label>
                <input type="text" id="form-nama_lengkap" placeholder="Nama lengkap dokter" required>
            </div>
            <div class="form-group">
                <label>Unit Kerja</label>
                <input type="text" id="form-unit_kerja" placeholder="Unit kerja" required>
            </div>
            <div class="form-group">
                <label>Spesialisasi</label>
                <input type="text" id="form-spesialisasi" placeholder="Spesialisasi" required>
            </div>
            <div class="form-group">
                <label>Jenis Kelamin</label>
                <select id="form-jenis_kelamin">
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                </select>
            </div>
            <div class="form-group">
                <label>Nomor STR</label>
                <input type="text" id="form-nomor_STR" placeholder="Nomor STR">
            </div>
            <div class="form-group">
                <label>Nomor SIP</label>
                <input type="text" id="form-nomor_SIP" placeholder="Nomor SIP">
            </div>
            <div class="form-group">
                <label>Tanggal SIP Expired</label>
                <input type="date" id="form-tanggal_SIP_Expired">
            </div>
            <div class="form-group">
                <label>Status Pegawai</label>
                <select id="form-status_pegawai">
                    <option value="PNS">PNS</option>
                    <option value="PPPK">PPPK</option>
                    <option value="Honorer">Honorer</option>
                </select>
            </div>
            <div class="form-group">
                <label>NIK</label>
                <input type="text" id="form-NIK" placeholder="NIK">
            </div>
            <div class="form-group">
                <label>NIP</label>
                <input type="text" id="form-NIP" placeholder="NIP (kosongkan jika tidak ada)">
            </div>
        `,
        rasio: `
            <div class="form-group">
                <label>Kecamatan</label>
                <input type="text" id="form-kec" placeholder="Nama kecamatan" required>
            </div>
            <div class="form-group">
                <label>Jumlah Penduduk</label>
                <input type="number" id="form-penduduk" placeholder="Jumlah penduduk" required>
            </div>
            <div class="form-group">
                <label>Dokter Spesialis KKLP</label>
                <input type="number" id="form-dokter_spesialis_kklip" placeholder="Jumlah">
            </div>
            <div class="form-group">
                <label>Dokter</label>
                <input type="number" id="form-dokter" placeholder="Jumlah dokter">
            </div>
            <div class="form-group">
                <label>Dokter Gigi</label>
                <input type="number" id="form-dokter_gigi" placeholder="Jumlah dokter gigi">
            </div>
            <div class="form-group">
                <label>Perawat</label>
                <input type="number" id="form-perawat" placeholder="Jumlah perawat">
            </div>
            <div class="form-group">
                <label>Bidan</label>
                <input type="number" id="form-bidan" placeholder="Jumlah bidan">
            </div>
            <div class="form-group">
                <label>Apoteker</label>
                <input type="number" id="form-apoteker" placeholder="Jumlah apoteker">
            </div>
        `,
        distribusi: `
            <div class="form-group">
                <label>Kecamatan</label>
                <input type="text" id="form-kecamatan" placeholder="Nama kecamatan" required>
            </div>
            <div class="form-group">
                <label>Total Nakes</label>
                <input type="number" id="form-total" placeholder="Total nakes" required>
            </div>
            <div class="form-group">
                <label>Dokter</label>
                <input type="number" id="form-dokter" placeholder="Jumlah dokter">
            </div>
            <div class="form-group">
                <label>Perawat</label>
                <input type="number" id="form-perawat" placeholder="Jumlah perawat">
            </div>
            <div class="form-group">
                <label>Bidan</label>
                <input type="number" id="form-bidan" placeholder="Jumlah bidan">
            </div>
            <div class="form-group">
                <label>Nakes Lainnya</label>
                <input type="number" id="form-nakes_lainnya" placeholder="Jumlah nakes lainnya">
            </div>
        `,
        profil_faskes: `
            <div class="form-group">
                <label>Kode Unit</label>
                <input type="text" id="form-kode_unit" placeholder="Kode unit" required>
            </div>
            <div class="form-group">
                <label>Nama Fasyankes</label>
                <input type="text" id="form-nama_fasyankes" placeholder="Nama fasyankes" required>
            </div>
            <div class="form-group">
                <label>Jenis</label>
                <select id="form-jenis">
                    <option value="Rumah Sakit">Rumah Sakit</option>
                    <option value="Puskesmas">Puskesmas</option>
                    <option value="Klinik">Klinik</option>
                    <option value="Apotek">Apotek</option>
                    <option value="Lab Kesehatan">Lab Kesehatan</option>
                </select>
            </div>
            <div class="form-group">
                <label>Kecamatan</label>
                <input type="text" id="form-kecamatan" placeholder="Kecamatan" required>
            </div>
            <div class="form-group">
                <label>Desa/Kelurahan</label>
                <input type="text" id="form-desa_kelurahan" placeholder="Desa/Kelurahan">
            </div>
            <div class="form-group">
                <label>Alamat</label>
                <input type="text" id="form-alamat" placeholder="Alamat lengkap">
            </div>
            <div class="form-group">
                <label>Kepala</label>
                <input type="text" id="form-kepala" placeholder="Nama kepala faskes">
            </div>
            <div class="form-group">
                <label>Nomor Telepon</label>
                <input type="text" id="form-nomor_telpon" placeholder="Nomor telepon">
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="form-email" placeholder="Email">
            </div>
        `,
        tpm: `
            <div class="form-group">
                <label>Nama Lengkap</label>
                <input type="text" id="form-nama_lengkap" placeholder="Nama lengkap" required>
            </div>
            <div class="form-group">
                <label>Jenis Profesi</label>
                <select id="form-jenis_profesi">
                    <option value="Dokter Umum">Dokter Umum</option>
                    <option value="Dokter Spesialis">Dokter Spesialis</option>
                    <option value="Dokter Gigi">Dokter Gigi</option>
                    <option value="Bidan">Bidan</option>
                    <option value="Perawat">Perawat</option>
                    <option value="Farmasis">Farmasis</option>
                </select>
            </div>
            <div class="form-group">
                <label>Nama Praktik Mandiri</label>
                <input type="text" id="form-nama_praktik_mandiri" placeholder="Nama tempat praktik" required>
            </div>
            <div class="form-group">
                <label>Alamat</label>
                <input type="text" id="form-alamat" placeholder="Alamat praktik" required>
            </div>
            <div class="form-group">
                <label>Jam Praktik</label>
                <input type="text" id="form-jam_praktik" placeholder="Contoh: Senin-Sabtu, 17.00-20.00 WIB">
            </div>
            <div class="form-group">
                <label>Nomor Telepon</label>
                <input type="text" id="form-nomor_telpon" placeholder="Nomor telepon">
            </div>
            <div class="form-group">
                <label>Tanggal Terbit SIP</label>
                <input type="date" id="form-tanggal_terbit_sip">
            </div>
            <div class="form-group">
                <label>Tanggal Expired SIP</label>
                <input type="date" id="form-tanggal_expired_sip">
            </div>
        `,
        users: `
            <div class="form-group">
                <label>Username</label>
                <input type="text" id="form-username" placeholder="Username" required>
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" id="form-password" placeholder="Password" required>
            </div>
            <div class="form-group">
                <label>Role</label>
                <select id="form-role">
                    <option value="super_admin">Super Admin</option>
                    <option value="operator">Operator</option>
                    <option value="dokter">Dokter</option>
                    <option value="viewer">Viewer</option>
                </select>
            </div>
            <div class="form-group">
                <label>Nama Lengkap</label>
                <input type="text" id="form-nama" placeholder="Nama lengkap" required>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="form-status">
                    <option value="aktif">Aktif</option>
                    <option value="nonaktif">Non-Aktif</option>
                </select>
            </div>
        `,
        data_sdmk: `
            <div class="form-group">
                <label>NIK</label>
                <input type="text" id="form-nik" placeholder="NIK" required>
            </div>
            <div class="form-group">
                <label>Nama Lengkap</label>
                <input type="text" id="form-nama_lengkap" placeholder="Nama lengkap" required>
            </div>
            <div class="form-group">
                <label>NIP</label>
                <input type="text" id="form-nip" placeholder="NIP (opsional)">
            </div>
            <div class="form-group">
                <label>Jenis Tenaga</label>
                <select id="form-jenis_tenaga">
                    <option value="Dokter Spesialis">Dokter Spesialis</option>
                    <option value="Dokter Umum">Dokter Umum</option>
                    <option value="Dokter Gigi">Dokter Gigi</option>
                    <option value="Perawat">Perawat</option>
                    <option value="Bidan">Bidan</option>
                    <option value="Farmasis">Farmasis</option>
                    <option value="Tenaga Kesehatan Lainnya">Tenaga Kesehatan Lainnya</option>
                </select>
            </div>
            <div class="form-group">
                <label>Pendidikan</label>
                <input type="text" id="form-pendidikan" placeholder="Pendidikan terakhir">
            </div>
            <div class="form-group">
                <label>Unit Kerja</label>
                <input type="text" id="form-unit_kerja" placeholder="Unit kerja" required>
            </div>
            <div class="form-group">
                <label>Status Kepegawaian</label>
                <select id="form-status_kepegawaian">
                    <option value="PNS">PNS</option>
                    <option value="PPPK">PPPK</option>
                    <option value="Honorer">Honorer</option>
                </select>
            </div>
            <div class="form-group">
                <label>Tanggal Mulai</label>
                <input type="date" id="form-tanggal_mulai">
            </div>
            <div class="form-group">
                <label>No. Telepon</label>
                <input type="text" id="form-no_telepon" placeholder="Nomor telepon">
            </div>
            <div class="form-group">
                <label>Alamat</label>
                <textarea id="form-alamat" placeholder="Alamat lengkap..."></textarea>
            </div>
        `
    };
    
    return forms[table] || '<p>Form tidak tersedia untuk tabel ini.</p>';
}

// ============ POPULATE FORM FOR EDIT ============
async function populateForm(table, id) {
    const data = await fetchdata(table);
    const item = data.find(d => d.id === id);
    
    if (!item) return;
    
    Object.keys(item).forEach(key => {
        const input = document.getElementById(`form-${key}`);
        if (input && item[key] !== null && item[key] !== undefined) {
            input.value = item[key];
        }
    });
}

// ============ SAVE ITEM (CREATE/UPDATE) ============
async function saveItem(table) {
    try {
        const formData = collectFormData(table);
        
        if (supabaseClient) {
            if (editingId) {
                const { error } = await supabaseClient.from(table).update(formData).eq('id', editingId);
                if (error) throw error;
                showToast('Data berhasil diperbarui!', 'success');
            } else {
                const { error } = await supabaseClient.from(table).insert(formData);
                if (error) throw error;
                showToast('Data berhasil ditambahkan!', 'success');
            }
        } else {
            if (editingId) {
                const index = demoData[table].findIndex(d => d.id === editingId);
                if (index !== -1) {
                    demoData[table][index] = { ...demoData[table][index], ...formData };
                }
                showToast('Data berhasil diperbarui! (Demo Mode)', 'success');
            } else {
                const newId = Math.max(...demoData[table].map(d => d.id), 0) + 1;
                demoData[table].push({ id: newId, ...formData });
                showToast('Data berhasil ditambahkan! (Demo Mode)', 'success');
            }
        }
        
        closeModal();
        loadPage(currentPage);
        
    } catch (error) {
        console.error('Error saving:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

// ============ COLLECT FORM DATA ============
function collectFormData(table) {
    const form = document.getElementById('modalBody');
    const inputs = form.querySelectorAll('input, select, textarea');
    const data = {};
    
    inputs.forEach(input => {
        const key = input.id.replace('form-', '');
        data[key] = input.value;
    });
    
    return data;
}

// ============ DELETE ITEM ============
async function deleteItem(table, id) {
    if (!hasPermission(table, 'delete') && !canAccessAdmin(table)) {
        showToast('Anda tidak memiliki izin untuk menghapus data ini!', 'warning');
        return;
    }
    
    if (!confirm('Apakah Anda yakin ingin menghapus data ini?')) return;
    
    try {
        if (supabaseClient) {
            const { error } = await supabaseClient.from(table).delete().eq('id', id);
            if (error) throw error;
            showToast('Data berhasil dihapus!', 'success');
        } else {
            const index = demoData[table].findIndex(d => d.id === id);
            if (index !== -1) {
                demoData[table].splice(index, 1);
            }
            showToast('Data berhasil dihapus! (Demo Mode)', 'success');
        }
        
        loadPage(currentPage);
        
    } catch (error) {
        console.error('Error deleting:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

// ============ VIEW ITEM (LIGHTBOX) ============
async function viewItem(table, id) {
    const data = await fetchdata(table);
    const item = data.find(d => d.id === id);
    
    if (!item) return;
    
    showLightboxContent(formatTableName(table), item);
}

function showLightbox(table, id) {
    viewItem(table, id);
}

function showLightboxContent(title, data) {
    const lightbox = document.getElementById('lightbox');
    const body = document.getElementById('lightboxBody');
    
    let html = `<h2 style="margin-bottom: 20px; color: var(--primary);">${title}</h2>`;
    html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px;">';
    
    Object.entries(data).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'password' && value) {
            html += `
                <div style="background: #f8fafc; padding: 15px; border-radius: 10px; border-left: 3px solid var(--secondary);">
                    <small style="color: var(--text-secondary); text-transform: uppercase; font-size: 0.75rem;">${formatFieldName(key)}</small>
                    <p style="font-weight: 600; margin-top: 5px;">${value}</p>
                </div>
            `;
        }
    });
    
    html += '</div>';
    body.innerHTML = html;
    lightbox.classList.add('active');
}

function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
}

// ============ UTILITY FUNCTIONS ============
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function truncateText(text, maxLength) {
    if (!text) return '-';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function formatTableName(table) {
    const names = {
        'pengumuman': 'Pengumuman',
        'renbut': 'Kebutuhan Personil',
        'anjab_abk': 'Anjab-ABK',
        'bezetting': 'Bezetting',
        'dokter_spesialis': 'Dokter Spesialis',
        'rasio': 'Rasio',
        'distribusi': 'Distribusi',
        'profil_faskes': 'Profil Faskes',
        'tpm': 'Tempat Praktik Mandiri',
        'users': 'Users',
        'data_sdmk': 'Data SDMK'
    };
    return names[table] || table;
}

function formatFieldName(field) {
    return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// ============ TOAST NOTIFICATIONS ============
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============ EXPORT FUNCTIONS FOR GLOBAL ACCESS ============
window.handleLogin = handleLogin;
window.quickLogin = quickLogin;
window.handleLogout = handleLogout;
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.openModal = openModal;
window.closeModal = closeModal;
window.saveItem = saveItem;
window.deleteItem = deleteItem;
window.viewItem = viewItem;
window.showLightbox = showLightbox;
window.closeLightbox = closeLightbox;
window.loadPage = loadPage;
window.hasPermission = hasPermission;
window.canAccessAdmin = canAccessAdmin;
