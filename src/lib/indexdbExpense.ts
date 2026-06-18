/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 🚀 PostgreSQL-enabled Expense Database Service
 */

import { supabase, isPostgresConfigured } from './supabaseClient';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType } from './firebaseClient';
import { collection, getDocs, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

export interface Expense {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: number;
  notes: string;
  created_at: number;
  updated_at: number;
}

export const EXPENSE_CATEGORIES = [
  'Listrik',
  'Air',
  'Internet',
  'Sewa Tempat',
  'Gaji Karyawan',
  'Perlengkapan',
  'Maintenance',
  'Transportasi',
  'Pemasaran',
  'Lainnya',
];

class IndexDBExpense {
  private dbName: string = "expenseDB";
  private storeName: string = "expenses";
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private initDb(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("date", "date", { unique: false });
          store.createIndex("category", "category", { unique: false });
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

  private mapFromPostgres(e: any): Expense {
    return {
      id: e.id,
      name: e.name || '',
      amount: Number(e.amount ?? 0),
      category: e.category || 'Lainnya',
      date: e.date ? new Date(e.date).getTime() : Date.now(),
      notes: e.notes || '',
      created_at: e.created_at ? new Date(e.created_at).getTime() : Date.now(),
      updated_at: e.updated_at ? new Date(e.updated_at).getTime() : Date.now()
    };
  }

  private mapToPostgres(e: Expense): any {
    return {
      id: e.id,
      name: e.name,
      amount: e.amount,
      category: e.category,
      date: new Date(e.date).toISOString(),
      notes: e.notes,
      updated_at: new Date()
    };
  }

  async getAll(): Promise<Expense[]> {
    if (isFirebaseConfigured) {
      try {
        const querySnapshot = await getDocs(collection(db, 'expenses'));
        const fbExpenses = querySnapshot.docs.map(d => d.data() as Expense);
        if (fbExpenses.length > 0) {
          // Sync senyap ke local IndexedDB
          await this.initDb();
          const store = this.getObjectStore("readwrite");
          for (const e of fbExpenses) {
            store.put(e);
          }
          return fbExpenses;
        }
      } catch (err) {
        console.error("Firebase GetAll Expenses Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .order('date', { ascending: false });
        if (!error && data) return data.map(e => this.mapFromPostgres(e));
      } catch (err) {
        console.error("PG GetAll Expenses Error:", err);
      }
    }
    await this.initDb();
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore("readonly");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getById(id: string): Promise<Expense | undefined> {
    if (isFirebaseConfigured) {
      try {
        const docSnap = await getDoc(doc(db, 'expenses', id));
        if (docSnap.exists()) return docSnap.data() as Expense;
      } catch (err) {
        console.error("Firebase Get Expense Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (!error && data) return this.mapFromPostgres(data);
      } catch (err) {
        console.error("PG Get Expense Error:", err);
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

  async save(expense: Expense): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'expenses', expense.id), expense);
        console.log(`🟢 [Firebase]: Pengeluaran saved.`);
      } catch (err) {
        console.error("Firebase Save Expense Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `expenses/${expense.id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { error } = await supabase
          .from('expenses')
          .upsert(this.mapToPostgres(expense));
        if (!error) console.log(`🟢 PG: Pengeluaran saved.`);
      } catch (err) {
        console.error("PG Save Expense Error:", err);
      }
    }
    await this.initDb();
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore("readwrite");
      const request = store.put({
        ...expense,
        updated_at: Date.now(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
        console.log(`🟢 [Firebase]: Pengeluaran deleted.`);
      } catch (err) {
        console.error("Firebase Delete Expense Error:", err);
        handleFirestoreError(err, OperationType.DELETE, `expenses/${id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { error } = await supabase
          .from('expenses')
          .delete()
          .eq('id', id);
        if (!error) console.log(`🟢 PG: Pengeluaran deleted.`);
      } catch (err) {
        console.error("PG Delete Expense Error:", err);
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

  async getTotalByCategory(): Promise<Record<string, number>> {
    const all = await this.getAll();
    const result: Record<string, number> = {};
    for (const e of all) {
      result[e.category] = (result[e.category] || 0) + e.amount;
    }
    return result;
  }

  async getMonthlyTotal(year: number, month: number): Promise<number> {
    const all = await this.getAll();
    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 0, 23, 59, 59).getTime();
    return all
      .filter(e => e.date >= start && e.date <= end)
      .reduce((sum, e) => sum + e.amount, 0);
  }

  async search(query: string): Promise<Expense[]> {
    if (isFirebaseConfigured) {
      try {
        const all = await this.getAll();
        const q = query.toLowerCase().trim();
        return all.filter(e =>
          e.name.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.notes.toLowerCase().includes(q)
        );
      } catch {}
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .or(`name.ilike.%${query}%,category.ilike.%${query}%,notes.ilike.%${query}%`)
          .order('date', { ascending: false });
        if (!error && data) return data.map(e => this.mapFromPostgres(e));
      } catch (err) {
        console.error("PG Search Expenses Error:", err);
      }
    }
    const all = await this.getAll();
    const q = query.toLowerCase().trim();
    return all.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.notes.toLowerCase().includes(q)
    );
  }

  generateId(): string {
    return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

export const indexdbExpense = new IndexDBExpense();
