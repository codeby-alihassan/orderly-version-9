import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Search,
  Wallet,
  Clock,
  Calendar,
  User as UserIcon,
  LogOut,
  KeyRound,
  PauseCircle,
  CheckCircle2,
  AlertCircle,
  FileText,
  Users,
  Package,
  PlusCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { formatDisplayDate, formatDisplayTime, formatCompactDate } from '../../lib/dateUtils';

export const Header: React.FC<{ onOpenHeldOrders: () => void }> = ({ onOpenHeldOrders }) => {
  const {
    user,
    settings,
    activeCash,
    formatMoney,
    setIsOpenCounterModalOpen,
    setIsCloseCounterModalOpen,
    setIsCashAdjustmentModalOpen,
    heldOrdersCount,
    handleLogout,
    setActiveTab,
    hasPermission,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    products: any[];
    customers: any[];
    sales: any[];
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showCashDropdown, setShowCashDropdown] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const cashRef = useRef<HTMLDivElement>(null);

  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Debounced global search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.globalSearch(searchQuery);
        setSearchResults(res);
        setShowSearchDropdown(true);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
      if (cashRef.current && !cashRef.current.contains(e.target as Node)) {
        setShowCashDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isCounterOpen = Boolean(activeCash?.session);

  return (
    <header className="h-16 bg-white border-b border-stone-200 px-4 md:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Brand / Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center text-white shadow-xs">
          <ShoppingBag className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-stone-900 tracking-tight leading-none">
            {settings.shop_name}
          </h1>
          <span className="text-[11px] font-medium text-orange-600 tracking-wider uppercase">Orderly POS</span>
        </div>
      </div>

      {/* Global Search Bar */}
      <div ref={searchRef} className="flex-1 max-w-lg relative hidden sm:block">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchResults) setShowSearchDropdown(true);
            }}
            placeholder="Search products, customers, invoices... (Press '/' to focus)"
            className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
          />
          {isSearching && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Global Search Dropdown */}
        {showSearchDropdown && searchResults && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-stone-200 rounded-xl shadow-xl p-2 z-50 max-h-96 overflow-y-auto">
            {searchResults.products.length === 0 &&
            searchResults.customers.length === 0 &&
            searchResults.sales.length === 0 ? (
              <div className="p-4 text-center text-xs text-stone-500">
                No matching products, customers, or invoices found.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Products */}
                {searchResults.products.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 px-2 py-1 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-stone-500" />
                      <span>Products ({searchResults.products.length})</span>
                    </div>
                    {searchResults.products.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setShowSearchDropdown(false);
                          setActiveTab('products');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-stone-50 flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <div className="font-medium text-stone-900">{p.name}</div>
                          <div className="text-[11px] text-stone-500 font-mono">SKU: {p.sku}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-stone-900">{formatMoney(p.sellingPrice)}</div>
                          <div className="text-[10px] text-stone-500">Stock: {p.currentStock}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Customers */}
                {searchResults.customers.length > 0 && (
                  <div className="border-t border-stone-100 pt-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 px-2 py-1 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-stone-500" />
                      <span>Customers ({searchResults.customers.length})</span>
                    </div>
                    {searchResults.customers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setShowSearchDropdown(false);
                          setActiveTab('credit');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-stone-50 flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <div className="font-medium text-stone-900">{c.name}</div>
                          <div className="text-[11px] text-stone-500">{c.phone}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-stone-500 block">Outstanding Due</span>
                          <span className="font-semibold text-orange-600">{formatMoney(c.currentBalance)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Sales / Invoices */}
                {searchResults.sales.length > 0 && (
                  <div className="border-t border-stone-100 pt-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 px-2 py-1 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-stone-500" />
                      <span>Invoices ({searchResults.sales.length})</span>
                    </div>
                    {searchResults.sales.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setShowSearchDropdown(false);
                          setActiveTab('invoices');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-stone-50 flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <div className="font-mono font-medium text-stone-900">{s.invoiceNumber}</div>
                          <div className="text-[11px] text-stone-500">
                            {s.customerName || 'Walk-in'} • {s.paymentMethod.toUpperCase()}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-stone-900">{formatMoney(s.grandTotal)}</span>
                          <span className="text-[10px] text-stone-400 block">{s.createdAt.slice(0, 10)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Header Actions */}
      <div className="flex items-center gap-2.5">
        {/* Live Date & Time Indicator */}
        <div
          id="header-live-datetime"
          className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-stone-50 border border-stone-200/80 rounded-lg text-xs hover:border-stone-300 transition-colors cursor-default"
          title="Business day resets strictly at 12:00 AM local midnight"
        >
          <div className="w-6 h-6 rounded-md bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col text-left leading-none gap-0.5">
            <span className="font-semibold text-stone-900 text-[11px]">{formatDisplayDate(currentDate)}</span>
            <span className="text-[10px] font-mono text-stone-500 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-stone-400" />
              {formatDisplayTime(currentDate)}
            </span>
          </div>
        </div>

        {/* Held Orders Pill */}
        <button
          id="held-orders-button"
          type="button"
          onClick={onOpenHeldOrders}
          className="relative px-3 py-1.5 bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
        >
          <PauseCircle className="w-4 h-4 text-orange-500" />
          <span className="hidden md:inline">Held Orders</span>
          {heldOrdersCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white rounded-full text-[10px] font-bold">
              {heldOrdersCount}
            </span>
          )}
        </button>

        {/* Counter Session Status & Drawer Control */}
        <div ref={cashRef} className="relative">
          {isCounterOpen ? (
            <button
              id="active-counter-badge"
              type="button"
              onClick={() => setShowCashDropdown((p) => !p)}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 rounded-lg text-xs transition-colors text-emerald-900"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="flex flex-col text-left">
                <span className="text-[10px] uppercase font-semibold text-emerald-700 leading-none">Current Cash</span>
                <span className="font-mono font-bold text-xs text-emerald-950">
                  {formatMoney(activeCash?.breakdown.currentCash || 0)}
                </span>
              </div>
            </button>
          ) : (
            <button
              id="open-counter-header-button"
              type="button"
              onClick={() => setIsOpenCounterModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-semibold text-amber-900 transition-colors"
            >
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Open Counter</span>
            </button>
          )}

          {/* Cash session dropdown menu */}
          {showCashDropdown && isCounterOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-stone-200 rounded-xl shadow-xl p-3 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <span className="text-xs font-semibold text-stone-800">Cash Drawer Actions</span>
                <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  Active
                </span>
              </div>
              <div className="py-2 space-y-1 text-xs">
                <div className="flex justify-between text-stone-500">
                  <span>Opening Vault</span>
                  <span className="font-mono text-stone-900">{formatMoney(activeCash?.breakdown.openingCash || 0)}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Cash Inflow Today</span>
                  <span className="font-mono text-emerald-600">
                    +{formatMoney((activeCash?.breakdown.cashSales || 0) + (activeCash?.breakdown.cashCustomerPayments || 0))}
                  </span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Cash Outflow Today</span>
                  <span className="font-mono text-red-600">-{formatMoney(activeCash?.breakdown.cashExpenses || 0)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-100 space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowCashDropdown(false);
                    setIsCashAdjustmentModalOpen(true);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-stone-50 text-xs font-medium text-stone-700 flex items-center gap-2 transition-colors"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-stone-500" />
                  <span>Cash Adjustment (In / Out)</span>
                </button>
                {hasPermission('cash') && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCashDropdown(false);
                      setActiveTab('cash');
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-stone-50 text-xs font-medium text-stone-700 flex items-center gap-2 transition-colors"
                  >
                    <Wallet className="w-3.5 h-3.5 text-stone-500" />
                    <span>View Full Cash Movements</span>
                  </button>
                )}
                <button
                  id="close-counter-dropdown-button"
                  type="button"
                  onClick={() => {
                    setShowCashDropdown(false);
                    setIsCloseCounterModalOpen(true);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-50 text-xs font-medium text-red-600 flex items-center gap-2 transition-colors"
                >
                  <Clock className="w-3.5 h-3.5 text-red-500" />
                  <span>Close Counter & End Shift</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div ref={userRef} className="relative">
          <button
            id="user-profile-button"
            type="button"
            onClick={() => setShowUserDropdown((p) => !p)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-stone-100 text-stone-700 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700 font-semibold text-xs">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'OP'}
            </div>
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-semibold text-stone-900 leading-none">{user?.name}</span>
              <span className="text-[10px] text-stone-500 capitalize">{user?.role}</span>
            </div>
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-stone-200 rounded-xl shadow-xl p-1.5 z-50">
              <div className="px-3 py-2 border-b border-stone-100">
                <div className="text-xs font-semibold text-stone-900">{user?.name}</div>
                <div className="text-[11px] text-stone-500 font-mono">@{user?.username}</div>
              </div>
              {hasPermission('settings') && (
                <button
                  type="button"
                  onClick={() => {
                    setShowUserDropdown(false);
                    setActiveTab('settings');
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5 text-stone-500" />
                  <span>Security & Password</span>
                </button>
              )}
              <button
                id="logout-button"
                type="button"
                onClick={() => {
                  setShowUserDropdown(false);
                  handleLogout();
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 text-red-500" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
