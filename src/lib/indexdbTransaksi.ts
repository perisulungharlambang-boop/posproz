/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 🚀 PostgreSQL-enabled Transaction / Sales database service
 */

import { supabase, isPostgresConfigured } from './supabaseClient';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType } from './firebaseClient';
import { collection, getDocs, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

class IndexDBTransaksi {
  private dbName: string = "transaksiDB";
  private storeName: string = "transaksi";
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
        resolve();
      };
      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
    return this.initPromise;
  }

  private getObjectStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error("DB not init");
    return this.db.transaction(this.storeName, mode).objectStore(this.storeName);
  }

  async create(total: number, items: any[], customerName?: string, paymentMethod?: string, paidAmount?: number, subtotal?: number, discountAmount?: number): Promise<string> {
    const id = `TRX-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const pMethod = paymentMethod || 'cash';
    const pAmount = paidAmount !== undefined ? paidAmount : total;
    const cName = customerName || '';

    const transaksi = {
      id,
      total,
      subtotal: subtotal ?? total,
      discountAmount: discountAmount ?? 0,
      items,
      customerName: cName,
      paymentMethod: pMethod,
      paidAmount: pAmount,
      created_at: nowIso,
      is_synced: true
    };

    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'sales', id), {
          id,
          total,
          items,
          customerName: cName,
          paymentMethod: pMethod,
          paidAmount: pAmount,
          created_at: nowIso
        });
        console.log(`🟢 [Firebase]: Transaksi [${id}] berhasil disimpan.`);
      } catch (err) {
        console.error("Firebase Create Transaction Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `sales/${id}`);
        transaksi.is_synced = false;
      }
    }

    if (isPostgresConfigured) {
      try {
        const { error } = await supabase
          .from('sales')
          .insert({
            id,
            total,
            items: items, // PostgreSQL JSONB support
            created_at: nowIso
          });
        if (!error) {
          console.log(`🟢 PG: Transaksi [${id}] berhasil disimpan ke Cloud PostgreSQL.`);
        } else {
          console.warn("⚠️ PG: Gagal menyimpan transaksi online, beralih ke IndexedDB.", error);
          transaksi.is_synced = false;
        }
      } catch (e) {
        console.error("PG Create Transaction Error:", e);
        transaksi.is_synced = false;
      }
    } else if (!isFirebaseConfigured) {
      transaksi.is_synced = false;
    }

    await this.initDb();
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore("readwrite");
      const request = store.add(transaksi);
      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(): Promise<any[]> {
    if (isFirebaseConfigured) {
      try {
        const querySnapshot = await getDocs(collection(db, 'sales'));
        const cloudSales = querySnapshot.docs.map(d => d.data());
        // Simpan cloud sales secara senyap ke local IndexedDB
        await this.initDb();
        const store = this.getObjectStore("readwrite");
        for (const s of cloudSales) {
          store.put({ ...s, is_synced: true });
        }
        return cloudSales.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      } catch (err) {
        console.error("Firebase GetAll Transactions Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('sales')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) {
          return data.map((t: any) => ({
            id: t.id,
            total: Number(t.total ?? t.grand_total ?? 0),
            items: typeof t.items === 'string' ? JSON.parse(t.items) : (t.items || []),
            created_at: t.created_at || new Date().toISOString(),
            is_synced: true
          }));
        }
      } catch (e) {
        console.error("PG GetAll Transactions Error:", e);
      }
    }

    await this.initDb();
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore("readonly");
      const request = store.getAll();
      request.onsuccess = () => {
        const sorted = (request.result || []).sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        resolve(sorted);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getById(id: string): Promise<any> {
    if (isFirebaseConfigured) {
      try {
        const docSnap = await getDoc(doc(db, 'sales', id));
        if (docSnap.exists()) return docSnap.data();
      } catch (err) {
        console.error("Firebase Get Transaction Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('sales')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (!error && data) {
          return {
            id: data.id,
            total: Number(data.total ?? data.grand_total ?? 0),
            items: typeof data.items === 'string' ? JSON.parse(data.items) : (data.items || []),
            created_at: data.created_at || new Date().toISOString(),
            is_synced: true
          };
        }
      } catch (e) {
        console.error("PG Get Transaction Error:", e);
      }
    }

    await this.initDb();
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore("readonly");
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async count(): Promise<number> {
    if (isFirebaseConfigured) {
      try {
        const list = await this.getAll();
        return list.length;
      } catch {}
    }

    if (isPostgresConfigured) {
      try {
        const { count, error } = await supabase
          .from('sales')
          .select('*', { count: 'exact', head: true });
        if (!error && count !== null) return count;
      } catch (e) {
        console.error("PG Count Sales Error:", e);
      }
    }
    await this.initDb();
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore("readonly");
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, 'sales', id));
        console.log(`🟢 [Firebase]: Transaksi [${id}] berhasil dihapus.`);
      } catch (err) {
        console.error("Firebase Delete Transaction Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { error } = await supabase
          .from('sales')
          .delete()
          .eq('id', id);
        if (!error) console.log(`🟢 PG: Transaksi [${id}] berhasil dihapus.`);
      } catch (e) {
        console.error("PG Delete Transaction Error:", e);
      }
    }
    await this.initDb();
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore("readwrite");
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        const list = await this.getAll();
        for (const s of list) {
          await deleteDoc(doc(db, 'sales', s.id));
        }
        console.log(`🟢 [Firebase]: Semua transaksi penjualan dibersihkan.`);
      } catch (err) {
        console.error("Firebase Clear Sales Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { error } = await supabase
          .from('sales')
          .delete()
          .neq('id', '_dummy_id_');
        if (!error) console.log("🟢 PG: Semua transaksi dalam tabel sales berhasil dihapus.");
      } catch (e) {
        console.error("PG Clear Sales Error:", e);
      }
    }
    await this.initDb();
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore("readwrite");
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async createRaw(transaksi: any): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'sales', transaksi.id), {
          id: transaksi.id,
          total: transaksi.total,
          items: transaksi.items,
          created_at: transaksi.created_at
        });
      } catch (e) {
        console.error("Firebase createRaw Sales Error:", e);
      }
    }

    if (isPostgresConfigured) {
      try {
        await supabase
          .from('sales')
          .upsert({
            id: transaksi.id,
            total: transaksi.total,
            items: transaksi.items,
            created_at: transaksi.created_at
          });
      } catch (e) {
        console.error("PG CreateRaw Sales Error:", e);
      }
    }
    await this.initDb();
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore("readwrite");
      const request = store.put(transaksi);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const indexdbTransaksi = new IndexDBTransaksi();
