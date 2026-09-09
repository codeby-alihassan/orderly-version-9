import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Plus,
  ArrowDownRight,
  Sliders,
  DollarSign,
  Phone,
  MapPin,
  X,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Banknote,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Customer, CustomerDetail, CustomerLedgerItem } from '../../types';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Toast';

export const CreditCustomersView: React.FC = () => {
  const { formatMoney, activeCash, refreshCash, settings } = useApp();
  const { showToast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Selected customer for Ledger drawer/modal
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  // Add Customer modal
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
    openingBalance: '0',
  });

  // Receive Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('Credit payment received');

  // Adjust Credit modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'add_debt' | 'reduce_debt'>('reduce_debt');
  const [adjustNotes, setAdjustNotes] = useState('');

  // Delete customer modal
  const [customerToDelete, setCustomerToDelete] = useState<Customer | CustomerDetail | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getCustomers(searchQuery);
      setCustomers(data);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleRequestDelete = (c: Customer | CustomerDetail) => {
    if (c.currentBalance > 0.001) {
      showToast(`Cannot delete customer "${c.name}". Active outstanding credit of ${formatMoney(c.currentBalance)} must be settled first.`, 'error');
      return;
    }
    setCustomerToDelete(c);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteCustomer(customerToDelete.id);
      showToast(`Customer "${customerToDelete.name}" deleted successfully.`);
      if (selectedCustomer?.id === customerToDelete.id) {
        setSelectedCustomer(null);
      }
      setCustomerToDelete(null);
      await loadCustomers();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete customer', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Open customer ledger
  const openCustomerLedger = async (cust: Customer) => {
    setIsLoadingLedger(true);
    try {
      const detail = await api.getCustomer(cust.id);
      setSelectedCustomer(detail);
    } catch (err: any) {
      showToast(err.message || 'Error loading customer ledger', 'error');
    } finally {
      setIsLoadingLedger(false);
    }
  };

  // Add customer
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerData.name.trim() || !newCustomerData.phone.trim()) {
      showToast('Name and phone are required', 'error');
      return;
    }

    try {
      await api.createCustomer({
        name: newCustomerData.name.trim(),
        phone: newCustomerData.phone.trim(),
        address: newCustomerData.address.trim() || null,
        notes: newCustomerData.notes.trim() || null,
        openingBalance: parseFloat(newCustomerData.openingBalance) || 0,
      });

      showToast(`Customer "${newCustomerData.name}" created`);
      setShowAddCustomerModal(false);
      setNewCustomerData({
        name: '',
        phone: '',
        address: '',
        notes: '',
        openingBalance: '0',
      });
      await loadCustomers();
    } catch (err: any) {
      showToast(err.message || 'Error creating customer', 'error');
    }
  };

  // Receive Payment
  const handleReceivePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid positive payment amount', 'error');
      return;
    }

    try {
      const res = await api.recordCustomerPayment({
        customerId: selectedCustomer.id,
        amount: amt,
        paymentMethod,
        cashSessionId: paymentMethod === 'cash' ? activeCash?.session?.id || null : null,
        description: paymentNotes.trim() || `Payment received via ${paymentMethod.toUpperCase()}`,
      });

      showToast(`Received ${formatMoney(amt)} from ${selectedCustomer.name}`);
      setShowPaymentModal(false);
      setPaymentAmount('');

      // Refresh ledger & cash drawer
      await Promise.all([openCustomerLedger(selectedCustomer), refreshCash(), loadCustomers()]);
    } catch (err: any) {
      showToast(err.message || 'Failed to record payment', 'error');
    }
  };

  // Adjust Credit
  const handleAdjustCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      await api.adjustCustomerCredit({
        customerId: selectedCustomer.id,
        amount: amt,
        type: adjustType,
        description: adjustNotes.trim() || 'Manual balance adjustment',
      });

      showToast('Customer credit adjusted successfully');
      setShowAdjustModal(false);
      setAdjustAmount('');
      setAdjustNotes('');

      await Promise.all([openCustomerLedger(selectedCustomer), loadCustomers()]);
    } catch (err: any) {
      showToast(err.message || 'Adjustment failed', 'error');
    }
  };

  const totalOutstandingCredit = customers.reduce((sum, c) => sum + Math.max(0, c.currentBalance), 0);
  const activeDebtorsCount = customers.filter((c) => c.currentBalance > 0).length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Credit Ledger & Customers</h2>
          <p className="text-xs text-stone-500 mt-0.5">Track customer debt, chronological debit/credit ledgers, and cash repayments</p>
        </div>

        <button
          id="add-customer-btn"
          type="button"
          onClick={() => setShowAddCustomerModal(true)}
          className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Customer</span>
        </button>
      </div>

      {/* Credit Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-stone-500">Total Outstanding Credit</span>
          <div className="mt-1 text-2xl font-bold font-mono text-purple-700">
            {formatMoney(totalOutstandingCredit)}
          </div>
          <span className="text-[11px] text-stone-400 font-medium">To be collected across all customers</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-stone-500">Active Debtors</span>
          <div className="mt-1 text-2xl font-bold font-mono text-stone-900">
            {activeDebtorsCount} <span className="text-xs font-normal text-stone-500">accounts</span>
          </div>
          <span className="text-[11px] text-stone-400 font-medium">
            Out of {customers.length} registered customers
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-stone-500">Average Outstanding Debt</span>
          <div className="mt-1 text-2xl font-bold font-mono text-stone-900">
            {formatMoney(activeDebtorsCount > 0 ? totalOutstandingCredit / activeDebtorsCount : 0)}
          </div>
          <span className="text-[11px] text-stone-400 font-medium">Per active credit customer</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customers by name, phone number, address..."
            className="w-full pl-9 pr-3.5 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Customer Name</th>
                <th className="py-3 px-4 font-semibold">Phone</th>
                <th className="py-3 px-4 font-semibold">Address</th>
                <th className="py-3 px-4 font-semibold text-right">Outstanding Due</th>
                <th className="py-3 px-4 font-semibold">Last Transaction</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    No customers registered yet. Click "Register New Customer" to start.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-stone-900">{c.name}</td>
                    <td className="py-3 px-4 font-mono text-stone-600">{c.phone}</td>
                    <td className="py-3 px-4 text-stone-500 truncate max-w-xs">{c.address || '—'}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-sm">
                      <span className={c.currentBalance > 0 ? 'text-purple-700' : 'text-emerald-700'}>
                        {formatMoney(c.currentBalance)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-400 text-[11px]">
                      {c.lastTransactionDate ? (
                        <div>
                          <span>{new Date(c.lastTransactionDate).toLocaleDateString()}</span>
                          <span className="block text-[10px] truncate max-w-[150px]">{c.lastTransactionDesc}</span>
                        </div>
                      ) : (
                        'No transactions'
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openCustomerLedger(c)}
                          className="px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-xs font-semibold border border-orange-200 transition-colors inline-flex items-center gap-1 shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5 text-orange-600" />
                          <span>View Ledger</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestDelete(c)}
                          title={c.currentBalance > 0 ? "Cannot delete customer with active credit balance" : "Delete customer"}
                          className="p-1.5 rounded-lg border border-stone-200 text-stone-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CUSTOMER DETAILS & LEDGER MODAL */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-stone-200 max-w-3xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="text-base font-bold text-stone-900">{selectedCustomer.name}</h3>
                <div className="flex items-center gap-3 text-xs text-stone-500 mt-0.5">
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3.5 h-3.5 text-stone-400" />
                    {selectedCustomer.phone}
                  </span>
                  {selectedCustomer.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-stone-400" />
                      {selectedCustomer.address}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-stone-500 uppercase font-semibold block">Outstanding Due</span>
                  <span className="text-lg font-bold font-mono text-purple-700">
                    {formatMoney(selectedCustomer.currentBalance)}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="px-6 py-3 bg-stone-100/70 border-b border-stone-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-700">Chronological Ledger Records</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRequestDelete(selectedCustomer)}
                  className="px-3 py-1.5 bg-white hover:bg-red-50 text-stone-600 hover:text-red-700 rounded-lg text-xs font-medium border border-stone-200 hover:border-red-200 flex items-center gap-1 shadow-2xs transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(true)}
                  className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-700 rounded-lg text-xs font-medium border border-stone-200 flex items-center gap-1 shadow-2xs"
                >
                  <Sliders className="w-3.5 h-3.5 text-stone-500" />
                  <span>Adjust Balance</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentAmount(String(Math.max(0, selectedCustomer.currentBalance)));
                    setShowPaymentModal(true);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Receive Payment</span>
                </button>
              </div>
            </div>

            {/* Ledger Table */}
            <div className="p-6 overflow-y-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Date & Time</th>
                    <th className="py-2.5 px-3 font-semibold">Transaction Description</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Type</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Debit (+)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Credit / Paid (-)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {selectedCustomer.ledger.map((row) => {
                    const isDebit = row.type === 'credit_sale' || row.type === 'adjustment_add';
                    const isCredit = row.type === 'payment' || row.type === 'adjustment_sub';

                    return (
                      <tr key={row.id} className="hover:bg-stone-50/70">
                        <td className="py-2.5 px-3 font-mono text-stone-500">
                          {new Date(row.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 text-stone-900">
                          <div className="font-medium">{row.description}</div>
                          {row.paymentMethod && (
                            <span className="text-[10px] text-stone-400 uppercase font-mono">
                              via {row.paymentMethod}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isDebit ? 'bg-purple-50 text-purple-700' : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {isDebit ? 'Credit Added' : 'Payment Received'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-purple-700">
                          {isDebit ? `+${formatMoney(row.amount)}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-emerald-600">
                          {isCredit ? `-${formatMoney(row.amount)}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-900">
                          {formatMoney(row.balanceAfter)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE PAYMENT MODAL */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-stone-900">Receive Customer Payment</h3>
            <p className="text-xs text-stone-500">
              Collect repayment from <span className="font-semibold text-stone-900">{selectedCustomer.name}</span>
            </p>

            <form onSubmit={handleReceivePayment} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Payment Amount ({settings.currency}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="5000"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-base font-mono font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Payment Destination
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span>Cash (Physical Drawer)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'bank'
                        ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20'
                        : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span>Bank Transfer</span>
                  </button>
                </div>
                <p className="text-[11px] text-stone-400 mt-1">
                  {paymentMethod === 'cash'
                    ? 'Cash payments automatically increment your active cash counter session.'
                    : 'Bank payments directly credit bank accounts without altering physical drawer cash.'}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Remarks / Receipt Note
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Cleared pending bill from yesterday"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-3.5 py-1.5 border border-stone-200 rounded-lg text-xs font-medium text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST CREDIT MODAL */}
      {showAdjustModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-stone-900">Adjust Credit Ledger Balance</h3>

            <form onSubmit={handleAdjustCredit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustType('reduce_debt')}
                  className={`py-2 px-2 rounded-lg border text-xs font-semibold ${
                    adjustType === 'reduce_debt'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                      : 'bg-stone-50 border-stone-200 text-stone-600'
                  }`}
                >
                  Reduce Debt (-)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('add_debt')}
                  className={`py-2 px-2 rounded-lg border text-xs font-semibold ${
                    adjustType === 'add_debt'
                      ? 'bg-purple-50 border-purple-500 text-purple-800'
                      : 'bg-stone-50 border-stone-200 text-stone-600'
                  }`}
                >
                  Add Debt (+)
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="500"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono font-bold focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">Reason</label>
                <input
                  type="text"
                  required
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. Goodwill discount or ledger correction"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-3 py-1.5 border border-stone-200 rounded-lg text-xs text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER CUSTOMER MODAL */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">Register New Customer</h3>
              <button
                onClick={() => setShowAddCustomerModal(false)}
                className="p-1 rounded text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCustomerData.name}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                  placeholder="e.g. Tariq Mahmood"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Phone Number *
                </label>
                <input
                  type="text"
                  required
                  value={newCustomerData.phone}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                  placeholder="0300-1234567"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={newCustomerData.address}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, address: e.target.value })}
                  placeholder="House 42, Sector G-10"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Opening Credit Balance ({settings.currency})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={newCustomerData.openingBalance}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, openingBalance: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-medium focus:bg-white focus:outline-none"
                />
                <p className="text-[11px] text-stone-400 mt-0.5">Existing debt migrated from previous manual register.</p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 border border-stone-200 rounded-lg text-xs font-medium text-stone-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CUSTOMER CONFIRMATION MODAL */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Delete Customer Profile</h3>
                <p className="text-xs text-stone-600 mt-1">
                  Are you sure you want to permanently delete customer <strong className="text-stone-900 font-semibold">{customerToDelete.name}</strong> ({customerToDelete.phone})?
                </p>
              </div>
            </div>

            {customerToDelete.currentBalance > 0.001 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Active Balance Detected:</span>
                  <span>
                    This customer has an active outstanding credit/balance of <strong>{formatMoney(customerToDelete.currentBalance)}</strong>. Customers with an active balance cannot be deleted until the balance is fully settled.
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-stone-500 bg-stone-50 p-3 rounded-lg border border-stone-200 leading-relaxed">
                Validation check passed: This customer has zero outstanding balance. All previous invoices and payment records remain intact in sales reports with detached customer reference.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setCustomerToDelete(null)}
                className="px-4 py-2 border border-stone-200 text-stone-700 rounded-lg text-xs font-medium hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              {customerToDelete.currentBalance <= 0.001 && (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeleting ? 'Deleting...' : 'Confirm Delete'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
