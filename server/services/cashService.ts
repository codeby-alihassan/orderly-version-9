import { client } from '../db/index.js';

export interface CashSessionSummary {
  session: {
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
  } | null;
  breakdown: {
    openingCash: number;
    cashSales: number;
    cashCustomerPayments: number;
    cashExpenses: number;
    manualAdjustments: number;
    currentCash: number;
  };
}

export async function getActiveCashSession(userId?: string): Promise<CashSessionSummary | null> {
  const query = userId
    ? `SELECT cs.*, u.name as user_name FROM cash_sessions cs JOIN users u ON cs.user_id = u.id WHERE cs.status = 'open' AND cs.user_id = ? ORDER BY cs.opened_at DESC LIMIT 1`
    : `SELECT cs.*, u.name as user_name FROM cash_sessions cs JOIN users u ON cs.user_id = u.id WHERE cs.status = 'open' ORDER BY cs.opened_at DESC LIMIT 1`;

  const args = userId ? [userId] : [];
  const result = await client.execute({ sql: query, args });

  if (result.rows.length === 0) {
    return {
      session: null,
      breakdown: {
        openingCash: 0,
        cashSales: 0,
        cashCustomerPayments: 0,
        cashExpenses: 0,
        manualAdjustments: 0,
        currentCash: 0,
      },
    };
  }

  const row = result.rows[0];
  const sessionId = String(row.id);
  const openingCash = Number(row.opening_cash || 0);

  // Calculate live movements for this session
  const movementsRes = await client.execute({
    sql: 'SELECT type, amount FROM cash_movements WHERE cash_session_id = ?',
    args: [sessionId],
  });

  let cashSales = 0;
  let cashCustomerPayments = 0;
  let cashExpenses = 0;
  let manualAdjustments = 0;

  for (const m of movementsRes.rows) {
    const type = String(m.type);
    const amount = Number(m.amount || 0);

    if (type === 'sale') {
      cashSales += amount;
    } else if (type === 'customer_payment') {
      cashCustomerPayments += amount;
    } else if (type === 'expense') {
      // In movements, expenses are stored as negative amounts or absolute amounts
      cashExpenses += Math.abs(amount);
    } else if (type === 'manual_in') {
      manualAdjustments += amount;
    } else if (type === 'manual_out') {
      manualAdjustments -= Math.abs(amount);
    }
  }

  const currentCash = Number(
    (openingCash + cashSales + cashCustomerPayments - cashExpenses + manualAdjustments).toFixed(2)
  );

  return {
    session: {
      id: sessionId,
      userId: String(row.user_id),
      userName: row.user_name ? String(row.user_name) : undefined,
      openingCash,
      closingCash: row.closing_cash !== null ? Number(row.closing_cash) : null,
      expectedCash: row.expected_cash !== null ? Number(row.expected_cash) : null,
      actualCash: row.actual_cash !== null ? Number(row.actual_cash) : null,
      difference: row.difference !== null ? Number(row.difference) : null,
      status: String(row.status) as 'open' | 'closed',
      openedAt: String(row.opened_at),
      closedAt: row.closed_at ? String(row.closed_at) : null,
      notes: row.notes ? String(row.notes) : null,
    },
    breakdown: {
      openingCash,
      cashSales: Number(cashSales.toFixed(2)),
      cashCustomerPayments: Number(cashCustomerPayments.toFixed(2)),
      cashExpenses: Number(cashExpenses.toFixed(2)),
      manualAdjustments: Number(manualAdjustments.toFixed(2)),
      currentCash,
    },
  };
}

export async function openCounter(userId: string, openingCash: number, notes?: string) {
  // Check if active session already exists
  const active = await getActiveCashSession(userId);
  if (active?.session) {
    throw new Error('A counter session is already open. Please close the active session first.');
  }

  if (isNaN(openingCash) || openingCash < 0) {
    throw new Error('Opening cash must be a valid positive amount.');
  }

  const now = new Date().toISOString();
  const sessionId = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  await client.execute({
    sql: `
      INSERT INTO cash_sessions (id, user_id, opening_cash, status, opened_at, notes)
      VALUES (?, ?, ?, 'open', ?, ?)
    `,
    args: [sessionId, userId, openingCash, now, notes || null],
  });

  // Record opening movement
  await client.execute({
    sql: `
      INSERT INTO cash_movements (id, cash_session_id, type, amount, description, created_at)
      VALUES (?, ?, 'opening', ?, 'Counter opened with initial cash', ?)
    `,
    args: [`cm_${Date.now()}_open`, sessionId, openingCash, now],
  });

  return getActiveCashSession(userId);
}

export async function closeCounter(sessionId: string, actualCash: number, notes?: string) {
  const summary = await getActiveCashSession();
  if (!summary?.session || summary.session.id !== sessionId) {
    throw new Error('Cash session not found or already closed.');
  }

  if (isNaN(actualCash) || actualCash < 0) {
    throw new Error('Actual cash count must be a valid number.');
  }

  const expectedCash = summary.breakdown.currentCash;
  const difference = Number((actualCash - expectedCash).toFixed(2));
  const now = new Date().toISOString();

  await client.execute({
    sql: `
      UPDATE cash_sessions
      SET closing_cash = ?, expected_cash = ?, actual_cash = ?, difference = ?, status = 'closed', closed_at = ?, notes = ?
      WHERE id = ?
    `,
    args: [actualCash, expectedCash, actualCash, difference, now, notes || null, sessionId],
  });

  // Record closing movement
  await client.execute({
    sql: `
      INSERT INTO cash_movements (id, cash_session_id, type, amount, description, created_at)
      VALUES (?, ?, 'closing', ?, ?, ?)
    `,
    args: [`cm_${Date.now()}_close`, sessionId, actualCash, `Counter closed. Expected: ${expectedCash}, Actual: ${actualCash}, Diff: ${difference}`, now],
  });

  return {
    sessionId,
    expectedCash,
    actualCash,
    difference,
    closedAt: now,
  };
}

export async function addManualCashAdjustment(
  sessionId: string,
  type: 'manual_in' | 'manual_out',
  amount: number,
  description: string
) {
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Adjustment amount must be greater than zero.');
  }
  if (!description.trim()) {
    throw new Error('Description is required for cash adjustments.');
  }

  const now = new Date().toISOString();
  const adjustedAmount = type === 'manual_out' ? -amount : amount;

  await client.execute({
    sql: `
      INSERT INTO cash_movements (id, cash_session_id, type, amount, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    args: [`cm_${Date.now()}`, sessionId, type, adjustedAmount, description.trim(), now],
  });

  return getActiveCashSession();
}

export async function getCashMovements(sessionId: string) {
  const result = await client.execute({
    sql: `SELECT * FROM cash_movements WHERE cash_session_id = ? ORDER BY created_at DESC`,
    args: [sessionId],
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    cashSessionId: String(row.cash_session_id),
    type: String(row.type),
    amount: Number(row.amount),
    referenceId: row.reference_id ? String(row.reference_id) : null,
    description: String(row.description),
    createdAt: String(row.created_at),
  }));
}

export async function listCashSessions(limit = 25) {
  const result = await client.execute({
    sql: `
      SELECT cs.*, u.name as user_name
      FROM cash_sessions cs
      JOIN users u ON cs.user_id = u.id
      ORDER BY cs.opened_at DESC
      LIMIT ?
    `,
    args: [limit],
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    openingCash: Number(row.opening_cash),
    closingCash: row.closing_cash !== null ? Number(row.closing_cash) : null,
    expectedCash: row.expected_cash !== null ? Number(row.expected_cash) : null,
    actualCash: row.actual_cash !== null ? Number(row.actual_cash) : null,
    difference: row.difference !== null ? Number(row.difference) : null,
    status: String(row.status),
    openedAt: String(row.opened_at),
    closedAt: row.closed_at ? String(row.closed_at) : null,
    notes: row.notes ? String(row.notes) : null,
  }));
}
