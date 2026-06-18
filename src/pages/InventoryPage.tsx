/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { indexdbBarang } from '@/lib/indexdbBarang';
import { Product } from '@/interfaces';
import { Plus, Edit, Trash2, Search, Package, Archive, Camera, Loader2, RefreshCw, Tag, X as XIcon, CheckCircle2, AlertCircle, Truck, Barcode, Printer } from 'lucide-react';
import { formatCurrency, cn, generateProductId } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import BarcodeScannerModal from '@/components/pos/BarcodeScannerModal';
import { indexdbCategory } from '@/lib/indexdbCategory';
import { indexdbSupplier } from '@/lib/indexdbSupplier';
import { barcodeService } from '@/services/hardware/BarcodeService';

const InventoryPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [showScanner, setShowScanner] = useState(false);
  const [scannerContext, setScannerContext] = useState<'search' | 'sku'>('search');
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', sku: '', priceRetail: 0, priceWholesale: 0, priceCost: 0, stock: 0, category: 'Umum', supplierId: '', supplierName: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  // ✅ State untuk supplier
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // ✅ State untuk kategori dinamis
  const [categories, setCategories] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState('');

  // Pagination State
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [totalProducts, setTotalProducts] = useState(0);

  // ✅ State untuk fitur barcode
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeHtml, setBarcodeHtml] = useState('');
  const [barcodeTarget, setBarcodeTarget] = useState<{ code: string; name: string; price: number } | null>(null);

  const PAGE_SIZE = 50;

  // ✅ Cache semua produk di memory untuk load more yang cepat tanpa query ulang
  const allProductsRef = useRef<any[]>([]);

  // ✅ Load kategori dinamis dari IndexedDB + kategori unik dari produk
  const loadCategories = useCallback(async () => {
    try {
      const [cats, allProducts] = await Promise.all([
        indexdbCategory.getAll(),
        indexdbBarang.getAllBarang()
      ]);
      // ✅ Ambil kategori unik dari semua produk yang tersimpan
      const productCategories = allProducts
        .map((p: any) => p.category)
        .filter(Boolean)
        .filter((cat: string) => cat !== 'Umum');
      // ✅ Gabung kategori dari tabel kategori + kategori dari produk, unik
      const merged = [...new Set([...cats, ...productCategories])].sort();
      setCategories(['Semua', ...merged]);
    } catch (e) {
      console.error('Load categories error:', e);
    }
  }, []);

  // ✅ Load supplier dari IndexedDB
  const loadSuppliers = useCallback(async () => {
    try {
      const allSuppliers = await indexdbSupplier.getAll();
      setSuppliers(allSuppliers);
    } catch (e) {
      console.error('Load suppliers error:', e);
      setSuppliers([]);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadSuppliers();
  }, [loadCategories, loadSuppliers]);

  const initLoad = async () => {
    try {
      setLoading(true);
      setOffset(0);
      setProducts([]);
      
      // ✅ Ambil semua produk — count() dari IndexedDB bisa stale, pakai .length langsung
      const allProducts = await indexdbBarang.getAllBarang();

      // ✅ Sort terbaru di atas berdasarkan updated_at
      const sorted = allProducts.sort((a: any, b: any) => {
        const aTime = typeof a.updated_at === 'number' ? a.updated_at : new Date(a.updated_at || 0).getTime();
        const bTime = typeof b.updated_at === 'number' ? b.updated_at : new Date(b.updated_at || 0).getTime();
        return bTime - aTime;
      });

      const firstPage = sorted.slice(0, PAGE_SIZE);

      const mappedProducts = firstPage.map((p: any) => ({
        ...p,
        sku: p.sku || p.barcode,
        priceRetail: p.priceRetail || p.price,
        priceWholesale: p.priceWholesale || p.wholesale_price,
        priceCost: p.priceCost || p.cost_price || 0
      }));
      
      // ✅ Gunakan .length dari array aktual, bukan count() yang bisa tidak sinkron
      setProducts(mappedProducts);
      setTotalProducts(sorted.length);
      setOffset(PAGE_SIZE);
      setHasMore(sorted.length > PAGE_SIZE);

      // ✅ Simpan semua data di ref untuk load more tanpa query ulang
      allProductsRef.current = sorted;
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loading || !hasMore || search.trim()) return;

    try {
      setLoading(true);
      // ✅ Pakai data yang sudah di-load di ref (sudah terfilter), tidak perlu query ulang
      setOffset(prev => {
        const nextPage = allProductsRef.current.slice(prev, prev + PAGE_SIZE);
        const mappedProducts = nextPage.map((p: any) => ({
          ...p,
          sku: p.sku || p.barcode,
          priceRetail: p.priceRetail || p.price,
          priceWholesale: p.priceWholesale || p.wholesale_price,
          priceCost: p.priceCost || p.cost_price || 0
        }));
        setProducts(existing => [...existing, ...mappedProducts]);
        setHasMore(prev + PAGE_SIZE < allProductsRef.current.length);
        return prev + PAGE_SIZE;
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fungsi load produk berdasarkan kategori (ambil semua, filter, tampilkan)
  const loadByCategory = useCallback(async (category: string) => {
    try {
      setLoading(true);
      setProducts([]);
      setOffset(0);

      const allProducts = await indexdbBarang.getAllBarang();
      const sorted = allProducts.sort((a: any, b: any) => {
        const aTime = typeof a.updated_at === 'number' ? a.updated_at : new Date(a.updated_at || 0).getTime();
        const bTime = typeof b.updated_at === 'number' ? b.updated_at : new Date(b.updated_at || 0).getTime();
        return bTime - aTime;
      });

      const mapped = sorted.map((p: any) => ({
        ...p,
        sku: p.sku || p.barcode,
        priceRetail: p.priceRetail || p.price,
        priceWholesale: p.priceWholesale || p.wholesale_price,
        priceCost: p.priceCost || p.cost_price || 0
      }));

      // ✅ Filter berdasarkan kategori
      const filtered = category === 'Semua'
        ? mapped
        : mapped.filter((p: any) => p.category === category);

      const firstPage = filtered.slice(0, PAGE_SIZE);
      setProducts(firstPage);
      setTotalProducts(filtered.length);
      setOffset(PAGE_SIZE);
      setHasMore(filtered.length > PAGE_SIZE);
      allProductsRef.current = filtered; // simpan filtered cache
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Effect: load ulang produk saat kategori berubah
  useEffect(() => {
    if (!search.trim()) {
      loadByCategory(activeCategory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  // Search Effect
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (search.trim()) {
        const results = await indexdbBarang.search(search);
        const mappedProducts = results.map((p: any) => ({
          ...p,
          sku: p.sku || p.barcode,
          priceRetail: p.priceRetail || p.price,
          priceWholesale: p.priceWholesale || p.wholesale_price,
          priceCost: p.priceCost || p.cost_price || 0
        }));
        setProducts(mappedProducts);
        setHasMore(false);
      } else {
        setOffset(0);
        initLoad();
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [search]);

  // ✅ Refresh otomatis saat halaman kembali aktif (misal: balik dari halaman lain)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !search.trim()) {
        loadByCategory(activeCategory);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [search, activeCategory, loadByCategory]);

  const loadProducts = useCallback(() => {
    if (search.trim()) {
      indexdbBarang.search(search).then(results => {
        const mappedProducts = results.map((p: any) => ({
          ...p,
          sku: p.sku || p.barcode,
          priceRetail: p.priceRetail || p.price,
          priceWholesale: p.priceWholesale || p.wholesale_price,
          priceCost: p.priceCost || p.cost_price || 0
        }));
        setProducts(mappedProducts);
      });
    } else {
      initLoad();
    }
  }, [search]);

  const handleBarcodeScanned = (code: string) => {
    if (scannerContext === 'search') {
      setSearch(code);
    } else {
      setFormData(prev => ({ ...prev, sku: code }));
    }
    setShowScanner(false);
  };

  const openScanner = (context: 'search' | 'sku') => {
    setScannerContext(context);
    setShowScanner(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // ✅ ID deterministik: edit pakai id lama, tambah baru pakai generateProductId dari SKU
    const id = editingId || generateProductId(formData.sku, formData.sku);
    const productData = { ...formData, id };
    
    await indexdbBarang.updateBarang(productData);
    resetForm();
    setIsModalOpen(false);
    loadProducts();
  };

  const resetForm = () => {
    setFormData({ name: '', sku: '', priceRetail: 0, priceWholesale: 0, priceCost: 0, stock: 0, category: 'Umum', supplierId: '', supplierName: '' });
    setEditingId(null);
  };

  const handleEdit = (product: Product) => {
    setFormData(product);
    setEditingId(product.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Hapus produk ini?')) {
      await indexdbBarang.deleteBarang(id);
      loadProducts();
    }
  };

  // ✅ Handler: Generate barcode untuk produk
  const handleGenerateBarcode = async (product: Product) => {
    setBarcodeLoading(true);
    try {
      // Jika produk sudah punya SKU, gunakan SKU-nya. Jika tidak, generate baru
      const code = product.sku?.trim() || barcodeService.generateCode(product.name);
      const html = await barcodeService.previewBarcode(code, product.name, product.priceRetail);
      setBarcodeTarget({ code, name: product.name, price: product.priceRetail });
      setBarcodeHtml(html);
      setShowBarcodeModal(true);
    } catch (e) {
      console.error('Generate barcode error:', e);
      alert('Gagal generate barcode. Silakan coba lagi.');
    } finally {
      setBarcodeLoading(false);
    }
  };

  // ✅ Handler: Cetak barcode langsung ke printer
  const handlePrintBarcode = async (product: Product) => {
    try {
      const code = product.sku?.trim() || barcodeService.generateCode(product.name);
      await barcodeService.printSingleBarcode(code, product.name, product.priceRetail);
    } catch (e) {
      console.error('Print barcode error:', e);
      alert('Gagal mencetak barcode. Periksa izin popup browser.');
    }
  };

  // ✅ Handler: Generate kode barcode otomatis di form produk
  const handleAutoGenerateSku = () => {
    const generatedCode = barcodeService.generateCode(formData.name);
    setFormData(prev => ({ ...prev, sku: generatedCode }));
  };

  // ✅ Handler tambah kategori baru
  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setCategoryError('Nama kategori harus diisi');
      return;
    }
    setCategoryLoading(true);
    setCategoryError('');
    try {
      const success = await indexdbCategory.add(name);
      if (success) {
        setShowCategoryModal(false);
        setNewCategoryName('');
        await loadCategories();
        // ✅ Set kategori yang baru ditambahkan sebagai pilihan di form
        setFormData(prev => ({ ...prev, category: name }));
      } else {
        setCategoryError('Kategori sudah ada');
      }
    } catch (e) {
      console.error('Add category error:', e);
      setCategoryError('Gagal menambah kategori');
    } finally {
      setCategoryLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Produk</h1>
          <p className="text-sm text-slate-500 font-medium">Kelola inventori dan katalog barang</p>
          {/* ✅ Tampilkan jumlah aktual dari IndexedDB */}
          <p className="text-xs text-slate-400 font-bold uppercase mt-1">
            {loading && totalProducts === 0
              ? 'Memuat...'
              : search.trim()
              ? `${products.length} hasil pencarian`
              : `${totalProducts.toLocaleString('id-ID')} produk tersimpan`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* ✅ Tombol refresh manual */}
          <button
            onClick={initLoad}
            disabled={loading}
            className="w-11 h-11 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-[#10B981] hover:border-[#10B981] transition-all shadow-sm disabled:opacity-50 active:scale-95"
            title="Refresh data produk"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="w-14 h-14 bg-[#10B981] text-white rounded-[20px] flex items-center justify-center shadow-lg shadow-green-100 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Search & Filter */}
        <div className="space-y-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#10B981] transition-colors" size={20} />
            <input 
              type="text"
              placeholder="Cari SKU atau nama barang..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-12 py-4 bg-white border border-slate-100 rounded-[24px] shadow-sm focus:ring-2 focus:ring-[#10B981] outline-none transition-all font-bold text-slate-700"
            />
            <button 
               type="button"
               onClick={() => openScanner('search')}
               className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-[#10B981] transition-colors p-1"
            >
              <Camera size={24} />
            </button>
          </div>

          {/* ✅ Filter kategori: Dropdown + tombol tambah kategori */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                value={activeCategory}
                onChange={(e) => {
                  setActiveCategory(e.target.value);
                  if (e.target.value !== 'Semua') {
                    setFormData(prev => ({ ...prev, category: e.target.value }));
                  }
                }}
                className="w-full bg-white border border-slate-100 rounded-[24px] px-5 py-4 pr-12 text-sm font-bold text-slate-700 appearance-none cursor-pointer focus:ring-2 focus:ring-[#10B981] outline-none transition-all shadow-sm"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
            <button
              onClick={() => { setShowCategoryModal(true); setNewCategoryName(''); setCategoryError(''); }}
              className="shrink-0 w-14 h-14 bg-white border border-slate-100 rounded-[20px] flex items-center justify-center text-slate-400 hover:text-purple-500 hover:border-purple-200 hover:bg-purple-50 transition-all shadow-sm active:scale-95"
              title="Tambah kategori baru"
            >
              <Tag size={18} />
            </button>
          </div>
        </div>

        {/* Product Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => (
            <div key={p.id} className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col group hover:shadow-xl hover:shadow-slate-100 transition-all duration-500">
              <div className="p-6 flex-1 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-800 text-lg leading-tight uppercase tracking-tight">{p.name}</h3>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-400 rounded-full">
                       <Archive size={12} />
                       <span className="text-[10px] font-black uppercase tracking-tight">{p.category || 'UMUM'}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {/* ✅ Tombol cetak barcode */}
                    <button
                      onClick={() => handlePrintBarcode(p)}
                      disabled={barcodeLoading}
                      className="p-2 text-slate-300 hover:text-purple-500 hover:bg-purple-50 rounded-xl transition-all disabled:opacity-50"
                      title="Cetak barcode"
                    >
                      <Printer size={16} />
                    </button>
                    {/* ✅ Tombol lihat barcode */}
                    <button
                      onClick={() => handleGenerateBarcode(p)}
                      disabled={barcodeLoading}
                      className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all disabled:opacity-50"
                      title="Lihat barcode"
                    >
                      <Barcode size={16} />
                    </button>
                    <button onClick={() => handleEdit(p)} className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">MODAL</p>
                    <p className="font-black text-orange-600 text-xs sm:text-sm">{formatCurrency(p.priceCost || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ECERAN</p>
                    <p className="font-black text-[#10B981] text-xs sm:text-sm">{formatCurrency(p.priceRetail)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">GROSIR</p>
                    <p className="font-black text-blue-500 text-xs sm:text-sm">{formatCurrency(p.priceWholesale)}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-50 space-y-2">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">STOK TERSEDIA</span>
                       <span className={cn(
                         "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                         p.stock <= 5 ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'
                       )}>
                         {p.stock} PCS
                       </span>
                     </div>
                     <div className="text-[10px] font-bold text-slate-300 font-mono">
                       #{p.sku}
                     </div>
                   </div>
                   {/* ✅ Tampilkan nama supplier jika ada */}
                   {p.supplierName && (
                     <div className="flex items-center gap-1.5 text-[9px] text-purple-400 font-bold">
                       <Truck size={10} className="shrink-0" />
                       <span className="truncate">{p.supplierName}</span>
                     </div>
                   )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Load More Button */}
        {hasMore && !search.trim() && products.length > 0 && (
          <button
            onClick={loadMore}
            disabled={loading}
            className="w-full py-5 bg-slate-100 hover:bg-slate-200 rounded-[28px] font-bold text-slate-600 transition-all flex items-center justify-center gap-3 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Memuat...
              </>
            ) : (
              'LIHAT LEBIH BANYAK'
            )}
          </button>
        )}

        {products.length === 0 && !loading && (
          <div className="p-20 flex flex-col items-center justify-center text-slate-200">
             <Package size={64} className="opacity-10 mb-4" />
             <p className="font-bold uppercase tracking-widest text-xs text-slate-400">Belum ada produk ditemukan</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showScanner && (
          <BarcodeScannerModal 
            onScan={handleBarcodeScanned}
            onClose={() => setShowScanner(false)}
          />
        )}
      </AnimatePresence>

      {/* ✅ MODAL TAMBAH KATEGORI */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm mx-4 rounded-[32px] p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-500">
                  <Tag size={20} />
                </div>
                <h3 className="text-lg font-black text-slate-800">Tambah Kategori</h3>
              </div>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
              >
                <XIcon size={16} />
              </button>
            </div>

            {categoryError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-[12px] flex items-center gap-2">
                <AlertCircle size={14} className="text-red-500 shrink-0" />
                <p className="text-xs font-bold text-red-600">{categoryError}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nama Kategori</label>
              <input
                type="text"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }}
                placeholder="Misal: Snack, Sembako, Obat..."
                className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-purple-500 focus:bg-white outline-none transition-all"
                autoFocus
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-3.5 rounded-2xl font-black text-sm transition-all active:scale-95"
              >
                Batal
              </button>
              <button
                onClick={handleAddCategory}
                disabled={categoryLoading}
                className="flex-[2] bg-purple-500 hover:bg-purple-600 text-white py-3.5 rounded-2xl font-black text-sm transition-all shadow-lg shadow-purple-100 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60"
              >
                {categoryLoading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ MODAL PREVIEW BARCODE */}
      {showBarcodeModal && barcodeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm mx-4 rounded-[32px] p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                  <Barcode size={20} />
                </div>
                <h3 className="text-lg font-black text-slate-800">Preview Barcode</h3>
              </div>
              <button
                onClick={() => setShowBarcodeModal(false)}
                className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
              >
                <XIcon size={16} />
              </button>
            </div>

            {/* ✅ Tampilkan barcode — dengan overflow hidden agar tidak keluar card */}
            {barcodeLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-slate-300" />
              </div>
            ) : (
              <div
                className="flex items-center justify-center py-6 px-4 bg-white border border-slate-100 rounded-2xl overflow-hidden"
                style={{ maxWidth: '280px', margin: '0 auto' }}
                dangerouslySetInnerHTML={{ __html: barcodeHtml }}
              />
            )}

            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">INFORMASI BARCODE</p>
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Kode</span>
                  <span className="text-xs font-black text-slate-800 font-mono">{barcodeTarget.code}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Produk</span>
                  <span className="text-xs font-black text-slate-800 text-right max-w-[180px] truncate">{barcodeTarget.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Harga</span>
                  <span className="text-xs font-black text-emerald-600">{formatCurrency(barcodeTarget.price)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBarcodeModal(false)}
                className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-3.5 rounded-2xl font-black text-sm transition-all active:scale-95"
              >
                Tutup
              </button>
              <button
                onClick={async () => {
                  setShowBarcodeModal(false);
                  await barcodeService.printSingleBarcode(
                    barcodeTarget.code,
                    barcodeTarget.name,
                    barcodeTarget.price
                  );
                }}
                className="flex-[2] bg-blue-500 hover:bg-blue-600 text-white py-3.5 rounded-2xl font-black text-sm transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 active:scale-95"
              >
                <Printer size={18} />
                Cetak Barcode
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ MODAL TAMBAH/EDIT PRODUK */}
       {isModalOpen && (
         <div className="fixed inset-0 bg-slate-90/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
           <div className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl animate-in slide-in-from-bottom-8 duration-500 flex flex-col max-h-[90vh]">
              <div className="bg-[#10B981] p-6 text-white relative flex-shrink-0">
                <h3 className="text-2xl font-black tracking-tighter uppercase">{editingId ? 'Edit Produk' : 'Produk Baru'}</h3>
                <p className="text-green-50/70 font-bold uppercase tracking-widest text-[10px] mt-1">Sistem Manajemen Inventori</p>
                <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-20">
                  <Package size={64} />
                </div>
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 space-y-5 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2 col-span-full">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nama Produk</label>
                      <input 
                        required
                        className="w-full bg-slate-50 border-2 border-slate-50 p-4 rounded-2xl focus:border-[#10B981] focus:bg-white outline-none font-bold text-slate-700 transition-all"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">SKU / Barcode</label>
                      <div className="relative">
                        <input 
                          required
                          className="w-full bg-slate-50 border-2 border-slate-50 p-4 pr-20 rounded-2xl focus:border-[#10B981] focus:bg-white outline-none font-bold font-mono text-slate-700 transition-all"
                          value={formData.sku}
                          onChange={e => setFormData({...formData, sku: e.target.value})}
                          placeholder={formData.name ? `Klik "Generate" untuk buat otomatis` : 'Masukkan SKU'}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                          {/* ✅ Tombol generate barcode otomatis */}
                          <button
                            type="button"
                            onClick={handleAutoGenerateSku}
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-[#10B981] hover:bg-green-50 rounded-lg transition-all"
                            title="Generate barcode otomatis"
                          >
                            <Barcode size={18} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => openScanner('sku')}
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-[#10B981] hover:bg-green-50 rounded-lg transition-all"
                          >
                            <Camera size={18} />
                          </button>
                        </div>
                      </div>
                   </div>

                   {/* ✅ Kategori: Dropdown SELECT + Tombol Tambah Kategori */}
                   <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kategori</label>
                        <button
                          type="button"
                          onClick={() => { setShowCategoryModal(true); setNewCategoryName(''); setCategoryError(''); }}
                          className="text-[9px] font-black text-purple-500 hover:text-purple-700 uppercase tracking-widest transition-all flex items-center gap-1"
                        >
                          <Tag size={10} />
                          + Baru
                        </button>
                      </div>
                      <select
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-50 p-4 rounded-2xl focus:border-[#10B981] focus:bg-white outline-none font-bold text-slate-700 transition-all appearance-none cursor-pointer"
                      >
                        {categories.filter(c => c !== 'Semua').map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                   </div>

                   {/* ✅ Supplier: Dropdown SELECT */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-purple-500">Supplier</label>
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tight">
                          {suppliers.length} tersedia
                        </span>
                      </div>
                      <select
                        value={formData.supplierId || ''}
                        onChange={e => {
                          const selectedId = e.target.value;
                          const selectedSupplier = suppliers.find(s => s.id === selectedId);
                          setFormData({
                            ...formData,
                            supplierId: selectedId,
                            supplierName: selectedSupplier?.name || ''
                          });
                        }}
                        className="w-full bg-purple-50/30 border-2 border-purple-50/50 p-4 rounded-2xl focus:border-purple-500 focus:bg-white outline-none font-bold text-purple-600 transition-all appearance-none cursor-pointer"
                      >
                        <option value="">— Pilih Supplier —</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <p className="text-[9px] text-slate-300 font-bold uppercase tracking-tighter">
                        {suppliers.length === 0 ? 'Belum ada supplier — tambah di menu Supplier' : `${suppliers.length} supplier terdaftar`}
                      </p>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 text-orange-500">Harga Modal</label>
                      <input 
                        type="number"
                        className="w-full bg-orange-50/35 border-2 border-orange-50/50 p-4 rounded-2xl focus:border-orange-500 focus:bg-white outline-none font-black text-orange-600 transition-all"
                        value={formData.priceCost || 0}
                        onChange={e => setFormData({...formData, priceCost: Number(e.target.value)})}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 text-emerald-500">Harga Eceran</label>
                      <input 
                        type="number"
                        className="w-full bg-emerald-50/30 border-2 border-emerald-50/50 p-4 rounded-2xl focus:border-[#10B981] focus:bg-white outline-none font-black text-emerald-600 transition-all"
                        value={formData.priceRetail}
                        onChange={e => setFormData({...formData, priceRetail: Number(e.target.value)})}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 text-blue-500">Harga Grosir</label>
                      <input 
                        type="number"
                        className="w-full bg-blue-50/30 border-2 border-blue-50/50 p-4 rounded-2xl focus:border-blue-500 focus:bg-white outline-none font-black text-blue-600 transition-all"
                        value={formData.priceWholesale}
                        onChange={e => setFormData({...formData, priceWholesale: Number(e.target.value)})}
                      />
                   </div>
                   <div className="space-y-2 col-span-full">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Stok Awal</label>
                      <input 
                        type="number"
                        className="w-full bg-slate-50 border-2 border-slate-50 p-4 rounded-2xl focus:border-[#10B981] focus:bg-white outline-none font-black text-slate-700 transition-all"
                        value={formData.stock}
                        onChange={e => setFormData({...formData, stock: Number(e.target.value)})}
                      />
                   </div>
                 </div>
                </div>
                 <div className="p-6 flex gap-4 flex-shrink-0 border-t border-slate-100">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-all">Batal</button>
                    <button type="submit" className="flex-[2] py-3 bg-[#10B981] text-white font-black rounded-2xl shadow-xl shadow-green-100 active:scale-95 transition-all text-lg uppercase tracking-tighter">
                      <Truck size={16} className="inline mr-2" />
                      {editingId ? 'Update' : 'Simpan'}
                    </button>
                 </div>
              </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;