import { client } from '../db/index.js';
import { getActiveCashSession } from './cashService.js';

export async function listCustomers(search?: string) {
  let query = `SELECT * FROM customers WHERE 1=1`;
  const args: any[] = [];

  if (search && search.trim()) {
    const s = `%${search.trim().toLowerCase()}%`;
    query += ` AND (LOWER(name) LIKE ? OR LOWER(phone) LIKE ?)`;
    args.push(s, s);
  }

  query += ` ORDER BY current_balance DESC, name ASC`;

  const res = await client.execute({ sql: query, args });

  // For each customer, get latest transaction date
  const customers = [];
  for (const r of res.rows) {
    const custId = String(r.id);
    const lastTx = await client.execute({
      sql: 'SELECT created_at, description, amount, type FROM customer_transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1',
      args: [custId],
    });

    const tx = lastTx.rows[0];

    customers.push({
      id: custId,
      name: String(r.name),
      phone: String(r.phone),
      address: r.address ? String(r.address) : null,
      notes: r.notes ? String(r.notes) : null,
      openingBalance: Number(r.opening_balance || 0),
      currentBalance: Number(r.current_balance || 0),
      lastTransactionDate: tx ? String(tx.created_at) : null,
      lastTransactionDesc: tx ? String(tx.description) : null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    });
  }

  return customers;
}

export async function getCustomerById(id: string) {
  const res = await client.execute({
    sql: 'SELECT * FROM customers WHERE id = ?',
    args: [id],
  });

  if (res.rows.length === 0) return null;
  const r = res.rows[0];

  // Fetch full ledger transactions
  const txRes = await client.execute({
    sql: `
      SELECT ct.*, s.invoice_number
      FROM customer_transactions ct
      LEFT JOIN sales s ON ct.sale_id = s.id
      WHERE ct.customer_id = ?
      ORDER BY ct.created_at DESC
    `,
    args: [id],
  });

  return {
    id: String(r.id),
    name: String(r.name),
    phone: String(r.phone),
    address: r.address ? String(r.address) : null,
    notes: r.notes ? String(r.notes) : null,
    openingBalance: Number(r.opening_balance || 0),
    currentBalance: Number(r.current_balance || 0),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    ledger: txRes.rows.map((t) => ({
      id: String(t.id),
      customerId: String(t.customer_id),
      saleId: t.sale_id ? String(t.sale_id) : null,
      invoiceNumber: t.invoice_number ? String(t.invoice_number) : null,
      type: String(t.type),
      paymentMethod: t.payment_method ? String(t.payment_method) : null,
      amount: Number(t.amount),
      balanceAfter: Number(t.balance_after),
      description: String(t.description),
      createdAt: String(t.created_at),
    })),
  };
}

export async function createCustomer(data: {
  name: string;
  phone: string;
  address?: string | null;
  notes?: string | null;
  openingBalance?: number;
}) {
  if (!data.name.trim()) throw new Error('Customer name is required');
  if (!data.phone.trim()) throw new Error('Customer phone is required');

  const existing = await client.execute({
    sql: 'SELECT id FROM customers WHERE phone = ?',
    args: [data.phone.trim()],
  });
  if (existing.rows.length > 0) {
    throw new Error('A customer with this phone number already exists.');
  }

  const id = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const openBal = Number(data.openingBalance || 0);

  const tx = await client.transaction('write');
  try {
    await tx.execute({
      sql: `
        INSERT INTO customers (id, name, phone, address, notes, opening_balance, current_balance, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        data.name.trim(),
        data.phone.trim(),
        data.address?.trim() || null,
        data.notes?.trim() || null,
        openBal,
        openBal,
        now,
        now,
      ],
    });

    if (openBal > 0) {
      await tx.execute({
        sql: `
          INSERT INTO customer_transactions (id, customer_id, type, amount, balance_after, description, created_at)
          VALUES (?, ?, 'credit_sale', ?, ?, 'Initial opening balance', ?)
        `,
        args: [`ctx_${Date.now()}_init`, id, openBal, openBal, now],
      });
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  return getCustomerById(id);
}

export async function updateCustomer(
  id: string,
  data: {
    name: string;
    phone: string;
    address?: string | null;
    notes?: string | null;
  }
) {
  if (!data.name.trim()) throw new Error('Customer name is required');
  if (!data.phone.trim()) throw new Error('Customer phone is required');

  const existing = await client.execute({
    sql: 'SELECT id FROM customers WHERE phone = ? AND id != ?',
    args: [data.phone.trim(), id],
  });
  if (existing.rows.length > 0) {
    throw new Error('Another customer already has this phone number.');
  }

  const now = new Date().toISOString();
  await client.execute({
    sql: `
      UPDATE customers
      SET name = ?, phone = ?, address = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `,
    args: [data.name.trim(), data.phone.trim(), data.address?.trim() || null, data.notes?.trim() || null, now, id],
  });

  return getCustomerById(id);
}

export async function recordCustomerPayment(data: {
  customerId: string;
  amount: number;
  paymentMethod: 'cash' | 'bank';
  notes?: string;
}) {
  if (isNaN(data.amount) || data.amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const cust = await getCustomerById(data.customerId);
  if (!cust) throw new Error('Customer not found');

  const now = new Date().toISOString();
  const prevBal = cust.currentBalance;
  const newBal = Number((prevBal - data.amount).toFixed(2));

  // Determine active session if paying in cash
  let activeSessionId: string | null = null;
  if (data.paymentMethod === 'cash') {
    const sessionRes = await getActiveCashSession();
    if (sessionRes?.session) {
      activeSessionId = sessionRes.session.id;
    }
  }

  const tx = await client.transaction('write');
  try {
    // 1. Update customer balance
    await tx.execute({
      sql: 'UPDATE customers SET current_balance = ?, updated_at = ? WHERE id = ?',
      args: [newBal, now, data.customerId],
    });

    // 2. Insert ledger transaction
    const desc = data.notes?.trim() || `Payment received via ${data.paymentMethod === 'cash' ? 'Cash' : 'Bank Transfer'}`;
    const txId = `ctx_${Date.now()}_pay`;
    await tx.execute({
      sql: `
        INSERT INTO customer_transactions (
          id, customer_id, type, payment_method, amount, balance_after, description, created_at
        ) VALUES (?, ?, 'payment_received', ?, ?, ?, ?, ?)
      `,
      args: [txId, data.customerId, data.paymentMethod, data.amount, newBal, desc, now],
    });

    // 3. If Cash payment, Current Cash INCREASES
    if (data.paymentMethod === 'cash' && activeSessionId) {
      await tx.execute({
        sql: `
          INSERT INTO cash_movements (id, cash_session_id, type, amount, reference_id, description, created_at)
          VALUES (?, ?, 'customer_payment', ?, ?, ?, ?)
        `,
        args: [
          `cm_${Date.now()}_cpay`,
          activeSessionId,
          data.amount,
          txId,
          `Customer Payment from ${cust.name}`,
          now,
        ],
      });
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  return getCustomerById(data.customerId);
}

export async function adjustCustomerCredit(data: {
  customerId: string;
  type: 'adjustment_credit' | 'adjustment_debit';
  amount: number;
  description: string;
}) {
  if (isNaN(data.amount) || data.amount <= 0) {
    throw new Error('Adjustment amount must be greater than zero');
  }
  if (!data.description.trim()) {
    throw new Error('Description is required for credit adjustments');
  }

  const cust = await getCustomerById(data.customerId);
  if (!cust) throw new Error('Customer not found');

  const now = new Date().toISOString();
  // If adjustment_credit (increasing debt): balance goes UP
  // If adjustment_debit (reducing debt/discount): balance goes DOWN
  const newBal =
    data.type === 'adjustment_credit'
      ? Number((cust.currentBalance + data.amount).toFixed(2))
      : Number((cust.currentBalance - data.amount).toFixed(2));

  const tx = await client.transaction('write');
  try {
    await tx.execute({
      sql: 'UPDATE customers SET current_balance = ?, updated_at = ? WHERE id = ?',
      args: [newBal, now, data.customerId],
    });

    await tx.execute({
      sql: `
        INSERT INTO customer_transactions (
          id, customer_id, type, amount, balance_after, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        `ctx_${Date.now()}_adj`,
        data.customerId,
        data.type,
        data.amount,
        newBal,
        data.description.trim(),
        now,
      ],
    });

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  return getCustomerById(data.customerId);
}

export async function deleteCustomer(id: string) {
  const cust = await getCustomerById(id);
  if (!cust) {
    throw new Error('Customer not found');
  }

  // Active credit balance check
  if (Math.abs(cust.currentBalance) > 0.001) {
    throw new Error(
      `Cannot delete customer "${cust.name}" because they have an active outstanding credit/balance of ${cust.currentBalance}. Outstanding balance must be settled to 0 before deleting.`
    );
  }

  const tx = await client.transaction('write');
  try {
    // Preserve invoice history: detach customer_id from past sales
    await tx.execute({
      sql: 'UPDATE sales SET customer_id = NULL WHERE customer_id = ?',
      args: [id],
    });

    // Delete customer transaction ledger records
    await tx.execute({
      sql: 'DELETE FROM customer_transactions WHERE customer_id = ?',
      args: [id],
    });

    // Delete customer record
    await tx.execute({
      sql: 'DELETE FROM customers WHERE id = ?',
      args: [id],
    });

    await tx.commit();
    return { success: true, message: `Customer "${cust.name}" deleted successfully.` };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}
