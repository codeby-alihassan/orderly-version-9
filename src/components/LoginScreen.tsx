import React, { useState, useEffect } from 'react';
import { ShoppingBag, Lock, User, AlertCircle, ArrowRight, ShieldCheck, Store, KeyRound } from 'lucide-react';
import { api, setStoredToken } from '../lib/api';
import { useApp } from '../context/AppContext';
import { useToast } from './Toast';

export const LoginScreen: React.FC = () => {
  const { setUser, refreshCash, refreshSettings, refreshShortcuts, setIsOpenCounterModalOpen } = useApp();
  const { showToast } = useToast();

  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial setup state
  const [setupData, setSetupData] = useState({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
    pin: '',
    storeName: 'Orderly Supermarket',
    currency: 'Rs.',
  });

  useEffect(() => {
    checkSystemSetup();
  }, []);

  const checkSystemSetup = async () => {
    try {
      const res = await api.getSetupStatus();
      setSetupRequired(res.setupRequired);
    } catch {
      // If error checking setup, default to standard login
      setSetupRequired(false);
    } finally {
      setIsCheckingSetup(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await api.login(username.trim(), password);
      setStoredToken(res.token);
      setUser(res.user);

      await Promise.all([refreshCash(), refreshSettings(), refreshShortcuts()]);
      showToast(`Welcome back, ${res.user.name}!`);

      // Check if counter is closed and prompt opening
      try {
        const cashRes = await api.getActiveCash();
        if (!cashRes?.session) {
          setIsOpenCounterModalOpen(true);
        }
      } catch (err) {
        console.warn('Active counter check failed:', err);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!setupData.name.trim()) {
      setError('Administrator name is required');
      return;
    }
    if (!setupData.username.trim()) {
      setError('Username is required');
      return;
    }
    if (setupData.password.length < 6) {
      setError('Master password must be at least 6 characters long');
      return;
    }
    if (setupData.password !== setupData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (setupData.pin && !/^\d{4,6}$/.test(setupData.pin)) {
      setError('Security PIN must be 4 to 6 numeric digits');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.setupAdmin({
        name: setupData.name.trim(),
        username: setupData.username.trim(),
        password: setupData.password,
        storeName: setupData.storeName.trim() || 'My POS Store',
        currency: setupData.currency.trim() || 'Rs.',
      });

      setStoredToken(res.token);
      setUser(res.user);

      await Promise.all([refreshCash(), refreshSettings(), refreshShortcuts()]);
      showToast(`Initial administrator setup complete. Welcome, ${res.user.name}!`);

      const cashRes = await api.getActiveCash();
      if (!cashRes?.session) {
        setIsOpenCounterModalOpen(true);
      }
    } catch (err: any) {
      setError(err.message || 'Initial setup failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSetup) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-stone-500">Initializing terminal...</span>
        </div>
      </div>
    );
  }

  // --- INITIAL SETUP SCREEN ---
  if (setupRequired) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-xl shadow-sm border border-stone-200 p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-xl bg-orange-500 flex items-center justify-center text-white mb-3 shadow-xs">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">First-Time System Setup</h1>
            <p className="text-xs text-stone-500 mt-1 max-w-sm">
              Create your primary administrator account and configure initial store details to secure your POS terminal.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSetup} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={setupData.name}
                  onChange={(e) => setSetupData({ ...setupData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Admin Username
                </label>
                <input
                  type="text"
                  required
                  value={setupData.username}
                  onChange={(e) => setSetupData({ ...setupData, username: e.target.value })}
                  placeholder="e.g. admin"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Store / Business Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-stone-400">
                    <Store className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={setupData.storeName}
                    onChange={(e) => setSetupData({ ...setupData, storeName: e.target.value })}
                    placeholder="e.g. Orderly Supermarket"
                    className="w-full pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Currency Symbol
                </label>
                <input
                  type="text"
                  required
                  value={setupData.currency}
                  onChange={(e) => setSetupData({ ...setupData, currency: e.target.value })}
                  placeholder="e.g. Rs. or $ or €"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-semibold text-stone-900 focus:bg-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Master Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={setupData.password}
                  onChange={(e) => setSetupData({ ...setupData, password: e.target.value })}
                  placeholder="At least 6 chars"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={setupData.confirmPassword}
                  onChange={(e) => setSetupData({ ...setupData, confirmPassword: e.target.value })}
                  placeholder="Re-enter password"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Cashier Fast Approval PIN (4-6 Digits)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-stone-400">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                <input
                  type="password"
                  maxLength={6}
                  value={setupData.pin}
                  onChange={(e) => setSetupData({ ...setupData, pin: e.target.value })}
                  placeholder="e.g. 1234 (Optional, defaults to 1234)"
                  className="w-full pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono text-stone-900 focus:bg-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <p className="text-[11px] text-stone-400 mt-1">
                Used for instant cashier supervisor approvals and shift actions without typing password.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg text-xs transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
            >
              {isLoading ? (
                <span>Configuring System...</span>
              ) : (
                <>
                  <span>Complete Setup & Launch POS</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- STANDARD AUTHENTICATED LOGIN SCREEN ---
  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-stone-200 p-8">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-orange-500 flex items-center justify-center text-white mb-4 shadow-sm">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">ORDERLY POS</h1>
          <p className="text-sm text-stone-500 mt-1">Professional Retail & POS Management</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Username or Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="login-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                placeholder="Enter username or staff name"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Password or 4-Digit PIN
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                placeholder="Enter password or login PIN"
              />
            </div>
          </div>

          <button
            id="login-submit-button"
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg text-sm transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Terminal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
