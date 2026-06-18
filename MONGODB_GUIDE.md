# 🍃 Panduan Integrasi & Koneksi MongoDB Online (Multi-User)

Panduan ini berisi penjelasan lengkap dan langkah demi langkah untuk menghubungkan aplikasi POS/Kasir Anda ke **MongoDB**, salah satu database Document NoSQL paling populer di dunia. 

Dengan MongoDB, seluruh data transaksi, produk, dan pengguna kini dapat disimpan di cloud online, memungkinkan **sinkronisasi seketika (real-time)** antara Admin di kantor, Kasir di toko, dan staf Gudang melalui jaringan internet.

---

## 🏗️ Mengapa MongoDB & Mongoose?
1. **Penyimpanan Berorientasi Dokumen (Document-based)**: Format penyimpanan data NoSQL JSON/BSON sangat selaras dengan objek JavaScript/TypeScript di frontend React, meminimalkan kompleksitas konversi data.
2. **Skema Fleksibel & Dinamis**: Cocok untuk kustomisasi atribut produk kasir yang bervariasi (diskon, barcode, dsb).
3. **Mongoose ODM**: Pustaka tangguh yang menyediakan validasi skema bertipe-aman (Type-Safe), kueri relasional virtual, serta penanganan koneksi pool otomatis.

---

## 🛠️ Langkah 1: Registrasi & Pembuatan Database MongoDB Atlas (Cloud Gratis)

1. Buka [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) dan klik **Try Free** untuk membuat akun baru.
2. Buat organisasi baru dan klik **Create a Deployment / Cluster**.
3. Pilih **M0 (Free Sandbox)** sebagai paket gratis (gratis selamanya dengan penyimpanan 512 MB, sangat cukup untuk ratusan ribu transaksi kasir).
4. Pilih penyedia cloud terdekat (misalnya: *AWS / Singapore*) untuk meminimalkan waktu respon (latency).
5. Pada bagian **Security Quickstart**:
   - **Username & Password**: Buat database user baru (contoh: `admin_kasir`) dan dapatkan password otomatis yang kuat. *Catat kredensial ini!*
   - **IP Access List**: Untuk kemudahan pengembangan, masukkan IP universal `0.0.0.0/0` agar server website Anda dapat terhubung dari server cloud manapun (seperti Cloud Run, Vercel, dll).
6. Masuk ke tab **Database**, klik tombol **Connect** pada cluster yang baru dibuat.
7. Pilih metode koneksi **Drivers** (Node.js), lalu salin alamat URL Koneksi (**Connection String**).
   *Contoh Format Connection String:*
   ```text
   mongodb+srv://admin_kasir:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```

---

## 🔐 Langkah 2: Konfigurasi Environment Variables (`.env`)

Kredensial database di atas bersifat sangat rahasia dan **TIDAK BOLEH** dibiarkan terlihat di browser klien. Oleh karena itu, kita mendefinisikannya di berkas `.env` (atau di config platform hosting) agar di-load secara aman di sisi backend.

Buka berkas `.env` pada root direktori Anda dan tambahkan baris berikut:

```env
# URL Koneksi yang disalin dari MongoDB Atlas (ganti <db_password> dengan password Anda yang sebenarnya)
MONGODB_URI="mongodb+srv://admin_kasir:SandiRahasia123@cluster0.abcde.mongodb.net"

# Nama Database yang ingin digunakan di cluster tersebut
MONGODB_DB_NAME="pos_pintar"
```

*Catatan: Pastikan `.env` terdaftar di `.gitignore` agar sandi tidak terunggah ke repositori Git publik!*

---

## ⚙️ Langkah 3: Penjelasan Kode Instansiasi & Model (`MongoDBService.ts`)

Kami telah membuatkan sistem koneksi dan pemodelan database yang sangat matang dan siap pakai di:  
👉 **`/src/services/db/MongoDBService.ts`**

Fitur-fitur utama yang dibawanya:
* **Connection Pooling**: Menggunakan Mongoose Singleton Manager agar status tersambung/tidak tersambung tetap stabil, mencegah inisialisasi berulang kali saat dipanggil berkali-kali.
* **Auto-Index compilation protection**: Mencegah eror *"Cannot overwrite model once compiled"* yang biasa terjadi di React/Vite dev mode saat perubahan kode terjadi.
* **Skema Struktur Data Lengkap**:
  * `MongoUser` (Akun kasir: admin, kasir, gudang, status aktif)
  * `MongoProduct` (Informasi barcode, SKU, stok minimal, harga beli, harga grosir, dsb)
  * `MongoTransaction` (Histori struk, metode bayar cash/qris/debit, detail kembalian, subtotal, diskon)
  * `MongoSetting` (Informasi metadata profil toko kelontong/ritel Anda)

---

## 📡 Langkah 4: Hubungan Server-Side API (Express.js Backend Wrapper)

Karena database tidak boleh melayani sambungan TCP langsung dari browser pengguna, kita merekomendasikan transisi aplikasi Anda menjadi **Full-Stack (Vite + Express)** dengan endpoint API penengah:

### 1. Buat Berkas Server Entrypoint Utama: `server.ts`
Buat berkas `server.ts` di folder root untuk melayani transfer data via HTTP JSON:

```typescript
import express from 'express';
import cors from 'cors';
import { mongoDBService, MongoProduct, MongoTransaction } from './src/services/db/MongoDBService';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Jalankan koneksi MongoDB saat server dinyalakan
mongoDBService.connect();

// ------------------------------------------
// ENDPOINT 1: AMBIL SEMUA PRODUK DARI CLOUD
// ------------------------------------------
app.get('/api/products', async (req, res) => {
  try {
    const products = await MongoProduct.find({}).sort({ name: 1 });
    res.json({ success: true, data: products });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ------------------------------------------
// ENDPOINT 2: TAMBAH PRODUK BARU
// ------------------------------------------
app.post('/api/products', async (req, res) => {
  try {
    const newProduct = new MongoProduct(req.body);
    const saved = await newProduct.save();
    res.json({ success: true, data: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ------------------------------------------
// ENDPOINT 3: CATAT TRANSAKSI PENJUALAN KASIR
// ------------------------------------------
app.post('/api/transactions', async (req, res) => {
  const session = await MongoProduct.startSession();
  try {
    session.startTransaction();
    
    const trxData = req.body;
    // 1. Simpan Transaksi Struk
    const newTrx = new MongoTransaction(trxData);
    await newTrx.save({ session });

    // 2. Potong Stok Produk Otomatis di Cloud!
    for (const item of trxData.items) {
      await MongoProduct.findOneAndUpdate(
        { id: item.productId },
        { $inc: { stock: -item.qty } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();
    res.json({ success: true, message: 'Transaksi tersimpan dan stok terpotong online!' });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API Server untuk MongoDB aktif di http://localhost:${PORT}`);
});
```

---

## 🔄 Langkah 5: Cara Sinkronisasi Data Lama (IndexedDB) ke MongoDB

Untuk memudahkan Anda yang saat ini sudah memiliki banyak data toko, produk, dan riwayat di browser lokal agar tidak terbuang sia-sia, kami telah melengkapi MongoDBService dengan fungsi **Sync Otomatis**.

Cukup buat tombol "Koneksikan & Unggah ke MongoDB" pada menu Pengaturan/Toko di React, lalu panggil kode berikut:

```typescript
import { mongoDBService } from '@/services/db/MongoDBService';
import { databaseService } from '@/services/db/DatabaseService';

async function handleSyncLokalKeCloud() {
  try {
    // 1. Ambil cadangan JSON lengkap dari penyimpanan lokal browser (IndexedDB)
    const localBackupBytes = await databaseService.backupToJSON();
    
    // 2. Kirim payload backup ke server / panggil fungsi impor MongoDBService
    const result = await mongoDBService.importBackupToMongo(localBackupBytes);
    
    alert(`🎉 Sukses mengunggah data lokal ke MongoDB Cloud!
    - Produk terunggah: ${result.productsSynced} item
    - Histori struk terunggah: ${result.transactionsSynced} transaksi
    - Pengaturan toko terunggah: ${result.settingsSynced} setelan
    
    Kini aplikasi Anda sepenuhnya sinkron dan aman di Cloud Online!`);
  } catch (err) {
    console.error("Gagal melakukan migrasi ke MongoDB:", err);
    alert("Terjadi kesalahan sinkronisasi, silakan cek konsol developer.");
  }
}
```

---

## 🔒 Tips Keamanan Produksi
1. **Gunakan Connection String Terenkripsi (TLS/SSL)**: MongoDB Atlas secara bawaan mewajibkan koneksi aman menggunakan enkripsi TLS/SSL.
2. **Jangan Publikasikan Credentials**: Gunakan `.env` di server deployment dan panggil dari `process.env`.
3. **Optimalkan Index**: Pastikan properti pencarian tersering seperti `barcode` dan `sku` ditandai `{ unique: true }` atau `{ index: true }` di skema Mongoose untuk menjamin kecepatan kueri kasir di bawah 10ms.
