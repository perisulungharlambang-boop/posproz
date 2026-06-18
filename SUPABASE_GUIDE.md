# 🚀 Panduan Migrasi & Koneksi Database Supabase (Online Multi-User)

Panduan ini menjelaskan langkah demi langkah untuk memindahkan penyimpanan data lokal (**IndexedDB**) ke cloud database **Supabase (PostgreSQL)**, sehingga aplikasi Kasir/POS Anda dapat diakses secara online, sinkron secara real-time antara Admin, Kasir, dan Gudang, serta aman dari risiko kehilangan data lokal pada browser.

---

## 📌 Mengapa Menggunakan Supabase?
1. **PostgreSQL Tangguh**: Menyediakan database relasional level produksi secara gratis.
2. **Real-time Engine**: Mengizinkan sinkronisasi stok dan transaksi secara instan antar perangkat.
3. **Autentikasi Terbawa (Built-in Auth)**: Menggantikan sistem login IndexedDB dengan proteksi ketat tingkat server (Row Level Security).
4. **Skalabilitas**: Siap digunakan untuk banyak cabang toko atau multi-perangkat sekaligus.

---

## 🛠️ Langkah 1: Registrasi & Pembuatan Proyek di Supabase

1. Buka situs [https://supabase.com](https://supabase.com) dan klik **Sign Up** menggunakan akun GitHub atau Email Anda.
2. Di dashboard, klik tombol **New Project**.
3. Isi informasi proyek Anda:
   - **Name**: `Aplikasi POS Pintar` (atau sesuai nama toko Anda)
   - **Database Password**: *Buat password yang kuat dan catat baik-baik!*
   - **Region**: Pilih region terdekat dengan pengguna Anda (misalnya: `Singapore` untuk akses cepat di Indonesia).
   - **Pricing Plan**: Pilih **Free Tier** (Gratis).
4. Klik **Create new project** dan tunggu 2-3 menit hingga database Anda selesai disiapkan.

---

## 🗄️ Langkah 2: Menyiapkan Skema Database (SQL DDL)

Setelah proyek aktif, masuk ke menu **SQL Editor** di panel kiri Supabase, klik **New Query**, kemudian salin dan jalankan (klik **Run**) perintah SQL berikut untuk membuat tabel-tabel yang sesuai dengan struktur data aplikasi Anda saat ini:

```sql
-- 1. TABEL PENGGUNA (USERS)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Di produksi sebaiknya di-hash (misal bcrypt)
    name TEXT NOT NULL,
    role VARCHAR(20) CHECK (role IN ('admin', 'kasir', 'gudang')) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed User Default
INSERT INTO users (id, username, password, name, role) VALUES
('user_admin', 'admin', 'admin123', 'Administrator Utama', 'admin'),
('user_kasir', 'kasir', 'kasir123', 'Staf Kasir Utama', 'kasir'),
('user_gudang', 'gudang', 'gudang123', 'Staf Gudang / Helper', 'gudang')
ON CONFLICT (username) DO NOTHING;


-- 2. TABEL SUPPLIER
CREATE TABLE suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 3. TABEL PELANGGAN (CUSTOMERS)
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    points INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 4. TABEL PRODUK (PRODUCTS)
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    barcode VARCHAR(100) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    sku VARCHAR(100),
    category TEXT,
    buy_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    sell_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    stock INT NOT NULL DEFAULT 0,
    min_stock INT DEFAULT 5,
    unit VARCHAR(20) DEFAULT 'pcs',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 5. TABEL TRANSAKSI PENJUALAN (SALES)
CREATE TABLE sales (
    id TEXT PRIMARY KEY,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    user_id TEXT REFERENCES users(id),
    subtotal DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    tax DECIMAL(12,2) DEFAULT 0,
    grand_total DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- 'Tunai', 'QRIS', 'Transfer', 'Hutang'
    received_amount DECIMAL(12,2) NOT NULL,
    change_amount DECIMAL(12,2) NOT NULL,
    is_debt BOOLEAN DEFAULT FALSE,
    due_date TIMESTAMP WITH TIME ZONE,
    is_paid_debt BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 6. TABEL DETAIL TRANSAKSI PENJUALAN (SALES_ITEMS)
CREATE TABLE sales_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT REFERENCES sales(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    name TEXT NOT NULL,
    qty INT NOT NULL,
    buy_price DECIMAL(12,2) NOT NULL,
    sell_price DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL
);


-- 7. TABEL TRANSAKSI RESTOCK / MASUK (RE_STOCKS)
CREATE TABLE restocks (
    id TEXT PRIMARY KEY,
    supplier_id TEXT REFERENCES suppliers(id),
    total_items INT NOT NULL,
    grand_total DECIMAL(12,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 8. TABEL DETAIL RESTOCK (RESTOCK_ITEMS)
CREATE TABLE restock_items (
    id TEXT PRIMARY KEY,
    restock_id TEXT REFERENCES restocks(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    name TEXT NOT NULL,
    qty INT NOT NULL,
    buy_price DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL
);


-- 9. TABEL BIAYA OPERASIONAL (EXPENSES)
CREATE TABLE expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    notes TEXT,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 10. TABEL RETUR PRODUK (RETURS)
CREATE TABLE returs (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(id),
    product_name TEXT NOT NULL,
    qty INT NOT NULL,
    reason TEXT,
    type VARCHAR(20) CHECK (type IN ('customer_to_store', 'store_to_supplier')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🔌 Langkah 3: Mengkoneksikan Aplikasi React ke Supabase

### 1. Instalasi SDK Supabase
Jalankan perintah ini di terminal proyek Anda untuk mengunduh modul integrasi resmi:
```bash
npm install @supabase/supabase-js
```

### 2. Atur Environment Variables
Buka file `.env.example` di root proyek Anda, dan tambahkan parameter berikut:
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Buat file baru bernama `.env` di root proyek Anda (atau edit jika sudah ada), lalu isi dengan kredensial yang dapat Anda salin dari dashboard Supabase Anda di **Project Settings -> API**:
```env
VITE_SUPABASE_URL=https://xyk6k33h7khsktajrro3.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5...
```

### 3. Buat File Inisialisasi Klien Supabase
Buat file baru di `/src/lib/supabaseClient.ts` untuk memfasilitasi koneksi:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Konfigurasi Supabase belum lengkap! fallback ke IndexedDB lokal mungkin diperlukan.");
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
```

### 4. Mengubah File Layanan (Service Layer)
Untuk menghubungkan database online ini dengan visual web, ubah pemanggilan di file-file database lokal Anda (seperti `indexdbUser.ts` atau file db di `/src/services/db`) agar melakukan query langsung ke API Supabase.

#### Contoh implementasi login user dengan Supabase:
```typescript
// Ganti logika di /src/lib/indexdbUser.ts
import { supabase } from './supabaseClient';

export const indexdbUser = {
  async login(username, password) {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.toLowerCase())
      .eq('password', password) // sebaiknya gunakan bcrypt / hashing di backend nyata
      .single();

    if (error || !user) {
      return { success: false, error: 'Username atau Password salah!' };
    }

    if (!user.is_active) {
      return { success: false, error: 'Akun Anda telah dinonaktifkan.' };
    }

    // Set Session ke LocalStorage untuk status login di perangkat lokal
    localStorage.setItem('pos_current_user', JSON.stringify(user));
    return { success: true, user };
  },

  getCurrentUser() {
    const data = localStorage.getItem('pos_current_user');
    return data ? JSON.parse(data) : null;
  },

  isLoggedIn() {
    return this.getCurrentUser() !== null;
  },

  logout() {
    localStorage.removeItem('pos_current_user');
  }
};
```

#### Contoh sinkronisasi/fetch barang (Products):
```typescript
// Di file product service atau tempat mengambil produk
import { supabase } from '../lib/supabaseClient';

export const ProductService = {
  async getAllProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });
      
    if (error) throw error;
    return data;
  },

  async updateStock(productId: string, newStock: number) {
    const { data, error } = await supabase
      .from('products')
      .update({ stock: newStock, updated_at: new Date() })
      .eq('id', productId);

    if (error) throw error;
    return data;
  }
};
```

---

## 🌐 Langkah 4: Cara Deploy Aplikasi agar Online

Agar aplikasi kasir ini dapat diakses oleh kasir dan admin di mana pun (misalnya menggunakan HP, tablet, atau laptop), Anda perlu men-deploy asets frontend (Vite) ini ke cloud server statis gratis seperti **Vercel** atau **Netlify**:

### Menggunakan Vercel (Rekomendasi - Sangat Mudah)
1. Buat akun di [https://vercel.com](https://vercel.com) menggunakan akun Github Anda.
2. Hubungkan repositori Github Anda yang berisi kode aplikasi ini.
3. Klik **Import** pada proyek aplikasi kasir Anda.
4. Di bagian **Environment Variables**, masukkan key dan value berikut:
   - `VITE_SUPABASE_URL` = (Isi URL Supabase Anda)
   - `VITE_SUPABASE_ANON_KEY` = (Isi Token Anonim Supabase Anda)
5. Klik **Deploy**.
6. Selesai! Vercel akan otomatis menyajikan link URL (contoh: `https://kasir-pintar.vercel.app`) yang aman (HTTPS) dan siap digunakan online secara real-time.

---

## 🔒 Langkah 5: Keamanan Tambahan di Supabase
Untuk produksi, Anda wajib mengaktifkan **Row Level Security (RLS)** pada masing-masing tabel di Supabase Dashboard Anda. RLS memastikan kasir Anda hanya bisa menulis transaksi baru tetapi tidak bisa menghapus histori penjualan secara sembarangan, sementara admin memiliki akses kontrol penuh.

*Selamat mencoba dan semoga bisnis Anda semakin lancar dan berkembang!* 😉🚀
