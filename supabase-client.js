/**
 * ============================================================
 * MANDAT v1.0 - SUPABASE API CLIENT
 * Dinas Kesehatan Kabupaten Kutai Kartanegara
 * ============================================================
 * 
 * CARA PAKAI:
 * 1. Copy file ini ke project kamu
 * 2. Install: npm install @supabase/supabase-js
 * 3. Ganti URL dan ANON KEY di bawah
 * 4. Import di HTML: <script src="supabase-client.js"></script>
 * 
 * ============================================================
 */

// ==================== CONFIGURATION ====================
// Ganti dengan credential Supabase kamu:
const SUPABASE_URL = 'https://ftsqrfqsbhwivyphogbv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0c3FyZnFzYmh3aXZ5cGhvZ2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjE0MDQsImV4cCI6MjEwMzEzNzQwNH0.Zb_ukPoJXfDFzfSS--at4CDBK7VI2_-gLU6N7BVnoCs';

// ==================== INITIALIZATION ====================
let supabaseClient = null;

/**
 * Initialize Supabase client (call this on app start)
 */
function initSupabase(url = SUPABASE_URL, key = SUPABASE_ANON_KEY) {
    if (typeof window.supabase !== 'undefined') {
        supabaseClient = window.supabase.createClient(url, key);
        console.log('[MANDAT] ✅ Supabase client initialized');
        return true;
    } else {
        console.error('[MANDAT] ❌ Supabase JS not loaded. Add to HTML:');
        console.error('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
        return false;
    }
}

// ==================== AUTH FUNCTIONS ====================

/**
 * Login user
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function loginSupabase(username, password) {
    try {
        // Custom login via RPC or direct query (since we use custom users table)
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password) // In production, use bcrypt via RPC!
            .eq('is_active', true)
            .single();

        if (error) throw error;

        // Update last login
        await supabaseClient
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', data.id);

        return {
            success: true,
            data: {
                id: data.id,
                username: data.username,
                nama: data.nama_lengkap,
                role: data.role,
                avatar: data.avatar_url
            }
        };
    } catch (err) {
        console.error('[MANDAT] Login error:', err);
        return { success: false, error: 'Username atau password salah' };
    }
}

/**
 * Logout user
 */
async function logoutSupabase() {
    // Clear local session
    localStorage.removeItem('simandakes_auth');
    currentUser = null;
    
    // If using Supabase Auth, sign out
    if (supabaseClient && supabaseClient.auth) {
        await supabaseClient.auth.signOut();
    }
}

// ==================== SDMK FUNCTIONS ====================

/**
 * Get all SDMK data with optional filters
 * @param {object} filters - {jenis_tenaga, unit_kerja_id, is_active}
 * @returns {Promise<Array>}
 */
async function getSDMK(filters = {}) {
    try {
        let query = supabaseClient
            .from('sdmk')
            .select('*, unit_kerja:unit_kerja_id(nama_unit, jenis)')
            .order('nama_lengkap', { ascending: true });

        if (filters.jenis_tenaga) {
            query = query.eq('jenis_tenaga', filters.jenis_tenaga);
        }
        if (filters.unit_kerja_id) {
            query = query.eq('unit_kerja_id', filters.unit_kerja_id);
        }
        if (filters.is_active !== undefined) {
            query = query.eq('is_active', filters.is_active);
        }

        const { data, error } = await query;

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        console.error('[MANDAT] Get SDMK error:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Create/Update SDMK record
 * @param {object} sdmkData 
 * @param {UUID|null} id - null for create, UUID for update
 */
async function saveSDMK(sdmkData, id = null) {
    try {
        let result;
        
        if (id) {
            // Update
            result = await supabaseClient
                .from('sdmk')
                .update(sdmkData)
                .eq('id', id)
                .select()
                .single();
        } else {
            // Create
            result = await supabaseClient
                .from('sdmk')
                .insert(sdmkData)
                .select()
                .single();
        }

        if (result.error) throw result.error;
        return { success: true, data: result.data };
    } catch (err) {
        console.error('[MANDAT] Save SDMK error:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Delete SDMK record
 */
async function deleteSDMK(id) {
    try {
        const { error } = await supabaseClient
            .from('sdmk')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ==================== PENGUMUMAN FUNCTIONS ====================

/**
 * Get all active announcements
 */
async function getPengumuman() {
    try {
        const { data, error } = await supabaseClient
            .from('pengumuman')
            .select('*, author:author_id(nama_lengkap)')
            .eq('is_active', true)
            .order('published_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Save announcement
 */
async function savePengumuman(pengumumanData, id = null) {
    try {
        let result;
        if (id) {
            result = await supabaseClient
                .from('pengumuman')
                .update(pengumumanData)
                .eq('id', id)
                .select()
                .single();
        } else {
            result = await supabaseClient
                .from('pengumuman')
                .insert({ ...pengumumanData, published_at: new Date().toISOString() })
                .select()
                .single();
        }
        if (result.error) throw result.error;
        return { success: true, data: result.data };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ==================== RENBUT FUNCTIONS ====================

/**
 * Get Renbut data with filters
 */
async function getRenbut(filters = {}) {
    try {
        let query = supabaseClient
            .from('renbut')
            .select('*')
            .order('tahun', { ascending: false });

        if (filters.tahun) query = query.eq('tahun', filters.tahun);
        if (filters.unit_kerja_id) query = query.eq('unit_kerja_id', filters.unit_kerja_id);

        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Save Renbut record
 */
async function saveRenbut(renbutData, id = null) {
    try {
        let result;
        if (id) {
            result = await supabaseClient.from('renbut').update(renbutData).eq('id', id).select().single();
        } else {
            result = await supabaseClient.from('renbut').insert(renbutData).select().single();
        }
        if (result.error) throw result.error;
        return { success: true, data: result.data };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ==================== UNIT KERJA / PROFIL FASKES ====================

/**
 * Get all units/faskes
 */
async function getUnitKerja() {
    try {
        const { data, error } = await supabaseClient
            .from('unit_kerja')
            .select('*')
            .eq('status', 'aktif')
            .order('nama_unit');

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Save Unit Kerja
 */
async function saveUnitKerja(unitData, id = null) {
    try {
        let result;
        if (id) {
            result = await supabaseClient.from('unit_kerja').update(unitData).eq('id', id).select().single();
        } else {
            result = await supabaseClient.from('unit_kerja').insert(unitData).select().single();
        }
        if (result.error) throw result.error;
        return { success: true, data: result.data };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ==================== TPM (TEMPAT PRAKTIK MANDIRI) ====================

/**
 * Get TPM data
 */
async function getTPM(filters = {}) {
    try {
        let query = supabaseClient
            .from('tpm')
            .select('*')
            .eq('is_active', true)
            .order('nama_praktik');

        if (filters.profesi) query = query.eq('profesi', filters.profesi);
        if (filters.kecamatan) query = query.eq('kecamatan', filters.kecamatan);

        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Save TPM
 */
async function saveTPM(tpmData, id = null) {
    try {
        let result;
        if (id) {
            result = await supabaseClient.from('tpm').update(tpmData).eq('id', id).select().single();
        } else {
            result = await supabaseClient.from('tpm').insert(tpmData).select().single();
        }
        if (result.error) throw result.error;
        return { success: true, data: result.data };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ==================== DOKTER SPESIALIS ====================

/**
 * Get Spesialis data
 */
async function getSpesialis() {
    try {
        const { data, error } = await supabaseClient
            .from('dokter_spesialis')
            .select('*, unit_kerja:unit_kerja_id(nama_unit)')
            .eq('is_active', true)
            .order('nama_lengkap');

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ==================== RASIO SDMK ====================

/**
 * Get Rasio SDMK
 */
async function getRasio(tahun = null) {
    try {
        let query = supabaseClient
            .from('rasio_sdmk')
            .select('*, unit_kerja:unit_kerja_id(nama_unit, jenis)')
            .order('tahun', { ascending: false });

        if (tahun) query = query.eq('tahun', tahun);

        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ==================== REKAP DATA ====================

/**
 * Get Rekap SDMK
 */
async function getRekapSDMK(tahun = null, bulan = null) {
    try {
        let query = supabaseClient
            .from('rekap_sdmk')
            .select('*')
            .order('tahun', { ascending: false })
            .order('bulan', { ascending: false });

        if (tahun) query = query.eq('tahun', tahun);
        if (bulan) query = query.eq('bulan', bulan);

        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Get Rekap Spesialis
 */
async function getRekapSpesialis(tahun = null, bulan = null) {
    try {
        let query = supabaseClient
            .from('rekap_spesialis')
            .select('*')
            .order('tahun', { ascending: false })
            .order('bulan', { ascending: false });

        if (tahun) query = query.eq('tahun', tahun);
        if (bulan) query = query.eq('bulan', bulan);

        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ==================== ANJAB/ABK ====================

/**
 * Get Anjab ABK data
 */
async function getAnjabABK(unitKerjaId = null) {
    try {
        let query = supabaseClient
            .from('anjab_abk')
            .select('*, unit_kerja:unit_kerja_id(nama_unit)')
            .order('jabatan');

        if (unitKerjaId) query = query.eq('unit_kerja_id', unitKerjaId);

        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ==================== ACTIVITY LOG ====================

/**
 * Log activity to database
 */
async function logActivity(action, module, description = '') {
    try {
        const logData = {
            user_id: currentUser?.id || null,
            username: currentUser?.username || 'anonymous',
            action: action,
            module: module,
            description: description,
            created_at: new Date().toISOString()
        };

        await supabaseClient.from('activity_log').insert(logData);
    } catch (err) {
        console.warn('[MANDAT] Failed to log activity:', err);
    }
}

// ==================== DASHBOARD SUMMARY ====================

/**
 * Get dashboard summary statistics
 */
async function getDashboardSummary() {
    try {
        // Use the view we created
        const { data, error } = await supabaseClient
            .from('v_dashboard_summary')
            .select('*')
            .single();

        if (error) throw error;
        return { success: true, data: data };
    } catch (err) {
        // Fallback: calculate manually
        console.warn('[MANDAT] Using fallback dashboard calculation');
        const [sdmkResult, unitResult, tpmResult, spesialisResult] = await Promise.all([
            supabaseClient.from('sdmk').select('id', { count: 'exact' }).eq('is_active', true),
            supabaseClient.from('unit_kerja').select('id', { count: 'exact' }).eq('status', 'aktif'),
            supabaseClient.from('tpm').select('id', { count: 'exact' }).eq('is_active', true),
            supabaseClient.from('dokter_spesialis').select('id', { count: 'exact' }).eq('is_active', true)
        ]);

        return {
            success: true,
            data: {
                total_sdmk: sdmkResult.count || 0,
                total_unit: unitResult.count || 0,
                total_tpm: tpmResult.count || 0,
                total_spesialis: spesialisResult.count || 0
            }
        };
    }
}

// ==================== FILE UPLOAD HELPERS ====================

/**
 * Upload file to Supabase Storage
 * @param {File} file - File object from input
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in bucket
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function uploadFile(file, bucket, path) {
    try {
        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = `${path}/${fileName}`;

        const { data, error } = await supabaseClient.storage
            .from(bucket)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabaseClient.storage
            .from(bucket)
            .getPublicUrl(filePath);

        return { success: true, url: publicUrl };
    } catch (err) {
        console.error('[MANDAT] Upload error:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Upload SDMK photo
 */
async function uploadSDMKPhoto(file) {
    return uploadFile(file, 'sdmk-photos', 'photos');
}

/**
 * Upload TPM photo
 */
async function uploadTPMPhoto(file) {
    return uploadFile(file, 'tpm-photos', 'photos');
}

/**
 * Upload avatar
 */
async function uploadAvatar(file) {
    return uploadFile(file, 'avatars', 'avatars');
}

// ==================== REALTIME SUBSCRIPTIONS ====================

/**
 * Subscribe to table changes for real-time updates
 * @param {string} tableName - Table name to subscribe
 * @param {function} callback - Callback function for changes
 */
function subscribeToTable(tableName, callback) {
    if (!supabaseClient) return null;

    return supabaseClient
        .channel(`mandat-${tableName}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, callback)
        .subscribe();
}

// ==================== EXPORT UTILITIES ====================

/**
 * Export data to CSV format
 */
function exportToCSV(data, filename = 'export.csv') {
    if (!data || data.length === 0) {
        showToast('Tidak ada data untuk diekspor', 'warning');
        return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// ==================== LEGACY COMPATIBILITY LAYER ====================
/**
 * Adapter untuk mengganti callAPI() lama ke Supabase
 * Gunakan ini sebagai drop-in replacement
 */

// Map old actions to new Supabase functions
const ACTION_MAP = {
    'getDashboard': () => getDashboardSummary(),
    'getPengumuman': () => getPengumuman(),
    'savePengumuman': (params) => savePengumuman(params.data, params.id),
    'deletePengumuman': (params) => supabaseClient.from('pengumuman').delete().eq('id', params.id),
    
    'getRenbut': () => getRenbut(),
    'saveRenbut': (params) => saveRenbut(params.data, params.id),
    'deleteRenbut': (params) => supabaseClient.from('renbut').delete().eq('id', params.id),
    
    'getSDMKData': () => getSDMK(),
    'saveSDMK': (params) => saveSDMK(params.data, params.id),
    'deleteSDMK': (params) => deleteSDMK(params.id),
    
    'getUnitKerja': () => getUnitKerja(),
    'saveUnitKerja': (params) => saveUnitKerja(params.data, params.id),
    
    'getTPMData': () => getTPM(),
    'saveTPM': (params) => saveTPM(params.data, params.id),
    'deleteTPM': (params) => supabaseClient.from('tpm').delete().eq('id', params.id),
    
    'getSpesialisData': () => getSpesialis(),
    'getRasioData': () => getRasio(),
    'calculateRasio': () => getRasio(), // Rasio now auto-calculated
    
    'getAnjabData': () => getAnjabABK(),
    'saveAnjab': (params) => supabaseClient.from('anjab_abk').upsert(params.data).select().single(),
    
    'getRekapSDMK': () => getRekapSDMK(),
    'saveRekapSDMK': (params) => supabaseClient.from('rekap_sdmk').upsert(params.data).select().single(),
    'deleteRekapSDMK': (params) => supabaseClient.from('rekap_sdmk').delete().eq('id', params.id),
    
    'getRekapSpesialis': () => getRekapSpesialis(),
    'saveRekapSpesialis': (params) => supabaseClient.from('rekap_spesialis').upsert(params.data).select().single(),
    
    'login': (params) => loginSupabase(params.username, params.password),
    'getUsers': () => supabaseClient.from('users').select('id, username, nama_lengkap, email, role, is_active, created_at').order('username'),
    'saveUser': (params) => supabaseClient.from('users').upsert(params.data).select().single(),
    'deleteUser': (params) => supabaseClient.from('users').delete().eq('id', params.id),
    
    'logActivity': (params) => logActivity(params.action, params.module, params.description)
};

/**
 * Legacy callAPI function - automatically routes to Supabase
 * This replaces the old Google Apps Script version
 */
async function callAPI(action, params = {}) {
    console.log(`[MANDAT-API] ${action}`, params);
    
    // Check if Supabase is initialized
    if (!supabaseClient) {
        console.warn('[MANDAT-API] Supabase not initialized, attempting...');
        if (!initSupabase()) {
            return { 
                success: false, 
                message: 'Supabase client tidak terinisialisasi. Pastikan supabase.js sudah dimuat.' 
            };
        }
    }

    // Check if action exists in map
    if (ACTION_MAP[action]) {
        try {
            const result = await ACTION_MAP[action](params);
            
            // Normalize response format
            if (result.data) {
                return { success: true, data: result.data };
            }
            return result;
        } catch (err) {
            console.error(`[MANDAT-API] Error in ${action}:`, err);
            return { success: false, message: err.message, error: err };
        }
    }

    // Unknown action
    return { 
        success: false, 
        message: `Action '${action}' tidak dikenali` 
    };
}

// ==================== AUTO-INIT ON LOAD ====================
document.addEventListener('DOMContentLoaded', () => {
    // Auto-initialize if credentials are set
    if (SUPABASE_URL !== 'https://YOUR-PROJECT-ID.supabase.co') {
        initSupabase();
    } else {
        console.warn('[MANDAT] ⚠️ Supabase credentials belum dikonfigurasi.');
        console.warn('[MANDAT] Edit supabase-client.js dan masukkan URL & ANON KEY kamu.');
    }
});

// Export for use
window.MANDAT_SUPABASE = {
    init: initSupabase,
    login: loginSupabase,
    logout: logoutSupabase,
    client: () => supabaseClient
};

console.log('[MANDAT] 📦 Supabase Client loaded v1.0');
