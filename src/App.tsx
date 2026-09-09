import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './components/Toast';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { OpenCounterModal } from './components/counter/OpenCounterModal';
import { CloseCounterModal } from './components/counter/CloseCounterModal';
import { CashAdjustmentModal } from './components/counter/CashAdjustmentModal';
import { HeldOrdersDrawer } from './components/pos/HeldOrdersDrawer';

// Views
import { DashboardView } from './components/views/DashboardView';
import { PosView } from './components/views/PosView';
import { ProductManagementView } from './components/views/ProductManagementView';
import { PurchaseInventoryView } from './components/views/PurchaseInventoryView';
import { CreditCustomersView } from './components/views/CreditCustomersView';
import { SalesInvoicesView } from './components/views/SalesInvoicesView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { CashManagementView } from './components/views/CashManagementView';
import { ExpensesView } from './components/views/ExpensesView';
import { SettingsView } from './components/views/SettingsView';

const MainLayout: React.FC = () => {
  const {
    user,
    activeTab,
    setActiveTab,
    hasPermission,
    isOpenCounterModalOpen,
    setIsOpenCounterModalOpen,
    isCloseCounterModalOpen,
    setIsCloseCounterModalOpen,
    isCashAdjustmentModalOpen,
    setIsCashAdjustmentModalOpen,
  } = useApp();

  const [isHeldOrdersOpen, setIsHeldOrdersOpen] = useState(false);

  if (!user) {
    return <LoginScreen />;
  }

  const handleRestoreCart = (cartData: any) => {
    setActiveTab('pos');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('pos:restore-cart', { detail: cartData }));
    }, 50);
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col font-sans text-stone-900 selection:bg-orange-500 selection:text-white">
      {/* Top Application Header */}
      <Header onOpenHeldOrders={() => setIsHeldOrdersOpen(true)} />

      {/* Body: Sidebar + Dynamic Main View */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 flex flex-col overflow-hidden bg-stone-50">
          {activeTab === 'dashboard' && hasPermission('dashboard') && <DashboardView />}
          {activeTab === 'pos' && hasPermission('pos') && <PosView />}
          {activeTab === 'products' && hasPermission('products') && <ProductManagementView />}
          {activeTab === 'purchases' && hasPermission('purchases') && <PurchaseInventoryView />}
          {activeTab === 'credit' && hasPermission('credit') && <CreditCustomersView />}
          {activeTab === 'invoices' && hasPermission('invoices') && <SalesInvoicesView />}
          {activeTab === 'analytics' && hasPermission('analytics') && <AnalyticsView />}
          {activeTab === 'cash' && hasPermission('cash') && <CashManagementView />}
          {activeTab === 'expenses' && hasPermission('expenses') && <ExpensesView />}
          {activeTab === 'settings' && hasPermission('settings') && <SettingsView />}
          {!hasPermission(activeTab) && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-3">
                <span className="text-xl">🔒</span>
              </div>
              <h3 className="text-base font-bold text-stone-900">Access Restricted</h3>
              <p className="text-xs text-stone-500 max-w-sm mt-1">
                Your staff account does not have authorization to view this module. Please contact your store administrator.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Global Modals */}
      <OpenCounterModal
        isOpen={isOpenCounterModalOpen}
        onClose={() => setIsOpenCounterModalOpen(false)}
      />

      <CloseCounterModal
        isOpen={isCloseCounterModalOpen}
        onClose={() => setIsCloseCounterModalOpen(false)}
      />

      <CashAdjustmentModal
        isOpen={isCashAdjustmentModalOpen}
        onClose={() => setIsCashAdjustmentModalOpen(false)}
      />

      <HeldOrdersDrawer
        isOpen={isHeldOrdersOpen}
        onClose={() => setIsHeldOrdersOpen(false)}
        onRestoreCart={handleRestoreCart}
      />
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </ToastProvider>
  );
}
