import React, { useState } from 'react';
import { X, DollarSign, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { useToast } from '../Toast';

export const OpenCounterModal: React.FC = () => {
  const { isOpenCounterModalOpen, setIsOpenCounterModalOpen, refreshCash, settings } = useApp();
  const { showToast } = useToast();

  const [openingCash, setOpeningCash] = useState('20000');
  const [notes, setNotes] = useState('Morning shift opening vault cash');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpenCounterModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = parseFloat(openingCash);
    if (isNaN(val) || val < 0) {
      setError('Please enter a valid positive opening cash amount');
      return;
    }

    setIsLoading(true);
    try {
      await api.openCounter(val, notes);
      await refreshCash();
      showToast(`Counter opened with ${settings.currency} ${val.toLocaleString()}`);
      setIsOpenCounterModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Failed to open counter');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div>
            <h3 className="text-base font-semibold text-stone-900">Open Counter / Cash Session</h3>
            <p className="text-xs text-stone-500 mt-0.5">Start daily cashier session and declare vault cash</p>
          </div>
          <button
            onClick={() => setIsOpenCounterModalOpen(false)}
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
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Opening Cash / Vault Cash ({settings.currency})
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400 font-bold text-sm">
                {settings.currency}
              </div>
              <input
                id="opening-cash-input"
                type="number"
                step="any"
                min="0"
                required
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="20000"
                className="w-full pl-12 pr-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-base font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Physical cash available in the cash drawer at the start of business.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Shift Notes / Remarks (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Counter 1 - Morning Shift"
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsOpenCounterModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors border border-stone-200"
            >
              Cancel
            </button>
            <button
              id="confirm-open-counter-button"
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Opening...' : 'Open Cash Drawer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
