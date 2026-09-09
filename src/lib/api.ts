const AUTH_TOKEN_KEY = 'orderly_pos_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function removeStoredToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401 && !endpoint.includes('/api/auth/login')) {
    removeStoredToken();
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Network request failed');
  }

  return data as T;
}

export const api = {
  // Auth
  getSetupStatus: () => apiRequest<{ setupRequired: boolean; hasUsers: boolean }>('/api/auth/setup-status'),
  setupAdmin: (data: { name: string; username: string; password: string; storeName?: string; currency?: string }) =>
    apiRequest<{ token: string; user: any }>('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  login: (username: string, password: string) =>
    apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  getMe: () => apiRequest('/api/auth/me'),
  logout: () => apiRequest('/api/auth/logout', { method: 'POST' }),
  updatePassword: (currentPassword: string, newPassword: string) =>
    apiRequest('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  updateCredentials: (data: { currentPassword: string; newUsername?: string; newPassword?: string; name?: string }) =>
    apiRequest<{ success: boolean; message: string; user: any }>('/api/auth/credentials', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Cash / Counter
  getActiveCash: () => apiRequest('/api/cash/active'),
  openCounter: (openingCash: number, notes?: string) =>
    apiRequest('/api/cash/open', {
      method: 'POST',
      body: JSON.stringify({ openingCash, notes }),
    }),
  closeCounter: (sessionId: string, actualCash: number, notes?: string) =>
    apiRequest('/api/cash/close', {
      method: 'POST',
      body: JSON.stringify({ sessionId, actualCash, notes }),
    }),
  addCashAdjustment: (sessionId: string, type: 'manual_in' | 'manual_out', amount: number, description: string) =>
    apiRequest('/api/cash/adjustment', {
      method: 'POST',
      body: JSON.stringify({ sessionId, type, amount, description }),
    }),
  getCashMovements: (sessionId: string) => apiRequest(`/api/cash/movements/${sessionId}`),
  getCashSessions: () => apiRequest('/api/cash/sessions'),

  // Products
  getProducts: (params?: { search?: string; categoryId?: string; status?: string; activeOnly?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.categoryId) q.append('categoryId', params.categoryId);
    if (params?.status) q.append('status', params.status);
    if (params?.activeOnly !== undefined) q.append('activeOnly', String(params.activeOnly));
    return apiRequest(`/api/products?${q.toString()}`);
  },
  getProduct: (id: string) => apiRequest(`/api/products/${id}`),
  createProduct: (data: any) => apiRequest('/api/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: any) => apiRequest(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adjustStock: (id: string, newStock: number, reason: string) =>
    apiRequest(`/api/products/${id}/adjust`, { method: 'POST', body: JSON.stringify({ newStock, reason }) }),
  deleteProduct: (id: string) => apiRequest(`/api/products/${id}`, { method: 'DELETE' }),
  getCategories: () => apiRequest('/api/categories'),
  createCategory: (name: string, description?: string) =>
    apiRequest('/api/categories', { method: 'POST', body: JSON.stringify({ name, description }) }),
  deleteCategory: (id: string) =>
    apiRequest<{ success: boolean; message: string }>(`/api/categories/${id}`, { method: 'DELETE' }),

  // Purchases
  getPurchases: (params?: { search?: string; startDate?: string; endDate?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.startDate) q.append('startDate', params.startDate);
    if (params?.endDate) q.append('endDate', params.endDate);
    return apiRequest(`/api/purchases?${q.toString()}`);
  },
  getPurchase: (id: string) => apiRequest(`/api/purchases/${id}`),
  createPurchase: (data: any) => apiRequest('/api/purchases', { method: 'POST', body: JSON.stringify(data) }),

  // Sales (POS & Invoices)
  checkoutSale: (data: any) => apiRequest('/api/sales/checkout', { method: 'POST', body: JSON.stringify(data) }),
  getSales: (params?: { search?: string; startDate?: string; endDate?: string; paymentMethod?: string; status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.startDate) q.append('startDate', params.startDate);
    if (params?.endDate) q.append('endDate', params.endDate);
    if (params?.paymentMethod) q.append('paymentMethod', params.paymentMethod);
    if (params?.status) q.append('status', params.status);
    if (params?.limit) q.append('limit', String(params.limit));
    q.append('tzOffset', String(new Date().getTimezoneOffset()));
    return apiRequest(`/api/sales?${q.toString()}`);
  },
  getSale: (id: string) => apiRequest(`/api/sales/${id}`),
  cancelSale: (id: string, reason: string) => apiRequest(`/api/sales/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Customers (Credit)
  getCustomers: (search?: string) => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiRequest(`/api/customers${q}`);
  },
  getCustomer: (id: string) => apiRequest(`/api/customers/${id}`),
  createCustomer: (data: any) => apiRequest('/api/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: any) => apiRequest(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id: string) => apiRequest<{ success: boolean; message: string }>(`/api/customers/${id}`, { method: 'DELETE' }),
  recordCustomerPayment: (data: any) => apiRequest('/api/customers/payment', { method: 'POST', body: JSON.stringify(data) }),
  adjustCustomerCredit: (data: any) => apiRequest('/api/customers/adjust', { method: 'POST', body: JSON.stringify(data) }),

  // Expenses
  getExpenses: (params?: { startDate?: string; endDate?: string; category?: string }) => {
    const q = new URLSearchParams();
    if (params?.startDate) q.append('startDate', params.startDate);
    if (params?.endDate) q.append('endDate', params.endDate);
    if (params?.category) q.append('category', params.category);
    return apiRequest(`/api/expenses?${q.toString()}`);
  },
  createExpense: (data: any) => apiRequest('/api/expenses', { method: 'POST', body: JSON.stringify(data) }),
  deleteExpense: (id: string) => apiRequest(`/api/expenses/${id}`, { method: 'DELETE' }),

  // Analytics & Dashboard
  getDashboardStats: (params?: { startDate?: string; endDate?: string }) => {
    const q = new URLSearchParams();
    if (params?.startDate) q.append('startDate', params.startDate);
    if (params?.endDate) q.append('endDate', params.endDate);
    q.append('tzOffset', String(new Date().getTimezoneOffset()));
    const qs = q.toString();
    return apiRequest(`/api/analytics/dashboard${qs ? `?${qs}` : ''}`);
  },
  getChartData: (range: string = '7d', customStart?: string, customEnd?: string) => {
    const q = new URLSearchParams({ range });
    if (customStart) q.append('customStart', customStart);
    if (customEnd) q.append('customEnd', customEnd);
    q.append('tzOffset', String(new Date().getTimezoneOffset()));
    return apiRequest(`/api/analytics/charts?${q.toString()}`);
  },
  getPaymentBreakdown: (range: string = '7d', customStart?: string, customEnd?: string) => {
    const q = new URLSearchParams({ range });
    if (customStart) q.append('customStart', customStart);
    if (customEnd) q.append('customEnd', customEnd);
    q.append('tzOffset', String(new Date().getTimezoneOffset()));
    return apiRequest(`/api/analytics/payments?${q.toString()}`);
  },
  getTopProducts: () => apiRequest('/api/analytics/top-products'),

  // Settings & Shortcuts
  getSettings: () => apiRequest('/api/settings'),
  updateSettings: (settings: Record<string, string>) => apiRequest('/api/settings', { method: 'POST', body: JSON.stringify(settings) }),
  updateProfile: (settings: Record<string, string>) => apiRequest('/api/settings', { method: 'POST', body: JSON.stringify(settings) }),
  getKeyboardShortcuts: () => apiRequest('/api/settings/shortcuts'),
  updateKeyboardShortcuts: (shortcuts: any) => apiRequest('/api/settings/shortcuts', { method: 'POST', body: JSON.stringify(shortcuts) }),
  getBackupDump: () => apiRequest('/api/settings/export'),
  exportDatabase: () => window.open('/api/settings/export', '_blank'),
  restoreDatabase: (backup: any) => apiRequest('/api/settings/restore', { method: 'POST', body: JSON.stringify(backup) }),

  // User management
  getUsers: () => apiRequest('/api/auth/users'),
  createUser: (data: any) => apiRequest('/api/auth/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUserPermissions: (userId: string, permissions: string[]) =>
    apiRequest<{ success: boolean; permissions: string[] }>(`/api/auth/users/${userId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    }),
  deleteUser: (id: string) => apiRequest<{ success: boolean }>(`/api/auth/users/${id}`, { method: 'DELETE' }),

  // Held Orders
  getHeldOrders: () => apiRequest('/api/held-orders'),
  holdOrder: (referenceName: string, cartData: any) => apiRequest('/api/held-orders', { method: 'POST', body: JSON.stringify({ referenceName, cartData }) }),
  deleteHeldOrder: (id: string) => apiRequest(`/api/held-orders/${id}`, { method: 'DELETE' }),

  // Global Search
  globalSearch: (q: string) => apiRequest(`/api/global-search?q=${encodeURIComponent(q)}`),
};
