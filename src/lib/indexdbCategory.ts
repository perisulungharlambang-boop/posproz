/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 🚀 PostgreSQL-enabled Category Database Service
 */

import { supabase, isPostgresConfigured } from './supabaseClient';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType } from './firebaseClient';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

class IndexDBCategory {
  private dbName: string = "categoryDB";
  private storeName: string = "categories";
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private initDb(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "name" });
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

  async getAll(): Promise<string[]> {
    const defaults = ['Makanan', 'Minuman', 'Elektronik', 'Alat Tulis', 'Umum'];
    
    if (isFirebaseConfigured) {
      try {
        const querySnapshot = await getDocs(collection(db, 'categories'));
        const fbNames = querySnapshot.docs.map(d => d.id);
        const mergedFb = [...new Set([...defaults, ...fbNames])].sort();
        // Simpan juga ke local db secara senyap agar data offline tetap memadai
        await this.initDb();
        const store = this.getObjectStore("readwrite");
        for (const name of fbNames) {
          store.put({ name });
        }
        return mergedFb;
      } catch (err) {
        console.error("Firebase GetAll Categories Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('name')
          .order('name', { ascending: true });
        if (!error && data) {
          const customNames = data.map((c: any) => c.name);
          return [...new Set([...defaults, ...customNames])].sort();
        }
      } catch (err) {
        console.error("PG GetAll Categories Error:", err);
      }
    }

    await this.initDb();
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore("readonly");
      const request = store.getAll();
      request.onsuccess = () => {
        const data: { name: string }[] = request.result || [];
        const customNames = data.map((c: any) => c.name || c);
        const merged = [...new Set([...defaults, ...customNames])].sort();
        resolve(merged);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async add(name: string): Promise<boolean> {
    const trimmed = name.trim();
    if (!trimmed) return false;

    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'categories', trimmed), { name: trimmed });
        console.log(`🟢 [Firebase]: Kategori [${trimmed}] berhasil disimpan.`);
      } catch (err) {
        console.error("Firebase Add Category Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `categories/${trimmed}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { error } = await supabase
          .from('categories')
          .upsert({ name: trimmed }, { onConflict: 'name' });
        if (!error) console.log(`🟢 PG: Kategori [${trimmed}] berhasil ditambahkan.`);
      } catch (err) {
        console.error("PG Add Category Error:", err);
      }
    }

    await this.initDb();
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore("readwrite");
      const request = store.put({ name: trimmed });
      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        if (request.error?.name === 'ConstraintError') {
          resolve(false);
        } else {
          reject(request.error);
        }
      };
    });
  }

  async delete(name: string): Promise<boolean> {
    const defaults = ['Makanan', 'Minuman', 'Elektronik', 'Alat Tulis', 'Umum'];
    if (defaults.includes(name)) return false;

    if (isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, 'categories', name));
        console.log(`🟢 [Firebase]: Kategori [${name}] berhasil dihapus.`);
      } catch (err) {
        console.error("Firebase Delete Category Error:", err);
        handleFirestoreError(err, OperationType.DELETE, `categories/${name}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { error } = await supabase
          .from('categories')
          .delete()
          .eq('name', name);
        if (!error) console.log(`🟢 PG: Kategori [${name}] dihapus.`);
      } catch (err) {
        console.error("PG Delete Category Error:", err);
      }
    }

    await this.initDb();
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore("readwrite");
      const request = store.delete(name);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }
}

export const indexdbCategory = new IndexDBCategory();
