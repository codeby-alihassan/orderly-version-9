import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('cashier'), // 'admin' | 'cashier'
  isActive: integer('is_active').notNull().default(1),
  permissions: text('permissions').notNull().default('["pos","invoices"]'),
  createdAt: text('created_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
});

export const cashSessions = sqliteTable('cash_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  openingCash: real('opening_cash').notNull().default(0),
  closingCash: real('closing_cash'),
  expectedCash: real('expected_cash'),
  actualCash: real('actual_cash'),
  difference: real('difference'),
  status: text('status').notNull().default('open'), // 'open' | 'closed'
  openedAt: text('opened_at').notNull(),
  closedAt: text('closed_at'),
  notes: text('notes'),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: text('created_at').notNull(),
});

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  categoryId: text('category_id').references(() => categories.id),
  sku: text('sku').notNull().unique(),
  barcode: text('barcode'),
  costPrice: real('cost_price').notNull().default(0),
  sellingPrice: real('selling_price').notNull().default(0),
  currentStock: integer('current_stock').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
  isActive: integer('is_active').notNull().default(1), // 1 = active, 0 = archived
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const purchases = sqliteTable('purchases', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  supplierName: text('supplier_name').notNull(),
  purchaseDate: text('purchase_date').notNull(),
  totalAmount: real('total_amount').notNull().default(0),
  paymentMethod: text('payment_method').notNull().default('cash'), // 'cash' | 'bank' | 'credit'
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

export const purchaseItems = sqliteTable('purchase_items', {
  id: text('id').primaryKey(),
  purchaseId: text('purchase_id').notNull().references(() => purchases.id),
  productId: text('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  costPrice: real('cost_price').notNull().default(0),
  quantity: integer('quantity').notNull().default(1),
  totalPrice: real('total_price').notNull().default(0),
});

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(),
  address: text('address'),
  notes: text('notes'),
  openingBalance: real('opening_balance').notNull().default(0),
  currentBalance: real('current_balance').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sales = sqliteTable('sales', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  customerId: text('customer_id').references(() => customers.id),
  userId: text('user_id').notNull().references(() => users.id),
  cashSessionId: text('cash_session_id').references(() => cashSessions.id),
  subtotal: real('subtotal').notNull().default(0),
  discount: real('discount').notNull().default(0),
  tax: real('tax').notNull().default(0),
  grandTotal: real('grand_total').notNull().default(0),
  totalCost: real('total_cost').notNull().default(0),
  profit: real('profit').notNull().default(0),
  paymentMethod: text('payment_method').notNull(), // 'cash' | 'bank' | 'credit'
  paymentStatus: text('payment_status').notNull().default('completed'), // 'completed' | 'credit' | 'cancelled'
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

export const saleItems = sqliteTable('sale_items', {
  id: text('id').primaryKey(),
  saleId: text('sale_id').notNull().references(() => sales.id),
  productId: text('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  sku: text('sku').notNull(),
  unitCost: real('unit_cost').notNull().default(0),
  unitPrice: real('unit_price').notNull().default(0),
  quantity: integer('quantity').notNull().default(1),
  totalPrice: real('total_price').notNull().default(0),
  totalCost: real('total_cost').notNull().default(0),
  profit: real('profit').notNull().default(0),
});

export const customerTransactions = sqliteTable('customer_transactions', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  saleId: text('sale_id').references(() => sales.id),
  type: text('type').notNull(), // 'credit_sale' | 'payment_received' | 'adjustment_credit' | 'adjustment_debit'
  paymentMethod: text('payment_method'), // 'cash' | 'bank'
  amount: real('amount').notNull().default(0),
  balanceAfter: real('balance_after').notNull().default(0),
  description: text('description').notNull(),
  createdAt: text('created_at').notNull(),
});

export const cashMovements = sqliteTable('cash_movements', {
  id: text('id').primaryKey(),
  cashSessionId: text('cash_session_id').notNull().references(() => cashSessions.id),
  type: text('type').notNull(), // 'opening' | 'sale' | 'customer_payment' | 'expense' | 'manual_in' | 'manual_out' | 'closing'
  amount: real('amount').notNull().default(0),
  referenceId: text('reference_id'),
  description: text('description').notNull(),
  createdAt: text('created_at').notNull(),
});

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  amount: real('amount').notNull().default(0),
  category: text('category').notNull(),
  paymentMethod: text('payment_method').notNull().default('cash'), // 'cash' | 'bank'
  cashSessionId: text('cash_session_id').references(() => cashSessions.id),
  notes: text('notes'),
  expenseDate: text('expense_date').notNull(),
  createdAt: text('created_at').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const heldOrders = sqliteTable('held_orders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  referenceName: text('reference_name').notNull(),
  cartDataJson: text('cart_data_json').notNull(),
  createdAt: text('created_at').notNull(),
});
