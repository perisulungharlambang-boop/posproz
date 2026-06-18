# 🗺️ ROADMAP PENGEMBANGAN POS KASIR
### Daftar fitur yang akan dikembangkan selanjutnya

---

## 📋 LEGENDA PRIORITAS
| Label | Arti |
|-------|------|
| 🔥 P1 - High | Fitur kritis untuk bisnis, dampak besar |
| 📊 P2 - Medium | Meningkatkan analisis & kontrol |
| ⚡ P3 - Quick Win | Mudah dikerjakan, nilai tambah langsung |

---

## 🔥 P1 - HIGH IMPACT

| # | Fitur | Manfaat | File yang akan dibuat/diupdate |
|---|-------|---------|-------------------------------|
| 1 | **Pembayaran Non-Tunai** (QRIS, Transfer, Debit) | Pelanggan bisa bayar dengan QRIS/transfer. Tidak terbatas uang cash | `CheckoutModal.tsx` (tambah opsi pembayaran), `store/useCartStore.ts` (simpan metode bayar) |
| 2 | **Manajemen Stok Masuk / Pembelian** | Catat pembelian barang dari supplier, update stok otomatis, hitung HPP (Harga Pokok Penjualan) akurat | `src/lib/indexdbPurchase.ts`, `src/pages/PurchasePage.tsx`, `src/lib/indexdbBarang.ts` (tambah field `hargaBeli`) |
| 3 | **Multi-Toko / Multi-Cabang** | Satu instalasi bisa untuk beberapa cabang toko dengan pemisahan data | `src/lib/indexdbBranch.ts`, Auth logic, filter cabang di semua halaman |

---

## 📊 P2 - MEDIUM IMPACT

| # | Fitur | Manfaat | File yang akan dibuat/diupdate |
|---|-------|---------|-------------------------------|
| 4 | **Grafik Dashboard Interaktif** | Chart penjualan tren harian/bulanan/tahunan, top produk, top kategori | `src/pages/DashboardPage.tsx` (tambah section chart), `src/components/dashboard/` (komponen chart) |
| 5 | **Export Laporan PDF** | Export laporan ke PDF (tidak hanya Excel) untuk arsip/cetak | `src/pages/ReportPage.tsx` (tambah tombol PDF), library `jspdf` |
| 6 | **Notifikasi WhatsApp / Email** | Kirim notifikasi stok menipis, pengingat hutang jatuh tempo via WhatsApp/Email | `src/services/NotificationService.ts`, integrasi API WhatsApp |

---

## ⚡ P3 - QUICK WIN

| # | Fitur | Manfaat | File yang akan dibuat/diupdate |
|---|-------|---------|-------------------------------|
| 7 | **Dark Mode / Tema Gelap** | Tampilan gelap untuk kenyamanan mata saat kerja malam | `src/store/useSettingsStore.ts` (tambah `theme`), `index.css` (CSS variables), semua halaman (ganti `bg-white` jadi variable) |
| 8 | **Backup Database Otomatis** | Simpan backup ke local storage atau cloud secara periodik | `src/lib/indexdbUtils.ts` (scheduler backup), `SettingsPage.tsx` (toggle auto backup) |
| 9 | **Pencarian Produk via Suara** | Cari produk cukup dengan bicara (speech recognition API) | `src/hooks/useVoiceSearch.ts`, `InventoryPage.tsx` (tambah mic button) |
| 10 | **Multi Bahasa (i18n)** | Tampilan aplikasi bisa diganti Bahasa Indonesia / English | `src/lib/i18n.ts`, file terjemahan `locales/`, hook `useTranslation` |

---

## 📝 CATATAN IMPLEMENTASI

### Prioritas pengerjaan (rekomendasi):
```
1. Dark Mode (P3 - paling cepat, langsung kelihatan) ⏱ 1-2 jam
2. Backup Otomatis (P3 - keamanan data) ⏱ 1-2 jam
3. Pembayaran Non-Tunai (P1 - cari uang) ⏱ 3-4 jam
4. Manajemen Stok Masuk (P1 - akurasi HPP) ⏱ 4-5 jam
5. Export PDF (P2 - laporan lebih baik) ⏱ 2-3 jam
6. Grafik Dashboard (P2 - analisis visual) ⏱ 2-3 jam
7. Pencarian Suara (P3 - efisiensi) ⏱ 1-2 jam
8. Notifikasi WhatsApp (P2 - reminder) ⏱ 3-4 jam
9. Multi Bahasa (P3 - aksesibilitas) ⏱ 3-4 jam
10. Multi Cabang (P1 - skala bisnis) ⏱ 6-8 jam
```

---

## STATUS SAAT INI
✅ **13 FITUR UTAMA SELESAI** - Aplikasi already production ready
⏳ **10 FITUR BARU DIRENCANAKAN** - Siap dikerjakan satu per satu