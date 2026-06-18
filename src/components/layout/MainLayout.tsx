/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, History, Wallet, BarChart3, Store, Bot, Truck, Users, TrendingDown, Percent, LogOut, User as UserIcon, PackagePlus, RotateCcw } from 'lucide-react';
import StockAlert from '@/components/pos/StockAlert';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/store/useSettingsStore';
import { indexdbUser } from '@/lib/indexdbUser';

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const storeName = useSettingsStore(state => state.storeInfo.name);
  const currentUser = indexdbUser.getCurrentUser();
  
  const rawMenuItems = [
    { path: '/', icon: <LayoutDashboard />, label: 'Beranda', roles: ['admin'], colorHex: '#6366F1', bgHex: '#6366F1', accentStyle: { backgroundColor: '#4f46e5', color: 'white' } },
    { path: '/pos', icon: <ShoppingCart />, label: 'Kasir', roles: ['admin', 'kasir'], colorHex: '#10b981', bgHex: '#10b981', accentStyle: { backgroundColor: '#059669', color: 'white' } },
    { path: '/restock', icon: <PackagePlus />, label: 'Masuk', roles: ['admin', 'gudang'], colorHex: '#0ea5e9', bgHex: '#0ea5e9', accentStyle: { backgroundColor: '#0284c7', color: 'white' } },
    { path: '/retur', icon: <RotateCcw />, label: 'Retur', roles: ['admin', 'gudang'], colorHex: '#f43f5e', bgHex: '#f43f5e', accentStyle: { backgroundColor: '#e11d48', color: 'white' } },
    { path: '/inventory', icon: <Package />, label: 'Produk', roles: ['admin', 'gudang'], colorHex: '#f59e0b', bgHex: '#f59e0b', accentStyle: { backgroundColor: '#d97706', color: 'white' } },
    { path: '/suppliers', icon: <Truck />, label: 'Supplier', roles: ['admin', 'gudang'], colorHex: '#8b5cf6', bgHex: '#8b5cf6', accentStyle: { backgroundColor: '#7c3aed', color: 'white' } },
    { path: '/expenses', icon: <TrendingDown />, label: 'Biaya', roles: ['admin'], colorHex: '#d946ef', bgHex: '#d946ef', accentStyle: { backgroundColor: '#c026d3', color: 'white' } },
    { path: '/discounts', icon: <Percent />, label: 'Diskon', roles: ['admin'], colorHex: '#ec4899', bgHex: '#ec4899', accentStyle: { backgroundColor: '#db2777', color: 'white' } },
    { path: '/customers', icon: <Users />, label: 'Pelanggan', roles: ['admin', 'kasir'], colorHex: '#14b8a6', bgHex: '#14b8a6', accentStyle: { backgroundColor: '#0d9488', color: 'white' } },
    { path: '/debts', icon: <Wallet />, label: 'Hutang', roles: ['admin', 'kasir'], colorHex: '#3b82f6', bgHex: '#3b82f6', accentStyle: { backgroundColor: '#1d4ed8', color: 'white' } },
    { path: '/history', icon: <History />, label: 'Riwayat', roles: ['admin', 'kasir'], colorHex: '#06b6d4', bgHex: '#06b6d4', accentStyle: { backgroundColor: '#0891b2', color: 'white' } },
    { path: '/reports', icon: <BarChart3 />, label: 'Laporan', roles: ['admin'], colorHex: '#a855f7', bgHex: '#a855f7', accentStyle: { backgroundColor: '#9333ea', color: 'white' } },
    { path: '/settings', icon: <Store />, label: 'Toko', roles: ['admin'], colorHex: '#6b7280', bgHex: '#6b7280', accentStyle: { backgroundColor: '#4b5563', color: 'white' } },
  ];

  const menuItems = rawMenuItems.filter(item => {
    const role = currentUser?.role || 'admin';
    return item.roles.includes(role);
  });

  return (
    <div className="flex flex-col min-h-[calc(var(--vh,1vh)*100)]" style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
      {/* Top Header */}
      <header className="h-16 px-6 flex items-center justify-between shrink-0 z-40" style={{ 
        backgroundColor: 'var(--color-bg-elevated)',
        borderBottomColor: 'var(--color-border-light)',
        borderBottomWidth: '1px'
      }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0" style={{ backgroundColor: 'var(--color-primary-600)' }}>
            <Store size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-base font-black leading-tight tracking-tight" style={{ color: 'var(--color-text-primary)' }}>{storeName}</h1>
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-tertiary)' }}>Sistem Kasir · Tema High Density</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {currentUser && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-black leading-none" style={{ color: 'var(--color-text-primary)' }}>{currentUser.name || 'User'}</div>
                  <div className="text-[8px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-primary-600)' }}>{currentUser.role || 'kasir'}</div>
                </div>
                <div className="w-9 h-9 rounded-xl border flex items-center justify-center font-extrabold text-xs uppercase" style={{ 
                  backgroundColor: 'var(--color-primary-100)',
                  borderColor: 'var(--color-primary-300)',
                  color: 'var(--color-primary-700)'
                }}>
                  {(currentUser.name || 'User').slice(0, 2)}
                </div>
              </div>
              <button
                onClick={() => {
                  indexdbUser.logout();
                  navigate('/login');
                }}
                title="Logout"
                className="p-2 rounded-xl transition-all flex items-center justify-center"
                style={{ 
                  color: 'var(--color-text-tertiary)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-error)';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }}
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Scrollable Content Panel */}
      <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6 pb-28 md:pb-28" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <div className="max-w-7xl mx-auto">
          <StockAlert />
          {children}
        </div>
      </main>

      {/* Bottom Floating Navigation for All Platforms - Balanced and Crisp */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-7xl px-2 z-50">
        <nav className="h-20 backdrop-blur-md rounded-[28px] flex items-center justify-start md:justify-center px-4 gap-2 overflow-x-auto scrollbar-none shadow-xl transition-all select-none" style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderColor: 'var(--color-border-light)',
          borderWidth: '1px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        }}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 transition-all py-1 px-2.5 rounded-2xl min-w-[64px] shrink-0",
                  isActive 
                    ? "scale-105" 
                    : "hover:opacity-75 active:scale-95"
                )}
              >
                {/* Icon Container with very solid borders & styling for clear visibility in Light Mode */}
                <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 border" style={{
                  backgroundColor: isActive ? item.accentStyle.backgroundColor : `${item.bgHex}15`,
                  borderColor: isActive ? 'transparent' : `${item.colorHex}40`,
                  boxShadow: isActive ? `0 4px 12px ${item.bgHex}30` : 'none',
                  color: isActive ? 'white' : item.colorHex
                }}>
                  <div className={cn(
                    "transition-transform duration-200",
                    isActive ? "scale-110" : "scale-100",
                    "[&>svg]:w-[18px] [&>svg]:h-[18px] [&>svg]:stroke-[2.5]"
                  )} style={{ color: isActive ? 'white' : item.colorHex }}>
                    {item.icon}
                  </div>
                </div>
                {/* Labels with increased readability */}
                <span className={cn(
                  "text-[8px] tracking-tight leading-none truncate max-w-[62px] uppercase text-center mt-0.5 font-bold",
                  isActive 
                    ? "font-extrabold" 
                    : "font-black"
                )} style={{
                  color: isActive ? item.accentStyle.backgroundColor : 'var(--color-text-secondary)'
                }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default MainLayout;
