# AI IDE Guidelines & Project Notes Serta SYSTEM PROMPT CODING STANDARDS

# SYSTEM PROMPT:
## 1. CORE ARCHITECTURAL RULES
- **Project Structure:** Single responsibility (1 file = 1 komponen/fungsi utama). Maksimal 300 baris per file.
- **Imports:** Gunakan absolute imports (path alias `@/`) dari root `src`.
- **Naming:** PascalCase untuk Komponen, camelCase untuk fungsi/variabel.
- **Tech Stack:** - Frontend: React + TypeScript + Vite + Tailwind CSS (Responsif & Multi-platform).
    - Database: SQLite utama.
    - Logic: Pisahkan Business Logic (Backend/Service layer) dari UI (Presentation layer).
- **Data Integrity:** Validasi data ketat di sisi backend/logic layer. Semua operasi database (Write/Update/Delete) harus bersifat atomik.

## 2. WORKFLOW & REASONING (CHAIN OF THOUGHT)
- **Discussion First:** Diskusikan dengan menggunakan bahasa indonesia dan pendekatan teknis (Step-by-step reasoning) sebelum menulis kode. Pertimbangkan edge-cases dan mengapa solusi tersebut adalah yang terbaik.
- **Documentation:** Berikan komentar bermakna pada blok logika atau algoritma yang kompleks (jangan *comment spam* di setiap baris).
- **berfikirlah step by step reasoning saat memutuskan sesuatu.jelaskan pendekatan teknisnya, pertimbangkan edge-cases,dan jelaskan mengapa solusinya adalah yg terbaik sebelum menulis kode.

## 3. DEFENSIVE CODING & UX
- **Loading State:** Semua aksi (Save/Delete/Update/Submit) WAJIB menggunakan `isLoading`. Disable tombol saat proses berlangsung.
- **Feedback:** Berikan indikator visual (spinner/teks) saat proses berjalan.
- **Error Handling:** Semua aksi (terutama IPC ke Rust/Backend) wajib dibungkus `try-catch`.
- **Communication:** Jika error terjadi, tampilkan pesan ke user (Toast/Alert) dan log detail error ke konsol.
- **Synchronization:** Anggap semua komunikasi backend sebagai async yang berpotensi gagal. Gunakan timeout jika diperlukan. Jangan biarkan proses berat memblokir main thread UI.

## 4. MANDATORY SELF-REVIEW & SELF-CORRECTION (Quality Gate)
Setiap kali Anda menulis atau memodifikasi kode, lakukan alur ini sebelum konfirmasi selesai:

1. **Self-Reflection:** - **Backend:** Cek *memory safety*, *unwrap* tidak aman, *panic*, atau *race condition*.
   - **Frontend:** Cek *re-render* yang tidak perlu, *dependency array* `useEffect`, dan *type safety*.
   - **Logic:** Cek efisiensi dan *edge cases*.
2. **Bug Hunt:** Cari potensi masalah (tombol mati, infinite loading, crash). Jika ditemukan error compiler/runtime, perbaiki sendiri tanpa menunggu perintah saya.
3. **Action:** Jika ditemukan masalah, perbaiki otomatis. Jika sudah bersih, beri catatan: *"Kode telah dianalisis mandiri dan aman."*

---
*Hanya beri tahu saya jika kode sudah benar-benar siap dan telah melewati proses self-review ini.*




# AI IDE Guidelines & Project Notes:
## hardware Integration (Barcodes & Printing)

### Barcode Scanners
- This app is designed to work with **USB/Wireless physical barcode scanners** that act as HID (Keyboard Emulation).
- **Implementation Note:** The application uses a global keydown listener to capture rapid numeric/alphanumeric input sequences. AI IDEs should maintain this global listener and ensure it filters out normal manual typing vs. rapid scanner input.
- **Preview Limitation:** Scanners will work in browser preview as long as focus is managed correctly.

### Receipt Printers
- This app uses the **Web Printing API (window.print())** with CSS Media Queries `@media print` for styling.
- **Compatibility:** This allows the app to work with *any* thermal printer (58mm/80mm) that is installed as a system printer on Windows, Mac, or Android (via Chrome Print Service).
- **Styling:** Maintain specific printer-friendly styles (monospace, calculated width, grayscale) in `PrinterService.ts` or relevant CSS.

## Persistence Layer (SQLite/IndexedDB)

- **Engine:** The application uses `IndexedDB` (via a wrapper like `dexie` or custom Dexie-like implementation) to mimic SQLite-like behavior in the browser.
- **Cloud Run Context:** Since this environment is ephemeral, data in `localStorage` or `IndexedDB` is **client-side only**. Moving to a persistent backend (Firebase/PostgreSQL) is the recommended path for production data safety.

## AI Features (Gemini API)

- **Key Management:** Uses `process.env.GEMINI_API_KEY`.
- **Functionality:** 
  - `AIService.ts` handles product identification and file scanning (Bulk Import).
  - AI is used for visual recognition of product labels and structured data extraction from photos/PDFs.

## Multi-Platform Deployment (Android/Windows)

- For **Android / Windows** standalone apps:
  - The project is compatible with **Capacitor** or **Electron**.
  - No changes should be made to the core logic that would break standard Web APIs, as they are the bridge to native functionality in those wrappers.
