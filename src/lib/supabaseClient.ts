/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 🚀 SUPABASE CLIENT - POSTGRESQL GATEWAY
 * ✅ Mengubungkan aplikasi React langsung ke database PostgreSQL Supabase
 * ✅ Aman & Handal dari lingkungan browser web
 */

import { createClient } from '@supabase/supabase-js';

const meta = import.meta as any;
const supabaseUrl = meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = meta.env?.VITE_SUPABASE_ANON_KEY || '';

// Periksa kelengkapan konfigurasi
export const isPostgresConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://your-project-url.supabase.co');

if (!isPostgresConfigured) {
  console.warn("⚠️ [PostgreSQL]: Config Supabase (URL / Anon Key) belum diisi di file .env. Aplikasi berjalan menggunakan mode IndexedDB offline.");
} else {
  console.log("🟢 [PostgreSQL]: Supabase Client berhasil diinisialisasi. Database PostgreSQL siap melayani online.");
}

// Gunakan credentials dummy jika belum dikonfigurasi agar inisialisasi tidak melempar error fatal
const targetUrl = isPostgresConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co';
const targetKey = isPostgresConfigured ? supabaseAnonKey : 'placeholder-anon-key-to-prevent-crash';

export const supabase = createClient(targetUrl, targetKey);
