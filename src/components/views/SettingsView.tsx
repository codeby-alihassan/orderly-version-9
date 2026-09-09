import React, { useState, useEffect } from 'react';
import {
  Settings,
  Store,
  Printer,
  Users,
  Database,
  Save,
  Download,
  Key,
  KeyRound,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Lock,
  X,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { useToast } from '../Toast';
import { AppSettings, User } from '../../types';

export const MODULE_OPTIONS = [
  { id: 'pos', name: 'Sales (POS)', desc: 'Terminal, cart, barcode scanner & quick cash' },
  { id: 'invoices', name: 'Sales Invoices', desc: 'Receipt history and reprinting' },
  { id: 'dashboard', name: 'Dashboard', desc: 'Summary KPIs, daily revenue & alerts' },
  { id: 'products', name: 'Products & Stock', desc: 'Product catalog & inventory adjustments' },
  { id: 'purchases', name: 'Purchase Orders', desc: 'Supplier receiving & stock replenishment' },
  { id: 'credit', name: 'Credit Ledger', desc: 'Customer balances and payments' },
  { id: 'cash', name: 'Cash Counter', desc: 'Open/close drawer & cash movements' },
  { id: 'expenses', name: 'Expenses', desc: 'Petty cash expense logging' },
  { id: 'analytics', name: 'Analytics & Reports', desc: 'Sales, margin charts & breakdown' },
  { id: 'settings', name: 'Settings', desc: 'Store profile, printers & backup' },
];

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, user, setUser } = useApp();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'store' | 'receipt' | 'users' | 'security' | 'backup'>('store');
  const [formData, setFormData] = useState<Record<string, string>>({
    shop_name: 'Orderly Supermarket',
    shop_address: 'Main Boulevard, Commercial Plaza',
    shop_phone: '+1 (555) 349-2810',
    currency: 'Rs.',
    tax_rate: '0',
    tax_enabled: 'false',
    tax_number: 'NTN-8923412',
    receipt_header: 'Welcome to Orderly Supermarket! Thank you for shopping with us.',
    receipt_footer: 'Goods once sold cannot be returned without original receipt.',
    receipt_paper_size: '80mm',
    show_address_on_receipt: 'true',
    show_phone_on_receipt: 'true',
    show_tax_on_receipt: 'true',
    default_low_stock_threshold: '5',
  });

  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New user state
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'cashier'>('cashier');
  const [newUserPermissions, setNewUserPermissions] = useState<string[]>(['pos', 'invoices']);

  // Edit user permissions modal state
  const [editingPermissionsUser, setEditingPermissionsUser] = useState<User | null>(null);
  const [editPermissionsList, setEditPermissionsList] = useState<string[]>([]);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  // User deletion state
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Admin credentials state
  const [adminName, setAdminName] = useState(user?.name || '');
  const [adminUsername, setAdminUsername] = useState(user?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingCredentials, setIsUpdatingCredentials] = useState(false);

  useEffect(() => {
    if (user) {
      setAdminName(user.name);
      setAdminUsername(user.username);
    }
  }, [user]);

  useEffect(() => {
    if (settings) {
      setFormData((prev) => ({
        ...prev,
        ...settings,
      }));
    }
  }, [settings]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await api.getUsers();
      setUsersList(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings(formData as any);
      showToast('Store settings saved successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserPin.trim()) {
      showToast('Name and PIN required', 'error');
      return;
    }

    try {
      const permsToAssign = newUserRole === 'admin' ? MODULE_OPTIONS.map((m) => m.id) : newUserPermissions;
      const res: any = await api.createUser({
        name: newUserName.trim(),
        username: newUserUsername.trim() || undefined,
        pin: newUserPin.trim(),
        role: newUserRole,
        permissions: permsToAssign,
      });
      showToast(`Staff account created! Login ID: ${res.username || newUserName}`);
      setNewUserName('');
      setNewUserUsername('');
      setNewUserPin('');
      setNewUserRole('cashier');
      setNewUserPermissions(['pos', 'invoices']);
      await loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to create user', 'error');
    }
  };

  const openEditPermissions = (u: User) => {
    setEditingPermissionsUser(u);
    setEditPermissionsList(u.permissions && u.permissions.length > 0 ? u.permissions : ['pos', 'invoices']);
  };

  const handleSavePermissions = async () => {
    if (!editingPermissionsUser) return;
    try {
      setIsSavingPermissions(true);
      await api.updateUserPermissions(editingPermissionsUser.id, editPermissionsList);
      showToast(`Permissions updated for "${editingPermissionsUser.name}"!`);
      setEditingPermissionsUser(null);
      await loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to update permissions', 'error');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const executeDeleteUser = async (targetUser: User) => {
    if (targetUser.id === user?.id) {
      showToast('You cannot delete your own active administrator account', 'error');
      return;
    }
    setIsDeletingUser(true);
    try {
      await api.deleteUser(targetUser.id);
      showToast(`Staff member "${targetUser.name}" removed successfully`);
      setUserToDelete(null);
      await loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove staff account', 'error');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      showToast('Please enter your current password to verify your identity', 'error');
      return;
    }
    if (newPassword && newPassword.length < 4) {
      showToast('New password must be at least 4 characters long', 'error');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      showToast('New password and confirmation do not match', 'error');
      return;
    }

    setIsUpdatingCredentials(true);
    try {
      const res = await api.updateCredentials({
        currentPassword,
        newUsername: adminUsername.trim(),
        newPassword: newPassword.trim() || undefined,
        name: adminName.trim(),
      });
      if (res.user) {
        setUser(res.user);
      }
      showToast('Admin credentials updated successfully! Changes saved to database.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to update admin credentials', 'error');
    } finally {
      setIsUpdatingCredentials(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const dump = await api.getBackupDump();
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orderly-pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup JSON exported successfully');
    } catch (err: any) {
      showToast(err.message || 'Backup export failed', 'error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-stone-900 tracking-tight">System Settings & Configuration</h2>
        <p className="text-xs text-stone-500 mt-0.5">
          Store profile, thermal receipt slip templates, cashier authentication, and database backups
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-lg text-xs font-medium w-fit border border-stone-200">
        <button
          type="button"
          onClick={() => setActiveTab('store')}
          className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
            activeTab === 'store' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>Store & Tax</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('receipt')}
          className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
            activeTab === 'receipt' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600'
          }`}
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Thermal Slip Format</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
            activeTab === 'users' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Staff & Cashier PINs</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
            activeTab === 'security' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Admin Security</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
            activeTab === 'backup' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Database & Backup</span>
        </button>
      </div>

      {/* TAB 1: STORE & TAX PROFILE */}
      {activeTab === 'store' && (
        <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-xl border border-stone-200 shadow-2xs space-y-5 max-w-2xl">
          <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
            Store Profile & Tax Rules
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Store / Business Name *
              </label>
              <input
                type="text"
                required
                value={formData.shop_name || ''}
                onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                required
                value={formData.currency || ''}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                placeholder="Rs. or $"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={formData.shop_phone || ''}
                onChange={(e) => setFormData({ ...formData, shop_phone: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Tax / NTN Registration #
              </label>
              <input
                type="text"
                value={formData.tax_number || ''}
                onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                placeholder="NTN-9823412"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Shop Address
              </label>
              <input
                type="text"
                value={formData.shop_address || ''}
                onChange={(e) => setFormData({ ...formData, shop_address: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Default Sales Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="50"
                value={formData.tax_rate || '0'}
                onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none"
              />
              <p className="text-[11px] text-stone-400 mt-0.5">Applied automatically when enabled in checkout</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Default Low Stock Alert Level
              </label>
              <input
                type="number"
                min="1"
                value={formData.default_low_stock_threshold || '5'}
                onChange={(e) => setFormData({ ...formData, default_low_stock_threshold: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none"
              />
              <p className="text-[11px] text-stone-400 mt-0.5">Trigger warning when product inventory falls below this</p>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: RECEIPT CUSTOMIZATION */}
      {activeTab === 'receipt' && (
        <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-xl border border-stone-200 shadow-2xs space-y-5 max-w-2xl">
          <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
            Thermal Slip Customization
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Receipt Paper Width
              </label>
              <div className="grid grid-cols-2 gap-3 max-w-xs">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, receipt_paper_size: '80mm' })}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold ${
                    formData.receipt_paper_size === '80mm'
                      ? 'bg-orange-50 border-orange-500 text-orange-800 ring-2 ring-orange-500/20'
                      : 'bg-stone-50 border-stone-200 text-stone-600'
                  }`}
                >
                  80mm Standard POS Slip
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, receipt_paper_size: '58mm' })}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold ${
                    formData.receipt_paper_size === '58mm'
                      ? 'bg-orange-50 border-orange-500 text-orange-800 ring-2 ring-orange-500/20'
                      : 'bg-stone-50 border-stone-200 text-stone-600'
                  }`}
                >
                  58mm Compact Mini Slip
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Receipt Header Greeting
              </label>
              <input
                type="text"
                value={formData.receipt_header || ''}
                onChange={(e) => setFormData({ ...formData, receipt_header: e.target.value })}
                placeholder="e.g. Welcome to Orderly Supermarket!"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Receipt Footer Terms
              </label>
              <textarea
                rows={2}
                value={formData.receipt_footer || ''}
                onChange={(e) => setFormData({ ...formData, receipt_footer: e.target.value })}
                placeholder="e.g. Goods once sold cannot be returned without original receipt. Thanks for visiting!"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none"
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-stone-100">
              <label className="flex items-center gap-2 text-xs font-medium text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.show_address_on_receipt === 'true'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      show_address_on_receipt: e.target.checked ? 'true' : 'false',
                    })
                  }
                  className="rounded border-stone-300 text-orange-500 focus:ring-orange-500"
                />
                <span>Print Store Address on Slip</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.show_phone_on_receipt === 'true'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      show_phone_on_receipt: e.target.checked ? 'true' : 'false',
                    })
                  }
                  className="rounded border-stone-300 text-orange-500 focus:ring-orange-500"
                />
                <span>Print Phone Number on Slip</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.show_tax_on_receipt === 'true'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      show_tax_on_receipt: e.target.checked ? 'true' : 'false',
                    })
                  }
                  className="rounded border-stone-300 text-orange-500 focus:ring-orange-500"
                />
                <span>Print Tax / NTN Number on Slip</span>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Slip Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: STAFF & CASHIERS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-purple-900">
                  Master Administrator: {user?.name || 'Admin'} <span className="font-mono text-[11px] font-normal text-purple-700">(@{user?.username || 'admin'})</span>
                </div>
                <div className="text-[11px] text-purple-700">
                  Full unrestricted access to all software features and database configurations.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className="px-3 py-1.5 bg-white border border-purple-200 text-purple-800 text-xs font-semibold rounded-lg hover:bg-purple-50 transition-colors shadow-2xs shrink-0 flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-purple-600" />
              <span>Change Admin Password / Username</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-stone-100 bg-stone-50">
                <h3 className="text-sm font-bold text-stone-900">Authorized Cashiers & Staff</h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Staff accounts and custom feature permissions. Click a staff member's permissions button to customize access.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-stone-100 text-stone-400 text-[10px] uppercase">
                    <tr>
                      <th className="py-2.5 px-4">Name</th>
                      <th className="py-2.5 px-4">Login ID</th>
                      <th className="py-2.5 px-4">Role</th>
                      <th className="py-2.5 px-4">Permissions</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Login PIN</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-stone-50/70">
                        <td className="py-3 px-4 font-semibold text-stone-900">{u.name}</td>
                        <td className="py-3 px-4 font-mono font-medium text-stone-700">
                          <span className="bg-stone-100 px-2 py-0.5 rounded border border-stone-200/80 text-[11px]">
                            {u.username}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              u.role === 'admin'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-stone-100 text-stone-700 border border-stone-200'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {u.role === 'admin' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              All Modules (Master)
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openEditPermissions(u)}
                              className="inline-flex items-center gap-1.5 px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[11px] font-medium border border-stone-200/80 transition-colors"
                              title="Click to edit permissions"
                            >
                              <Lock className="w-3 h-3 text-stone-500" />
                              <span>{u.permissions?.length ?? 2} / {MODULE_OPTIONS.length} Modules</span>
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-emerald-700 text-[11px] font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-stone-500">••••</td>
                        <td className="py-3 px-4 text-right">
                          {u.id !== user?.id && (
                            userToDelete?.id === u.id ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  disabled={isDeletingUser}
                                  onClick={() => executeDeleteUser(u)}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-semibold transition-colors disabled:opacity-50"
                                >
                                  {isDeletingUser ? 'Deleting...' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  disabled={isDeletingUser}
                                  onClick={() => setUserToDelete(null)}
                                  className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded text-[10px] transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setUserToDelete(u)}
                                className="p-1.5 rounded-lg border border-stone-200 text-stone-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors inline-flex items-center"
                                title="Remove staff member"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs space-y-4 h-fit">
            <h4 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
              Add New Staff / Cashier
            </h4>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">Staff Member Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => {
                    const val = e.target.value;
                    const prevSlug = newUserName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '');
                    setNewUserName(val);
                    if (!newUserUsername || newUserUsername === prevSlug) {
                      setNewUserUsername(val.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, ''));
                    }
                  }}
                  placeholder="e.g. Asad Khan"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Login Username <span className="text-stone-400 font-normal">(cashier signs in with this)</span>
                </label>
                <input
                  type="text"
                  required
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, ''))}
                  placeholder="e.g. asad or cashier1"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">4-Digit Login PIN</label>
                <input
                  type="password"
                  maxLength={6}
                  required
                  value={newUserPin}
                  onChange={(e) => setNewUserPin(e.target.value)}
                  placeholder="1234"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">Assigned Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium focus:outline-none"
                >
                  <option value="cashier">Cashier (Custom Permissions)</option>
                  <option value="admin">Store Admin (Full Control)</option>
                </select>
              </div>

              {/* Custom Staff Permissions Selector */}
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-stone-700">
                    Feature Access Permissions
                  </label>
                  {newUserRole !== 'admin' && (
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setNewUserPermissions(MODULE_OPTIONS.map((m) => m.id))}
                        className="text-orange-600 hover:text-orange-700 font-semibold underline underline-offset-2"
                      >
                        Select All
                      </button>
                      <span className="text-stone-300">•</span>
                      <button
                        type="button"
                        onClick={() => setNewUserPermissions(['pos', 'invoices'])}
                        className="text-stone-500 hover:text-stone-700 font-medium"
                      >
                        Default
                      </button>
                      <span className="text-stone-300">•</span>
                      <button
                        type="button"
                        onClick={() => setNewUserPermissions([])}
                        className="text-stone-400 hover:text-stone-600"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-stone-400">
                  {newUserRole === 'admin'
                    ? 'Admins automatically have master permissions for all modules.'
                    : 'Select which individual software features this cashier can view and access:'}
                </p>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {MODULE_OPTIONS.map((mod) => {
                    const isChecked = newUserRole === 'admin' || newUserPermissions.includes(mod.id);
                    const isDisabled = newUserRole === 'admin';
                    return (
                      <label
                        key={mod.id}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-orange-50/50 border-orange-200 text-stone-900'
                            : 'bg-stone-50/80 border-stone-200 text-stone-600 hover:bg-stone-100'
                        } ${isDisabled ? 'opacity-80 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isDisabled}
                          onChange={(e) => {
                            if (isDisabled) return;
                            if (e.target.checked) {
                              setNewUserPermissions((prev) => [...prev, mod.id]);
                            } else {
                              setNewUserPermissions((prev) => prev.filter((id) => id !== mod.id));
                            }
                          }}
                          className="mt-0.5 rounded border-stone-300 text-orange-500 focus:ring-orange-400"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-stone-800 text-[11px] leading-tight flex items-center justify-between">
                            <span>{mod.name}</span>
                            {isChecked && <Check className="w-3 h-3 text-orange-600 shrink-0" />}
                          </div>
                          <p className="text-[10px] text-stone-400 leading-snug mt-0.5 truncate">{mod.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                Create Staff Account
              </button>
            </form>
          </div>
        </div>
        </div>
      )}

      {/* TAB: ADMIN SECURITY & CREDENTIALS */}
      {activeTab === 'security' && (
        <form onSubmit={handleUpdateCredentials} className="bg-white p-6 rounded-xl border border-stone-200 shadow-2xs space-y-6 max-w-2xl">
          <div className="border-b border-stone-100 pb-3 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">Administrator Security & Credentials</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Update your administrator account name, login username, and master password. These credentials give you complete administrative control over the POS system.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Administrator Display Name
                </label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="e.g. Store Owner / Super Admin"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-stone-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Admin Login Username
                </label>
                <input
                  type="text"
                  required
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="e.g. admin"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono focus:bg-white focus:outline-none focus:border-stone-400"
                />
                <span className="text-[10px] text-stone-400 mt-1 block">Used to sign in to the administrative portal.</span>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Current Password / Master PIN <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password to verify identity"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-stone-400"
                />
                <span className="text-[10px] text-stone-400 mt-1 block">Verification is required before updating your credentials.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    New Password (Optional)
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep current password"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-stone-400"
                  />
                  <span className="text-[10px] text-stone-400 mt-1 block">Minimum 4 characters or numbers.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-stone-400"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isUpdatingCredentials}
              className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              <span>{isUpdatingCredentials ? 'Updating Credentials...' : 'Update Admin Credentials'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: DATABASE & BACKUP */}
      {activeTab === 'backup' && (
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-2xs space-y-6 max-w-2xl">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Database Export & Safety Backup</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Download your complete store database snapshot containing all products, customers, transactions, and settings.
            </p>
          </div>

          <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-stone-800 block">Download Offline JSON Backup</span>
                <span className="text-[11px] text-stone-500">
                  Export products, inventory stock counts, customer credit ledgers, and sales logs
                </span>
              </div>
              <button
                type="button"
                onClick={handleExportBackup}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER PERMISSIONS */}
      {editingPermissionsUser && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-orange-500" />
                  Custom Permissions for {editingPermissionsUser.name}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Login ID: <span className="font-mono text-stone-700 font-semibold">{editingPermissionsUser.username}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPermissionsUser(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-700">Select Permitted Modules:</span>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setEditPermissionsList(MODULE_OPTIONS.map((m) => m.id))}
                  className="text-orange-600 hover:text-orange-700 font-semibold underline underline-offset-2"
                >
                  Select All
                </button>
                <span className="text-stone-300">•</span>
                <button
                  type="button"
                  onClick={() => setEditPermissionsList(['pos', 'invoices'])}
                  className="text-stone-500 hover:text-stone-700"
                >
                  Default
                </button>
                <span className="text-stone-300">•</span>
                <button
                  type="button"
                  onClick={() => setEditPermissionsList([])}
                  className="text-stone-400 hover:text-stone-600"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {MODULE_OPTIONS.map((mod) => {
                const isChecked = editPermissionsList.includes(mod.id);
                return (
                  <label
                    key={mod.id}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-orange-50/60 border-orange-200 text-stone-900'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditPermissionsList((prev) => [...prev, mod.id]);
                        } else {
                          setEditPermissionsList((prev) => prev.filter((id) => id !== mod.id));
                        }
                      }}
                      className="mt-0.5 rounded border-stone-300 text-orange-500 focus:ring-orange-400"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-stone-800 text-[11px] flex items-center justify-between">
                        <span>{mod.name}</span>
                        {isChecked && <Check className="w-3 h-3 text-orange-600 shrink-0" />}
                      </div>
                      <p className="text-[10px] text-stone-400 mt-0.5 truncate">{mod.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setEditingPermissionsUser(null)}
                className="px-3.5 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingPermissions}
                onClick={handleSavePermissions}
                className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {isSavingPermissions ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
