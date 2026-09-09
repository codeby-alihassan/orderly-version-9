import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  PauseCircle,
  CreditCard,
  Banknote,
  Users,
  AlertCircle,
  Check,
  Package,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Product, Category, CartItem, Customer, SaleDetail } from '../../types';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Toast';
import { ReceiptModal } from '../pos/ReceiptModal';

export const PosView: React.FC = () => {
  const {
    settings,
    shortcuts,
    formatMoney,
    activeCash,
    refreshCash,
    refreshHeldOrdersCount,
    setIsOpenCounterModalOpen,
  } = useApp();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [enableTax, setEnableTax] = useState(settings.tax_enabled === 'true');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'credit'>('cash');

  // Customer state for Credit
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');

  // Hold order dialog
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdRefName, setHoldRefName] = useState('');

  // Receipt Modal
  const [completedSale, setCompletedSale] = useState<SaleDetail | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load products, categories, customers
  const loadInitialData = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const [prods, cats, custs] = await Promise.all([
        api.getProducts({ activeOnly: true }),
        api.getCategories(),
        api.getCustomers(),
      ]);
      setProducts(prods);
      setCategories(cats);
      setCustomers(custs);
    } catch (err) {
      console.error('Error loading POS data:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if inside an active text input or textarea (unless key is F-key or Escape)
      const isInput =
        document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';

      if (e.key === shortcuts.searchProduct) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === shortcuts.creditCustomer) {
        e.preventDefault();
        setPaymentMethod('credit');
      } else if (e.key === shortcuts.holdOrder) {
        e.preventDefault();
        if (cart.length > 0) {
          setShowHoldModal(true);
        }
      } else if (e.key === shortcuts.checkout) {
        e.preventDefault();
        if (cart.length > 0) {
          handleCheckout();
        }
      } else if (e.key === shortcuts.quickCash) {
        e.preventDefault();
        setPaymentMethod('cash');
        if (cart.length > 0) {
          handleCheckout('cash');
        }
      } else if (e.key === shortcuts.clearCart && !isInput) {
        e.preventDefault();
        if (cart.length > 0) {
          if (window.confirm('Clear current cart?')) {
            setCart([]);
            setDiscount(0);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, cart, paymentMethod]);

  // Listen for restored held cart
  useEffect(() => {
    const handleRestoreCart = (e: any) => {
      const data = e.detail;
      if (!data) return;
      if (Array.isArray(data.items)) {
        setCart(data.items);
      }
      if (typeof data.discount === 'number') {
        setDiscount(data.discount);
      }
      if (data.paymentMethod) {
        setPaymentMethod(data.paymentMethod);
      }
      if (data.selectedCustomer) {
        setSelectedCustomer(data.selectedCustomer);
      }
    };

    window.addEventListener('pos:restore-cart', handleRestoreCart);
    return () => window.removeEventListener('pos:restore-cart', handleRestoreCart);
  }, []);

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      p.name.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query) ||
      (p.barcode && p.barcode.toLowerCase().includes(query));
    return matchesCat && matchesSearch;
  });

  // Add to cart
  const addToCart = (product: Product) => {
    if (product.currentStock <= 0) {
      showToast(`"${product.name}" is out of stock!`, 'error');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((it) => it.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.currentStock) {
          showToast(`Cannot add more than available stock (${product.currentStock})`, 'error');
          return prev;
        }
        return prev.map((it) =>
          it.product.id === product.id
            ? {
                ...it,
                quantity: it.quantity + 1,
                totalPrice: Number(((it.quantity + 1) * it.unitPrice).toFixed(2)),
              }
            : it
        );
      } else {
        return [
          ...prev,
          {
            product,
            quantity: 1,
            unitPrice: product.sellingPrice,
            totalPrice: product.sellingPrice,
          },
        ];
      }
    });
  };

  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    const prod = products.find((p) => p.id === productId);
    if (prod && newQty > prod.currentStock) {
      showToast(`Cannot exceed available stock of ${prod.currentStock}`, 'error');
      return;
    }

    setCart((prev) =>
      prev.map((it) =>
        it.product.id === productId
          ? {
              ...it,
              quantity: newQty,
              totalPrice: Number((newQty * it.unitPrice).toFixed(2)),
            }
          : it
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((it) => it.product.id !== productId));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Are you sure you want to clear the cart?')) {
      setCart([]);
      setDiscount(0);
      setSelectedCustomer(null);
      showToast('Cart cleared');
    }
  };

  // Cart calculations
  const subtotal = Number(cart.reduce((sum, it) => sum + it.totalPrice, 0).toFixed(2));
  const taxRate = enableTax ? parseFloat(settings.tax_rate || '0') : 0;
  const taxAmount = Number(((subtotal - discount) * (taxRate / 100)).toFixed(2));
  const grandTotal = Number(Math.max(0, subtotal - discount + (taxAmount > 0 ? taxAmount : 0)).toFixed(2));

  // Hold Order
  const handleHoldOrder = async () => {
    if (cart.length === 0) return;
    const name = holdRefName.trim() || `Held Order #${Date.now().toString().slice(-4)}`;

    try {
      await api.holdOrder(name, {
        items: cart,
        discount,
        tax: taxAmount,
        paymentMethod,
        selectedCustomer,
        notes: '',
      });
      await refreshHeldOrdersCount();
      showToast(`Order "${name}" put on hold`);
      setCart([]);
      setDiscount(0);
      setSelectedCustomer(null);
      setShowHoldModal(false);
      setHoldRefName('');
    } catch (err: any) {
      showToast(err.message || 'Failed to hold order', 'error');
    }
  };

  // Checkout
  const handleCheckout = async (forcedMethod?: 'cash' | 'bank' | 'credit') => {
    const method = forcedMethod || paymentMethod;

    if (cart.length === 0) {
      showToast('Cart is empty. Please add items to checkout.', 'error');
      return;
    }

    // Require active counter for cash sales
    if (method === 'cash' && !activeCash?.session) {
      showToast('Cash drawer is closed. Please open counter first.', 'error');
      setIsOpenCounterModalOpen(true);
      return;
    }

    // Strict validation for Credit sale
    if (method === 'credit' && !selectedCustomer) {
      showToast('Please select a customer for Credit sales.', 'error');
      return;
    }

    setIsCheckingOut(true);
    try {
      const salePayload = {
        items: cart.map((it) => ({
          productId: it.product.id,
          productName: it.product.name,
          sku: it.product.sku,
          unitCost: it.product.costPrice,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          totalPrice: it.totalPrice,
          totalCost: Number((it.product.costPrice * it.quantity).toFixed(2)),
          profit: Number((it.totalPrice - it.product.costPrice * it.quantity).toFixed(2)),
        })),
        customerId: method === 'credit' ? selectedCustomer?.id : null,
        subtotal,
        discount,
        tax: taxAmount,
        grandTotal,
        paymentMethod: method,
        cashSessionId: activeCash?.session?.id || null,
        notes: method === 'credit' ? `Credit to ${selectedCustomer?.name}` : '',
      };

      const result = await api.checkoutSale(salePayload);

      // Refresh product stock locally and refresh cash drawer
      await Promise.all([loadInitialData(), refreshCash()]);

      setCompletedSale(result);
      setCart([]);
      setDiscount(0);
      setSelectedCustomer(null);
      showToast(`Sale ${result.invoiceNumber} completed!`);
    } catch (err: any) {
      showToast(err.message || 'Checkout failed', 'error');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Restore cart callback from held orders
  const handleRestoreCartData = (cartData: any) => {
    if (cartData?.items) {
      setCart(cartData.items);
      setDiscount(cartData.discount || 0);
      if (cartData.paymentMethod) setPaymentMethod(cartData.paymentMethod);
      if (cartData.selectedCustomer) setSelectedCustomer(cartData.selectedCustomer);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-stone-100">
      {/* LEFT SECTION: Catalog & Search */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-stone-200 bg-white">
        {/* Search & Category Filter Bar */}
        <div className="p-4 border-b border-stone-200 bg-white space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                ref={searchInputRef}
                id="pos-product-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search products by name, SKU, barcode... (${shortcuts.searchProduct})`}
                className="w-full pl-9 pr-3.5 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Categories Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              All Items ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-stone-50">
          {isLoadingProducts ? (
            <div className="py-20 text-center text-xs text-stone-500">Loading catalog...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-20 text-center text-stone-500">
              <Package className="w-8 h-8 mx-auto text-stone-300 mb-2" />
              <p className="font-semibold text-xs text-stone-700">No Products Found</p>
              <p className="text-[11px] text-stone-400 mt-0.5">Try searching with a different keyword or SKU.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((p) => {
                const inCart = cart.find((it) => it.product.id === p.id);
                const isOutOfStock = p.currentStock <= 0;
                const isLowStock = p.currentStock > 0 && p.currentStock <= p.lowStockThreshold;

                return (
                  <button
                    key={p.id}
                    id={`pos-product-${p.id}`}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => addToCart(p)}
                    className={`relative p-3 rounded-xl border text-left flex flex-col justify-between transition-all group ${
                      isOutOfStock
                        ? 'bg-stone-100/70 border-stone-200 opacity-60 cursor-not-allowed'
                        : 'bg-white border-stone-200 hover:border-orange-400 hover:shadow-sm cursor-pointer'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                        {inCart.quantity}
                      </span>
                    )}

                    <div>
                      <div className="text-[10px] font-mono text-stone-400 truncate">{p.sku}</div>
                      <h4 className="font-semibold text-xs text-stone-900 line-clamp-2 mt-0.5 group-hover:text-orange-600 transition-colors">
                        {p.name}
                      </h4>
                      <div className="text-[10px] text-stone-500 mt-0.5 truncate">{p.categoryName}</div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-stone-100 flex items-end justify-between">
                      <div>
                        <span className="text-[10px] text-stone-400 block leading-none">Price</span>
                        <span className="font-bold text-sm text-stone-900 font-mono">
                          {formatMoney(p.sellingPrice)}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isOutOfStock
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : isLowStock
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {isOutOfStock ? 'Out' : `Stock: ${p.currentStock}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SECTION: Cart, Totals & Checkout */}
      <div className="w-full lg:w-96 xl:w-[420px] bg-white flex flex-col shrink-0 shadow-sm">
        {/* Cart Header */}
        <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-orange-500" />
            <h3 className="font-bold text-stone-900 text-xs tracking-tight">Active Sale Cart</h3>
            <span className="px-1.5 py-0.5 bg-stone-200 text-stone-700 rounded text-[10px] font-semibold">
              {cart.reduce((sum, it) => sum + it.quantity, 0)} items
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="hold-cart-button"
              type="button"
              disabled={cart.length === 0}
              onClick={() => setShowHoldModal(true)}
              className="text-[11px] font-medium text-stone-600 hover:text-orange-600 p-1 rounded hover:bg-stone-100 transition-colors disabled:opacity-40"
              title={`Hold Order (${shortcuts.holdOrder})`}
            >
              Hold ({shortcuts.holdOrder})
            </button>
            <button
              id="clear-cart-button"
              type="button"
              disabled={cart.length === 0}
              onClick={clearCart}
              className="text-[11px] font-medium text-stone-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors disabled:opacity-40"
              title={`Clear Cart (${shortcuts.clearCart})`}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="py-24 text-center text-stone-400 text-xs">
              <ShoppingCart className="w-8 h-8 mx-auto text-stone-300 mb-2 stroke-1" />
              <p className="font-medium text-stone-600">Cart is Empty</p>
              <p className="text-[11px] text-stone-400 mt-1">
                Click products from the catalog or search by barcode/SKU to start.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <h5 className="font-semibold text-stone-900 truncate">{item.product.name}</h5>
                  <div className="text-[11px] text-stone-500 font-mono">
                    {formatMoney(item.unitPrice)} each
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-lg p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="w-6 h-6 flex items-center justify-center rounded text-stone-600 hover:bg-stone-100 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={item.product.currentStock}
                    value={item.quantity}
                    onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                    className="w-8 text-center text-xs font-semibold text-stone-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    className="w-6 h-6 flex items-center justify-center rounded text-stone-600 hover:bg-stone-100 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="text-right min-w-[70px]">
                  <div className="font-mono font-bold text-xs text-stone-900">
                    {formatMoney(item.totalPrice)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-[10px] text-stone-400 hover:text-red-600 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Calculation & Payment Area */}
        <div className="p-4 border-t border-stone-200 bg-stone-50/70 space-y-3">
          {/* Subtotal, Discount & Tax inputs */}
          <div className="space-y-1.5 text-xs text-stone-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono font-medium text-stone-900">{formatMoney(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-500">Discount ({settings.currency})</span>
              <input
                id="pos-discount-input"
                type="number"
                min="0"
                step="any"
                value={discount === 0 ? '' : discount}
                onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="0.00"
                className="w-24 text-right px-2 py-1 bg-white border border-stone-200 rounded text-xs font-mono focus:outline-none focus:border-orange-500"
              />
            </div>

            {settings.tax_rate !== '0' && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableTax}
                    onChange={(e) => setEnableTax(e.target.checked)}
                    className="rounded border-stone-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span>Tax ({settings.tax_rate}%)</span>
                </label>
                <span className="font-mono font-medium text-stone-900">{formatMoney(taxAmount)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-stone-200 flex justify-between items-baseline font-bold text-stone-900">
              <span className="text-xs uppercase tracking-wider">Grand Total</span>
              <span className="font-mono text-lg text-orange-600">{formatMoney(grandTotal)}</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                id="pay-cash-btn"
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2 px-2 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-orange-50 border-orange-500 text-orange-800 ring-2 ring-orange-500/20 shadow-2xs'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>Cash</span>
              </button>

              <button
                id="pay-bank-btn"
                type="button"
                onClick={() => setPaymentMethod('bank')}
                className={`py-2 px-2 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'bank'
                    ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20 shadow-2xs'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>Bank Transfer</span>
              </button>

              <button
                id="pay-credit-btn"
                type="button"
                onClick={() => setPaymentMethod('credit')}
                className={`py-2 px-2 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'credit'
                    ? 'bg-purple-50 border-purple-500 text-purple-800 ring-2 ring-purple-500/20 shadow-2xs'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Users className="w-4 h-4 text-purple-600" />
                <span>Credit ({shortcuts.creditCustomer})</span>
              </button>
            </div>
          </div>

          {/* MANDATORY CUSTOMER SELECTOR (Shown ONLY when Credit is selected) */}
          {paymentMethod === 'credit' && (
            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-purple-900 uppercase tracking-wider flex items-center gap-1">
                  <span>Select Credit Customer</span>
                  <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-purple-700 font-medium">Mandatory for Credit</span>
              </div>

              <select
                id="pos-customer-select"
                value={selectedCustomer?.id || ''}
                onChange={(e) => {
                  const c = customers.find((cust) => cust.id === e.target.value) || null;
                  setSelectedCustomer(c);
                }}
                className="w-full px-3 py-2 bg-white border border-purple-300 rounded-lg text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="">-- Choose registered customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) - Due: {formatMoney(c.currentBalance)}
                  </option>
                ))}
              </select>

              {selectedCustomer && (
                <div className="text-[11px] text-purple-800 flex justify-between pt-1 border-t border-purple-200">
                  <span>Current Outstanding Due:</span>
                  <span className="font-mono font-bold">{formatMoney(selectedCustomer.currentBalance)}</span>
                </div>
              )}
            </div>
          )}

          {/* Complete Checkout Button */}
          <button
            id="pos-checkout-button"
            type="button"
            disabled={cart.length === 0 || isCheckingOut || (paymentMethod === 'credit' && !selectedCustomer)}
            onClick={() => handleCheckout()}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {isCheckingOut ? (
              <span>Processing Transaction...</span>
            ) : (
              <>
                <span>Complete Checkout ({formatMoney(grandTotal)})</span>
                <span className="text-xs font-normal opacity-75">[{shortcuts.checkout}]</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* HOLD ORDER DIALOG */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-stone-900">Hold Active Order</h3>
            <p className="text-xs text-stone-500">
              Save current cart items on hold to serve another customer.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Reference Label / Note
              </label>
              <input
                type="text"
                autoFocus
                value={holdRefName}
                onChange={(e) => setHoldRefName(e.target.value)}
                placeholder="e.g. Table 4 or Customer in Grey Jacket"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowHoldModal(false)}
                className="px-3 py-1.5 border border-stone-200 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleHoldOrder}
                className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Confirm Hold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          onClose={() => setCompletedSale(null)}
          onNewSale={() => {
            setCompletedSale(null);
            searchInputRef.current?.focus();
          }}
        />
      )}
    </div>
  );
};
