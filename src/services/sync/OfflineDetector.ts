/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Offline Detection Service
 */

export type OnlineStatusCallback = (isOnline: boolean) => void;

class OfflineDetector {
  private isOnline: boolean = navigator.onLine;
  private listeners: Set<OnlineStatusCallback> = new Set();
  private checkInterval: NodeJS.Timeout | null = null;
  private lastCheckTime: number = 0;
  private CHECK_INTERVAL_MS = 5000; // Check every 5 seconds

  constructor() {
    this.setupListeners();
    this.startPeriodicCheck();
  }

  /**
   * Setup online/offline event listeners
   */
  private setupListeners() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  /**
   * Handle online event
   */
  private handleOnline() {
    if (!this.isOnline) {
      this.isOnline = true;
      console.log('✅ Online - Starting sync...');
      this.notifyListeners(true);
    }
  }

  /**
   * Handle offline event
   */
  private handleOffline() {
    if (this.isOnline) {
      this.isOnline = false;
      console.log('❌ Offline - Working in offline mode');
      this.notifyListeners(false);
    }
  }

  /**
   * Start periodic connectivity check (fallback untuk browser yang tidak support event)
   */
  private startPeriodicCheck() {
    this.checkInterval = setInterval(() => {
      const now = Date.now();
      if (now - this.lastCheckTime < 1000) return; // Don't check too frequently

      // Ping ke endpoint ringan
      fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        cache: 'no-store',
      })
        .then(() => {
          if (!this.isOnline) this.handleOnline();
        })
        .catch(() => {
          if (this.isOnline) this.handleOffline();
        });

      this.lastCheckTime = now;
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Subscribe ke status perubahan online/offline
   */
  subscribe(callback: OnlineStatusCallback): () => void {
    this.listeners.add(callback);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify semua listeners tentang perubahan status
   */
  private notifyListeners(isOnline: boolean) {
    this.listeners.forEach((callback) => {
      try {
        callback(isOnline);
      } catch (error) {
        console.error('Error in offline detector callback:', error);
      }
    });
  }

  /**
   * Get current online status
   */
  getStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Cleanup (jika diperlukan)
   */
  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.listeners.clear();
  }

  /**
   * Manual check (untuk testing atau force check)
   */
  async checkNow(): Promise<boolean> {
    try {
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        cache: 'no-store',
      });
      if (!this.isOnline) this.handleOnline();
      return true;
    } catch {
      if (this.isOnline) this.handleOffline();
      return false;
    }
  }
}

// Export singleton instance
export const offlineDetector = new OfflineDetector();
