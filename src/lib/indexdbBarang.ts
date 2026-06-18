/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 🚀 PostgreSQL-enabled Product Database Service
 * Support hybrid cloud-local operation.
 */

import defaultData from "../services/db/DefaultData.json";
import { supabase, isPostgresConfigured } from './supabaseClient';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType } from './firebaseClient';
import { collection, getDocs, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

class IndexDBBarang {
  private dbName: string = "barangDB";
  private storeName: string = "barang";
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private initDb(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "id" });
        }
      };
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.seedData();
        resolve();
      };
      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
    return this.initPromise;
  }

  private async seedData(): Promise<void> {
    try {
      const total = await this.count();
      if (total > 0 || !defaultData.data.products) return;
      const products = defaultData.data.products;
      const transaction = this.db!.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      for (const p of products) {
        const item = p as any;
        const sku = (item.sku || item.barcode || '').toString().trim();
        const id = item.id || `prod_${sku.toLowerCase().replace(/[^a-z0-9\-_]/g, ".")}`;
        const record = {
          id,
          name: item.name || '',
          sku,
          barcode: item.barcode || sku,
          category: item.category || 'Umum',
          priceRetail: item.priceRetail || item.price || 0,
          priceWholesale: item.priceWholesale || item.wholesale_price || 0,
          priceCost: item.priceCost || item.capitalPrice || 0,
          stock: item.stock || 0,
          min_stock: item.min_stock || 0,
          created_at: Date.now(),
          updated_at: Date.now()
        };
        store.add(record);

        // Jika Firebase terkonfigurasi pada boot pertama seed, sync ke cloud secara sepihak
        if (isFirebaseConfigured) {
          setDoc(doc(db, 'products', id), record).catch(() => {});
        }
      }
    } catch (e) {
      console.error("Seed error products:", e);
    }
  }

  private getObjectStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error("DB not init");
    return this.db.transaction(this.storeName, mode).objectStore(this.storeName);
  }

  private mapFromPostgres(p: any): any {
    return {
      id: p.id,
      name: p.name,
      sku: p.sku || '',
      barcode: p.barcode || '',
      category: p.category || 'Umum',
      priceRetail: Number(p.price_retail ?? p.priceRetail ?? 0),
      priceWholesale: Number(p.price_wholesale ?? p.priceWholesale ?? 0),
      priceCost: Number(p.price_cost ?? p.priceCost ?? 0),
      stock: Number(p.stock ?? 0),
      min_stock: Number(p.min_stock ?? 0),
      supplierId: p.supplier_id || p.supplierId || '',
      supplierName: p.supplier_name || p.supplierName || '',
      created_at: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
      updated_at: p.updated_at ? new Date(p.updated_at).getTime() : Date.now()
    };
  }

  private mapToPostgres(p: any): any {
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      category: p.category,
      price_retail: p.priceRetail,
      price_wholesale: p.priceWholesale,
      price_cost: p.priceCost,
      stock: p.stock,
      min_stock: p.min_stock,
      supplier_id: p.supplierId,
      supplier_name: p.supplierName,
      updated_at: new Date()
    };
  }

  async addBarang(barang: any): Promise<number> {
    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'products', barang.id.toString()), barang);
        console.log(`🟢 [Firebase]: Barang ${barang.name} berhasil disimpan.`);
      } catch (err) {
        console.error("Firebase Insert Product Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `products/${barang.id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { error } = await supabase
          .from('products')
          .insert(this.mapToPostgres(barang));
        if (!error) console.log("🟢 PG: Barang berhasil dimasukkan.");
      } catch (e) {
        console.error("PG Insert Product Error:", e);
      }
    }
    await this.initDb();
    return new Promise((resolve, reject) => {
      const req = this.getObjectStore("readwrite").add(barang);
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => reject(req.error);
    });
  }

  async getBarang(id: string | number): Promise<any> {
    if (isFirebaseConfigured) {
      try {
        const docSnap = await getDoc(doc(db, 'products', id.toString()));
        if (docSnap.exists()) return docSnap.data();
      } catch (err) {
        console.error("Firebase Get Product Error:", err);
        handleFirestoreError(err, OperationType.GET, `products/${id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', id.toString())
          .maybeSingle();
        if (!error && data) return this.mapFromPostgres(data);
      } catch (e) {
        console.error("PG Get Product Error:", e);
      }
    }
    await this.initDb();
    return new Promise((resolve, reject) => {
      const req = this.getObjectStore("readonly").get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllBarang(): Promise<any[]> {
    if (isFirebaseConfigured) {
      try {
        const querySnapshot = await getDocs(collection(db, 'products'));
        const cloudProducts = querySnapshot.docs.map(d => d.data());
        // Simpan cloud produk secara senyap ke local IndexedDB
        await this.initDb();
        const store = this.getObjectStore("readwrite");
        for (const p of cloudProducts) {
          store.put(p);
        }
        return cloudProducts;
      } catch (err) {
        console.error("Firebase GetAll Products Error:", err);
        handleFirestoreError(err, OperationType.LIST, 'products');
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true });
        if (!error && data) return data.map(p => this.mapFromPostgres(p));
      } catch (e) {
        console.error("PG GetAll Products Error:", e);
      }
    }
    await this.initDb();
    return new Promise((resolve, reject) => {
      const req = this.getObjectStore("readonly").getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async updateBarang(barang: any): Promise<void> {
    if (!barang.id && barang.id !== 0) {
      throw new Error("updateBarang: id wajib diisi.");
    }
    
    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'products', barang.id.toString()), barang);
        console.log(`🟢 [Firebase]: Barang ${barang.name} berhasil di-update.`);
      } catch (err) {
        console.error("Firebase Update Product Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `products/${barang.id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { error } = await supabase
          .from('products')
          .upsert(this.mapToPostgres(barang));
        if (!error) console.log("🟢 PG: Barang berhasil di-update.");
      } catch (e) {
        console.error("PG Upsert Product Error:", e);
      }
    }
    await this.initDb();
    return new Promise((resolve, reject) => {
      const req = this.getObjectStore("readwrite").put({
        ...barang,
        updated_at: barang.updated_at || Date.now()
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteBarang(id: string | number): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, 'products', id.toString()));
        console.log(`🟢 [Firebase]: Barang [${id}] berhasil dihapus.`);
      } catch (err) {
        console.error("Firebase Delete Product Error:", err);
        handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', id.toString());
        if (!error) console.log("🟢 PG: Barang berhasil dihapus.");
      } catch (e) {
        console.error("PG Delete Product Error:", e);
      }
    }
    await this.initDb();
    return new Promise((resolve, reject) => {
      const req = this.getObjectStore("readwrite").delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async count(): Promise<number> {
    if (isFirebaseConfigured) {
      try {
        const list = await this.getAllBarang();
        return list.length;
      } catch {}
    }

    if (isPostgresConfigured) {
      try {
        const { count, error } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true });
        if (!error && count !== null) return count;
      } catch (e) {
        console.error("PG Count Product Error:", e);
      }
    }
    await this.initDb();
    return new Promise((resolve, reject) => {
      const req = this.getObjectStore("readonly").count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getPaged(offset: number, limit: number): Promise<any[]> {
    if (isFirebaseConfigured) {
      try {
        const list = await this.getAllBarang();
        return list.slice(offset, offset + limit);
      } catch {}
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true })
          .range(offset, offset + limit - 1);
        if (!error && data) return data.map(p => this.mapFromPostgres(p));
      } catch (e) {
        console.error("PG Paged Products Error:", e);
      }
    }
    await this.initDb();
    return new Promise((resolve, reject) => {
      const req = this.getObjectStore("readonly").getAll();
      req.onsuccess = () => {
        resolve((req.result || []).slice(offset, offset + limit));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async search(query: string): Promise<any[]> {
    if (isFirebaseConfigured) {
      try {
        const list = await this.getAllBarang();
        const q = query.toLowerCase().trim();
        return list.filter(p => 
          p.name?.toLowerCase().includes(q) || 
          p.barcode?.includes(query) || 
          p.sku?.includes(query)
        );
      } catch {}
    }

    if (isPostgresConfigured) {
      try {
        // Cari berdasarkan barcode, sku, atau name
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .or(`name.ilike.%${query}%,barcode.ilike.%${query}%,sku.ilike.%${query}%`)
          .order('name', { ascending: true });
        if (!error && data) return data.map(p => this.mapFromPostgres(p));
      } catch (e) {
        console.error("PG Search Products Error:", e);
      }
    }
    await this.initDb();
    return new Promise((resolve, reject) => {
      const req = this.getObjectStore("readonly").getAll();
      req.onsuccess = () => {
        const q = query.toLowerCase().trim();
        const results = (req.result || []).filter(p => 
          p.name?.toLowerCase().includes(q) || 
          p.barcode?.includes(query) || 
          p.sku?.includes(query)
        );
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async clearAll(): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        const list = await this.getAllBarang();
        for (const item of list) {
          await deleteDoc(doc(db, 'products', item.id.toString()));
        }
        console.log(`🟢 [Firebase]: Semua produk telah dibersihkan.`);
      } catch (err) {
        console.error("Firebase Clear Product Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .neq('id', '_dummy_id_');
        if (!error) console.log("🟢 PG: Semua barang dihapus.");
      } catch (e) {
        console.error("PG Clear Products Error:", e);
      }
    }
    await this.initDb();
    return new Promise((resolve, reject) => {
      const req = this.getObjectStore("readwrite").clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async migrateIds(): Promise<{ migrated: number; skipped: number }> {
    await this.initDb();
    const all = await this.getAllBarang();
    let migrated = 0;
    let skipped = 0;
    for (const p of all) {
      const sku = (p.sku || p.barcode || '').toString().trim();
      if (typeof p.id === 'string' && p.id.startsWith('prod_')) {
        skipped++;
        continue;
      }
      const newId = sku ? `prod_${sku.toLowerCase().replace(/[^a-z0-9\-_]/g, ".")}` : `prod_no_sku_${crypto.randomUUID()}`;
      await this.deleteBarang(p.id);
      await this.updateBarang({ ...p, id: newId });
      migrated++;
    }
    return { migrated, skipped };
  }

  async deduplicateBySku(): Promise<{ removed: number; kept: number }> {
    await this.initDb();
    const all = await this.getAllBarang();
    const byKey = new Map<string, any[]>();
    for (const p of all) {
      const key = (p.sku || p.barcode || '').toString().trim();
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(p);
    }
    let removed = 0;
    for (const [, group] of byKey) {
      if (group.length <= 1) continue;
      group.sort((a, b) => b.updated_at - a.updated_at);
      for (let i = 1; i < group.length; i++) {
        await this.deleteBarang(group[i].id);
        removed++;
      }
    }
    return { removed, kept: all.length - removed };
  }
}

export const indexdbBarang = new IndexDBBarang();
