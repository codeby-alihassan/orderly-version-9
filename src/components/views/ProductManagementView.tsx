import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Sliders,
  Trash2,
  AlertTriangle,
  FolderPlus,
  X,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { Product, Category } from '../../types';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Toast';

export const ProductManagementView: React.FC = () => {
  const { formatMoney, settings } = useApp();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Form states for Add/Edit
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    sku: '',
    barcode: '',
    costPrice: '',
    sellingPrice: '',
    currentStock: '',
    lowStockThreshold: settings.default_low_stock_threshold || '5',
  });

  // Adjust stock form state
  const [newStockVal, setNewStockVal] = useState('');
  const [adjustReason, setAdjustReason] = useState('Physical audit adjustment');

  // Category form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        api.getProducts({
          search: searchQuery,
          categoryId: selectedCategory === 'all' ? undefined : selectedCategory,
          status: selectedStatus === 'all' ? undefined : selectedStatus,
        }),
        api.getCategories(),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Edit modal
  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      categoryId: p.categoryId || '',
      sku: p.sku,
      barcode: p.barcode || '',
      costPrice: String(p.costPrice),
      sellingPrice: String(p.sellingPrice),
      currentStock: String(p.currentStock),
      lowStockThreshold: String(p.lowStockThreshold),
    });
  };

  // Open Adjust Stock modal
  const openAdjust = (p: Product) => {
    setAdjustingProduct(p);
    setNewStockVal(String(p.currentStock));
    setAdjustReason('Physical audit adjustment');
  };

  // Submit Add or Edit Product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name.trim(),
        categoryId: formData.categoryId || null,
        sku: formData.sku.trim(),
        barcode: formData.barcode.trim() || null,
        costPrice: parseFloat(formData.costPrice) || 0,
        sellingPrice: parseFloat(formData.sellingPrice) || 0,
        currentStock: parseInt(formData.currentStock) || 0,
        lowStockThreshold: parseInt(formData.lowStockThreshold) || 5,
      };

      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
        showToast(`Updated product "${payload.name}"`);
        setEditingProduct(null);
      } else {
        await api.createProduct(payload);
        showToast(`Created product "${payload.name}"`);
        setShowAddModal(false);
      }

      // Reset form
      setFormData({
        name: '',
        categoryId: '',
        sku: '',
        barcode: '',
        costPrice: '',
        sellingPrice: '',
        currentStock: '',
        lowStockThreshold: settings.default_low_stock_threshold || '5',
      });
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Error saving product', 'error');
    }
  };

  // Submit Stock Adjustment
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    const val = parseInt(newStockVal);
    if (isNaN(val) || val < 0) {
      showToast('Please enter a valid non-negative stock quantity', 'error');
      return;
    }

    try {
      await api.adjustStock(adjustingProduct.id, val, adjustReason);
      showToast(`Stock updated for ${adjustingProduct.name}`);
      setAdjustingProduct(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Error adjusting stock', 'error');
    }
  };

  // Delete Product
  const handleDeleteProduct = async (p: Product) => {
    if (window.confirm(`Are you sure you want to delete or deactivate "${p.name}"?`)) {
      try {
        await api.deleteProduct(p.id);
        showToast(`Product "${p.name}" removed`);
        await loadData();
      } catch (err: any) {
        showToast(err.message || 'Failed to delete product', 'error');
      }
    }
  };

  // Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      await api.createCategory(newCatName.trim(), newCatDesc.trim());
      showToast(`Category "${newCatName}" created`);
      setNewCatName('');
      setNewCatDesc('');
      setShowCategoryModal(false);
      const cats = await api.getCategories();
      setCategories(cats);
    } catch (err: any) {
      showToast(err.message || 'Failed to create category', 'error');
    }
  };

  // Delete Category
  const handleDeleteCategory = async (cat: Category) => {
    setIsDeletingCategory(true);
    try {
      await api.deleteCategory(cat.id);
      showToast(`Category "${cat.name}" deleted successfully`);
      const cats = await api.getCategories();
      setCategories(cats);
      if (selectedCategory === cat.id) {
        setSelectedCategory('all');
      }
      setCategoryToDelete(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete category', 'error');
    } finally {
      setIsDeletingCategory(false);
    }
  };

  // Stats
  const totalCount = products.length;
  const healthyCount = products.filter((p) => p.stockStatus === 'healthy').length;
  const lowCount = products.filter((p) => p.stockStatus === 'low').length;
  const outCount = products.filter((p) => p.stockStatus === 'out').length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Product Catalog & Inventory</h2>
          <p className="text-xs text-stone-500 mt-0.5">Manage SKUs, barcodes, pricing margins, and reorder levels</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCategoryModal(true)}
            className="px-3 py-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <FolderPlus className="w-4 h-4 text-stone-500" />
            <span>Categories</span>
          </button>
          <button
            id="add-product-btn"
            type="button"
            onClick={() => {
              setFormData({
                name: '',
                categoryId: categories[0]?.id || '',
                sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
                barcode: '',
                costPrice: '',
                sellingPrice: '',
                currentStock: '10',
                lowStockThreshold: settings.default_low_stock_threshold || '5',
              });
              setShowAddModal(true);
            }}
            className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Stock Health Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-[11px] font-medium text-stone-500">Total Products</span>
          <div className="text-lg font-bold font-mono text-stone-900 mt-1">{totalCount}</div>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-[11px] font-medium text-emerald-600">Healthy Stock</span>
          <div className="text-lg font-bold font-mono text-emerald-700 mt-1">{healthyCount}</div>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-[11px] font-medium text-amber-600">Low Stock Alert</span>
          <div className="text-lg font-bold font-mono text-amber-700 mt-1">{lowCount}</div>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-[11px] font-medium text-red-600">Out of Stock</span>
          <div className="text-lg font-bold font-mono text-red-700 mt-1">{outCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by product title, SKU code, or barcode..."
            className="w-full pl-9 pr-3.5 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-stone-700 focus:outline-none"
          >
            <option value="all">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-stone-700 focus:outline-none"
          >
            <option value="all">All Stock Status</option>
            <option value="healthy">Healthy Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 font-semibold">SKU / Code</th>
                <th className="py-3 px-4 font-semibold">Product Name</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold text-right">Cost Price</th>
                <th className="py-3 px-4 font-semibold text-right">Selling Price</th>
                <th className="py-3 px-4 font-semibold text-right">Margin</th>
                <th className="py-3 px-4 font-semibold text-right">Stock</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">
                    No products found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const marginPct =
                    p.sellingPrice > 0
                      ? (((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100).toFixed(1)
                      : '0';

                  return (
                    <tr key={p.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-stone-500 font-medium">
                        {p.sku}
                        {p.barcode && <div className="text-[10px] text-stone-400 font-mono">{p.barcode}</div>}
                      </td>
                      <td className="py-3 px-4 font-semibold text-stone-900">{p.name}</td>
                      <td className="py-3 px-4 text-stone-600">{p.categoryName}</td>
                      <td className="py-3 px-4 text-right font-mono text-stone-500">
                        {formatMoney(p.costPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                        {formatMoney(p.sellingPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-emerald-600">
                        {marginPct}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                        {p.currentStock}
                        <span className="text-[10px] text-stone-400 font-normal ml-1">
                          (min {p.lowStockThreshold})
                        </span>
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
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openAdjust(p)}
                            title="Adjust Stock Quantity"
                            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded transition-colors"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            title="Edit Product Details"
                            className="p-1.5 text-stone-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            title="Delete Product"
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* ADD / EDIT PRODUCT MODAL */}
      {(showAddModal || editingProduct) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <h3 className="text-base font-semibold text-stone-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingProduct(null);
                }}
                className="p-1 rounded-md text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Organic Brown Eggs 12pk"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium focus:outline-none"
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="SKU-1001"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Barcode / UPC (Optional)
                </label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="8901030382910"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Cost Price ({settings.currency}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    placeholder="120"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Selling Price ({settings.currency}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    placeholder="150"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Current Stock *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                    placeholder="25"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Low Stock Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.lowStockThreshold}
                    onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                    placeholder="5"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 border border-stone-200 rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  {editingProduct ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST STOCK MODAL */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-stone-900">Adjust Inventory Stock</h3>
            <p className="text-xs text-stone-500">
              Update physical count for <span className="font-semibold text-stone-900">{adjustingProduct.name}</span>
            </p>

            <form onSubmit={handleSaveAdjustment} className="space-y-3">
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
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Reason for Adjustment
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium focus:outline-none"
                >
                  <option value="Physical audit adjustment">Physical audit adjustment</option>
                  <option value="Damaged / expired goods">Damaged / expired goods</option>
                  <option value="Stock received from supplier">Stock received from supplier</option>
                  <option value="Returned by customer">Returned by customer</option>
                  <option value="Internal theft / shrinkage">Internal shrinkage</option>
                </select>
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

      {/* CATEGORIES MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-sm font-bold text-stone-900">Manage Categories</h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List existing categories */}
            <div className="max-h-56 overflow-y-auto divide-y divide-stone-100 border border-stone-100 rounded-lg">
              {categories.length === 0 ? (
                <div className="p-4 text-center text-xs text-stone-400">No categories created yet.</div>
              ) : (
                categories.map((c) => (
                  <div key={c.id} className="p-2.5 flex justify-between items-center text-xs hover:bg-stone-50 transition-colors">
                    <div>
                      <div className="font-semibold text-stone-900">{c.name}</div>
                      {c.description && <div className="text-[11px] text-stone-400">{c.description}</div>}
                    </div>
                    {categoryToDelete?.id === c.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isDeletingCategory}
                          onClick={() => handleDeleteCategory(c)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-semibold transition-colors disabled:opacity-50"
                        >
                          {isDeletingCategory ? 'Deleting...' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          disabled={isDeletingCategory}
                          onClick={() => setCategoryToDelete(null)}
                          className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded text-[10px] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCategoryToDelete(c)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={`Delete category ${c.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add new category form */}
            <form onSubmit={handleCreateCategory} className="border-t border-stone-100 pt-3 space-y-2">
              <div className="text-xs font-semibold text-stone-700">Add New Category</div>
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Category name (e.g. Frozen Foods)"
                className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none"
              />
              <input
                type="text"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
