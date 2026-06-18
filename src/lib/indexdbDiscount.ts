/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * IndexedDB Service untuk Diskon & Promo
 */

export interface Discount {
  id: string;
  code: string;
  name: string;
  type: 'percentage' | 'nominal';
  value: number;
  minPurchase: number;
  maxDiscount: number;
  isActive: boolean;
  usageLimit: number;
  usageCount: number;
  validFrom: number;
  validUntil: number;
  created_at: number;
  updated_at: number;
}

export interface ActiveDiscount {
  discountId: string;
  code: string;
  type: 'percentage' | 'nominal';
  value: number;
  name: string;
}

class IndexDBDiscount {
  private dbName: string = "discountDB";
  private storeName: string = "discounts";
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDb();
  }

  private initDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve();
        return;
      }
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("code", "code", { unique: true });
        }
      };
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      request.onerror = (event) => {
        console.error("discountDB error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  private getObjectStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error("DB not init");
    return this.db.transaction(this.storeName, mode).objectStore(this.storeName);
  }

  async getAll(): Promise<Discount[]> {
    await this.initDb();
    return new Promise((resolve, reject) => {
      const req = this.getObjectStore("readonly").getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async save(d: Discount): Promise<void> {
    await this.initDb();
    return new Promise((resolve, reject) => {
      const req = this.getObjectStore("readwrite").put({...d, updated_at: Date.now()});
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async delete(id: string): Promise<void> {
    await this.initDb();
    return new Promise((resolve, reject) => {
      const req = this.getObjectStore("readwrite").delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /** Validasi kode diskon: cek apakah aktif, masih berlaku, belum melebihi limit */
  async validateCode(code: string, total: number): Promise<{ valid: boolean; discount?: ActiveDiscount; error?: string }> {
    await this.initDb();
    const all = await this.getAll();
    const d = all.find(x => x.code.toUpperCase() === code.toUpperCase().trim());

    if (!d) return { valid: false, error: 'Kode diskon tidak ditemukan' };
    if (!d.isActive) return { valid: false, error: 'Kode diskon sudah tidak aktif' };
    if (d.validUntil < Date.now()) return { valid: false, error: 'Kode diskon sudah kedaluwarsa' };
    if (d.validFrom > Date.now()) return { valid: false, error: 'Kode diskon belum berlaku' };
    if (d.usageLimit > 0 && d.usageCount >= d.usageLimit) return { valid: false, error: 'Kode diskon sudah habis digunakan' };
    if (total < d.minPurchase) return { valid: false, error: `Minimal belanja ${d.minPurchase.toLocaleString('id-ID')}` };

    const rawDiscount = d.type === 'percentage' ? Math.round(total * d.value / 100) : d.value;
    const diskonFinal = d.maxDiscount > 0 ? Math.min(rawDiscount, d.maxDiscount) : rawDiscount;

    return {
      valid: true,
      discount: {
        discountId: d.id,
        code: d.code,
        type: d.type,
        value: diskonFinal,
        name: d.name,
      }
    };
  }

  /** Tambah pemakaian kode diskon */
  async incrementUsage(id: string): Promise<void> {
    const all = await this.getAll();
    const d = all.find(x => x.id === id);
    if (d) {
      d.usageCount = (d.usageCount || 0) + 1;
      await this.save(d);
    }
  }

  generateId(): string { return `disc_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }
}

export const indexdbDiscount = new IndexDBDiscount();