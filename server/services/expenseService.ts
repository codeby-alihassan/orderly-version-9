import { client } from '../db/index.js';
import { getActiveCashSession } from './cashService.js';

export async function listExpenses(params: { startDate?: string; endDate?: string; category?: string } = {}) {
  let query = `SELECT * FROM expenses WHERE 1=1`;
  const args: any[] = [];

  if (params.startDate) {
    query += ` AND expense_date >= ?`;
    args.push(params.startDate);
  }

  if (params.endDate) {
    query += ` AND expense_date <= ?`;
    args.push(params.endDate);
  }

  if (params.category && params.category !== 'all') {
    query += ` AND category = ?`;
    args.push(params.category);
  }

  query += ` ORDER BY expense_date DESC, created_at DESC`;

  const res = await client.execute({ sql: query, args });

  return res.rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    amount: Number(r.amount),
    category: String(r.category),
    paymentMethod: String(r.payment_method),
    cashSessionId: r.cash_session_id ? String(r.cash_session_id) : null,
    notes: r.notes ? String(r.notes) : null,
    expenseDate: String(r.expense_date),
    createdAt: String(r.created_at),
  }));
}

export async function createExpense(data: {
  title: string;
  amount: number;
  category: string;
  paymentMethod: 'cash' | 'bank';
  notes?: string | null;
  expenseDate?: string;
}) {
  if (!data.title.trim()) throw new Error('Expense title is required');
  if (isNaN(data.amount) || data.amount <= 0) throw new Error('Expense amount must be greater than zero');
  if (!data.category.trim()) throw new Error('Expense category is required');

  const now = new Date().toISOString();
  const expenseId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const expenseDate = data.expenseDate || now.slice(0, 10);

  // Check active session if cash
  let activeSessionId: string | null = null;
  if (data.paymentMethod === 'cash') {
    const sessionRes = await getActiveCashSession();
    if (sessionRes?.session) {
      activeSessionId = sessionRes.session.id;
    }
  }

  const tx = await client.transaction('write');
  try {
    // 1. Insert expense
    await tx.execute({
      sql: `
        INSERT INTO expenses (id, title, amount, category, payment_method, cash_session_id, notes, expense_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        expenseId,
        data.title.trim(),
        data.amount,
        data.category.trim(),
        data.paymentMethod,
        activeSessionId || null,
        data.notes?.trim() || null,
        expenseDate,
        now,
      ],
    });

    // 2. If Cash expense, Current Cash DECREASES
    if (data.paymentMethod === 'cash' && activeSessionId) {
      await tx.execute({
        sql: `
          INSERT INTO cash_movements (id, cash_session_id, type, amount, reference_id, description, created_at)
          VALUES (?, ?, 'expense', ?, ?, ?, ?)
        `,
        args: [
          `cm_${Date.now()}_exp`,
          activeSessionId,
          -data.amount,
          expenseId,
          `Expense: ${data.title.trim()}`,
          now,
        ],
      });
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  return {
    id: expenseId,
    title: data.title.trim(),
    amount: data.amount,
    category: data.category.trim(),
    paymentMethod: data.paymentMethod,
    cashSessionId: activeSessionId,
    notes: data.notes?.trim() || null,
    expenseDate,
    createdAt: now,
  };
}

export async function deleteExpense(id: string) {
  const expRes = await client.execute({
    sql: 'SELECT * FROM expenses WHERE id = ?',
    args: [id],
  });

  if (expRes.rows.length === 0) throw new Error('Expense not found');
  const exp = expRes.rows[0];

  const now = new Date().toISOString();
  const tx = await client.transaction('write');
  try {
    // If it was cash and linked to session, reverse the movement
    if (exp.payment_method === 'cash' && exp.cash_session_id) {
      await tx.execute({
        sql: `
          INSERT INTO cash_movements (id, cash_session_id, type, amount, reference_id, description, created_at)
          VALUES (?, ?, 'manual_in', ?, ?, ?, ?)
        `,
        args: [
          `cm_${Date.now()}_revexp`,
          String(exp.cash_session_id),
          Number(exp.amount),
          id,
          `Reversed Expense: ${exp.title}`,
          now,
        ],
      });
    }

    await tx.execute({
      sql: 'DELETE FROM expenses WHERE id = ?',
      args: [id],
    });

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  return { success: true };
}
