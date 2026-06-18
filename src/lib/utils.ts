/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(value);
};

/**
 * Utilitas untuk mengunduh file di browser
 */
export async function downloadFile(filename: string, content: string | Blob, type: 'json' | 'xlsx' | 'text' = 'text') {
  // Browser-only download
  const blob = content instanceof Blob ? content : new Blob([content], { 
    type: type === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/json' 
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Generate ID produk yang deterministik dan konsisten.
 *
 * Aturan prioritas:
 * 1. Jika ada `sku` atau `barcode` → pakai `prod_<sku>` (deterministik, tidak berubah)
 * 2. Jika tidak ada keduanya → pakai `prod_<timestamp>_<random>` (fallback unik)
 *
 * Dengan cara ini, produk yang sama (SKU sama) selalu mendapat ID yang sama
 * di mana pun dia dibuat — import JSON, tambah manual, atau dari POS.
 */
export function generateProductId(sku?: string, barcode?: string): string {
  const key = (sku || barcode || '').toString().trim();
  if (key) {
    // Normalisasi: lowercase, hapus karakter non-alphanumeric kecuali - dan _
    const normalized = key.toLowerCase().replace(/[^a-z0-9\-_]/g, '_');
    return `prod_${normalized}`;
  }
  // Fallback: tidak ada SKU/barcode — gunakan UUID yang unik
  return `prod_no_sku_${crypto.randomUUID()}`;
}
