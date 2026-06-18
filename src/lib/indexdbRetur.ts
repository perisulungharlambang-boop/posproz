/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ IndexedDB Service untuk Retur Barang
 * Mencatat retur penjualan (customer return) dan retur pembelian (return ke supplier)
 */

export interface ReturRecord {
  id: string;
  type: 'sale_return' | 'purchase_return';  // Retur penjualan / retur pembelian
  productId: string;
  productName: string;
  productSku: string;
  qty: number;
  price: number;           // Harga saat retur
  totalRefund: number;     // qty * price
  reason: string;          // Alasan retur
  // Untuk retur penjualan
  customerName: string;
  transactionId: string;
  // Untuk retur pembelian
  supplierName: string;
  supplierId: string;
  invoiceNumber: string;
  notes: string;
  created_at: number;
}

class IndexDBRetur {
  private dbName: string = "returDB";
  private storeName: string = "returs";
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {}

  private initDb(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (this.db) {
        resolve();
        return;
      }
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("productId", "productId", { unique: false });
          store.createIndex("type", "type", { unique: false });
          store.createIndex("created_at", "created_at", { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        console.error("IndexedDB returDB error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.initPromise;
  }

  private getObjectStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error("Database retur belum diinisialisasi.");
    const transaction = this.db.transaction(this.storeName, mode);
    return transaction.objectStore(this.storeName);
  }

  async add(record: ReturRecord): Promise<void> {
    return new Promise(async (resolve, reject) => {
      await this.initDb();
      const store = this.getObjectStore("readwrite");
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(): Promise<ReturRecord[]> {
    return new Promise(async (resolve, reject) => {
      await this.initDb();
      const store = this.getObjectStore("readonly");
      const request = store.getAll();
      request.onsuccess = () => {
        const result: ReturRecord[] = request.result || [];
        result.sort((a, b) => b.created_at - a.created_at);
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getByType(type: 'sale_return' | 'purchase_return'): Promise<ReturRecord[]> {
    const all = await this.getAll();
    return all.filter(r => r.type === type);
  }

  async getByProductId(productId: string): Promise<ReturRecord[]> {
    const all = await this.getAll();
    return all.filter(r => r.productId === productId);
  }

  async getTotalRefundByType(type: 'sale_return' | 'purchase_return'): Promise<number> {
    const items = await this.getByType(type);
    return items.reduce((sum, r) => sum + r.totalRefund, 0);
  }

  async delete(id: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      await this.initDb();
      const store = this.getObjectStore("readwrite");
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      await this.initDb();
      const store = this.getObjectStore("readwrite");
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  generateId(): string {
    return `retur_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

export const indexdbRetur = new IndexDBRetur();