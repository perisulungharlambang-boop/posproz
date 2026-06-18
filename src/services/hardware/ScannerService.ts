/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Service untuk menangkap input Barcode Scanner Hardware (HID Keyboard Mode)
 * Bekerja global di seluruh aplikasi tanpa fokus input
 * Support: Windows, Android, Web Browser
 */

interface ScannerCallback {
  (barcode: string): void;
}

class ScannerService {
  private buffer = '';
  private lastKeyTime = Date.now();
  private callbacks: ScannerCallback[] = [];
  private isAttached = false;

  private readonly SCANNER_KEY_INTERVAL = 100; // Max ms antar karakter dari scanner
  private readonly MIN_BARCODE_LENGTH = 3;

  start() {
    if (this.isAttached) return;

    window.addEventListener('keydown', this.handleKeyDown, { capture: true });
    this.isAttached = true;
    console.log("✅ Barcode Scanner global listener aktif");
  }

  stop() {
    window.removeEventListener('keydown', this.handleKeyDown, { capture: true });
    this.isAttached = false;
    this.buffer = '';
    console.log("⛔ Barcode Scanner global listener dihentikan");
  }

  subscribe(callback: ScannerCallback) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const currentTime = Date.now();
    const target = e.target as HTMLElement;
    const isScannerInput = target instanceof HTMLElement && target.dataset?.scannerInput === 'true';
    const isEditable =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    // ✅ Hanya tangkap input di field scanner khusus, atau ketika user tidak sedang mengetik manual di form lain.
    if (isEditable && !isScannerInput) {
      this.buffer = '';
      return;
    }

    // Reset buffer jika jeda terlalu lama (bukan input scanner)
    if (currentTime - this.lastKeyTime > this.SCANNER_KEY_INTERVAL) {
      this.buffer = '';
    }

    if (e.key === 'Enter') {
      // Jika buffer cukup panjang, ini adalah barcode
      if (this.buffer.length >= this.MIN_BARCODE_LENGTH) {
        e.preventDefault();
        e.stopImmediatePropagation();

        const barcode = this.buffer.trim();
        console.log("📟 Barcode terdeteksi:", barcode);
        
        // Broadcast ke semua subscriber
        this.callbacks.forEach(cb => cb(barcode));
      }
      this.buffer = '';
    } else if (e.key.length === 1) {
      // Hanya tambahkan karakter tunggal (bukan tombol fungsi)
      this.buffer += e.key;
    }

    this.lastKeyTime = currentTime;
  };
}

export const scannerService = new ScannerService();