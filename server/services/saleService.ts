import { client } from '../db/index.js';
import { getActiveCashSession } from './cashService.js';

export interface CartItemInput {
  productId: string;
  productName: string;
  sku: string;
  unitCost: number;
  unitPrice: number;
  quantity: number;
}

export interface CheckoutSaleInput {
  items: CartItemInput[];
  customerId?: string | null;
  userId: string;
  cashSessionId?: string | null;
  subtotal: number;
  discount?: number;
  tax?: number;
  grandTotal: number;
  paymentMethod: 'cash' | 'bank' | 'credit';
  notes?: string;
}

export async function checkoutSale(data: CheckoutSaleInput) {
  if (!data.items || data.items.length === 0) {
    throw new Error('Cart cannot be empty for checkout');
  }

  // 1. Resolve and validate User ID (guarantee foreign key integrity)
  let validUserId: string = data.userId ? String(data.userId).trim() : '';
  if (validUserId) {
    const uRes = await client.execute({
      sql: 'SELECT id FROM users WHERE id = ?',
      args: [validUserId],
    });
    if (uRes.rows.length === 0) {
      validUserId = '';
    }
  }

  if (!validUserId) {
    // Find first active cashier/admin user
    const firstUser = await client.execute('SELECT id FROM users ORDER BY created_at ASC LIMIT 1');
    if (firstUser.rows.length > 0) {
      validUserId = String(firstUser.rows[0].id);
    } else {
      const nowSeed = new Date().toISOString();
      validUserId = 'user_admin_1';
      await client.execute({
        sql: `INSERT OR IGNORE INTO users (id, username, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          'user_admin_1',
          'admin',
          '$2a$10$wN1Gq8pQv6hJt.Y4CjHwUe9VpS9e7V4CjHwUe9VpS9e7V4CjHwUe',
          'Store Manager',
          'admin',
          nowSeed,
        ],
      });
    }
  }

  // 2. Resolve and validate Customer ID
  let validCustomerId: string | null = null;
  const candidateCustId = data.customerId ? String(data.customerId).trim() : '';
  if (candidateCustId) {
    const cRes = await client.execute({
      sql: 'SELECT id FROM customers WHERE id = ?',
      args: [candidateCustId],
    });
    if (cRes.rows.length > 0) {
      validCustomerId = String(cRes.rows[0].id);
    }
  }

  if (data.paymentMethod === 'credit' && !validCustomerId) {
    throw new Error('Customer selection is mandatory for Credit sales');
  }

  // 3. Resolve and validate Cash Session ID
  let validSessionId: string | null = null;
  const candidateSessionId = data.cashSessionId ? String(data.cashSessionId).trim() : '';
  if (candidateSessionId) {
    const sRes = await client.execute({
      sql: 'SELECT id FROM cash_sessions WHERE id = ?',
      args: [candidateSessionId],
    });
    if (sRes.rows.length > 0) {
      validSessionId = String(sRes.rows[0].id);
    }
  }

  // If no valid session supplied and payment is cash, look for open counter session
  if (!validSessionId && data.paymentMethod === 'cash') {
    const openRes = await client.execute(
      "SELECT id FROM cash_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1"
    );
    if (openRes.rows.length > 0) {
      validSessionId = String(openRes.rows[0].id);
    }
  }

  const now = new Date().toISOString();
  const saleId = `sale_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // Generate guaranteed unique invoice number: INV-YYYY-XXXXX
  const countRes = await client.execute('SELECT COUNT(*) as c FROM sales');
  let count = Number(countRes.rows[0]?.c || 0) + 1;
  const year = new Date().getFullYear();
  let invoiceNumber = `INV-${year}-${String(count).padStart(5, '0')}`;

  let exists = await client.execute({
    sql: 'SELECT id FROM sales WHERE invoice_number = ?',
    args: [invoiceNumber],
  });
  while (exists.rows.length > 0) {
    count++;
    invoiceNumber = `INV-${year}-${String(count).padStart(5, '0')}`;
    exists = await client.execute({
      sql: 'SELECT id FROM sales WHERE invoice_number = ?',
      args: [invoiceNumber],
    });
  }

  const tx = await client.transaction('write');

  try {
    let calculatedSubtotal = 0;
    let calculatedTotalCost = 0;
    const preparedItems: Array<{
      saleItemId: string;
      productId: string;
      productName: string;
      sku: string;
      unitCost: number;
      unitPrice: number;
      quantity: number;
      itemTotalPrice: number;
      itemTotalCost: number;
      itemProfit: number;
    }> = [];

    // 1. Stock validation & calculation in-memory BEFORE ANY INSERT
    for (const item of data.items) {
      if (item.quantity <= 0) {
        throw new Error(`Quantity for ${item.productName || 'item'} must be at least 1`);
      }

      const prodRes = await tx.execute({
        sql: 'SELECT id, name, current_stock, cost_price, selling_price, sku FROM products WHERE id = ?',
        args: [item.productId],
      });

      if (prodRes.rows.length === 0) {
        throw new Error(`Product "${item.productName || item.productId}" not found`);
      }

      const prod = prodRes.rows[0];
      const stock = Number(prod.current_stock || 0);

      if (stock < item.quantity) {
        throw new Error(
          `Insufficient stock for "${prod.name}". Available: ${stock}, Requested: ${item.quantity}`
        );
      }

      // Snapshot unit cost and selling prices
      const unitCost = Number(prod.cost_price ?? item.unitCost ?? 0);
      const unitPrice = Number(item.unitPrice);
      const itemTotalPrice = Number((unitPrice * item.quantity).toFixed(2));
      const itemTotalCost = Number((unitCost * item.quantity).toFixed(2));
      const itemProfit = Number((itemTotalPrice - itemTotalCost).toFixed(2));

      calculatedSubtotal += itemTotalPrice;
      calculatedTotalCost += itemTotalCost;

      const saleItemId = `sitem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      preparedItems.push({
        saleItemId,
        productId: String(prod.id),
        productName: String(prod.name),
        sku: String(prod.sku),
        unitCost,
        unitPrice,
        quantity: item.quantity,
        itemTotalPrice,
        itemTotalCost,
        itemProfit,
      });
    }

    const discount = Number(data.discount || 0);
    const tax = Number(data.tax || 0);
    const grandTotal = Number(Math.max(0, calculatedSubtotal - discount + tax).toFixed(2));
    const profit = Number((grandTotal - calculatedTotalCost).toFixed(2));

    // 2. CRITICAL INSERTION ORDER: Insert parent "sales" record FIRST!
    await tx.execute({
      sql: `
        INSERT INTO sales (
          id, invoice_number, customer_id, user_id, cash_session_id, subtotal,
          discount, tax, grand_total, total_cost, profit, payment_method,
          payment_status, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        saleId,
        invoiceNumber,
        validCustomerId,
        validUserId,
        validSessionId,
        Number(calculatedSubtotal.toFixed(2)),
        discount,
        tax,
        grandTotal,
        Number(calculatedTotalCost.toFixed(2)),
        profit,
        data.paymentMethod,
        data.paymentMethod === 'credit' ? 'credit' : 'completed',
        data.notes?.trim() || null,
        now,
      ],
    });

    // 3. Insert child "sale_items" records (foreign key sales(id) is now satisfied) & update stock
    for (const item of preparedItems) {
      await tx.execute({
        sql: `
          INSERT INTO sale_items (
            id, sale_id, product_id, product_name, sku, unit_cost, unit_price,
            quantity, total_price, total_cost, profit
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          item.saleItemId,
          saleId,
          item.productId,
          item.productName,
          item.sku,
          item.unitCost,
          item.unitPrice,
          item.quantity,
          item.itemTotalPrice,
          item.itemTotalCost,
          item.itemProfit,
        ],
      });

      // Atomically decrease product current stock
      await tx.execute({
        sql: `UPDATE products SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?`,
        args: [item.quantity, now, item.productId],
      });
    }

    // 4. Payment method specific handling
    if (data.paymentMethod === 'cash' && validSessionId) {
      // Physical cash increases in active drawer
      await tx.execute({
        sql: `
          INSERT INTO cash_movements (id, cash_session_id, type, amount, reference_id, description, created_at)
          VALUES (?, ?, 'sale', ?, ?, ?, ?)
        `,
        args: [
          `cm_${Date.now()}_sale`,
          validSessionId,
          grandTotal,
          saleId,
          `Cash Sale: ${invoiceNumber}`,
          now,
        ],
      });
    } else if (data.paymentMethod === 'credit' && validCustomerId) {
      // Customer balance increases
      const custRes = await tx.execute({
        sql: 'SELECT id, name, current_balance FROM customers WHERE id = ?',
        args: [validCustomerId],
      });

      if (custRes.rows.length === 0) {
        throw new Error('Selected customer not found');
      }

      const cust = custRes.rows[0];
      const prevBal = Number(cust.current_balance || 0);
      const newBal = Number((prevBal + grandTotal).toFixed(2));

      await tx.execute({
        sql: 'UPDATE customers SET current_balance = ?, updated_at = ? WHERE id = ?',
        args: [newBal, now, validCustomerId],
      });

      // Record customer transaction (referencing customer_id and sale_id)
      await tx.execute({
        sql: `
          INSERT INTO customer_transactions (
            id, customer_id, sale_id, type, payment_method, amount, balance_after, description, created_at
          ) VALUES (?, ?, ?, 'credit_sale', null, ?, ?, ?, ?)
        `,
        args: [
          `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          validCustomerId,
          saleId,
          grandTotal,
          newBal,
          `Credit Sale: ${invoiceNumber}`,
          now,
        ],
      });
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  return getSaleById(saleId);
}

export async function getSaleById(id: string) {
  const saleRes = await client.execute({
    sql: `
      SELECT s.*, c.name as customer_name, c.phone as customer_phone, u.name as cashier_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ? OR s.invoice_number = ?
    `,
    args: [id, id],
  });

  if (saleRes.rows.length === 0) return null;
  const s = saleRes.rows[0];

  const itemsRes = await client.execute({
    sql: 'SELECT * FROM sale_items WHERE sale_id = ?',
    args: [String(s.id)],
  });

  return {
    id: String(s.id),
    invoiceNumber: String(s.invoice_number),
    customerId: s.customer_id ? String(s.customer_id) : null,
    customerName: s.customer_name ? String(s.customer_name) : null,
    customerPhone: s.customer_phone ? String(s.customer_phone) : null,
    cashierName: s.cashier_name ? String(s.cashier_name) : 'Cashier',
    userId: String(s.user_id),
    cashSessionId: s.cash_session_id ? String(s.cash_session_id) : null,
    subtotal: Number(s.subtotal),
    discount: Number(s.discount),
    tax: Number(s.tax),
    grandTotal: Number(s.grand_total),
    totalCost: Number(s.total_cost),
    profit: Number(s.profit),
    paymentMethod: String(s.payment_method),
    paymentStatus: String(s.payment_status),
    notes: s.notes ? String(s.notes) : null,
    createdAt: String(s.created_at),
    items: itemsRes.rows.map((item) => ({
      id: String(item.id),
      productId: String(item.product_id),
      productName: String(item.product_name),
      sku: String(item.sku),
      unitCost: Number(item.unit_cost),
      unitPrice: Number(item.unit_price),
      quantity: Number(item.quantity),
      totalPrice: Number(item.total_price),
      totalCost: Number(item.total_cost),
      profit: Number(item.profit),
    })),
  };
}

export async function listSales(params: {
  search?: string;
  startDate?: string;
  endDate?: string;
  tzOffset?: number | string;
  paymentMethod?: string;
  status?: string;
  limit?: number;
} = {}) {
  let query = `
    SELECT s.*, c.name as customer_name, u.name as cashier_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE 1=1
  `;
  const args: any[] = [];

  if (params.search && params.search.trim()) {
    const s = `%${params.search.trim().toLowerCase()}%`;
    query += ` AND (LOWER(s.invoice_number) LIKE ? OR LOWER(COALESCE(c.name, '')) LIKE ?)`;
    args.push(s, s);
  }

  const offsetMin = params.tzOffset !== undefined && params.tzOffset !== null ? (parseInt(String(params.tzOffset), 10) || 0) : 0;

  if (params.startDate) {
    let start = params.startDate;
    if (params.startDate.length === 10) {
      const epoch = new Date(`${params.startDate}T00:00:00.000Z`).getTime() + offsetMin * 60000;
      start = new Date(epoch).toISOString();
    }
    query += ` AND (CASE WHEN length(s.created_at) = 10 THEN replace(s.created_at, ' ', 'T') || 'T00:00:00.000Z' ELSE replace(s.created_at, ' ', 'T') END) >= ?`;
    args.push(start);
  }

  if (params.endDate) {
    let end = params.endDate;
    if (params.endDate.length === 10) {
      const epoch = new Date(`${params.endDate}T23:59:59.999Z`).getTime() + offsetMin * 60000;
      end = new Date(epoch).toISOString();
    }
    query += ` AND (CASE WHEN length(s.created_at) = 10 THEN replace(s.created_at, ' ', 'T') || 'T23:59:59.999Z' ELSE replace(s.created_at, ' ', 'T') END) <= ?`;
    args.push(end);
  }

  if (params.paymentMethod && params.paymentMethod !== 'all') {
    query += ` AND s.payment_method = ?`;
    args.push(params.paymentMethod);
  }

  if (params.status && params.status !== 'all') {
    query += ` AND s.payment_status = ?`;
    args.push(params.status);
  }

  query += ` ORDER BY s.created_at DESC LIMIT ?`;
  args.push(params.limit || 500);

  const result = await client.execute({ sql: query, args });

  return result.rows.map((s) => ({
    id: String(s.id),
    invoiceNumber: String(s.invoice_number),
    customerName: s.customer_name ? String(s.customer_name) : null,
    cashierName: s.cashier_name ? String(s.cashier_name) : 'Cashier',
    subtotal: Number(s.subtotal),
    discount: Number(s.discount),
    tax: Number(s.tax),
    grandTotal: Number(s.grand_total),
    profit: Number(s.profit),
    paymentMethod: String(s.payment_method),
    paymentStatus: String(s.payment_status),
    createdAt: String(s.created_at),
  }));
}

export async function cancelSale(saleId: string, reason: string) {
  const sale = await getSaleById(saleId);
  if (!sale) throw new Error('Sale not found');
  if (sale.paymentStatus === 'cancelled') {
    throw new Error('This sale is already cancelled');
  }

  const now = new Date().toISOString();
  const tx = await client.transaction('write');

  try {
    // 1. Restore product inventory
    for (const item of sale.items) {
      await tx.execute({
        sql: `UPDATE products SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?`,
        args: [item.quantity, now, item.productId],
      });
    }

    // 2. Revert cash movement if cash
    if (sale.paymentMethod === 'cash' && sale.cashSessionId) {
      await tx.execute({
        sql: `
          INSERT INTO cash_movements (id, cash_session_id, type, amount, reference_id, description, created_at)
          VALUES (?, ?, 'manual_out', ?, ?, ?, ?)
        `,
        args: [
          `cm_${Date.now()}_void`,
          sale.cashSessionId,
          -sale.grandTotal,
          sale.id,
          `Cancelled Sale ${sale.invoiceNumber}: ${reason || 'Voided'}`,
          now,
        ],
      });
    }

    // 3. Revert customer balance if credit
    if (sale.paymentMethod === 'credit' && sale.customerId) {
      const custRes = await tx.execute({
        sql: 'SELECT current_balance FROM customers WHERE id = ?',
        args: [sale.customerId],
      });

      if (custRes.rows.length > 0) {
        const currentBal = Number(custRes.rows[0].current_balance || 0);
        const newBal = Number((currentBal - sale.grandTotal).toFixed(2));

        await tx.execute({
          sql: 'UPDATE customers SET current_balance = ?, updated_at = ? WHERE id = ?',
          args: [newBal, now, sale.customerId],
        });

        await tx.execute({
          sql: `
            INSERT INTO customer_transactions (
              id, customer_id, sale_id, type, payment_method, amount, balance_after, description, created_at
            ) VALUES (?, ?, ?, 'adjustment_debit', null, ?, ?, ?, ?)
          `,
          args: [
            `ctx_${Date.now()}_void`,
            sale.customerId,
            sale.id,
            sale.grandTotal,
            newBal,
            `Voided Credit Sale: ${sale.invoiceNumber} (${reason || 'Cancelled'})`,
            now,
          ],
        });
      }
    }

    // 4. Mark sale as cancelled
    await tx.execute({
      sql: `UPDATE sales SET payment_status = 'cancelled', notes = COALESCE(notes || ' | ', '') || ? WHERE id = ?`,
      args: [`CANCELLED: ${reason || 'User cancelled'} (${now})`, saleId],
    });

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  return getSaleById(saleId);
}
