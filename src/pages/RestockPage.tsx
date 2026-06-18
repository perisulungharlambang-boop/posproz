/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ HALAMAN MANAJEMEN MASUK BARANG (RESTOCK)
 * Alur: Input Supplier & Faktur dulu → Tambah banyak produk → Konfirmasi
 * - Barcode Kamera, Barcode Tembak HID, Keyboard
 * - Search tanpa lag (client-side filter)
 * - Riwayat penerimaan barang
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Package, Plus, Minus, History, ShoppingBag, CheckCircle2, X, DollarSign, Camera, Trash2, Truck, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product } from '@/interfaces';
import { indexdbBarang } from '@/lib/indexdbBarang';
import { indexdbRestock, RestockRecord } from '@/lib/indexdbRestock';
import { indexdbSupplier } from '@/lib/indexdbSupplier';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import BarcodeScannerModal from '@/components/pos/BarcodeScannerModal';
import { formatCurrency, cn } from '@/lib/utils';

/** Item sementara di keranjang restock sebelum di-save */
interface RestockCartItem {
  product: Product;
  qty: number;
  priceBuy: number;
}

const RestockPage: React.FC = () => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ✅ HEADER SESI: Supplier & Faktur (diisi pertama)
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');

  // ✅ KERANJANG RESTOCK: daftar produk yang akan di-restock
  const [cart, setCart] = useState<RestockCartItem[]>([]);

  // Riwayat
  const [restockHistory, setRestockHistory] = useState<RestockRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Scanner modal
  const [showScanner, setShowScanner] = useState(false);

  // Status
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ✅ LOAD SEMUA DATA SEKALI
  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        try {
          const allSuppliers = await indexdbSupplier.getAll();
          setSuppliers(allSuppliers);
        } catch { /* noop */ }

        const raw = await indexdbBarang.getAllBarang();
        const mapped = raw.map((p: any) => ({
          ...p,
          priceRetail: p.priceRetail || p.price || 0,
          priceWholesale: p.priceWholesale || p.wholesale_price || 0,
        }));
        setAllProducts(mapped);
      } catch (e) {
        console.error('load error:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ✅ FILTER CLIENT-SIDE
  const filteredProducts = useMemo(() => {
    if (!search.trim()) {
      return allProducts
        .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
        .slice(0, 30);
    }
    const q = search.toLowerCase().trim();
    return allProducts.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [allProducts, search]);

  // ✅ TAMBAH produk ke keranjang restock
  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      return [...prev, {
        product,
        qty: 1,
        priceBuy: Math.round(product.priceRetail * 0.7),
      }];
    });
  }, []);

  // ✅ Barcode scan → tambah ke keranjang
  const handleBarcodeScan = useCallback((code: string) => {
    const found = allProducts.find(p =>
      p.sku === code || (p as any).barcode === code
    );
    if (found) {
      addToCart(found);
      setSearch('');
      searchInputRef.current?.focus();
    }
  }, [allProducts, addToCart]);

  useBarcodeScanner(handleBarcodeScan);

  // Ambil riwayat
  const loadHistory = useCallback(async () => {
    const h = await indexdbRestock.getAll();
    setRestockHistory(h.slice(0, 50));
  }, []);

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory, loadHistory]);

  // Hitung total biaya keranjang
  const cartTotalCost = useMemo(() =>
    cart.reduce((sum, item) => sum + item.priceBuy * item.qty, 0),
  [cart]);

  // ✅ KONFIRMASI SIMPAN SEMUA PRODUK
  const handleConfirmRestock = async () => {
    if (cart.length === 0) return;

    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    const supplierName = supplier?.name || '';
    const invNumber = invoiceNumber.trim() || '-';

    try {
      // Proses satu per satu agar atomic
      for (const item of cart) {
        const product = item.product;
        const stockBefore = product.stock || 0;
        const stockAfter = stockBefore + item.qty;
        const totalCost = item.priceBuy * item.qty;

        // Update stok produk
        await indexdbBarang.updateBarang({
          ...product,
          stock: stockAfter,
          updated_at: Date.now(),
        });

        // Update cache lokal
        setAllProducts(prev => prev.map(p =>
          p.id === product.id ? { ...p, stock: stockAfter, updated_at: Date.now() } : p
        ));

        // Catat riwayat restock
        const record: RestockRecord = {
          id: indexdbRestock.generateId(),
          productId: product.id || '',
          productName: product.name || '',
          productSku: product.sku || '',
          qty: item.qty,
          priceBuy: item.priceBuy,
          totalCost,
          stockBefore,
          stockAfter,
          supplierId: selectedSupplierId,
          supplierName,
          invoiceNumber: invNumber,
          notes: sessionNotes,
          created_at: Date.now(),
        };
        await indexdbRestock.add(record);
      }

      const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
      setSuccessMsg(`✅ Berhasil restock ${cart.length} produk (${totalQty} pcs) dari ${supplierName || 'Tanpa Supplier'} — Faktur: ${invNumber}`);

      // Reset form
      setCart([]);
      setSelectedSupplierId('');
      setInvoiceNumber('');
      setSessionNotes('');
      setSearch('');

      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (e) {
      console.error('Restock error:', e);
      alert('Gagal melakukan restock. Cek konsol untuk detail.');
    }
  };

  // Hapus item dari keranjang
  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Update qty item di keranjang
  const updateCartQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item =>
      item.product.id === productId ? { ...item, qty } : item
    ));
  };

  // Update priceBuy item di keranjang
  const updateCartPrice = (productId: string, priceBuy: number) => {
    setCart(prev => prev.map(item =>
      item.product.id === productId ? { ...item, priceBuy: Math.max(0, priceBuy) } : item
    ));
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Masuk Barang</h1>
          <p className="text-sm text-slate-500 font-medium">Input supplier & faktur, lalu tambah produk</p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-100 rounded-2xl font-bold text-xs text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all shadow-sm"
        >
          <History size={16} />
          {showHistory ? 'Tutup Riwayat' : 'Riwayat'}
        </button>
      </div>

      {/* Success Message */}
      {successMsg && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-[24px] flex items-center gap-4 animate-in zoom-in duration-300">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <p className="font-bold text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}

      {/* STEP 1: SUPPLIER & FAKTUR — Header Sesi */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-500">
            <Truck size={20} />
          </div>
          <div>
            <h3 className="font-black text-lg text-slate-800">Supplier & Faktur</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Isi data penerimaan barang</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Supplier *</label>
            <select
              value={selectedSupplierId}
              onChange={e => setSelectedSupplierId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 p-4 rounded-[16px] font-bold text-sm text-slate-700 focus:border-purple-400 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="">— Pilih Supplier —</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {suppliers.length === 0 && (
              <p className="text-[9px] text-amber-500 font-bold uppercase tracking-tighter px-1">
                Belum ada supplier. Tambah di halaman Supplier.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">No. Faktur / Nota *</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              placeholder="FKT-2026-05-001"
              className="w-full bg-slate-50 border border-slate-100 p-4 rounded-[16px] font-bold text-sm text-slate-700 focus:border-purple-400 focus:bg-white outline-none transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Catatan Penerimaan (opsional)</label>
          <input
            type="text"
            value={sessionNotes}
            onChange={e => setSessionNotes(e.target.value)}
            placeholder="Misal: Pembelian mingguan, Faktur dari PT Sinar Jaya..."
            className="w-full bg-slate-50 border border-slate-100 p-4 rounded-[16px] font-bold text-sm text-slate-700 focus:border-purple-400 focus:bg-white outline-none transition-all"
          />
        </div>
      </div>

      {/* STEP 2: TAMBAH PRODUK */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
            <Package size={20} />
          </div>
          <div>
            <h3 className="font-black text-lg text-slate-800">Tambah Produk</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Scan / Tembak / Ketik barcode</p>
          </div>
        </div>

        {/* Search + Scan */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Scan / Tembak / Ketik — langsung tambah ke daftar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && search.trim()) {
                  const exact = allProducts.find(p =>
                    p.sku === search.trim() || (p as any).barcode === search.trim()
                  );
                  if (exact) {
                    addToCart(exact);
                    setSearch('');
                  }
                }
              }}
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-[20px] font-bold text-sm text-slate-700 focus:border-blue-400 focus:bg-white outline-none transition-all"
              autoFocus
            />
          </div>
          <button
            onClick={() => setShowScanner(true)}
            className="w-14 h-14 bg-blue-500 hover:bg-blue-600 rounded-[20px] flex items-center justify-center text-white shadow-lg shadow-blue-100 transition-all active:scale-95"
          >
            <Camera size={22} />
          </button>
        </div>

        {/* Grid Produk untuk dipilih */}
        <div className="max-h-48 overflow-y-auto space-y-2 scrollbar-hide">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <span className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-6 text-slate-400">
              <Package size={32} className="mx-auto mb-2 opacity-30" />
              <p className="font-bold text-xs">Produk Tidak Ditemukan</p>
            </div>
          ) : (
            filteredProducts.map(p => (
              <button
                key={p.id}
                onClick={() => { addToCart(p); setSearch(''); }}
                className="w-full flex items-center gap-3 p-3 rounded-[16px] border-2 border-transparent bg-slate-50 hover:border-blue-300 transition-all text-left"
              >
                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-slate-400 font-bold border border-slate-100 shrink-0 text-[10px]">
                  {p.name?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-xs text-slate-800 truncate">{p.name}</p>
                  <p className="text-[9px] text-slate-400 font-bold font-mono">#{p.sku || '-'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-xs text-slate-700">{formatCurrency(p.priceRetail || 0)}</p>
                  <p className={cn("text-[9px] font-bold", (p.stock || 0) <= 5 ? 'text-red-500' : 'text-slate-400')}>
                    Stok: {p.stock || 0}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* STEP 3: KERANJANG RESTOCK — Daftar produk yang akan di-restock */}
      {cart.length > 0 && (
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
                <ShoppingBag size={20} />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-800">Daftar Produk</h3>
                <p className="text-[10px] text-slate-400 font-bold">{cart.length} produk — Total: {formatCurrency(cartTotalCost)}</p>
              </div>
            </div>
            <button
              onClick={() => setCart([])}
              className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors"
            >
              Kosongkan
            </button>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-hide">
            {cart.map(item => (
              <div key={item.product.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-[16px]">
                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-slate-400 font-bold border border-slate-100 shrink-0 text-[10px]">
                  {item.product.name?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-xs text-slate-800 truncate">{item.product.name}</p>
                  <p className="text-[9px] text-slate-400 font-bold font-mono">#{item.product.sku || '-'}</p>
                </div>

                {/* Qty */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateCartQty(item.product.id, item.qty - 1)}
                    className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-600 transition-all shadow-sm text-[10px] font-black"
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={e => updateCartQty(item.product.id, Math.max(1, Number(e.target.value) || 1))}
                    className="w-10 text-center bg-white rounded-lg font-black text-xs text-slate-800 outline-none border border-slate-100 py-1"
                  />
                  <button
                    onClick={() => updateCartQty(item.product.id, item.qty + 1)}
                    className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-600 transition-all shadow-sm text-[10px] font-black"
                  >+</button>
                </div>

                {/* Harga Beli */}
                <div className="flex items-center">
                  <input
                    type="number"
                    min={0}
                    value={item.priceBuy}
                    onChange={e => updateCartPrice(item.product.id, Number(e.target.value) || 0)}
                    className="w-20 text-right bg-white rounded-lg font-black text-xs text-emerald-600 outline-none border border-slate-100 py-1 px-2"
                  />
                </div>

                {/* Total per item */}
                <div className="text-right shrink-0 w-16">
                  <p className="font-black text-xs text-blue-600">{formatCurrency(item.priceBuy * item.qty)}</p>
                </div>

                {/* Hapus */}
                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 transition-all shadow-sm"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Ringkasan & Tombol Konfirmasi */}
          <div className="p-4 bg-emerald-50 rounded-[20px] flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Produk: <span className="text-slate-700">{cart.length} item</span>
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Qty: <span className="text-slate-700">{cart.reduce((s, i) => s + i.qty, 0)} pcs</span>
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Biaya: <span className="text-blue-600 font-black">{formatCurrency(cartTotalCost)}</span>
              </p>
            </div>
            <button
              onClick={handleConfirmRestock}
              disabled={!selectedSupplierId || cart.length === 0}
              className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-emerald-100 disabled:cursor-not-allowed active:scale-95"
            >
              <CheckCircle2 size={18} className="inline mr-2" />
              Konfirmasi Semua
            </button>
          </div>
        </div>
      )}

      {/* Riwayat Restock */}
      {showHistory && (
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
              <History size={20} />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-800">Riwayat Masuk Barang</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">50 transaksi terakhir</p>
            </div>
          </div>

          {restockHistory.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <History size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold text-sm">Belum Ada Riwayat Restock</p>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-1">Lakukan restock produk untuk melihat riwayat</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-hide">
              {restockHistory.map(r => (
                <div key={r.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-[20px]">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 border border-slate-100 shrink-0">
                    <Package size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-slate-800 truncate">{r.productName}</p>
                    <p className="text-[10px] text-slate-400 font-bold font-mono">#{r.productSku} — {new Date(r.created_at).toLocaleString('id-ID')}</p>
                    {r.supplierName && <p className="text-[9px] text-purple-500 font-bold uppercase tracking-tight">Supplier: {r.supplierName}</p>}
                    {r.invoiceNumber && r.invoiceNumber !== '-' && <p className="text-[9px] text-amber-600 font-bold tracking-tight">Faktur: {r.invoiceNumber}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-sm text-emerald-600">+{r.qty}</p>
                    <p className="text-[10px] text-slate-400 font-bold">Stok: {r.stockBefore} → {r.stockAfter}</p>
                  </div>
                  {r.totalCost > 0 && (
                    <div className="text-right shrink-0 border-l border-slate-200 pl-4">
                      <p className="font-black text-xs text-blue-600">{formatCurrency(r.totalCost)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <AnimatePresence>
        {showScanner && (
          <BarcodeScannerModal
            onScan={(code) => {
              handleBarcodeScan(code);
              setShowScanner(false);
            }}
            onClose={() => setShowScanner(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RestockPage;