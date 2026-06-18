/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ IndexedDB & Firestore-enabled Service untuk Data Pelanggan (Customer)
 * Menyimpan data pelanggan dan riwayat transaksi per pelanggan secara luring & daring
 */

import { db, isFirebaseConfigured, handleFirestoreError, OperationType } from './firebaseClient';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  totalSpent: number;
  totalTransactions: number;
  lastTransaction: number | null;
  notes: string;
  created_at: number;
  updated_at: number;
}

class IndexDBCustomer {
  private dbName: string = "customerDB";
  private storeName: string = "customers";
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
          store.createIndex("name", "name", { unique: false });
          store.createIndex("phone", "phone", { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        console.error("IndexedDB customerDB error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
    return this.initPromise;
  }

  private getObjectStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) {
      throw new Error("Database customer not initialized.");
    }
    const transaction = this.db.transaction(this.storeName, mode);
    return transaction.objectStore(this.storeName);
  }

  async getAll(): Promise<Customer[]> {
    if (isFirebaseConfigured) {
      try {
        const querySnapshot = await getDocs(collection(db, 'customers'));
        const fbCustomers = querySnapshot.docs.map(d => {
          const data = d.data();
          return {
            id: data.id,
            name: data.name || '',
            phone: data.phone || '',
            address: data.address || '',
            totalSpent: Number(data.totalSpent ?? 0),
            totalTransactions: Number(data.totalTransactions ?? 0),
            lastTransaction: data.lastTransaction ? Number(data.lastTransaction) : null,
            notes: data.notes || '',
            created_at: Number(data.created_at || Date.now()),
            updated_at: Number(data.updated_at || Date.now()),
          } as Customer;
        });

        if (fbCustomers.length > 0) {
          // Sync senyap ke local IndexedDB
          await this.initDb();
          const store = this.getObjectStore("readwrite");
          for (const c of fbCustomers) {
            store.put(c);
          }
          return fbCustomers;
        }
      } catch (err) {
        console.error("Firebase GetAll Customers Error:", err);
      }
    }

    await this.initDb();
    return new Promise((resolve, reject) => {
      try {
        const store = this.getObjectStore("readonly");
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  async getById(id: string): Promise<Customer | undefined> {
    if (isFirebaseConfigured) {
      try {
        const docSnap = await getDoc(doc(db, 'customers', id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          return {
            id: data.id,
            name: data.name || '',
            phone: data.phone || '',
            address: data.address || '',
            totalSpent: Number(data.totalSpent ?? 0),
            totalTransactions: Number(data.totalTransactions ?? 0),
            lastTransaction: data.lastTransaction ? Number(data.lastTransaction) : null,
            notes: data.notes || '',
            created_at: Number(data.created_at || Date.now()),
            updated_at: Number(data.updated_at || Date.now()),
          } as Customer;
        }
      } catch (err) {
        console.error("Firebase Get Customer Error:", err);
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

  async search(query: string): Promise<Customer[]> {
    const all = await this.getAll();
    const q = query.toLowerCase().trim();
    return all.filter(
      (c: Customer) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(query)
    );
  }

  async save(customer: Customer): Promise<void> {
    if (!customer.id) {
      throw new Error("Customer id is required");
    }

    const freshCustomer = {
      ...customer,
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || '',
      totalSpent: Number(customer.totalSpent || 0),
      totalTransactions: Number(customer.totalTransactions || 0),
      created_at: customer.created_at || Date.now(),
      updated_at: Date.now(),
    };

    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'customers', freshCustomer.id), freshCustomer);
        console.log(`🟢 [Firebase]: Customer saved.`);
      } catch (err) {
        console.error("Firebase Save Customer Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `customers/${freshCustomer.id}`);
      }
    }

    await this.initDb();
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore("readwrite");
      const request = store.put(freshCustomer);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, 'customers', id));
        console.log(`🟢 [Firebase]: Customer deleted.`);
      } catch (err) {
        console.error("Firebase Delete Customer Error:", err);
        handleFirestoreError(err, OperationType.DELETE, `customers/${id}`);
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

  /**
   * ✅ Update statistik customer setelah transaksi
   */
  async updateStats(id: string, totalAmount: number): Promise<void> {
    const customer = await this.getById(id);
    if (!customer) return;

    await this.save({
      ...customer,
      totalSpent: (customer.totalSpent || 0) + totalAmount,
      totalTransactions: (customer.totalTransactions || 0) + 1,
      lastTransaction: Date.now(),
    });
  }

  async count(): Promise<number> {
    await this.initDb();
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore("readonly");
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    await this.initDb();
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore("readwrite");
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const indexdbCustomer = new IndexDBCustomer();
