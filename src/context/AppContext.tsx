import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, CashSessionSummary, AppSettings, KeyboardShortcuts } from '../types';
import { api, getStoredToken, removeStoredToken, setStoredToken } from '../lib/api';

interface AppContextType {
  user: User | null;
  setUser: (u: User | null) => void;
  activeCash: CashSessionSummary | null;
  refreshCash: () => Promise<void>;
  settings: AppSettings;
  refreshSettings: () => Promise<void>;
  updateSettings: (newSettings: Record<string, string>) => Promise<any>;
  updateProfile: (newSettings: Record<string, string>) => Promise<any>;
  shortcuts: KeyboardShortcuts;
  refreshShortcuts: () => Promise<void>;
  heldOrdersCount: number;
  refreshHeldOrdersCount: () => Promise<void>;
  isOpenCounterModalOpen: boolean;
  setIsOpenCounterModalOpen: (v: boolean) => void;
  isCloseCounterModalOpen: boolean;
  setIsCloseCounterModalOpen: (v: boolean) => void;
  isCashAdjustmentModalOpen: boolean;
  setIsCashAdjustmentModalOpen: (v: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  hasPermission: (tabOrModuleId: string) => boolean;
  formatMoney: (amount: number) => string;
  handleLogout: () => Promise<void>;
  isInitializing: boolean;
}

const defaultShortcuts: KeyboardShortcuts = {
  searchProduct: 'F2',
  creditCustomer: 'F4',
  holdOrder: 'F6',
  checkout: 'F8',
  quickCash: 'F9',
  clearCart: 'Escape',
};

const defaultSettings: AppSettings = {
  shop_name: 'Orderly Supermarket',
  shop_address: 'Main Commercial Avenue',
  shop_phone: '+1 (555) 349-2810',
  currency: 'Rs.',
  tax_rate: '0',
  tax_enabled: 'false',
  default_low_stock_threshold: '5',
  theme: 'light',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeCash, setActiveCash] = useState<CashSessionSummary | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [shortcuts, setShortcuts] = useState<KeyboardShortcuts>(defaultShortcuts);
  const [heldOrdersCount, setHeldOrdersCount] = useState(0);

  const [isOpenCounterModalOpen, setIsOpenCounterModalOpen] = useState(false);
  const [isCloseCounterModalOpen, setIsCloseCounterModalOpen] = useState(false);
  const [isCashAdjustmentModalOpen, setIsCashAdjustmentModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const hasPermission = useCallback(
    (tabOrModuleId: string): boolean => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      const perms = Array.isArray(user.permissions) ? user.permissions : ['pos', 'invoices'];
      return perms.includes(tabOrModuleId);
    },
    [user]
  );

  // Auto-redirect user if current activeTab is not permitted
  useEffect(() => {
    if (user && !hasPermission(activeTab)) {
      const allModules = [
        'pos',
        'invoices',
        'dashboard',
        'products',
        'purchases',
        'credit',
        'analytics',
        'cash',
        'expenses',
        'settings',
      ];
      const fallbackTab = allModules.find((tab) => hasPermission(tab)) || 'pos';
      setActiveTab(fallbackTab);
    }
  }, [user, activeTab, hasPermission]);

  const refreshCash = useCallback(async () => {
    try {
      const summary = await api.getActiveCash();
      setActiveCash(summary);
    } catch (err) {
      console.error('Error loading cash status:', err);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await api.getSettings();
      setSettings((prev) => ({ ...prev, ...s }));
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Record<string, string>) => {
    const res = await api.updateSettings(newSettings);
    await refreshSettings();
    return res;
  }, [refreshSettings]);

  const updateProfile = useCallback(async (newSettings: Record<string, string>) => {
    return updateSettings(newSettings);
  }, [updateSettings]);

  const refreshShortcuts = useCallback(async () => {
    try {
      const sc = await api.getKeyboardShortcuts();
      setShortcuts(sc);
    } catch (err) {
      console.error('Error loading shortcuts:', err);
    }
  }, []);

  const refreshHeldOrdersCount = useCallback(async () => {
    try {
      const orders = await api.getHeldOrders();
      setHeldOrdersCount(Array.isArray(orders) ? orders.length : 0);
    } catch (err) {
      console.error('Error loading held orders count:', err);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Ignore
    } finally {
      removeStoredToken();
      setUser(null);
    }
  }, []);

  // Format currency helper
  const formatMoney = useCallback(
    (amount: number) => {
      const formatted = Number(amount || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${settings.currency} ${formatted}`;
    },
    [settings.currency]
  );

  // Initial authentication check
  useEffect(() => {
    async function checkAuth() {
      const token = getStoredToken();
      if (!token) {
        setIsInitializing(false);
        return;
      }

      try {
        const res = await api.getMe();
        if (res?.user) {
          setUser(res.user);
          await Promise.all([
            refreshCash(),
            refreshSettings(),
            refreshShortcuts(),
            refreshHeldOrdersCount(),
          ]);
        } else {
          removeStoredToken();
        }
      } catch {
        removeStoredToken();
      } finally {
        setIsInitializing(false);
      }
    }

    checkAuth();

    const handleExpired = () => {
      setUser(null);
    };

    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, [refreshCash, refreshSettings, refreshShortcuts, refreshHeldOrdersCount]);

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        activeCash,
        refreshCash,
        settings,
        refreshSettings,
        updateSettings,
        updateProfile,
        shortcuts,
        refreshShortcuts,
        heldOrdersCount,
        refreshHeldOrdersCount,
        isOpenCounterModalOpen,
        setIsOpenCounterModalOpen,
        isCloseCounterModalOpen,
        setIsCloseCounterModalOpen,
        isCashAdjustmentModalOpen,
        setIsCashAdjustmentModalOpen,
        activeTab,
        setActiveTab,
        hasPermission,
        formatMoney,
        handleLogout,
        isInitializing,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
