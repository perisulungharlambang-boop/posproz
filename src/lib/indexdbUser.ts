/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * IndexedDB Service untuk Manajemen User & Autentikasi
 * Role: admin (full akses), kasir (terbatas)
 */

import { supabase, isPostgresConfigured } from './supabaseClient';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType } from './firebaseClient';
import { collection, getDocs, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

export interface User {
  id: string;
  username: string;
  password: string; // plain text (offline-only, no server)
  name: string;
  role: 'admin' | 'kasir' | 'gudang';
  isActive: boolean;
  created_at: number;
  updated_at: number;
}

class IndexDBUser {
  private dbName: string = "userDB";
  private storeName: string = "users";
  private db: IDBDatabase | null = null;
  private currentUser: { id: string; name: string; username: string; role: 'admin' | 'kasir' | 'gudang' } | null = null;

  constructor() {
    this.initDb();
    const stored = localStorage.getItem('pos_current_user');
    if (stored) {
      try {
        this.currentUser = JSON.parse(stored);
      } catch (e) {
        this.currentUser = null;
      }
    }
  }

  private initDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) { resolve(); return; }
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("username", "username", { unique: true });
        }
      };
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        // ✅ Buat admin & kasir default jika belum ada
        this.seedAdmin();
        resolve();
      };
      request.onerror = (event) => {
        console.error("userDB error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  private async seedAdmin() {
    try {
      const all = await this.getAll();
      if (all.length === 0) {
        await this.save({
          id: 'user_admin',
          username: 'admin',
          password: 'admin123',
          name: 'Administrator',
          role: 'admin',
          isActive: true,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
        await this.save({
          id: 'user_kasir',
          username: 'kasir',
          password: 'kasir123',
          name: 'Kasir Pegawai',
          role: 'kasir',
          isActive: true,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
        await this.save({
          id: 'user_gudang',
          username: 'gudang',
          password: 'gudang123',
          name: 'Staf Gudang / Helper',
          role: 'gudang',
          isActive: true,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
        console.log('✅ User default dibuat: Admin (admin/admin123), Kasir (kasir/kasir123), Gudang (gudang/gudang123)');
      }
    } catch (e) {
      console.error('Seed users error:', e);
    }
  }

  private getObjectStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error("DB not init");
    return this.db.transaction(this.storeName, mode).objectStore(this.storeName);
  }

  async getAll(): Promise<User[]> {
    if (isFirebaseConfigured) {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const fbReq = querySnapshot.docs.map(d => d.data() as User);
        if (fbReq.length > 0) {
          // Sync senyap ke local IndexedDB
          await this.initDb();
          const store = this.getObjectStore("readwrite");
          for (const u of fbReq) {
            store.put(u);
          }
          return fbReq;
        }
      } catch (err) {
        console.error("Firebase GetAll Users Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('username', { ascending: true });
        if (!error && data) {
          // Normalisasi tipe boolean & casing jika dibalik dari PostgreSQL
          return data.map((u: any) => ({
            id: u.id,
            username: u.username,
            password: u.password,
            name: u.name,
            role: u.role,
            isActive: u.is_active !== undefined ? u.is_active : u.isActive,
            created_at: u.created_at ? new Date(u.created_at).getTime() : Date.now(),
            updated_at: u.updated_at ? new Date(u.updated_at).getTime() : Date.now()
          })) as User[];
        }
        console.warn("⚠️ PostgreSQL: Gagal membaca data user, beralih ke IndexedDB.", error);
      } catch (e) {
        console.error("❌ PostgreSQL User Error:", e);
      }
    }

    await this.initDb();
    return new Promise((resolve, reject) => {
      const req = this.getObjectStore("readonly").getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async save(u: User): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'users', u.id), u);
        console.log(`🟢 [Firebase]: Pengguna ${u.username} berhasil disimpan.`);
      } catch (err) {
        console.error("Firebase Save User Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `users/${u.id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        const payload = {
          id: u.id,
          username: u.username.toLowerCase().trim(),
          password: u.password,
          name: u.name,
          role: u.role,
          is_active: u.isActive,
          updated_at: new Date()
        };
        const { error } = await supabase
          .from('users')
          .upsert(payload, { onConflict: 'id' });
        if (!error) {
          console.log(`🟢 PostgreSQL: User ${u.username} berhasil disimpan.`);
        } else {
          console.warn("⚠️ PostgreSQL: Gagal menyimpan user, beralih ke IndexedDB local.", error);
        }
      } catch (e) {
        console.error("❌ PostgreSQL User Save Error:", e);
      }
    }

    await this.initDb();
    return new Promise((resolve, reject) => {
      const req = this.getObjectStore("readwrite").put({...u, updated_at: Date.now()});
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async delete(id: string): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, 'users', id));
        console.log(`🟢 [Firebase]: Pengguna ID [${id}] berhasil dihapus.`);
      } catch (err) {
        console.error("Firebase Delete User Error:", err);
        handleFirestoreError(err, OperationType.DELETE, `users/${id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', id);
        if (!error) {
          console.log(`🟢 PostgreSQL: Tipe User ID [${id}] berhasil dihapus.`);
        } else {
          console.warn("⚠️ PostgreSQL: Gagal menghapus user di cloud.", error);
        }
      } catch (e) {
        console.error("❌ PostgreSQL User Delete Error:", e);
      }
    }

    await this.initDb();
    return new Promise((resolve, reject) => {
      const req = this.getObjectStore("readwrite").delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async login(username: string, password: string): Promise<{ success: boolean; user?: any; error?: string }> {
    if (isFirebaseConfigured) {
      try {
        const all = await this.getAll();
        const user = all.find(u => u.username.toLowerCase().trim() === username.trim().toLowerCase());
        if (!user) {
          return { success: false, error: 'Username tidak ditemukan di database online' };
        }
        if (!user.isActive) {
          return { success: false, error: 'Akun ini sudah dinonaktifkan di database online' };
        }
        if (user.password !== password) {
          return { success: false, error: 'Password salah' };
        }

        this.currentUser = {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
        };

        localStorage.setItem('pos_current_user', JSON.stringify(this.currentUser));
        return { success: true, user: this.currentUser };
      } catch (e) {
        console.error("❌ Firebase Login Error:", e);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data: user, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username.trim().toLowerCase())
          .single();

        if (error || !user) {
          return { success: false, error: 'Username tidak ditemukan di database online' };
        }

        const userActive = user.is_active !== undefined ? user.is_active : user.isActive;
        if (!userActive) {
          return { success: false, error: 'Akun ini sudah dinonaktifkan di database online' };
        }

        if (user.password !== password) {
          return { success: false, error: 'Password salah' };
        }

        this.currentUser = {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
        };

        localStorage.setItem('pos_current_user', JSON.stringify(this.currentUser));
        return { success: true, user: this.currentUser };
      } catch (e: any) {
        console.error("❌ PostgreSQL Login Error:", e);
      }
    }

    await this.initDb();
    const all = await this.getAll();
    const user = all.find(u => u.username === username.trim());

    if (!user) return { success: false, error: 'Username tidak ditemukan' };
    if (!user.isActive) return { success: false, error: 'Akun ini sudah dinonaktifkan' };
    if (user.password !== password) return { success: false, error: 'Password salah' };

    this.currentUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    };

    // ✅ Simpan session ke localStorage
    localStorage.setItem('pos_current_user', JSON.stringify(this.currentUser));

    return { success: true, user: this.currentUser };
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('pos_current_user');
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isLoggedIn(): boolean {
    return this.currentUser !== null;
  }

  isAdmin(): boolean {
    return this.getCurrentUser()?.role === 'admin';
  }

  generateId(): string { return `user_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }
}

export const indexdbUser = new IndexDBUser();