export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  isActive?: boolean;
  permissions?: string[];
  createdAt?: string;
}

export interface CashSession {
  id: string;
  userId: string;
  userName?: string;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  actualCash: number | null;
  difference: number | null;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
}

export interface CashBreakdown {
  openingCash: number;
  cashSales: number;
  cashCustomerPayments: number;
  cashExpenses: number;
  manualAdjustments: number;
  currentCash: number;
}

export interface CashSessionSummary {
  session: CashSession | null;
  breakdown: CashBreakdown;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string;
  sku: string;
  barcode: string | null;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  lowStockThreshold: number;
  stockStatus: 'healthy' | 'low' | 'out';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
  openingBalance: number;
  currentBalance: number;
  lastTransactionDate: string | null;
  lastTransactionDesc: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerLedgerItem {
  id: string;
  customerId: string;
  saleId: string | null;
  invoiceNumber: string | null;
  type: string;
  paymentMethod: string | null;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface CustomerDetail extends Customer {
  ledger: CustomerLedgerItem[];
}

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unitCost: number;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  totalCost: number;
  profit: number;
}

export interface SaleSummary {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  cashierName: string;
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  profit: number;
  paymentMethod: 'cash' | 'bank' | 'credit';
  paymentStatus: 'completed' | 'credit' | 'cancelled';
  createdAt: string;
}

export interface SaleDetail extends SaleSummary {
  customerId: string | null;
  customerPhone: string | null;
  userId: string;
  cashSessionId: string | null;
  totalCost: number;
  notes: string | null;
  items: SaleItem[];
}

export interface PurchaseItem {
  id: string;
  productId: string;
  productName: string;
  costPrice: number;
  quantity: number;
  totalPrice: number;
}

export interface PurchaseSummary {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  purchaseDate: string;
  totalAmount: number;
  paymentMethod: string;
  notes: string | null;
  createdAt: string;
}

export interface PurchaseDetail extends PurchaseSummary {
  items: PurchaseItem[];
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  paymentMethod: string;
  cashSessionId: string | null;
  notes: string | null;
  expenseDate: string;
  createdAt: string;
}

export interface DashboardStats {
  todaySales: number;
  todayProfit: number;
  todayExpenses: number;
  currentCash: number;
  totalCredit: number;
  totalProducts: number;
  lowStock: number;
  outOfStock: number;
  todayOrders: number;
  totalStockValue: number;
  hasActiveCounter: boolean;
  activeCounterSession: CashSession | null;
}

export interface ChartDataPoint {
  key: string;
  label: string;
  sales: number;
  profit: number;
  expenses: number;
  orders: number;
}

export interface PaymentBreakdown {
  method: string;
  key: string;
  total: number;
  count: number;
  percentage: number;
  color: string;
}

export interface TopProduct {
  productId: string;
  productName: string;
  sku: string;
  totalQuantity: number;
  totalRevenue: number;
  totalProfit: number;
}

export interface KeyboardShortcuts {
  searchProduct: string;
  creditCustomer: string;
  holdOrder: string;
  checkout: string;
  quickCash: string;
  clearCart: string;
}

export interface HeldOrder {
  id: string;
  userId: string;
  referenceName: string;
  cartData: {
    items: {
      product: Product;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }[];
    discount: number;
    tax: number;
    paymentMethod: 'cash' | 'bank' | 'credit';
    selectedCustomer: Customer | null;
    notes: string;
  };
  createdAt: string;
}

export interface AppSettings {
  shop_name: string;
  shop_address: string;
  shop_phone: string;
  currency: string;
  tax_rate: string;
  tax_enabled: string;
  default_low_stock_threshold: string;
  theme: string;
  [key: string]: string;
}
