/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Sync Service - Sinkronisasi IndexedDB dengan Supabase
 */

import { supabase } from '@/lib/supabaseClient';
import { offlineDB, Product, Customer, Supplier, Transaction, Restock, Retur, SyncStatus } from '@/lib/dexieDb';
import { offlineDetector } from './OfflineDetector';

export type TableName = 'products' | 'customers' | 'suppliers' | 'transactions' | 'restocks' | 'returs';

export interface SyncResult {
  table: TableName;
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export interface SyncStats {
  isOnline: boolean;
  isSyncing: boolean;
  pendingItems: number;
  lastSyncTime?: number;
  results?: SyncResult[];
}

/**
 * Sync Service untuk manage sinkronisasi data
 */
class SyncService {
  private isSyncing = false;
  private lastSyncTime: number | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private syncIntervalMs = 30000; // Sync setiap 30 detik
  private syncListeners: Set<(stats: SyncStats) => void> = new Set();

  constructor() {
    // Subscribe ke offline detector
    offlineDetector.subscribe((isOnline) => {
      if (isOnline) {
        console.log('🔄 Device online, starting sync...');
        this.startPeriodicSync();
      } else {
        console.log('⏸️ Device offline, pausing sync...');
        this.stopPeriodicSync();
      }
    });

    // Mulai sync jika sudah online
    if (offlineDetector.getStatus()) {
      this.startPeriodicSync();
    }
  }

  /**
   * Subscribe ke sync status updates
   */
  subscribe(callback: (stats: SyncStats) => void): () => void {
    this.syncListeners.add(callback);
    return () => this.syncListeners.delete(callback);
  }

  /**
   * Notify sync listeners
   */
  private notifySyncListeners() {
    this.broadcastStats();
  }

  /**
   * Broadcast current sync stats
   */
  private async broadcastStats() {
    const stats = await this.getSyncStats();
    this.syncListeners.forEach((callback) => {
      try {
        callback(stats);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  /**
   * Get current sync statistics
   */
  async getSyncStats(): Promise<SyncStats> {
    const stats = await offlineDB.getSyncStats();
    return {
      isOnline: offlineDetector.getStatus(),
      isSyncing: this.isSyncing,
      pendingItems: stats.total,
      lastSyncTime: this.lastSyncTime || undefined,
    };
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync() {
    if (this.syncInterval) return;
    this.syncInterval = setInterval(() => {
      this.sync().catch(console.error);
    }, this.syncIntervalMs);
    // Sync immediately
    this.sync().catch(console.error);
  }

  /**
   * Stop periodic sync
   */
  private stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Main sync function - sync semua tables
   */
  async sync(): Promise<SyncResult[]> {
    if (!offlineDetector.getStatus()) {
      console.warn('⚠️ Device offline, cannot sync');
      return [];
    }

    if (this.isSyncing) {
      console.warn('⚠️ Sync already in progress');
      return [];
    }

    this.isSyncing = true;
    this.notifySyncListeners();

    try {
      const tables: TableName[] = ['products', 'customers', 'suppliers', 'transactions', 'restocks', 'returs'];
      const results: SyncResult[] = [];

      for (const table of tables) {
        try {
          const result = await this.syncTable(table);
          results.push(result);
          console.log(`✅ ${table}: ${result.successful}/${result.total} synced`);
        } catch (error) {
          console.error(`❌ Error syncing ${table}:`, error);
          results.push({
            table,
            total: 0,
            successful: 0,
            failed: 0,
            errors: [{ id: '', error: String(error) }],
          });
        }
      }

      this.lastSyncTime = Date.now();
      this.notifySyncListeners();

      return results;
    } finally {
      this.isSyncing = false;
      this.notifySyncListeners();
    }
  }

  /**
   * Sync single table
   */
  private async syncTable(table: TableName): Promise<SyncResult> {
    const pendingData = await offlineDB.getPendingSyncData(table);

    if (pendingData.length === 0) {
      return { table, total: 0, successful: 0, failed: 0, errors: [] };
    }

    const errors: Array<{ id: string; error: string }> = [];
    let successful = 0;

    // Process each item
    for (const item of pendingData) {
      try {
        const syncStatus = item.sync_status as SyncStatus;

        if (syncStatus === 'deleted') {
          // Handle delete
          await this.deleteFromSupabase(table, item.id);
        } else {
          // Handle create/update via upsert
          await this.upsertToSupabase(table, item);
        }

        // Mark as synced
        await offlineDB.markAsSynced(table, item.id);
        successful++;
      } catch (error) {
        console.error(`Error syncing ${table} item ${item.id}:`, error);
        errors.push({
          id: item.id,
          error: String(error),
        });
      }
    }

    return {
      table,
      total: pendingData.length,
      successful,
      failed: errors.length,
      errors,
    };
  }

  /**
   * Upsert data ke Supabase menggunakan .upsert()
   * Upsert akan INSERT jika id tidak ada, atau UPDATE jika id sudah ada
   */
  private async upsertToSupabase(table: TableName, item: any) {
    // Siapkan data untuk upsert
    const dataToUpsert = { ...item };
    delete dataToUpsert.sync_status; // Jangan kirim sync_status ke server
    
    // Tambahkan server metadata
    dataToUpsert.updated_at = new Date(dataToUpsert.updated_at).toISOString();
    if (dataToUpsert.created_at) {
      dataToUpsert.created_at = new Date(dataToUpsert.created_at).toISOString();
    }
    if (dataToUpsert.synced_at) {
      dataToUpsert.synced_at = new Date(dataToUpsert.synced_at).toISOString();
    }

    const { error } = await supabase
      .from(table)
      .upsert(dataToUpsert, {
        onConflict: 'id', // Gunakan id sebagai unique constraint
      });

    if (error) {
      throw new Error(`Supabase upsert error: ${error.message}`);
    }
  }

  /**
   * Delete data dari Supabase
   */
  private async deleteFromSupabase(table: TableName, id: string) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Supabase delete error: ${error.message}`);
    }
  }

  /**
   * Manual sync trigger (untuk button atau testing)
   */
  async syncNow(): Promise<SyncResult[]> {
    return this.sync();
  }

  /**
   * Sync specific table only
   */
  async syncTableOnly(table: TableName): Promise<SyncResult> {
    if (!offlineDetector.getStatus()) {
      throw new Error('Device offline');
    }
    return this.syncTable(table);
  }

  /**
   * Pull data dari Supabase ke IndexedDB (untuk sync dari server)
   */
  async pullFromSupabase(table: TableName) {
    if (!offlineDetector.getStatus()) {
      console.warn('⚠️ Device offline, cannot pull from server');
      return;
    }

    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('sync_status', 'synced'); // Hanya pull synced data dari server

      if (error) throw error;

      if (!data) return;

      // Update local data
      for (const item of data) {
        // Convert timestamps
        if (item.updated_at) {
          item.updated_at = new Date(item.updated_at).getTime();
        }
        if (item.created_at) {
          item.created_at = new Date(item.created_at).getTime();
        }
        if (item.synced_at) {
          item.synced_at = new Date(item.synced_at).getTime();
        }

        // Ensure sync_status is synced
        item.sync_status = 'synced';

        await offlineDB[table].put(item as any);
      }

      console.log(`✅ Pulled ${data.length} items from ${table}`);
    } catch (error) {
      console.error(`❌ Error pulling from ${table}:`, error);
    }
  }

  /**
   * Clear all pending syncs
   */
  async clearPendingSyncs() {
    await offlineDB.clearSyncedData();
    this.notifySyncListeners();
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stopPeriodicSync();
    this.syncListeners.clear();
  }
}

// Export singleton instance
export const syncService = new SyncService();
