import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Plus,
  Search,
  Package,
  Calendar,
  DollarSign,
  FileText,
  AlertTriangle,
  X,
  Trash2,
  Eye,
  Sliders,
} from 'lucide-react';
import { Product, PurchaseSummary, PurchaseDetail } from '../../types';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Toast';

export const PurchaseInventoryView: React.FC = () => {
  const { formatMoney, activeCash } = useApp();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'inventory' | 'purchases'>('inventory');
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<PurchaseSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // New Purchase modal state
  const [showNewPurchaseModal, setShowNewPurchaseModal] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState<'cash' | 'bank' | 'credit'>('bank');
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseLines, setPurchaseLines] = useState<
    { productId: string; costPrice: number; quantity: number }[]
  >([{ productId: '', costPrice: 0, quantity: 1 }]);

  // Purchase Details modal state
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseDetail | null>(null);

  // Quick adjust stock modal
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [newStockVal, setNewStockVal] = useState('');
  const [adjustReason, setAdjustReason] = useState('Supplier delivery adjustment');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [prods, purch] = await Promise.all([
        api.getProducts({ search: searchQuery }),
        api.getPurchases({ search: searchQuery }),
      ]);
      setProducts(prods);
      setPurchases(purch);
    } catch (err) {
      console.error('Error loading inventory data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle adding line item to purchase
  const addPurchaseLine = () => {
    setPurchaseLines((prev) => [...prev, { productId: '', costPrice: 0, quantity: 1 }]);
  };

  const removePurchaseLine = (index: number) => {
    if (purchaseLines.length <= 1) return;
    setPurchaseLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updatePurchaseLine = (index: number, field: string, value: any) => {
    setPurchaseLines((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };

      if (field === 'productId') {
        item.productId = value;
        const prod = products.find((p) => p.id === value);
        if (prod) {
          item.costPrice = prod.costPrice;
        }
      } else if (field === 'costPrice') {
        item.costPrice = parseFloat(value) || 0;
      } else if (field === 'quantity') {
        item.quantity = parseInt(value) || 1;
      }

      updated[index] = item;
      return updated;
    });
  };

  // Submit New Purchase
  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierName.trim()) {
      showToast('Please enter supplier name', 'error');
      return;
    }

    const validLines = purchaseLines.filter((l) => l.productId && l.quantity > 0);
    if (validLines.length === 0) {
      showToast('Please select at least one valid product line', 'error');
      return;
    }

    try {
      const payload = {
        supplierName: supplierName.trim(),
        purchaseDate,
        paymentMethod: purchasePaymentMethod,
        notes: purchaseNotes.trim(),
        items: validLines.map((l) => ({
          productId: l.productId,
          productName: products.find((p) => p.id === l.productId)?.name || 'Item',
          costPrice: l.costPrice,
          quantity: l.quantity,
          totalPrice: Number((l.costPrice * l.quantity).toFixed(2)),
        })),
      };

      const res = await api.createPurchase(payload);
      showToast(`Purchase order ${res.invoiceNumber} recorded! Stock increased.`);
      setShowNewPurchaseModal(false);
      setSupplierName('');
      setPurchaseLines([{ productId: '', costPrice: 0, quantity: 1 }]);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save purchase', 'error');
    }
  };

  // View Purchase details
  const viewPurchase = async (p: PurchaseSummary) => {
    try {
      const detail = await api.getPurchase(p.id);
      setSelectedPurchase(detail);
    } catch (err: any) {
      showToast(err.message || 'Error loading purchase detail', 'error');
    }
  };

  // Save quick stock adjust
  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    const val = parseInt(newStockVal);
    if (isNaN(val) || val < 0) {
      showToast('Please enter valid stock amount', 'error');
      return;
    }

    try {
      await api.adjustStock(adjustingProduct.id, val, adjustReason);
      showToast(`Stock updated for ${adjustingProduct.name}`);
      setAdjustingProduct(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Adjustment failed', 'error');
    }
  };

  // Inventory valuation calculations
  const totalStockValuation = products.reduce((sum, p) => sum + p.costPrice * p.currentStock, 0);
  const totalRetailValuation = products.reduce((sum, p) => sum + p.sellingPrice * p.currentStock, 0);
  const lowStockCount = products.filter((p) => p.stockStatus === 'low').length;
  const outOfStockCount = products.filter((p) => p.stockStatus === 'out').length;

  const totalPurchaseLinesAmount = purchaseLines.reduce(
    (sum, l) => sum + (l.costPrice || 0) * (l.quantity || 0),
    0
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Purchase Orders & Inventory</h2>
          <p className="text-xs text-stone-500 mt-0.5">Supplier replenishment, warehouse stock valuation, and purchase records</p>
        </div>

        <button
          id="new-purchase-btn"
          type="button"
          onClick={() => {
            setShowNewPurchaseModal(true);
            setSupplierName('');
            setPurchaseLines([
              {
                productId: products[0]?.id || '',
                costPrice: products[0]?.costPrice || 0,
                quantity: 10,
              },
            ]);
          }}
          className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Record New Purchase</span>
        </button>
      </div>

      {/* Inventory Valuation Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-stone-500">Inventory Cost Value</span>
          <div className="mt-1 text-xl font-bold font-mono text-stone-900">
            {formatMoney(totalStockValuation)}
          </div>
          <span className="text-[11px] text-stone-400 font-medium">At current supplier cost</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-stone-500">Retail Sales Value</span>
          <div className="mt-1 text-xl font-bold font-mono text-emerald-600">
            {formatMoney(totalRetailValuation)}
          </div>
          <span className="text-[11px] text-stone-400 font-medium">
            Potential margin: {formatMoney(totalRetailValuation - totalStockValuation)}
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-amber-600">Items Needing Reorder</span>
          <div className="mt-1 text-xl font-bold font-mono text-amber-700">
            {lowStockCount} <span className="text-xs font-normal text-stone-500">SKUs</span>
          </div>
          <span className="text-[11px] text-stone-400 font-medium">Below low-stock threshold</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-red-600">Out of Stock Depleted</span>
          <div className="mt-1 text-xl font-bold font-mono text-red-700">
            {outOfStockCount} <span className="text-xs font-normal text-stone-500">SKUs</span>
          </div>
          <span className="text-[11px] text-stone-400 font-medium">Cannot be rung in POS</span>
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-1.5 rounded-md transition-colors ${
              activeTab === 'inventory'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Inventory Stock View ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('purchases')}
            className={`px-3.5 py-1.5 rounded-md transition-colors ${
              activeTab === 'purchases'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Purchase Orders History ({purchases.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'inventory' ? 'Filter inventory products...' : 'Filter suppliers or invoice #...'
            }
            className="w-full pl-9 pr-3.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
        </div>
      </div>

      {/* TAB 1: Inventory Stock Table */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 font-semibold">SKU</th>
                  <th className="py-3 px-4 font-semibold">Product Name</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold text-right">Cost Price</th>
                  <th className="py-3 px-4 font-semibold text-right">Selling Price</th>
                  <th className="py-3 px-4 font-semibold text-right">On Hand</th>
                  <th className="py-3 px-4 font-semibold text-right">Valuation</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {products.map((p) => {
                  const lineVal = p.costPrice * p.currentStock;

                  return (
                    <tr key={p.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-stone-500">{p.sku}</td>
                      <td className="py-3 px-4 font-semibold text-stone-900">{p.name}</td>
                      <td className="py-3 px-4 text-stone-600">{p.categoryName}</td>
                      <td className="py-3 px-4 text-right font-mono text-stone-500">
                        {formatMoney(p.costPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                        {formatMoney(p.sellingPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                        {p.currentStock}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                        {formatMoney(lineVal)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            p.stockStatus === 'out'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : p.stockStatus === 'low'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {p.stockStatus === 'out' ? 'Out of Stock' : p.stockStatus === 'low' ? 'Low Stock' : 'Healthy'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustingProduct(p);
                            setNewStockVal(String(p.currentStock));
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 transition-colors inline-flex items-center gap-1"
                        >
                          <Sliders className="w-3 h-3 text-stone-500" />
                          <span>Adjust</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Purchases History Table */}
      {activeTab === 'purchases' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Purchase #</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Supplier Name</th>
                  <th className="py-3 px-4 font-semibold">Payment Mode</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Amount</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-stone-400">
                      No purchase orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  purchases.map((pur) => (
                    <tr key={pur.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-stone-900">
                        {pur.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 text-stone-600">{pur.purchaseDate}</td>
                      <td className="py-3 px-4 font-medium text-stone-900">{pur.supplierName}</td>
                      <td className="py-3 px-4">
                        <span className="uppercase text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-100 border border-stone-200 text-stone-700">
                          {pur.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                        {formatMoney(pur.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => viewPurchase(pur)}
                          className="px-2.5 py-1 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded border border-orange-200 transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3 text-orange-600" />
                          <span>View Order</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NEW MULTI-ITEM PURCHASE MODAL */}
      {showNewPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="text-base font-semibold text-stone-900">Record Supplier Purchase Order</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Restock product quantities and register warehouse purchase invoices
                </p>
              </div>
              <button
                onClick={() => setShowNewPurchaseModal(false)}
                className="p-1 rounded-md text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. Metro Wholesale Foods"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Payment Method
                  </label>
                  <select
                    value={purchasePaymentMethod}
                    onChange={(e) => setPurchasePaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium focus:outline-none"
                  >
                    <option value="bank">Bank Transfer</option>
                    <option value="cash">Cash (Physical Drawer)</option>
                    <option value="credit">Credit / Supplier Account</option>
                  </select>
                </div>
              </div>

              {/* Multi-item lines table */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Purchase Line Items ({purchaseLines.length})
                  </span>
                  <button
                    type="button"
                    onClick={addPurchaseLine}
                    className="px-2.5 py-1 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded border border-stone-200 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item Line</span>
                  </button>
                </div>

                <div className="border border-stone-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Select Product</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-32">Cost Price</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-24">Qty</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-32">Total</th>
                        <th className="py-2.5 px-2 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {purchaseLines.map((line, idx) => {
                        const lineTotal = (line.costPrice || 0) * (line.quantity || 0);

                        return (
                          <tr key={idx} className="bg-white">
                            <td className="py-2 px-3">
                              <select
                                required
                                value={line.productId}
                                onChange={(e) => updatePurchaseLine(idx, 'productId', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded text-xs focus:outline-none focus:bg-white"
                              >
                                <option value="">-- Choose product --</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.sku}) - On hand: {p.currentStock}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                required
                                value={line.costPrice || ''}
                                onChange={(e) => updatePurchaseLine(idx, 'costPrice', e.target.value)}
                                className="w-full px-2 py-1.5 bg-stone-50 border border-stone-200 rounded text-right text-xs font-mono focus:bg-white focus:outline-none"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="1"
                                required
                                value={line.quantity || ''}
                                onChange={(e) => updatePurchaseLine(idx, 'quantity', e.target.value)}
                                className="w-full px-2 py-1.5 bg-stone-50 border border-stone-200 rounded text-right text-xs font-mono font-bold focus:bg-white focus:outline-none"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-stone-900">
                              {formatMoney(lineTotal)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {purchaseLines.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removePurchaseLine(idx)}
                                  className="p-1 text-stone-400 hover:text-red-600 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Summary */}
              <div className="pt-2 flex justify-between items-center text-sm font-bold text-stone-900 border-t border-stone-200">
                <span>Total Purchase Order Value:</span>
                <span className="font-mono text-base text-orange-600">
                  {formatMoney(totalPurchaseLinesAmount)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Notes / Supplier Bill #
                </label>
                <input
                  type="text"
                  value={purchaseNotes}
                  onChange={(e) => setPurchaseNotes(e.target.value)}
                  placeholder="e.g. Invoice #MWF-8929; Delivered via truck"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPurchaseModal(false)}
                  className="px-4 py-2 border border-stone-200 rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Record Purchase & Increase Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PURCHASE DETAILS MODAL */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900">{selectedPurchase.invoiceNumber}</h3>
                <span className="text-xs text-stone-500">
                  Supplier: {selectedPurchase.supplierName} • {selectedPurchase.purchaseDate}
                </span>
              </div>
              <button
                onClick={() => setSelectedPurchase(null)}
                className="p-1 rounded text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border border-stone-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3">Item</th>
                    <th className="py-2 px-3 text-right">Cost</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {selectedPurchase.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 px-3 font-medium text-stone-900">{it.productName}</td>
                      <td className="py-2 px-3 text-right font-mono text-stone-600">
                        {formatMoney(it.costPrice)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-stone-900">
                        {it.quantity}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-stone-900">
                        {formatMoney(it.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center text-sm font-bold text-stone-900 pt-2 border-t border-stone-100">
              <span>Grand Total:</span>
              <span className="font-mono text-orange-600">
                {formatMoney(selectedPurchase.totalAmount)}
              </span>
            </div>

            {selectedPurchase.notes && (
              <div className="text-xs text-stone-500 bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                <span className="font-semibold text-stone-700">Remarks: </span>
                {selectedPurchase.notes}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setSelectedPurchase(null)}
                className="px-4 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADJUST STOCK MODAL */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-stone-900">Adjust Inventory Stock</h3>
            <p className="text-xs text-stone-500">
              Set new quantity for <span className="font-semibold text-stone-900">{adjustingProduct.name}</span>
            </p>

            <form onSubmit={handleSaveAdjust} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  New Quantity on Hand
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newStockVal}
                  onChange={(e) => setNewStockVal(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono font-bold focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Reason for Adjustment
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-3 py-1.5 border border-stone-200 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Save Count
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
