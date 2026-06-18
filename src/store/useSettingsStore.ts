/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsState {
  isWholesaleMode: boolean;
  darkMode: boolean;
  storeInfo: {
    name: string;
    address: string;
    phone: string;
    footer: string;
  };
  printer: {
    /** Lebar kertas thermal (umum: 58mm / 80mm) */
    paperWidthMm: 58 | 80;
    /** Tambahan tinggi halaman (mm) untuk kompensasi printer/driver yang suka memotong bawah */
    extraPageHeightMm: number;
    /** Mode render barcode untuk print (beberapa driver lebih cocok PNG dibanding SVG, atau sebaliknya) */
    barcodeRenderMode: 'svg' | 'png';
  };
  toggleWholesaleMode: () => void;
  toggleDarkMode: () => void;
  updateStoreInfo: (info: Partial<SettingsState['storeInfo']>) => void;
  updatePrinterSettings: (printer: Partial<SettingsState['printer']>) => void;

  /**
   * ✅ Store ini digunakan untuk semua pengaturan aplikasi global
   * Akan ditambahkan nanti:
   * - Session Login / User
   * - Status Lisensi Aplikasi
   * - Pengaturan Printer
   * - Pengaturan Scanner
   */
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isWholesaleMode: false,
      darkMode: false,
      storeInfo: {
        name: 'Toko Ceria',
        address: 'Jl. Merdeka No. 123, Jakarta',
        phone: '0812-3456-7890',
        footer: 'Terima Kasih Atas Kunjungan Anda!'
      },
      printer: {
        paperWidthMm: 58,
        extraPageHeightMm: 0,
        barcodeRenderMode: 'svg',
      },
      toggleWholesaleMode: () => set((state) => ({ isWholesaleMode: !state.isWholesaleMode })),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      updateStoreInfo: (info) => set((state) => ({ 
        storeInfo: { ...state.storeInfo, ...info } 
      })),
      updatePrinterSettings: (printer) => set((state) => ({
        printer: { ...state.printer, ...printer },
      })),
    }),
    {
      name: 'pos-app-settings',
      storage: createJSONStorage(() => localStorage),
      version: 2,
    }
  )
);
