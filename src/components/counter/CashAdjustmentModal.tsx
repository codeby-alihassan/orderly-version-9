import React, { useState } from 'react';
import { X, ArrowDownRight, ArrowUpRight, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { useToast } from '../Toast';

export const CashAdjustmentModal: React.FC = () => {
  const { isCashAdjustmentModalOpen, setIsCashAdjustmentModalOpen, activeCash, refreshCash, settings } = useApp();
  const { showToast } = useToast();

  const [type, setType] = useState<'manual_in' | 'manual_out'>('manual_in');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isCashAdjustmentModalOpen || !activeCash?.session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      setError('Please enter a valid amount greater than zero');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a reason for the adjustment');
      return;
    }

    setIsLoading(true);
    try {
      await api.addCashAdjustment(activeCash.session.id, type, val, description);
      await refreshCash();
      showToast(`Recorded ${type === 'manual_in' ? 'Cash In' : 'Cash Out'} of ${settings.currency} ${val}`);
      setIsCashAdjustmentModalOpen(false);
      setAmount('');
      setDescription('');
    } catch (err: any) {
      setError(err.message || 'Failed to record adjustment');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div>
            <h3 className="text-base font-semibold text-stone-900">Manual Cash Drawer Adjustment</h3>
            <p className="text-xs text-stone-500 mt-0.5">Deposit or withdraw physical cash from active drawer</p>
          </div>
          <button
            onClick={() => setIsCashAdjustmentModalOpen(false)}
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('manual_in')}
              className={`py-2.5 px-3 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                type === 'manual_in'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                  : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <ArrowDownRight className="w-4 h-4 text-emerald-600" />
              <span>Cash In (Deposit)</span>
            </button>
            <button
              type="button"
              onClick={() => setType('manual_out')}
              className={`py-2.5 px-3 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                type === 'manual_out'
                  ? 'bg-red-50 border-red-500 text-red-800 ring-2 ring-red-500/20'
                  : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 text-red-600" />
              <span>Cash Out (Withdrawal)</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Adjustment Amount ({settings.currency})
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400 font-bold text-sm">
                {settings.currency}
              </div>
              <input
                id="adjustment-amount-input"
                type="number"
                step="any"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
                className="w-full pl-12 pr-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-base font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Reason / Description
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Added change from safe / Petty cash withdrawal"
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsCashAdjustmentModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors border border-stone-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Apply Cash Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
