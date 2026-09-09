import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  SlidersHorizontal,
  DollarSign,
  Plus,
  Calendar,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { CashSession } from '../../types';
import { format12HourTime, format12HourDateTime } from '../../lib/dateUtils';

export const CashManagementView: React.FC = () => {
  const {
    activeCash,
    refreshCash,
    formatMoney,
    setIsOpenCounterModalOpen,
    setIsCloseCounterModalOpen,
    setIsCashAdjustmentModalOpen,
  } = useApp();

  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const sessList = await api.getCashSessions();
      setSessions(sessList);

      if (activeCash?.session) {
        const mv = await api.getCashMovements(activeCash.session.id);
        setMovements(mv);
      } else {
        setMovements([]);
      }
    } catch (err) {
      console.error('Failed to load cash management data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeCash?.session?.id]);

  const isCounterOpen = Boolean(activeCash?.session);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Cash Drawer & Counter Management</h2>
          <p className="text-xs text-stone-500 mt-0.5">Reconciliation ledger, cash movements, and cashier shift logs</p>
        </div>

        <div className="flex items-center gap-2">
          {isCounterOpen ? (
            <>
              <button
                type="button"
                onClick={() => setIsCashAdjustmentModalOpen(true)}
                className="px-3.5 py-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4 text-stone-500" />
                <span>Cash In / Out</span>
              </button>
              <button
                id="cash-view-close-counter"
                type="button"
                onClick={() => setIsCloseCounterModalOpen(true)}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Clock className="w-4 h-4" />
                <span>Close Counter & Reconcile</span>
              </button>
            </>
          ) : (
            <button
              id="cash-view-open-counter"
              type="button"
              onClick={() => setIsOpenCounterModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Wallet className="w-4 h-4" />
              <span>Open Cash Drawer / Start Shift</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Session Status & Breakdown Card */}
      <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isCounterOpen ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'
                }`}
              />
              <h3 className="text-base font-bold text-stone-900">
                {isCounterOpen ? 'Current Active Cash Session' : 'Cash Drawer is Closed'}
              </h3>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              {isCounterOpen
                ? `Opened by ${activeCash?.session?.userName || 'Cashier'} at ${format12HourTime(
                    activeCash?.session?.openedAt
                  )}`
                : 'Open the counter to record physical cash receipts and sales.'}
            </p>
          </div>

          <div className="text-left md:text-right">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
              Physical Cash in Drawer
            </span>
            <div className="text-3xl font-bold font-mono text-emerald-700 mt-0.5">
              {formatMoney(activeCash?.breakdown.currentCash || 0)}
            </div>
          </div>
        </div>

        {/* Detailed Ledger Math Breakdown */}
        {isCounterOpen && activeCash && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-6 text-xs">
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
              <span className="text-stone-500 block">Opening Vault Cash</span>
              <span className="font-mono font-bold text-stone-900 text-sm mt-1 block">
                {formatMoney(activeCash.breakdown.openingCash)}
              </span>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="text-emerald-700 block">+ Cash Sales Today</span>
              <span className="font-mono font-bold text-emerald-800 text-sm mt-1 block">
                +{formatMoney(activeCash.breakdown.cashSales)}
              </span>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="text-emerald-700 block">+ Credit Repayments</span>
              <span className="font-mono font-bold text-emerald-800 text-sm mt-1 block">
                +{formatMoney(activeCash.breakdown.cashCustomerPayments)}
              </span>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-red-700 block">- Cash Expenses Paid</span>
              <span className="font-mono font-bold text-red-800 text-sm mt-1 block">
                -{formatMoney(activeCash.breakdown.cashExpenses)}
              </span>
            </div>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
              <span className="text-stone-600 block">+/- Adjustments</span>
              <span className="font-mono font-bold text-stone-900 text-sm mt-1 block">
                {activeCash.breakdown.manualAdjustments >= 0 ? '+' : ''}
                {formatMoney(activeCash.breakdown.manualAdjustments)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Movements Table for Current Session */}
      {isCounterOpen && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
              Live Cash Movements (This Shift)
            </h4>
            <span className="text-xs text-stone-500 font-mono">{movements.length} logged events</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-200 text-stone-400 text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-4">Time</th>
                  <th className="py-2.5 px-4">Movement Type</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4 text-right">Cash In (+)</th>
                  <th className="py-2.5 px-4 text-right">Cash Out (-)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-stone-400">
                      No cash transactions registered in this session yet.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const isIn = m.amount > 0;
                    return (
                      <tr key={m.id} className="hover:bg-stone-50/70">
                        <td className="py-2.5 px-4 font-mono text-stone-500">
                          {format12HourTime(m.createdAt)}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-stone-900 uppercase text-[10px]">
                          {m.type.replace('_', ' ')}
                        </td>
                        <td className="py-2.5 px-4 text-stone-700">{m.description}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">
                          {isIn ? `+${formatMoney(m.amount)}` : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-red-600">
                          {!isIn ? `-${formatMoney(Math.abs(m.amount))}` : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historical Cash Sessions Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-stone-200 bg-stone-50">
          <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
            Historical Counter Shift Logs & Reconciliations
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-stone-200 text-stone-400 text-[10px] uppercase">
              <tr>
                <th className="py-3 px-4">Opened At</th>
                <th className="py-3 px-4">Closed At</th>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4 text-right">Opening Cash</th>
                <th className="py-3 px-4 text-right">Expected Cash</th>
                <th className="py-3 px-4 text-right">Actual Counted</th>
                <th className="py-3 px-4 text-right">Variance</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sessions.map((s) => {
                const isOver = (s.difference || 0) > 0;
                const isShort = (s.difference || 0) < 0;

                return (
                  <tr key={s.id} className="hover:bg-stone-50/70">
                    <td className="py-3 px-4 font-mono text-stone-600">
                      {format12HourDateTime(s.openedAt)}
                    </td>
                    <td className="py-3 px-4 font-mono text-stone-600">
                      {s.closedAt ? format12HourDateTime(s.closedAt) : '—'}
                    </td>
                    <td className="py-3 px-4 font-medium text-stone-900">{s.userName}</td>
                    <td className="py-3 px-4 text-right font-mono text-stone-600">
                      {formatMoney(s.openingCash)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-stone-600">
                      {s.expectedCash !== null ? formatMoney(s.expectedCash) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                      {s.actualCash !== null ? formatMoney(s.actualCash) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      {s.difference === null ? (
                        '—'
                      ) : s.difference === 0 ? (
                        <span className="text-emerald-600">0.00 (Balanced)</span>
                      ) : isOver ? (
                        <span className="text-blue-600">+{formatMoney(s.difference)} Over</span>
                      ) : (
                        <span className="text-red-600">{formatMoney(s.difference)} Short</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          s.status === 'open'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-stone-100 text-stone-700 border border-stone-200'
                        }`}
                      >
                        {s.status === 'open' ? 'Open' : 'Reconciled'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
