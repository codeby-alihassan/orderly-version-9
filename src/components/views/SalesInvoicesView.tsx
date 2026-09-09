import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Search,
  Calendar,
  X,
  Eye,
  Ban,
  Printer,
  CheckCircle2,
  AlertCircle,
  Filter,
  Download,
  FileSpreadsheet,
  Layers,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SaleSummary, SaleDetail } from '../../types';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Toast';
import { ReceiptModal } from '../pos/ReceiptModal';
import { format12HourTime, format12HourDateTime } from '../../lib/dateUtils';

export const SalesInvoicesView: React.FC = () => {
  const { formatMoney, refreshCash, settings } = useApp();
  const { showToast } = useToast();

  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7d' | 'month' | 'range'>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Selected sale for receipt viewing
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<SaleDetail | null>(null);

  // Void/Cancel sale dialog
  const [cancellingSale, setCancellingSale] = useState<SaleSummary | null>(null);
  const [cancelReason, setCancelReason] = useState('Customer returned items');

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportPreset, setExportPreset] = useState<'current' | 'today' | 'yesterday' | '7d' | 'month' | 'custom' | 'all'>('current');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportPayment, setExportPayment] = useState('all');
  const [exportStatus, setExportStatus] = useState('all');
  const [isExporting, setIsExporting] = useState(false);

  const getEffectiveDatesForFilter = (filterType: string, customStart?: string, customEnd?: string) => {
    const now = new Date();
    let sDate = customStart || '';
    let eDate = customEnd || '';

    if (filterType === 'today') {
      sDate = now.toISOString().slice(0, 10);
      eDate = sDate;
    } else if (filterType === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      sDate = y.toISOString().slice(0, 10);
      eDate = sDate;
    } else if (filterType === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      sDate = d.toISOString().slice(0, 10);
      eDate = now.toISOString().slice(0, 10);
    } else if (filterType === 'month') {
      sDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      eDate = now.toISOString().slice(0, 10);
    } else if (filterType === 'all') {
      sDate = '';
      eDate = '';
    }

    return { sDate, eDate };
  };

  const loadSales = useCallback(async () => {
    setIsLoading(true);
    try {
      const { sDate, eDate } = getEffectiveDatesForFilter(dateFilter, startDate, endDate);

      const res = await api.getSales({
        search: searchQuery,
        startDate: sDate || undefined,
        endDate: eDate || undefined,
        paymentMethod: paymentMethod === 'all' ? undefined : paymentMethod,
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 500,
      });

      setSales(res);
    } catch (err) {
      console.error('Failed to load sales invoices:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, paymentMethod, statusFilter, dateFilter, startDate, endDate]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  // Open export modal with current dates pre-populated
  const handleOpenExportModal = () => {
    const { sDate, eDate } = getEffectiveDatesForFilter(dateFilter, startDate, endDate);
    setExportPreset(dateFilter === 'range' ? 'custom' : (dateFilter as any));
    setExportStartDate(sDate);
    setExportEndDate(eDate);
    setExportPayment(paymentMethod);
    setExportStatus(statusFilter);
    setIsExportModalOpen(true);
  };

  // Execute export to Excel or CSV
  const handleExportData = async (format: 'xlsx' | 'csv', fromModal: boolean = false) => {
    setIsExporting(true);
    try {
      let reqStart = '';
      let reqEnd = '';
      let reqPayment: string | undefined = undefined;
      let reqStatus: string | undefined = undefined;
      let reqSearch: string | undefined = undefined;

      if (fromModal) {
        if (exportPreset === 'current') {
          const eff = getEffectiveDatesForFilter(dateFilter, startDate, endDate);
          reqStart = eff.sDate;
          reqEnd = eff.eDate;
          reqPayment = paymentMethod === 'all' ? undefined : paymentMethod;
          reqStatus = statusFilter === 'all' ? undefined : statusFilter;
          reqSearch = searchQuery || undefined;
        } else if (exportPreset === 'custom') {
          reqStart = exportStartDate;
          reqEnd = exportEndDate;
          reqPayment = exportPayment === 'all' ? undefined : exportPayment;
          reqStatus = exportStatus === 'all' ? undefined : exportStatus;
        } else {
          const eff = getEffectiveDatesForFilter(exportPreset);
          reqStart = eff.sDate;
          reqEnd = eff.eDate;
          reqPayment = exportPayment === 'all' ? undefined : exportPayment;
          reqStatus = exportStatus === 'all' ? undefined : exportStatus;
        }
      } else {
        // Quick export from current active filter
        const eff = getEffectiveDatesForFilter(dateFilter, startDate, endDate);
        reqStart = eff.sDate;
        reqEnd = eff.eDate;
        reqPayment = paymentMethod === 'all' ? undefined : paymentMethod;
        reqStatus = statusFilter === 'all' ? undefined : statusFilter;
        reqSearch = searchQuery || undefined;
      }

      // Fetch all matching records for the report
      const reportSales = await api.getSales({
        startDate: reqStart || undefined,
        endDate: reqEnd || undefined,
        paymentMethod: reqPayment,
        status: reqStatus,
        search: reqSearch,
        limit: 10000,
      });

      if (!reportSales || reportSales.length === 0) {
        showToast('No sales records match the selected date range and filters.', 'error');
        setIsExporting(false);
        return;
      }

      // 1. Format transaction rows
      const rows = reportSales.map((s, index) => {
        const d = new Date(s.createdAt);
        return {
          '#': index + 1,
          'Invoice Number': s.invoiceNumber,
          'Date': d.toLocaleDateString(),
          'Time': format12HourTime(d),
          'Customer': s.customerName || 'Walk-in Customer',
          'Cashier / Staff': s.cashierName || 'Staff',
          'Payment Method': (s.paymentMethod || 'cash').toUpperCase(),
          'Status': (s.paymentStatus || 'completed').toUpperCase(),
          'Subtotal': Number(s.subtotal || 0),
          'Tax': Number(s.tax || 0),
          'Discount': Number(s.discount || 0),
          'Grand Total': Number(s.grandTotal || 0),
          'Estimated Margin': Number(s.profit || 0),
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);

      // Set optimal column widths
      ws['!cols'] = [
        { wch: 5 },  // #
        { wch: 18 }, // Invoice Number
        { wch: 13 }, // Date
        { wch: 10 }, // Time
        { wch: 22 }, // Customer
        { wch: 16 }, // Cashier
        { wch: 16 }, // Payment Method
        { wch: 14 }, // Status
        { wch: 12 }, // Subtotal
        { wch: 10 }, // Tax
        { wch: 10 }, // Discount
        { wch: 14 }, // Grand Total
        { wch: 16 }, // Margin
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Sales Invoices');

      // 2. Add Summary Report Sheet
      const validTransactions = reportSales.filter((s) => s.paymentStatus !== 'cancelled');
      const totalRevenue = validTransactions.reduce((acc, s) => acc + s.grandTotal, 0);
      const totalMargin = validTransactions.reduce((acc, s) => acc + s.profit, 0);
      const cashTotal = validTransactions.filter((s) => s.paymentMethod === 'cash').reduce((acc, s) => acc + s.grandTotal, 0);
      const bankTotal = validTransactions.filter((s) => s.paymentMethod === 'bank').reduce((acc, s) => acc + s.grandTotal, 0);
      const creditTotal = validTransactions.filter((s) => s.paymentMethod === 'credit').reduce((acc, s) => acc + s.grandTotal, 0);
      const voidCount = reportSales.filter((s) => s.paymentStatus === 'cancelled').length;

      const summaryData = [
        { 'Report Metric': 'Store Name', 'Report Value': settings?.shop_name || 'Orderly Supermarket' },
        { 'Report Metric': 'Generated On', 'Report Value': format12HourDateTime(new Date()) },
        { 'Report Metric': 'Report Date Range', 'Report Value': `${reqStart || 'Beginning'} to ${reqEnd || 'Present'}` },
        { 'Report Metric': 'Total Invoices Logged', 'Report Value': reportSales.length },
        { 'Report Metric': 'Completed Transactions', 'Report Value': validTransactions.length },
        { 'Report Metric': 'Void / Cancelled Transactions', 'Report Value': voidCount },
        { 'Report Metric': 'Total Invoiced Revenue', 'Report Value': totalRevenue },
        { 'Report Metric': 'Total Net Profit Margin', 'Report Value': totalMargin },
        { 'Report Metric': 'Cash Receipts Total', 'Report Value': cashTotal },
        { 'Report Metric': 'Bank / Card Receipts Total', 'Report Value': bankTotal },
        { 'Report Metric': 'Credit Extended Total', 'Report Value': creditTotal },
      ];

      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      summaryWs['!cols'] = [{ wch: 30 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Executive Summary');

      const dateTag = reqStart && reqEnd ? `${reqStart}_to_${reqEnd}` : new Date().toISOString().slice(0, 10);
      const fileName = `sales_report_${dateTag}.${format}`;

      if (format === 'csv') {
        XLSX.writeFile(wb, fileName, { bookType: 'csv' });
      } else {
        XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
      }

      showToast(`Exported ${reportSales.length} sales records to ${fileName}!`);
      if (fromModal) {
        setIsExportModalOpen(false);
      }
    } catch (err: any) {
      console.error('Export failed:', err);
      showToast(err.message || 'Failed to export sales report', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Open invoice detail
  const handleViewInvoice = async (sale: SaleSummary) => {
    try {
      const detail = await api.getSale(sale.id);
      setSelectedSaleDetail(detail);
    } catch (err: any) {
      showToast(err.message || 'Failed to load sale details', 'error');
    }
  };

  // Void Sale
  const handleConfirmCancelSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingSale) return;

    try {
      await api.cancelSale(cancellingSale.id, cancelReason);
      showToast(`Sale ${cancellingSale.invoiceNumber} has been cancelled & stock restored`);
      setCancellingSale(null);
      await Promise.all([loadSales(), refreshCash()]);
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel sale', 'error');
    }
  };

  const totalInvoiced = sales.reduce((sum, s) => (s.paymentStatus !== 'cancelled' ? sum + s.grandTotal : sum), 0);
  const totalProfitInvoiced = sales.reduce(
    (sum, s) => (s.paymentStatus !== 'cancelled' ? sum + s.profit : sum),
    0
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Sales Invoices & Transactions</h2>
          <p className="text-xs text-stone-500 mt-0.5">Audit customer checkout receipts, profit margins, and void transaction history</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] text-stone-500 uppercase font-semibold block">Total Period Volume</span>
            <span className="text-lg font-bold font-mono text-stone-900">{formatMoney(totalInvoiced)}</span>
          </div>
          <div className="h-8 w-px bg-stone-200" />
          <div className="text-right">
            <span className="text-[10px] text-emerald-600 uppercase font-semibold block">Total Margin</span>
            <span className="text-lg font-bold font-mono text-emerald-600">+{formatMoney(totalProfitInvoiced)}</span>
          </div>
          <div className="h-8 w-px bg-stone-200 hidden sm:block" />
          <button
            type="button"
            onClick={handleOpenExportModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Export sales reports by custom date ranges or formats"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Date Filter & Search Controls */}
      <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                dateFilter === 'today'
                  ? 'bg-stone-900 text-white font-semibold'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('yesterday')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                dateFilter === 'yesterday'
                  ? 'bg-stone-900 text-white font-semibold'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('7d')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                dateFilter === '7d'
                  ? 'bg-stone-900 text-white font-semibold'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('month')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                dateFilter === 'month'
                  ? 'bg-stone-900 text-white font-semibold'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('range')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                dateFilter === 'range'
                  ? 'bg-stone-900 text-white font-semibold'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Custom Date Range
            </button>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => handleExportData('xlsx', false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              title="Quick download Excel spreadsheet for current view"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={() => handleExportData('csv', false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              title="Quick download CSV spreadsheet for current view"
            >
              <Download className="w-3.5 h-3.5 text-stone-600" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {dateFilter === 'range' && (
          <div className="flex items-center gap-3 pt-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded text-xs"
              />
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-3 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by invoice # (e.g. INV-2026-0001) or customer name..."
              className="w-full pl-9 pr-3.5 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-stone-700 focus:outline-none"
            >
              <option value="all">All Payment Methods</option>
              <option value="cash">Cash Only</option>
              <option value="bank">Bank Transfer</option>
              <option value="credit">Credit</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-stone-700 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="credit">Credit / Pending</option>
              <option value="cancelled">Cancelled / Void</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Invoice #</th>
                <th className="py-3 px-4 font-semibold">Date & Time</th>
                <th className="py-3 px-4 font-semibold">Customer</th>
                <th className="py-3 px-4 font-semibold">Cashier</th>
                <th className="py-3 px-4 font-semibold">Method</th>
                <th className="py-3 px-4 font-semibold text-right">Subtotal</th>
                <th className="py-3 px-4 font-semibold text-right">Discount</th>
                <th className="py-3 px-4 font-semibold text-right">Tax</th>
                <th className="py-3 px-4 font-semibold text-right">Grand Total</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-stone-400">
                    Loading sales records...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-stone-400">
                    No sales invoices found for selected criteria.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => {
                  const isCancelled = sale.paymentStatus === 'cancelled';

                  return (
                    <tr
                      key={sale.id}
                      className={`hover:bg-stone-50/70 transition-colors ${
                        isCancelled ? 'opacity-50 bg-stone-50/50 line-through-none' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-stone-900">
                        {sale.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 text-stone-600">
                        <div>{new Date(sale.createdAt).toLocaleDateString()}</div>
                        <div className="text-[10px] text-stone-400">
                          {format12HourTime(sale.createdAt)}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-stone-900">
                        {sale.customerName || <span className="text-stone-400 font-normal">Walk-in</span>}
                      </td>
                      <td className="py-3 px-4 text-stone-600">{sale.cashierName}</td>
                      <td className="py-3 px-4">
                        <span className="uppercase text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-100 border border-stone-200 text-stone-700">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-stone-600">
                        {formatMoney(sale.subtotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-red-600">
                        {sale.discount > 0 ? `-${formatMoney(sale.discount)}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-stone-600">
                        {sale.tax > 0 ? `+${formatMoney(sale.tax)}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                        {formatMoney(sale.grandTotal)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                            isCancelled
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : sale.paymentStatus === 'credit'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isCancelled ? 'Cancelled' : sale.paymentStatus === 'credit' ? 'Credit' : 'Completed'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleViewInvoice(sale)}
                            title="View / Print Receipt"
                            className="p-1.5 text-stone-600 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {!isCancelled && (
                            <button
                              type="button"
                              onClick={() => setCancellingSale(sale)}
                              title="Cancel / Void Invoice"
                              className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECEIPT MODAL */}
      {selectedSaleDetail && (
        <ReceiptModal
          sale={selectedSaleDetail}
          onClose={() => setSelectedSaleDetail(null)}
        />
      )}

      {/* VOID / CANCEL INVOICE CONFIRMATION MODAL */}
      {cancellingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-base font-bold text-stone-900">Void / Cancel Invoice</h3>
            </div>
            <p className="text-xs text-stone-600">
              Are you sure you want to void{' '}
              <span className="font-bold text-stone-900 font-mono">{cancellingSale.invoiceNumber}</span>?
            </p>

            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
              <p className="font-semibold">Automatic System Reversals:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li>All purchased item quantities will be restocked into inventory.</li>
                {cancellingSale.paymentMethod === 'cash' && (
                  <li>Physical cash of {formatMoney(cancellingSale.grandTotal)} will be deducted from active counter.</li>
                )}
                {cancellingSale.paymentMethod === 'credit' && (
                  <li>The customer's credit debt will be reversed in their ledger.</li>
                )}
              </ul>
            </div>

            <form onSubmit={handleConfirmCancelSale} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Reason for Cancellation *
                </label>
                <input
                  type="text"
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Customer returned items / Cashier entered incorrect products"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancellingSale(null)}
                  className="px-3.5 py-1.5 border border-stone-200 rounded-lg text-xs font-medium text-stone-600"
                >
                  Keep Invoice
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Confirm Void & Restore Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXPORT SALES REPORT MODAL */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5 text-emerald-700">
                <FileSpreadsheet className="w-5 h-5" />
                <h3 className="text-base font-bold text-stone-900">Export Sales Report & Records</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-500">
              Export sales audit records and multi-sheet financial summaries into Excel (.xlsx) or CSV format based on your custom dates.
            </p>

            <div className="space-y-4">
              {/* Date Preset Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                  Date Range Selection
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs font-medium">
                  {[
                    { id: 'current', label: 'Current Filter' },
                    { id: 'today', label: 'Today' },
                    { id: 'yesterday', label: 'Yesterday' },
                    { id: '7d', label: 'Last 7 Days' },
                    { id: 'month', label: 'This Month' },
                    { id: 'custom', label: 'Custom Range' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setExportPreset(p.id as any);
                        if (p.id !== 'custom' && p.id !== 'current') {
                          const eff = getEffectiveDatesForFilter(p.id);
                          setExportStartDate(eff.sDate);
                          setExportEndDate(eff.eDate);
                        } else if (p.id === 'current') {
                          const eff = getEffectiveDatesForFilter(dateFilter, startDate, endDate);
                          setExportStartDate(eff.sDate);
                          setExportEndDate(eff.eDate);
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-center transition-colors cursor-pointer ${
                        exportPreset === p.id
                          ? 'bg-stone-900 text-white border-stone-900 font-semibold shadow-xs'
                          : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start & End Date Inputs */}
              {(exportPreset === 'custom' || exportPreset === 'current') && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <div>
                    <label className="block text-[10px] font-semibold text-stone-600 uppercase mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={exportStartDate}
                      onChange={(e) => {
                        setExportPreset('custom');
                        setExportStartDate(e.target.value);
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-stone-600 uppercase mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={exportEndDate}
                      onChange={(e) => {
                        setExportPreset('custom');
                        setExportEndDate(e.target.value);
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              )}

              {/* Filters */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Payment Method
                  </label>
                  <select
                    value={exportPayment}
                    onChange={(e) => setExportPayment(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-stone-700 focus:outline-none"
                  >
                    <option value="all">All Payment Methods</option>
                    <option value="cash">Cash Only</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Invoice Status
                  </label>
                  <select
                    value={exportStatus}
                    onChange={(e) => setExportStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-stone-700 focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="completed">Completed Only</option>
                    <option value="credit">Credit / Pending</option>
                    <option value="cancelled">Cancelled / Void</option>
                  </select>
                </div>
              </div>

              {/* Report Structure Notice */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Included in Exported Workbook:
                </p>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-emerald-800">
                  <li><strong>Sales Invoices Sheet:</strong> Full ledger with invoice numbers, items, cashier names, payment modes, and margins.</li>
                  <li><strong>Executive Summary Sheet:</strong> Aggregated revenue, cash vs. digital collections, profit totals, and date range metadata.</li>
                </ul>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-3.5 py-2 border border-stone-200 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={() => handleExportData('csv', true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-stone-700" />
                <span>Export CSV (.csv)</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={() => handleExportData('xlsx', true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                <span>{isExporting ? 'Generating...' : 'Export Excel (.xlsx)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
