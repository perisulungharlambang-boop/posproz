/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CartItem, Product } from '@/interfaces';
import { useSettingsStore } from './useSettingsStore';

interface CartState {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (id: string) => void;
  updateManualPrice: (id: string, newPrice: number) => void;
  updateManualQty: (id: string, newQty: number) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: [],

      addToCart: (product) => {
        set((state) => {
          const existing = state.cart.find((item) => item.id === product.id);
          if (existing) {
            return {
              cart: state.cart.map((item) =>
                item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
              ),
            };
          }
          return { cart: [...state.cart, { ...product, quantity: 1 }] };
        });
      },

      updateManualPrice: (id, newPrice) => {
        set((state) => ({
          cart: state.cart.map((item) =>
            item.id === id ? { ...item, customPrice: newPrice } : item
          ),
        }));
      },

      updateManualQty: (id, newQty) => {
        set((state) => ({
          cart: state.cart.map((item) =>
            item.id === id ? { ...item, quantity: Math.max(0, newQty) } : item
          ),
        }));
      },

      removeFromCart: (id) => set((state) => ({
        cart: state.cart.filter((item) => item.id !== id)
      })),

      clearCart: () => set({ cart: [] }),

      getTotal: () => {
        const { cart } = get();
        const { isWholesaleMode } = useSettingsStore.getState();

        return cart.reduce((total, item) => {
          // Prioritas: 1. Manual Override, 2. Grosir Mode, 3. Retail Default
          let price = isWholesaleMode ? item.priceWholesale : item.priceRetail;
          if (item.customPrice !== undefined) price = item.customPrice;
          
          return total + (price * item.quantity);
        }, 0);
      },
    }),
    {
      name: 'pos-cart-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      onRehydrateStorage: () => {
        console.log("✅ Cart berhasil di restore dari localStorage");
      }
    }
  )
);