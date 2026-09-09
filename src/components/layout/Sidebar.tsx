import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  Users,
  FileText,
  BarChart3,
  Wallet,
  Receipt,
  Settings,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, hasPermission } = useApp();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos', label: 'Sales (POS)', icon: ShoppingCart },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'purchases', label: 'Purchase & Inventory', icon: Truck },
    { id: 'credit', label: 'Credit Ledger', icon: Users },
    { id: 'invoices', label: 'Sales Invoices', icon: FileText },
    { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
    { id: 'cash', label: 'Cash & Counter', icon: Wallet },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const allowedNavItems = navItems.filter((item) => hasPermission(item.id));

  return (
    <aside className="w-60 bg-white border-r border-stone-200 flex flex-col shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-3 space-y-1">
        {allowedNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-stone-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="mt-auto p-4 border-t border-stone-200 text-[11px] text-stone-400">
        <div className="font-semibold text-stone-600">Orderly POS v1.0</div>
        <div>SQLite Database Online</div>
      </div>
    </aside>
  );
};
