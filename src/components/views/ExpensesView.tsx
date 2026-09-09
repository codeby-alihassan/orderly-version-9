import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Calendar,
  Trash2,
  AlertCircle,
  X,
  Banknote,
  CreditCard,
  DollarSign,
} from 'lucide-react';
import { Expense } from '../../types';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Toast';

export const ExpensesView: React.FC = () => {
  const { formatMoney, activeCash, refreshCash, settings } = useApp();
  const { showToast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // New expense modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'Utilities & Bills',
    paymentMethod: 'cash',
    expenseDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const categories = [
    'Utilities & Bills',
    'Salaries & Wages',
    'Shop Supplies & Bags',
    'Tea & Refreshments',
    'Rent & Maintenance',
    'Transportation & Freight',
    'Marketing',
    'Miscellaneous',
  ];

  const loadExpenses = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getExpenses({
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setExpenses(data);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, startDate, endDate]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid expense amount', 'error');
      return;
    }

    try {
      await api.createExpense({
        title: formData.title.trim(),
        amount: amt,
        category: formData.category,
        paymentMethod: formData.paymentMethod,
        cashSessionId: formData.paymentMethod === 'cash' ? activeCash?.session?.id || null : null,
        expenseDate: formData.expenseDate,
        notes: formData.notes.trim() || null,
      });

      showToast(`Expense "${formData.title}" logged`);
      setShowAddModal(false);
      setFormData({
        title: '',
        amount: '',
        category: 'Utilities & Bills',
        paymentMethod: 'cash',
        expenseDate: new Date().toISOString().slice(0, 10),
        notes: '',
      });

      await Promise.all([loadExpenses(), refreshCash()]);
    } catch (err: any) {
      showToast(err.message || 'Error recording expense', 'error');
    }
  };

  const handleDeleteExpense = async (exp: Expense) => {
    if (window.confirm(`Delete expense "${exp.title}" of ${formatMoney(exp.amount)}?`)) {
      try {
        await api.deleteExpense(exp.id);
        showToast('Expense removed');
        await Promise.all([loadExpenses(), refreshCash()]);
      } catch (err: any) {
        showToast(err.message || 'Failed to delete expense', 'error');
      }
    }
  };

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalCashExpenses = expenses.filter((e) => e.paymentMethod === 'cash').reduce((sum, e) => sum + e.amount, 0);
  const totalBankExpenses = expenses.filter((e) => e.paymentMethod === 'bank').reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Operating Expenses</h2>
          <p className="text-xs text-stone-500 mt-0.5">Record daily shop overhead, utilities, staff wages, and supplies</p>
        </div>

        <button
          id="add-expense-btn"
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Record New Expense</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-stone-500">Total Period Expenses</span>
          <div className="mt-1 text-2xl font-bold font-mono text-red-600">
            {formatMoney(totalExpenseAmount)}
          </div>
          <span className="text-[11px] text-stone-400 font-medium">Across all payment channels</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-stone-500">Paid from Drawer Cash</span>
          <div className="mt-1 text-2xl font-bold font-mono text-stone-900">
            {formatMoney(totalCashExpenses)}
          </div>
          <span className="text-[11px] text-stone-400 font-medium">Deducted from active counter sessions</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-stone-500">Paid via Bank Transfer</span>
          <div className="mt-1 text-2xl font-bold font-mono text-stone-900">
            {formatMoney(totalBankExpenses)}
          </div>
          <span className="text-[11px] text-stone-400 font-medium">Direct shop bank transfers</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium focus:outline-none"
          >
            <option value="all">All Expense Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-stone-400 text-[11px]">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-stone-400 text-[11px]">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded text-xs"
            />
          </div>
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="text-[11px] text-stone-500 hover:text-stone-800 underline ml-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Expense Title</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Channel</th>
                <th className="py-3 px-4 font-semibold">Remarks / Notes</th>
                <th className="py-3 px-4 font-semibold text-right">Amount</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    No operating expenses recorded for this selection.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-stone-600">{exp.expenseDate}</td>
                    <td className="py-3 px-4 font-semibold text-stone-900">{exp.title}</td>
                    <td className="py-3 px-4 text-stone-600">
                      <span className="px-2 py-0.5 rounded bg-stone-100 border border-stone-200 text-[11px]">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="uppercase text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-100 border border-stone-200 text-stone-700">
                        {exp.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-500 truncate max-w-xs">{exp.notes || '—'}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-red-600">
                      {formatMoney(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(exp)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete Expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD EXPENSE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">Record Operating Expense</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Expense Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Electric bill / Staff lunch / Packaging boxes"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Amount ({settings.currency}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="1500"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.expenseDate}
                    onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Payment Source
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, paymentMethod: 'cash' })}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                      formData.paymentMethod === 'cash'
                        ? 'bg-red-50 border-red-500 text-red-800 ring-2 ring-red-500/20'
                        : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-red-600" />
                    <span>Drawer Cash (Out)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, paymentMethod: 'bank' })}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                      formData.paymentMethod === 'bank'
                        ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20'
                        : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span>Bank Transfer</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Notes / Bill # (Optional)
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Receipt number or details"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-stone-200 rounded-lg text-xs font-medium text-stone-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
