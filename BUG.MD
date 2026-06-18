# Panduan Penyelesaian Bug

Dokumen ini berisi template dan langkah-langkah standar untuk merekam, mendiagnosis, memperbaiki, dan memverifikasi bug pada proyek ini.

## Tujuan
- Menstandarisasi proses penyelesaian bug agar cepat, terukur, dan dapat direproduksi.

## Template Laporan Bug (untuk diisi sebelum mulai mengerjakan)
- **Judul singkat:** (mis. "Checkout gagal saat diskon 0%")
- **ID/Issue:** (nomor issue/PR terkait)
- **Prioritas:** (P0/P1/P2)
- **Dampak:** (pengguna terdampak, frekuensi)
- **Lingkungan:** (OS, browser, versi app: `npm run dev` / build)
- **Versi commit:** (hash commit atau branch)
- **Ringkasan masalah:** (1-2 kalimat)
- **Langkah reproduksi:**
  1. 
  2. 
  3. 
- **Ekspektasi:** (apa yang seharusnya terjadi)
- **Hasil aktual & log/stacktrace:** (salin error dan log)
- **Screenshot / rekaman:** (link atau file)

## Langkah Diagnosis
1. Verifikasi reproduksi pada lingkungan development:
   - Jalankan: `npm install` lalu `npm run dev`.
   - Ikuti langkah reproduksi pada browser/terminal.
2. Cek log aplikasi (console, network, indexedDB) dan backend (jika ada).
3. Cari referensi pada kode: gunakan pencarian untuk kata kunci error, nama fungsi, atau file terkait.
4. Tambahkan `console.log` / breakpoint untuk menemukan nilai variabel kunci.
5. Tuliskan hipotesis penyebab dan tes singkat untuk memvalidasinya.

## Panduan Perbaikan Kode
- Buat branch baru bernama `fix/<issue>-short-desc` dari `master`.
- Implementasi perubahan kecil dan atomic; sertakan komentar kenapa perubahan dibuat.
- Jika mengubah state atau persistence, pastikan migrasi data atau penanganan versi.

## Checklist Pengujian
- [ ] Unit tests (jika ada) ditambahkan/diupdate.
- [ ] Manual test: reproduksi awal sudah gagal, setelah perbaikan tidak gagal.
- [ ] Cek regresi pada fitur terkait.
- [ ] Lint & build sukses: `npm run build`.

## Verifikasi & Rollout
1. Jalankan CI / pipeline (jika ada).
2. Merge ke `master` setelah review dan hasil CI hijau.
3. Monitor logs & error tracking setelah deploy (1-24 jam tergantung prioritas).
4. Siapkan rollback plan kalau muncul issue baru.

## Contoh Isian (contoh singkat)
- Judul: Harga tampil 0 saat ada diskon 100%
- Lingkungan: Chrome 120, app v0.9.2 (commit abc123)
- Langkah reproduksi:
  1. Buka POS, pilih produk X
  2. Terapkan diskon 100%
  3. Total menampilkan 0
- Diagnosis: Fungsi `applyDiscount()` mengalikan `price * (1 - discount)` tanpa validasi; diskon 1.0 menghasilkan 0.
- Perbaikan: Batasi diskon max 0.99 atau gunakan aturan rounding; tambahkan test untuk kasus 100%.

## Catatan Untuk Pengembang
- Selalu sertakan deskripsi singkat pada commit terkait bugfix.
- Lakukan self-review: cek edge-case, performance, dan potensi regressi.

## Resources & Perintah Berguna
- Menjalankan dev server: `npm run dev`
- Build produksi: `npm run build`
- Jalankan linter: `npm run lint` (jika tersedia)
- Menjalankan test: `npm test` (jika tersedia)

---
Dokumen ini bisa diedit sesuai kebutuhan tim; minta review sebelum mengubah alur kerja standar.
