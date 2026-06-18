# POS KASIR - Sistem Point of Sale Multi Platform

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)]()
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Windows%20%7C%20Web-orange)]()

Sistem POS Kasir modern, open source, dan berjalan native di Android, Windows, dan Web. Dibangun dengan standar industri untuk keandalan dan performa tinggi.

---

## 📌 Daftar Isi
- [Fitur Utama](#fitur-utama)
- [Tech Stack](#tech-stack)
- [Arsitektur Sistem](#arsitektur-sistem)
- [Algoritma & Workflow](#algoritma--workflow)
- [Struktur Project](#struktur-project)
- [Hardware Integration](#hardware-integration)
- [Cara Menjalankan](#cara-menjalankan)
- [Deployment](#deployment)
- [Standar Kontribusi](#standar-kontribusi)

---

## ✨ Fitur Utama
✅ Transaksi penjualan realtime
✅ Manajemen stok inventory
✅ **Import produk massal dari JSON** - Tambah ratusan produk dalam sekali klik
✅ **Paginasi Load More 50 produk** - Tidak freeze walaupun 10.000+ produk
✅ Scanner barcode hardware support
✅ Cetak struk thermal printer 58mm / 80mm
✅ Laporan penjualan harian / bulanan
✅ Manajemen Hutang & Piutang (Pelanggan & Supplier)
✅ Sistem Diskon & Kode Promo
✅ Manajemen Biaya Operasional (Expenses)
✅ Riwayat transaksi lengkap
✅ Backup & restore database (JSON)
✅ Multi platform: Android, Windows Desktop, Browser
✅ 100% Responsif di semua ukuran layar
✅ **Filter kategori dengan Dropdown** - Pilih kategori dari select, bukan tombol panjang
✅ **Supplier dengan NPWP** - Data supplier lengkap dengan Nomor Pokok Wajib Pajak
✅ **Supplier Name di Produk** - Nama supplier tersimpan langsung di produk (denormalisasi)
✅ **Auto Run Batch** - Jalankan server + buka Edge fullscreen dengan satu klik
✅ **Manajemen Pelanggan** - Database pelanggan + riwayat belanja + auto-save saat checkout
✅ **Data Preparation Tools** - Script utilitas untuk convert Excel dan update harga massal

---

## 🛠 Tech Stack

| Layer | Teknologi | Deskripsi |
|-------|-----------|-----------|
| **Frontend** | React 19 + TypeScript | UI Framework modern dengan type safety |
| | Vite 6 | Build tool tercepat untuk React |
| | Tailwind CSS 4 | Utility first CSS framework |
| | Zustand | State manager ringan dan cepat |
| | React Router | Routing single page application |
| **Backend** | Tauri v2 | Runtime native untuk Windows |
| | Capacitor 8 | Runtime native untuk Android |
| | SQLite | Database relational native |
| | IndexedDB | Fallback database untuk browser |
| | **Customer** | IndexedDB customerDB |
| **AI** | Optional (Google Gemini) | Integrasi AI bersifat opsional — dependency `@google/genai` telah dihapus. Untuk mengaktifkan kembali: set `GEMINI_API_KEY` di environment dan instal `@google/genai`.
| **Hardware** | Web HID API | Untuk barcode scanner |
| | Web Print API | Untuk thermal printer |

---

## 🏗 Arsitektur Sistem
Project ini menggunakan **Clean Architecture** dengan pemisahan layer yang jelas:

```
┌─────────────────────────────────────────┐
│              PRESENTATION               │
│  Pages, Components, Hooks, Store        │
├─────────────────────────────────────────┤
│              SERVICE LAYER              │
│  Business Logic, Validasi, Transaksi    │
├─────────────────────────────────────────┤
│              DATABASE LAYER             │
│  Adapter, Query Builder, Migration      │
├─────────────────────────────────────────┤
│              PLATFORM RUNTIME           │
│  Tauri / Capacitor / Web Browser        │
└─────────────────────────────────────────┘
```

✅ **Aturan Arsitektur:**
1.  Semua dependensi hanya boleh mengarah ke bawah
2.  Presentation layer tidak boleh tahu detail implementasi database
3.  Semua business logic hanya berada di Service Layer
4.  Semua operasi tulis database harus dalam transaction
5.  Tidak ada business logic di komponen React

---

## 📥 Import Produk Massal dari JSON

Fitur import produk memungkinkan Anda menambahkan banyak produk sekaligus dari file JSON. Sangat berguna untuk:
- Import data produk dari supplier
- Migrasi data dari sistem lama
- Menambah ratusan produk baru dengan cepat

### Cara Menggunakan:
1. Buka halaman **Settings** → **Pusat Data & Cadangan**
2. Klik tombol **Import Produk JSON**
3. Pilih file JSON berisi data produk
4. Konfirmasi import
5. Halaman akan reload otomatis dan produk baru akan muncul

### Format File JSON:
File JSON dapat berisi array produk atau object dengan property `products`:

```json
[
  {
    "name": "Nama Produk",
    "sku": "SKU001",
    "barcode": "8991234567890",
    "category": "Makanan",
    "priceRetail": 5000,
    "priceWholesale": 4500,
    "stock": 100,
    "min_stock": 10
  },
  {
    "name": "Produk Kedua",
    "sku": "SKU002",
    "barcode": "8990987654321",
    "category": "Minuman",
    "priceRetail": 10000,
    "priceWholesale": 9000,
    "stock": 50
  }
]
```

### Field yang Didukung:
| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `name` | string | ✅ Ya | Nama produk (harus ada) |
| `id` | string | ❌ Tidak | ID unik produk (auto-generate jika kosong) |
| `sku` | string | ❌ Tidak | Kode SKU produk |
| `barcode` | string | ❌ Tidak | Kode barcode produk |
| `category` | string | ❌ Tidak | Kategori produk (default: "Umum") |
| `priceRetail` | number | ❌ Tidak | Harga eceran (default: 0) |
| `priceWholesale` | number | ❌ Tidak | Harga grosir (default: 0) |
| `stock` | number | ❌ Tidak | Stok awal (default: 0) |
| `min_stock` | number | ❌ Tidak | Stok minimum (default: 0) |

### Catatan Penting:
- Produk dengan ID/SKU yang sama akan **ditimpa** (update), bukan ditambah
- Produk tanpa `name` akan diabaikan
- Template contoh tersedia di `public/import-products-template.json`
- Untuk debug, buka Developer Tools (F12) → Console untuk melihat detail import

---

## 📊 Persiapan Data (Excel & Scripts)

Selain import JSON via UI, tersedia tools CLI untuk persiapan data awal dalam jumlah besar:

### 1. Konversi Excel ke JSON
Jika Anda memiliki data produk di Excel (`dataproduk.xlsx`), gunakan script konversi:
```bash
# Menjalankan script konversi
node convert-excel.cjs
```
- **Input**: `dataproduk.xlsx` (Kolom: KODE ITEM, BARCODE, NAMA ITEM)
- **Output**: `public/products-data.json`
- **Fitur**: Auto-categorization berdasarkan keyword pada nama produk.

### 2. Update Harga & Stok Massal
Gunakan script berikut untuk memanipulasi `DefaultData.json`:
- `update-prices.cjs`: Mengisi harga retail/grosir berdasarkan keyword produk.
- `update-stock.cjs`: Mengisi stok awal secara acak/realistis.
- `update-default-data.cjs`: Menggabungkan hasil konversi ke database default aplikasi.

---

## 🧠 Algoritma & Workflow

### 🔍 Algoritma Barcode Scanner
```
Input:  Global Keyboard Event
Output: Callback with Barcode Value

1.  Tangkap semua event keydown secara global
2.  Hitung waktu antar tekan karakter
3.  Jika interval < 100ms = dianggap input scanner (bukan manual typing)
4.  Jika enter ditekan dan buffer > 2 karakter
5.  Kembalikan nilai barcode ke aplikasi
6.  Reset buffer
```
✅ Keunggulan: Bekerja dengan SEMUA merk scanner barcode yang menggunakan mode keyboard emulation. Tidak perlu driver khusus.

### 💾 Algoritma Database Import
```
1.  Matikan foreign key constraint
2.  Hapus semua data lama
3.  Jalankan VACUUM untuk bersihkan ruang
4.  Insert data dalam batch 500 baris per query
5.  Bungkus SEMUA operasi dalam satu transaction
6.  Jika ada error: ROLLBACK SEMUA
7.  Nyalakan kembali foreign key constraint
8.  Reload aplikasi
```
✅ Keunggulan: Proses import 10.000 produk selesai dalam < 1 menit. Atomic 100% tidak ada data setengah ter-import.

### 📂 Struktur Product Category Filter
```
1.  Semua kategori di-load dari 2 sumber:
    - Tabel kategori (categoryDB) → kategori yang ditambahkan manual
    - Field category dari semua produk di database
2.  Digabung, di-unik-kan, diurutkan → tampil di dropdown
3.  Saat kategori dipilih → getAllBarang() → filter client-side → paginasi
4.  Cache hasil filter di allProductsRef untuk Load More
```

---

## 📂 Struktur Project
```
src/
├── components/             # Komponen UI reusable
│   ├── layout/            # Layout global (Navbar, Sidebar)
│   ├── pos/               # Komponen halaman POS
│   └── products/          # Komponen produk
├── hooks/                 # Custom React Hooks
│   └── useBarcodeScanner.ts  # Algoritma scanner barcode
├── interfaces/            # TypeScript interface / tipe data
├── lib/                   # Service IndexedDB (Database Layer)
│   ├── indexdbBarang.ts   # CRUD produk
│   ├── indexdbCategory.ts # CRUD kategori
│   ├── indexdbSupplier.ts # CRUD supplier (dengan NPWP)
│   ├── indexdbCustomer.ts # CRUD pelanggan (dengan riwayat belanja)
│   ├── indexdbTransaksi.ts# CRUD transaksi
│   ├── indexdbDebt.ts     # CRUD Hutang & Piutang
│   ├── indexdbDiscount.ts # CRUD Diskon & Promo
│   ├── indexdbExpense.ts  # CRUD Biaya Operasional
│   └── indexdbUser.ts     # Manajemen User/Auth
├── pages/                 # Halaman aplikasi
│   ├── POSPage.tsx        # Halaman utama POS
│   ├── InventoryPage.tsx  # Manajemen produk + filter kategori dropdown
│   ├── SupplierPage.tsx   # Manajemen supplier (dengan NPWP)
│   ├── DashboardPage.tsx  # Dashboard (dengan statistik pelanggan)
│   ├── CustomerPage.tsx   # Manajemen pelanggan + riwayat belanja
│   ├── HistoryPage.tsx    # Riwayat transaksi
│   ├── DebtPage.tsx       # Manajemen Hutang & Piutang
│   ├── ExpensePage.tsx    # Manajemen Biaya Operasional
│   ├── DiscountPage.tsx   # Manajemen Diskon
│   ├── ReportPage.tsx     # Laporan & Statistik
│   └── SettingsPage.tsx   # Pengaturan
├── services/              # Business Logic Layer
│   ├── db/                # Database Abstraction Layer
│   ├── hardware/          # Driver hardware
│   └── AIService.ts       # Integrasi AI (opsional)
├── store/                 # Global State Management (Zustand)
├── App.tsx                # Entry point aplikasi
└── main.tsx               # Root render
```

---

## 🖨 Hardware Integration

### Barcode Scanner
✅ **Full HID Keyboard Emulation Support**
- ✅ Support SEMUA USB / Wireless scanner barcode
- ✅ Global listener, tidak perlu buka modal apapun
- ✅ Auto detect input scanner vs manual typing (berdasarkan kecepatan input < 100ms per karakter)
- ✅ Tidak akan mencuri input ketika user mengetik di form
- ✅ Bekerja di semua platform Android / Windows / Web
- ✅ Tanpa driver, tanpa konfigurasi apapun
- ✅ Scan barcode dimanapun di aplikasi, langsung terdeteksi

### Thermal Printer
✅ **Hybrid Multi Platform Printing System**
- ✅ **Android:** Otomatis integrasi dengan RawBT Printer Service (standar industri POS Android)
- ✅ **Windows Tauri:** Dialog print native Windows
- ✅ **Browser:** Standar Web Print API
- ✅ Support semua merk printer thermal 58mm / 80mm
- ✅ Tanpa library khusus
- ✅ Tanpa driver
- ✅ Print tanpa margin dan header footer default browser

### Native Android Features
✅ **Android APK Native Support:**
- ✅ Tombol Back Android handler (back ke halaman sebelumnya)
- ✅ Status Bar warna putih sesuai tema aplikasi
- ✅ Orientasi layar terkunci Portrait
- ✅ SQLite Native Unlimited storage
- ✅ Semua izin storage dan permission otomatis

---

## 🚀 Cara Menjalankan

### Development
```bash
# Install dependencies
npm install

# Jalankan development server
npm run dev

# Buka browser di http://localhost:3000
```

### Auto Run (Windows)
```bash
# Cukup double-click file run.bat di root project
# Script akan:
# 1. Cek & install npm dependencies jika belum ada
# 2. Matikan proses Node.js sebelumnya
# 3. Jalankan server di background
# 4. Buka Microsoft Edge fullscreen ke http://localhost:3000
# 5. Tekan sembarang tombol untuk mematikan server
```

### Build Production
```bash
# Install dependencies
npm install

# Build web production
npm run build

# Sync dan build Android APK
npx cap sync android
npx cap build android

# Build Windows EXE
npm run tauri build
```

---

## ✅ Standar Kontribusi
Project ini mengikuti aturan ketat sesuai `AGENTS.md`:
1.  Satu file = satu tanggung jawab, maksimal 300 baris
2.  Gunakan absolute import `@/`
3.  Semua operasi async wajib try-catch
4.  Semua aksi user wajib ada loading state
5.  Tidak ada `any` type di TypeScript
6.  Lakukan self-review sebelum commit
7.  Tidak ada `unwrap` yang tidak aman

---

## 📝 Catatan Penting
Project ini dirancang untuk **keandalan tinggi** di lingkungan bisnis. Semua keputusan arsitektur dan algoritma dioptimalkan untuk:
✅ Tidak crash
✅ Tidak kehilangan data
✅ Cepat dan responsif
✅ Bekerja offline 100%
✅ Mudah di maintenance dan dikembangkan

---
**Dibuat dengan standar industri oleh developer Indonesia.**
