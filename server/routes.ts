import express, { Request, Response, NextFunction } from 'express';
import {
  loginUser,
  getUserByToken,
  logoutUser,
  updatePassword,
  updateAdminCredentials,
  listUsers,
  createUser,
  getSetupStatus,
  setupInitialAdmin,
  deleteUser,
  updateUserPermissions,
} from './services/authService.js';
import {
  getActiveCashSession,
  openCounter,
  closeCounter,
  addManualCashAdjustment,
  getCashMovements,
  listCashSessions,
} from './services/cashService.js';
import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  adjustStock,
  deleteProduct,
  listCategories,
  createCategory,
  deleteCategory,
} from './services/productService.js';
import { listPurchases, getPurchaseById, createPurchase } from './services/purchaseService.js';
import { checkoutSale, listSales, getSaleById, cancelSale } from './services/saleService.js';
import {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  recordCustomerPayment,
  adjustCustomerCredit,
  deleteCustomer,
} from './services/customerService.js';
import { listExpenses, createExpense, deleteExpense } from './services/expenseService.js';
import {
  getDashboardStats,
  getChartData,
  getPaymentMethodBreakdown,
  getTopSellingProducts,
} from './services/analyticsService.js';
import {
  getAllSettings,
  updateMultipleSettings,
  getKeyboardShortcuts,
  updateKeyboardShortcuts,
  exportDatabaseData,
  restoreDatabaseData,
} from './services/settingsService.js';
import { listHeldOrders, holdOrder, deleteHeldOrder } from './services/heldOrdersService.js';

export const apiRouter = express.Router();

// Middleware to extract authenticated user from Bearer token
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    (req as any).user = null;
    return next();
  }

  const token = authHeader.substring(7).trim();
  try {
    const user = await getUserByToken(token);
    (req as any).user = user;
    (req as any).token = token;
  } catch {
    (req as any).user = null;
  }
  next();
}

apiRouter.use(authMiddleware);

// --- AUTH ROUTES ---
apiRouter.get('/auth/setup-status', async (req, res) => {
  try {
    const status = await getSetupStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/auth/setup', async (req, res) => {
  try {
    const session = await setupInitialAdmin(req.body);
    res.json(session);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || password === undefined || password === null || password === '') {
      return res.status(400).json({ error: 'Username and password or PIN are required' });
    }
    const session = await loginUser(username, password);
    if (!session) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    res.json(session);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Login failed' });
  }
});

apiRouter.get('/auth/me', (req, res) => {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user });
});

apiRouter.post('/auth/logout', async (req, res) => {
  const token = (req as any).token;
  if (token) {
    await logoutUser(token);
  }
  res.json({ success: true });
});

apiRouter.post('/auth/password', async (req, res) => {
  const user = (req as any).user;
  const targetId = user?.id || req.body.userId || req.body.username || 'admin';

  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }
    await updatePassword(targetId, currentPassword, newPassword);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/auth/credentials', async (req, res) => {
  const user = (req as any).user;
  const targetId = user?.id || req.body.userId || req.body.username || 'admin';

  try {
    const { currentPassword, newUsername, newPassword, name } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required to verify changes.' });
    }
    const updatedUser = await updateAdminCredentials(targetId, {
      currentPassword,
      newUsername,
      newPassword,
      name,
    });
    res.json({ success: true, message: 'Credentials updated successfully', user: updatedUser });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/auth/users', async (req, res) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/auth/users', async (req, res) => {
  try {
    const { name, username, pin, role, permissions } = req.body;
    if (!name || !pin) {
      return res.status(400).json({ error: 'Name and PIN required' });
    }
    const user = await createUser({
      name,
      username,
      pin,
      role: role || 'cashier',
      permissions: Array.isArray(permissions) ? permissions : undefined,
    });
    res.status(201).json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/auth/users/:id/permissions', async (req, res) => {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can update staff permissions.' });
  }
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array of module names.' });
    }
    const result = await updateUserPermissions(req.params.id, permissions);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/auth/users/:id', async (req, res) => {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can remove staff accounts.' });
  }
  try {
    const result = await deleteUser(req.params.id, user.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- CASH / COUNTER MANAGEMENT ---
apiRouter.get('/cash/active', async (req, res) => {
  try {
    const summary = await getActiveCashSession();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/cash/open', async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  try {
    const { openingCash, notes } = req.body;
    const summary = await openCounter(user.id, Number(openingCash || 0), notes);
    res.json(summary);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/cash/close', async (req, res) => {
  try {
    const { sessionId, actualCash, notes } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Session ID is required' });
    const result = await closeCounter(sessionId, Number(actualCash || 0), notes);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/cash/adjustment', async (req, res) => {
  try {
    const { sessionId, type, amount, description } = req.body;
    if (!sessionId || !type || !amount || !description) {
      return res.status(400).json({ error: 'All adjustment fields are required' });
    }
    const summary = await addManualCashAdjustment(sessionId, type, Number(amount), description);
    res.json(summary);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/cash/movements/:sessionId', async (req, res) => {
  try {
    const movements = await getCashMovements(req.params.sessionId);
    res.json(movements);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/cash/sessions', async (req, res) => {
  try {
    const sessions = await listCashSessions(50);
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- PRODUCT MANAGEMENT ---
apiRouter.get('/products', async (req, res) => {
  try {
    const { search, categoryId, status, activeOnly } = req.query;
    const products = await listProducts({
      search: search as string,
      categoryId: categoryId as string,
      status: status as any,
      activeOnly: activeOnly !== 'false',
    });
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/products/:id', async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/products', async (req, res) => {
  try {
    const product = await createProduct(req.body);
    res.json(product);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/products/:id', async (req, res) => {
  try {
    const product = await updateProduct(req.params.id, req.body);
    res.json(product);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/products/:id/adjust', async (req, res) => {
  try {
    const { newStock, reason } = req.body;
    const product = await adjustStock(req.params.id, Number(newStock), reason);
    res.json(product);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/products/:id', async (req, res) => {
  try {
    const result = await deleteProduct(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/categories', async (req, res) => {
  try {
    const categories = await listCategories();
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/categories', async (req, res) => {
  try {
    const { name, description } = req.body;
    const cat = await createCategory(name, description);
    res.json(cat);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/categories/:id', async (req, res) => {
  try {
    const result = await deleteCategory(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- PURCHASES & INVENTORY REPLENISHMENT ---
apiRouter.get('/purchases', async (req, res) => {
  try {
    const { search, startDate, endDate } = req.query;
    const purchases = await listPurchases({
      search: search as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    res.json(purchases);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/purchases/:id', async (req, res) => {
  try {
    const purchase = await getPurchaseById(req.params.id);
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    res.json(purchase);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/purchases', async (req, res) => {
  try {
    const purchase = await createPurchase(req.body);
    res.json(purchase);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- SALES (POS CHECKOUT, INVOICES & VOIDS) ---
apiRouter.post('/sales/checkout', async (req, res) => {
  const user = (req as any).user;
  const userId = user?.id || req.body.userId || 'user_admin_1';

  try {
    const sale = await checkoutSale({
      ...req.body,
      userId,
    });
    res.json(sale);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/sales', async (req, res) => {
  try {
    const { search, startDate, endDate, tzOffset, paymentMethod, status, limit } = req.query;
    const sales = await listSales({
      search: search as string,
      startDate: startDate as string,
      endDate: endDate as string,
      tzOffset: tzOffset as string,
      paymentMethod: paymentMethod as string,
      status: status as string,
      limit: limit ? Number(limit) : 100,
    });
    res.json(sales);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/sales/:id', async (req, res) => {
  try {
    const sale = await getSaleById(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    res.json(sale);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/sales/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body;
    const sale = await cancelSale(req.params.id, reason);
    res.json(sale);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- CREDIT / CUSTOMERS ---
apiRouter.get('/customers', async (req, res) => {
  try {
    const { search } = req.query;
    const customers = await listCustomers(search as string);
    res.json(customers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/customers/:id', async (req, res) => {
  try {
    const customer = await getCustomerById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/customers', async (req, res) => {
  try {
    const customer = await createCustomer(req.body);
    res.json(customer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/customers/:id', async (req, res) => {
  try {
    const customer = await updateCustomer(req.params.id, req.body);
    res.json(customer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/customers/payment', async (req, res) => {
  try {
    const customer = await recordCustomerPayment(req.body);
    res.json(customer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/customers/adjust', async (req, res) => {
  try {
    const customer = await adjustCustomerCredit(req.body);
    res.json(customer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/customers/:id', async (req, res) => {
  try {
    const result = await deleteCustomer(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- EXPENSES ---
apiRouter.get('/expenses', async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;
    const expenses = await listExpenses({
      startDate: startDate as string,
      endDate: endDate as string,
      category: category as string,
    });
    res.json(expenses);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/expenses', async (req, res) => {
  try {
    const expense = await createExpense(req.body);
    res.json(expense);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/expenses/:id', async (req, res) => {
  try {
    const result = await deleteExpense(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- DASHBOARD & ANALYTICS ---
apiRouter.get('/analytics/dashboard', async (req, res) => {
  try {
    const { startDate, endDate, tzOffset } = req.query;
    const stats = await getDashboardStats(
      startDate && endDate ? { startDate: String(startDate), endDate: String(endDate) } : undefined,
      tzOffset as string
    );
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/analytics/charts', async (req, res) => {
  try {
    const { range, customStart, customEnd, tzOffset } = req.query;
    const chart = await getChartData(range as any, customStart as string, customEnd as string, tzOffset as string);
    res.json(chart);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/analytics/payments', async (req, res) => {
  try {
    const { range, customStart, customEnd, tzOffset } = req.query;
    const data = await getPaymentMethodBreakdown(
      range as string,
      customStart as string,
      customEnd as string,
      tzOffset as string
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/analytics/top-products', async (req, res) => {
  try {
    const products = await getTopSellingProducts(8);
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- SETTINGS & KEYBOARD SHORTCUTS ---
apiRouter.get('/settings', async (req, res) => {
  try {
    const settings = await getAllSettings();
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post(['/settings', '/settings/profile', '/profile'], async (req, res) => {
  try {
    const updated = await updateMultipleSettings(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/settings/shortcuts', async (req, res) => {
  try {
    const shortcuts = await getKeyboardShortcuts();
    res.json(shortcuts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/settings/shortcuts', async (req, res) => {
  try {
    const shortcuts = await updateKeyboardShortcuts(req.body);
    res.json(shortcuts);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/settings/export', async (req, res) => {
  try {
    const dump = await exportDatabaseData();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=orderly_backup_${Date.now()}.json`);
    res.json(dump);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/settings/restore', async (req, res) => {
  try {
    const result = await restoreDatabaseData(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- HELD ORDERS ---
apiRouter.get('/held-orders', async (req, res) => {
  try {
    const orders = await listHeldOrders();
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/held-orders', async (req, res) => {
  const user = (req as any).user;
  const userId = user ? user.id : 'user_admin_1';
  try {
    const { referenceName, cartData } = req.body;
    const order = await holdOrder(userId, referenceName, cartData);
    res.json(order);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/held-orders/:id', async (req, res) => {
  try {
    const result = await deleteHeldOrder(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- GLOBAL SEARCH ---
apiRouter.get('/global-search', async (req, res) => {
  const q = req.query.q as string;
  if (!q || !q.trim()) {
    return res.json({ products: [], customers: [], sales: [] });
  }

  try {
    const term = `%${q.trim().toLowerCase()}%`;
    const [products, customers, sales] = await Promise.all([
      listProducts({ search: q, limit: 5 } as any),
      listCustomers(q),
      listSales({ search: q, limit: 5 }),
    ]);

    res.json({
      products: products.slice(0, 5),
      customers: customers.slice(0, 5),
      sales: sales.slice(0, 5),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
