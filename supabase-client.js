/**
 * ============================================================
 * MANDAT v1.0 - SUPABASE API CLIENT (Complete Version)
 * Dinas Kesehatan Kabupaten Kutai Kartanegara
 * ============================================================
 * 
 * CARA PAKAI:
 * 1. Copy file ini ke project kamu
 * 2. Ganti URL dan ANON KEY di bawah
 * 3. Import di HTML: <script src="supabase-client.js"></script>
 * 
 * FITUR:
 * - Auth (login/logout)
 * - CRUD untuk semua tabel (SDMK, Pengumuman, Renbut, TPM, dll)
 * - Dashboard summary
 * - Offline mode fallback
 * - File upload helpers
 * - Realtime subscriptions
 * - Export utilities
 * 
 * ============================================================
 */

// ==================== CONFIGURATION ====================
// Ganti dengan credential Supabase kamu:
const SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY-HERE';

// ==================== INITIALIZATION ====================
let supabaseClient = null;

/**
 * Initialize Supabase client (call this on app start)
 */
function initSupabase(url = SUPABASE_URL, key = SUPABASE_ANON_KEY) {
    try {
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            supabaseClient = window.supabase.createClient(url, key);
            console.log('[MANDAT] ✅ Supabase client initialized');
            return true;
        } else {
            console.warn('[MANDAT] ⚠️ Supabase JS not loaded');
            console.warn('[MANDAT] Add to HTML: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
            return false;
        }
    } catch (err) {
        console.error('[MANDAT] ❌ Supabase init error:', err);
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
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password) // In production, use bcrypt via RPC!
            .eq('is_active', true)
            .single();

        if (error) throw error;
        if (!data) throw new Error('User not found');

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
 * Struktur baru: nama_lengkap, jenis_kelamin, NIK, NIP, spesialisasi, unit_kerja, 
 *                 nomor_STR, nomor_SIP, tanggal_SIP_Expired, status_pegawai,
 *                 praktik_ke_1, praktik_ke_2, praktik_ke_3
 */
async function getSpesialis() {
    try {
        const { data, error } = await supabaseClient
            .from('dokter_spesialis')
            .select('*')
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

// ==================== USERS FUNCTIONS ====================

/**
 * Get all users
 */
async function getUsers() {
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('id, username, nama_lengkap, email, role, is_active, created_at')
            .order('username');
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Save User (create/update)
 */
async function saveUser(userData) {
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .upsert({
                ...userData,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        return { success: true, data };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ==================== ACTIVITY LOG ====================

/**
 * Get activity log
 */
async function getActivityLog(limit = 100) {
    try {
        const { data, error } = await supabaseClient
            .from('activity_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Log activity to database
 */
async function logActivityToDB(action, module, description = '') {
    try {
        await supabaseClient.from('activity_log').insert({
            user_id: typeof STATE !== 'undefined' ? STATE.currentUser?.id : null,
            username: typeof STATE !== 'undefined' ? STATE.currentUser?.username || 'anonymous' : 'anonymous',
            action: action,
            module: module,
            description: description,
            created_at: new Date().toISOString()
        });
        return { success: true };
    } catch (err) {
        console.warn('[MANDAT] Failed to log:', err);
        return { success: false };
    }
}

/**
 * Log activity (wrapper for compatibility)
 */
async function logActivity(action, module, description = '') {
    try {
        await logActivityToDB(action, module, description);
    } catch (e) {
        console.warn('Failed to log activity:', e);
    }
}

// ==================== DASHBOARD SUMMARY ====================

/**
 * Get dashboard summary statistics
 */
async function getDashboardSummary() {
    try {
        // Parallel queries untuk performa
        const [sdmkResult, unitResult, tpmResult, spesialisResult] = await Promise.all([
            supabaseClient.from('sdmk').select('id, jenis_tenaga, is_active', { count: 'exact' }).eq('is_active', true),
            supabaseClient.from('unit_kerja').select('id', { count: 'exact' }).eq('status', 'aktif'),
            supabaseClient.from('tpm').select('id', { count: 'exact' }).eq('is_active', true),
            supabaseClient.from('dokter_spesialis').select('id', { count: 'exact' }).eq('is_active', true)
        ]);
        
        // Hitung dokter dan perawat/bidan
        const allSDMK = sdmkResult.data || [];
        const dokterCount = allSDMK.filter(s => s.jenis_tenaga?.toLowerCase().includes('dokter')).length;
        const perawatBidanCount = allSDMK.filter(s => 
            s.jenis_tenaga?.toLowerCase().includes('perawat') || 
            s.jenis_tenaga?.toLowerCase().includes('bidan')
        ).length;
        
        return {
            success: true,
            data: {
                total_sdmk: sdmkResult.count || allSDMK.length,
                total_dokter: dokterCount,
                total_perawat_bidan: perawatBidanCount,
                total_unit: unitResult.count || 0,
                total_tpm: tpmResult.count || 0,
                total_spesialis: spesialisResult.count || 0
            }
        };
    } catch (err) {
        console.error('Dashboard summary error:', err);
        return { 
            success: true, 
            data: { 
                total_sdmk: 0, total_dokter: 0, total_perawat_bidan: 0, 
                total_unit: 0, total_tpm: 0, total_spesialis: 0 
            } 
        };
    }
}

// ==================== GENERIC CRUD HELPERS ====================

/**
 * Delete record from any table
 */
async function deleteRecord(table, id) {
    try {
        const { error } = await supabaseClient.from(table).delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Upsert record to any table
 */
async function upsertRecord(table, data) {
    try {
        const { data: result, error } = await supabaseClient
            .from(table)
            .upsert({ ...data, updated_at: new Date().toISOString() })
            .select()
            .single();
        
        if (error) throw error;
        return { success: true, data: result };
    } catch (err) {
        return { success: false, error: err.message };
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
        if (typeof showToast === 'function') {
            showToast('Tidak ada data untuk diekspor', 'warning');
        }
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

// ==================== OFFLINE FALLBACK HANDLER ====================

/**
 * Handle actions when offline or Supabase not connected
 * Uses DATA object from main app for cached data
 */
function handleOfflineAction(action, params = {}) {
    console.warn(`[MANDAT-API] Offline mode for: ${action}`);
    
    // Access DATA object from global scope if available
    const appData = (typeof DATA !== 'undefined') ? DATA : {
        sdmk: [], pengumuman: [], renbut: [], unit_kerja: [],
        tpm: [], spesialis: [], rasio: [], anjab: [],
        rekap_sdmk: [], rekap_spesialis: [], users: [], activity_log: []
    };
    
    // Return cached data if available
    const offlineHandlers = {
        'getDashboard': () => ({ 
            success: true, 
            data: { 
                total_sdmk: appData.sdmk.length,
                total_dokter: appData.sdmk.filter(s => s.jenis_tenaga?.includes('Dokter')).length,
                total_perawat_bidan: appData.sdmk.filter(s => s.jenis_tenaga?.match(/Perawat|Bidan/)).length,
                total_unit: appData.unit_kerja.length,
                total_tpm: appData.tpm.length,
                total_spesialis: appData.spesialis.length
            } 
        }),
        'getPengumuman': () => ({ success: true, data: appData.pengumuman }),
        'getSDMKData': () => ({ success: true, data: appData.sdmk }),
        'getRenbut': () => ({ success: true, data: appData.renbut }),
        'getUnitKerja': () => ({ success: true, data: appData.unit_kerja }),
        'getTPMData': () => ({ success: true, data: appData.tpm }),
        'getSpesialisData': () => ({ success: true, data: appData.spesialis }),
        'getRasioData': () => ({ success: true, data: appData.rasio }),
        'getAnjabData': () => ({ success: true, data: appData.anjab }),
        'getRekapSDMK': () => ({ success: true, data: appData.rekap_sdmk }),
        'getRekapSpesialis': () => ({ success: true, data: appData.rekap_spesialis }),
        'getUsers': () => ({ success: true, data: appData.users }),
        'getActivityLog': () => ({ success: true, data: appData.activity_log })
    };
    
    if (offlineHandlers[action]) {
        return offlineHandlers[action]();
    }
    
    return { success: false, message: 'Tidak terhubung ke server' };
}

// ==================== MAIN API ROUTER (callAPI) ====================

/**
 * MAIN API FUNCTION - Router untuk semua database operations
 * Menggantikan callAPI dari Google Apps Script
 * 
 * @param {string} action - Action name
 * @param {object} params - Action parameters
 * @returns {Promise<object>} Result object
 */
async function callAPI(action, params = {}) {
    console.log(`[MANDAT-API] ${action}`, params);
    
    // Initialize jika belum
    if (!supabaseClient) {
        if (!initSupabase()) {
            // Fallback: offline mode
            return handleOfflineAction(action, params);
        }
    }
    
    try {
        let result;
        
        switch (action) {
            // ==================== AUTH ====================
            case 'login':
                result = await loginSupabase(params.username, params.password);
                break;
                
            // ==================== DASHBOARD ====================
            case 'getDashboard':
                result = await getDashboardSummary();
                break;
                
            // ==================== PENGUMUMAN ====================
            case 'getPengumuman':
                result = await getPengumuman();
                break;
            case 'savePengumuman':
                result = await savePengumuman(params.data, params.id);
                break;
            case 'deletePengumuman':
                result = await deleteRecord('pengumuman', params.id);
                break;
                
            // ==================== RENBUT ====================
            case 'getRenbut':
                result = await getRenbut();
                break;
            case 'saveRenbut':
                result = await saveRenbut(params.data, params.id);
                break;
            case 'deleteRenbut':
                result = await deleteRecord('renbut', params.id);
                break;
                
            // ==================== SDMK ====================
            case 'getSDMKData':
                result = await getSDMK();
                break;
            case 'saveSDMK':
                result = await saveSDMK(params.data, params.id);
                break;
            case 'deleteSDMK':
                result = await deleteRecord('sdmk', params.id);
                break;
                
            // ==================== UNIT KERJA ====================
            case 'getUnitKerja':
                result = await getUnitKerja();
                break;
            case 'saveUnitKerja':
                result = await saveUnitKerja(params.data, params.id);
                break;
                
            // ==================== SPESIALIS ====================
            case 'getSpesialisData':
                result = await getSpesialis();
                break;
                
            // ==================== TPM ====================
            case 'getTPMData':
                result = await getTPM();
                break;
            case 'saveTPM':
                result = await saveTPM(params.data, params.id);
                break;
            case 'deleteTPM':
                result = await deleteRecord('tpm', params.id);
                break;
                
            // ==================== RASIO ====================
            case 'getRasioData':
                result = await getRasio();
                break;
            case 'calculateRasio':
                result = await getRasio(); // Rasio now auto-calculated
                break;
                
            // ==================== ANJAB ====================
            case 'getAnjabData':
                result = await getAnjabABK();
                break;
            case 'saveAnjab':
                result = await upsertRecord('anjab_abk', params.data);
                break;
                
            // ==================== REKAP ====================
            case 'getRekapSDMK':
                result = await getRekapSDMK();
                break;
            case 'saveRekapSDMK':
                result = await upsertRecord('rekap_sdmk', params.data);
                break;
            case 'deleteRekapSDMK':
                result = await deleteRecord('rekap_sdmk', params.id);
                break;
            case 'getRekapSpesialis':
                result = await getRekapSpesialis();
                break;
            case 'saveRekapSpesialis':
                result = await upsertRecord('rekap_spesialis', params.data);
                break;
                
            // ==================== USERS ====================
            case 'getUsers':
                result = await getUsers();
                break;
            case 'saveUser':
                result = await saveUser(params.data);
                break;
            case 'deleteUser':
                result = await deleteRecord('users', params.id);
                break;
                
            // ==================== LOGS ====================
            case 'getActivityLog':
                result = await getActivityLog();
                break;
            case 'logActivity':
                result = await logActivityToDB(params.action, params.module, params.description);
                break;
                
            default:
                result = { success: false, message: `Unknown action: ${action}` };
        }
        
        return result;
        
    } catch (err) {
        console.error(`[MANDAT-API] Error in ${action}:`, err);
        return { success: false, message: err.message || 'Terjadi kesalahan' };
    }
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

// ==================== EXPORT FOR EXTERNAL USE ====================
window.MANDAT_SUPABASE = {
    init: initSupabase,
    login: loginSupabase,
    logout: logoutSupabase,
    client: () => supabaseClient,
    callAPI: callAPI
};

console.log('[MANDAT] 📦 Supabase Client v1.0 loaded (External Version)');
console.log('[MANDAT] ✅ Functions available: callAPI, initSupabase, loginSupabase, dan lainnya...');
