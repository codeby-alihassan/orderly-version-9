import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { useToast } from '../Toast';

export const CloseCounterModal: React.FC = () => {
  const { isCloseCounterModalOpen, setIsCloseCounterModalOpen, activeCash, refreshCash, formatMoney } = useApp();
  const { showToast } = useToast();

  const [actualCash, setActualCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isCloseCounterModalOpen || !activeCash?.session) return null;

  const expectedCash = activeCash.breakdown.currentCash;
  const counted = parseFloat(actualCash);
  const diff = isNaN(counted) ? 0 : Number((counted - expectedCash).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isNaN(counted) || counted < 0) {
      setError('Please enter a valid actual cash count');
      return;
    }

    setIsLoading(true);
    try {
      await api.closeCounter(activeCash.session!.id, counted, closingNotes);
      await refreshCash();
      showToast('Counter closed successfully');
      setIsCloseCounterModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Failed to close counter');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-lg w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div>
            <h3 className="text-base font-semibold text-stone-900">Close Counter & Shift Reconciliation</h3>
            <p className="text-xs text-stone-500 mt-0.5">Verify physical drawer balance against system records</p>
          </div>
          <button
            onClick={() => setIsCloseCounterModalOpen(false)}
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-800">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Summary Breakdown Box */}
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between text-stone-600">
              <span>Opening Cash</span>
              <span className="font-mono font-medium text-stone-900">{formatMoney(activeCash.breakdown.openingCash)}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>+ Cash Sales</span>
              <span className="font-mono font-medium text-emerald-600">+{formatMoney(activeCash.breakdown.cashSales)}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>+ Cash Customer Payments (Credit Paid)</span>
              <span className="font-mono font-medium text-emerald-600">+{formatMoney(activeCash.breakdown.cashCustomerPayments)}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>- Cash Expenses Paid</span>
              <span className="font-mono font-medium text-red-600">-{formatMoney(activeCash.breakdown.cashExpenses)}</span>
            </div>
            {activeCash.breakdown.manualAdjustments !== 0 && (
              <div className="flex justify-between text-stone-600">
                <span>+/- Manual Cash Adjustments</span>
                <span className="font-mono font-medium text-stone-900">
                  {activeCash.breakdown.manualAdjustments > 0 ? '+' : ''}
                  {formatMoney(activeCash.breakdown.manualAdjustments)}
                </span>
              </div>
            )}
            <div className="pt-2 border-t border-stone-200 flex justify-between font-semibold text-stone-900 text-base">
              <span>Expected Cash in Drawer</span>
              <span className="font-mono text-orange-600">{formatMoney(expectedCash)}</span>
            </div>
          </div>

          {/* Actual Cash Entry */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Actual Physical Cash Counted
            </label>
            <input
              id="actual-cash-input"
              type="number"
              step="any"
              min="0"
              required
              value={actualCash}
              onChange={(e) => setActualCash(e.target.value)}
              placeholder={`Enter counted cash e.g. ${expectedCash}`}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-base font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          {/* Real-time Variance Display */}
          {actualCash.trim() !== '' && !isNaN(counted) && (
            <div
              className={`p-3.5 rounded-lg border flex items-center justify-between text-sm ${
                diff === 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : diff > 0
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {diff === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : diff > 0 ? (
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
                <span className="font-medium">
                  {diff === 0 ? 'Drawer Balanced Perfectly' : diff > 0 ? 'Cash Surplus (Over)' : 'Cash Shortage (Short)'}
                </span>
              </div>
              <span className="font-mono font-bold text-base">
                {diff > 0 ? `+${formatMoney(diff)}` : formatMoney(diff)}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Closing Remarks / Discrepancy Explanation (Optional)
            </label>
            <textarea
              rows={2}
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder="e.g. Verified by manager; Rs. 50 shortage due to coin roundoff"
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsCloseCounterModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors border border-stone-200"
            >
              Cancel
            </button>
            <button
              id="confirm-close-counter-button"
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Closing...' : 'Close & Finalize Counter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
