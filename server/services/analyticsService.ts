import { client } from '../db/index.js';
import { getActiveCashSession } from './cashService.js';

function parseTzOffset(tzOffset?: number | string): number {
  if (tzOffset === undefined || tzOffset === null) return 0;
  const parsed = parseInt(String(tzOffset), 10);
  return isNaN(parsed) ? 0 : parsed;
}

function getClientTodayKey(tzOffsetMin: number = 0): string {
  const localEpoch = Date.now() - tzOffsetMin * 60000;
  return new Date(localEpoch).toISOString().slice(0, 10);
}

function getLocalDateKey(isoString: string, tzOffsetMin: number = 0): string {
  try {
    let s = String(isoString).trim();
    if (!s) return new Date().toISOString().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (s.includes(' ') && !s.includes('T')) s = s.replace(' ', 'T');

    // If string has explicit timezone indicator ('Z' or offset like +05:00)
    if (s.endsWith('Z') || /[+-]\d{2}(:?\d{2})?$/.test(s)) {
      const epoch = new Date(s).getTime();
      if (!isNaN(epoch)) {
        const localEpoch = epoch - tzOffsetMin * 60000;
        return new Date(localEpoch).toISOString().slice(0, 10);
      }
    }

    // If timestamp has no timezone offset (e.g. stored in local DB time), the date prefix is already the exact local date
    const dateMatch = s.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateMatch) return dateMatch[0];

    const epoch = new Date(s).getTime();
    if (!isNaN(epoch)) {
      const localEpoch = epoch - tzOffsetMin * 60000;
      return new Date(localEpoch).toISOString().slice(0, 10);
    }
    return s.slice(0, 10);
  } catch {
    return String(isoString).slice(0, 10);
  }
}

function getLocalHour(isoString: string, tzOffsetMin: number = 0): number {
  try {
    let s = String(isoString).trim();
    if (s.includes(' ') && !s.includes('T')) s = s.replace(' ', 'T');

    if (s.endsWith('Z') || /[+-]\d{2}(:?\d{2})?$/.test(s)) {
      const epoch = new Date(s).getTime();
      if (!isNaN(epoch)) {
        const localEpoch = epoch - tzOffsetMin * 60000;
        return new Date(localEpoch).getUTCHours();
      }
    }

    const hourMatch = s.match(/T(\d{2}):/);
    if (hourMatch) return parseInt(hourMatch[1], 10);

    const epoch = new Date(s).getTime();
    if (!isNaN(epoch)) return new Date(epoch).getHours();
    return 0;
  } catch {
    return 0;
  }
}

function getTodayRange(tzOffsetMin: number = 0) {
  const clientToday = getClientTodayKey(tzOffsetMin);
  const startEpoch = new Date(`${clientToday}T00:00:00.000Z`).getTime() + tzOffsetMin * 60000;
  const endEpoch = new Date(`${clientToday}T23:59:59.999Z`).getTime() + tzOffsetMin * 60000;

  return {
    dateStr: clientToday,
    startOfDay: new Date(startEpoch).toISOString(),
    endOfDay: new Date(endEpoch).toISOString(),
  };
}

function parseBoundaryIso(dateStr?: string, isEnd = false, tzOffsetMin: number = 0): string {
  if (!dateStr || !dateStr.trim()) {
    const clientToday = getClientTodayKey(tzOffsetMin);
    const epoch = new Date(`${clientToday}T${isEnd ? '23:59:59.999' : '00:00:00.000'}Z`).getTime() + tzOffsetMin * 60000;
    return new Date(epoch).toISOString();
  }
  const clean = dateStr.trim();
  if (clean.includes('T')) {
    return clean;
  }
  const key = clean.slice(0, 10);
  const epoch = new Date(`${key}T${isEnd ? '23:59:59.999' : '00:00:00.000'}Z`).getTime() + tzOffsetMin * 60000;
  return new Date(epoch).toISOString();
}

export async function getDashboardStats(
  customRange?: { startDate?: string; endDate?: string },
  tzOffset?: number | string
) {
  const tzOffsetMin = parseTzOffset(tzOffset);
  const defaultRange = getTodayRange(tzOffsetMin);
  const startOfDay = customRange?.startDate
    ? parseBoundaryIso(customRange.startDate, false, tzOffsetMin)
    : defaultRange.startOfDay;
  const endOfDay = customRange?.endDate
    ? parseBoundaryIso(customRange.endDate, true, tzOffsetMin)
    : defaultRange.endOfDay;

  // 1. Today's Sales, Profit, and Orders count
  const salesRes = await client.execute({
    sql: `
      SELECT
        COUNT(*) as order_count,
        COALESCE(SUM(grand_total), 0) as total_sales,
        COALESCE(SUM(profit), 0) as total_profit
      FROM sales
      WHERE (payment_status IS NULL OR payment_status != 'cancelled')
        AND replace(created_at, ' ', 'T') >= ? AND replace(created_at, ' ', 'T') <= ?
    `,
    args: [startOfDay, endOfDay],
  });

  const todayOrders = Number(salesRes.rows[0]?.order_count || 0);
  const todaySales = Number(Number(salesRes.rows[0]?.total_sales || 0).toFixed(2));
  const todayProfit = Number(Number(salesRes.rows[0]?.total_profit || 0).toFixed(2));

  // 2. Current Cash
  const cashSummary = await getActiveCashSession();
  const currentCash = cashSummary?.breakdown.currentCash || 0;

  // 3. Total Credit (customers with balance > 0)
  const creditRes = await client.execute(`
    SELECT COALESCE(SUM(current_balance), 0) as total_credit
    FROM customers
    WHERE current_balance > 0
  `);
  const totalCredit = Number(Number(creditRes.rows[0]?.total_credit || 0).toFixed(2));

  // 4. Products statistics
  const prodRes = await client.execute(`
    SELECT
      COUNT(*) as total_products,
      COALESCE(SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END), 0) as out_of_stock,
      COALESCE(SUM(CASE WHEN current_stock > 0 AND current_stock <= low_stock_threshold THEN 1 ELSE 0 END), 0) as low_stock,
      COALESCE(SUM(current_stock * cost_price), 0) as total_stock_value
    FROM products
    WHERE is_active = 1
  `);

  const totalProducts = Number(prodRes.rows[0]?.total_products || 0);
  const outOfStock = Number(prodRes.rows[0]?.out_of_stock || 0);
  const lowStock = Number(prodRes.rows[0]?.low_stock || 0);
  const totalStockValue = Number(Number(prodRes.rows[0]?.total_stock_value || 0).toFixed(2));

  // 5. Today's Expenses
  const expRes = await client.execute({
    sql: `
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses
      WHERE replace(created_at, ' ', 'T') >= ? AND replace(created_at, ' ', 'T') <= ?
    `,
    args: [startOfDay, endOfDay],
  });
  const todayExpenses = Number(Number(expRes.rows[0]?.total_expenses || 0).toFixed(2));

  return {
    todaySales,
    todayProfit,
    todayExpenses,
    currentCash,
    totalCredit,
    totalProducts,
    lowStock,
    outOfStock,
    todayOrders,
    totalStockValue,
    hasActiveCounter: Boolean(cashSummary?.session),
    activeCounterSession: cashSummary?.session || null,
  };
}

export async function getChartData(
  range: 'today' | '7d' | '30d' | 'custom' = '7d',
  customStart?: string,
  customEnd?: string,
  tzOffset?: number | string
) {
  const tzOffsetMin = parseTzOffset(tzOffset);
  const clientToday = getClientTodayKey(tzOffsetMin);

  let startIso: string;
  let endIso: string;
  let mode: 'hourly' | 'daily' = 'daily';
  let targetSingleDayKey: string | null = null;

  if (range === 'today') {
    mode = 'hourly';
    targetSingleDayKey = clientToday;
    const startEpoch = new Date(`${clientToday}T00:00:00.000Z`).getTime() + tzOffsetMin * 60000;
    const endEpoch = new Date(`${clientToday}T23:59:59.999Z`).getTime() + tzOffsetMin * 60000;
    startIso = new Date(startEpoch).toISOString();
    endIso = new Date(endEpoch).toISOString();
  } else if (range === '7d') {
    mode = 'daily';
    const past7Epoch = Date.now() - tzOffsetMin * 60000 - 6 * 24 * 60 * 60 * 1000;
    const sKey = new Date(past7Epoch).toISOString().slice(0, 10);
    const startEpoch = new Date(`${sKey}T00:00:00.000Z`).getTime() + tzOffsetMin * 60000;
    const endEpoch = new Date(`${clientToday}T23:59:59.999Z`).getTime() + tzOffsetMin * 60000;
    startIso = new Date(startEpoch).toISOString();
    endIso = new Date(endEpoch).toISOString();
  } else if (range === '30d') {
    mode = 'daily';
    const past30Epoch = Date.now() - tzOffsetMin * 60000 - 29 * 24 * 60 * 60 * 1000;
    const sKey = new Date(past30Epoch).toISOString().slice(0, 10);
    const startEpoch = new Date(`${sKey}T00:00:00.000Z`).getTime() + tzOffsetMin * 60000;
    const endEpoch = new Date(`${clientToday}T23:59:59.999Z`).getTime() + tzOffsetMin * 60000;
    startIso = new Date(startEpoch).toISOString();
    endIso = new Date(endEpoch).toISOString();
  } else if (range === 'custom') {
    const rawS = (customStart || clientToday).slice(0, 10);
    const rawE = (customEnd || clientToday).slice(0, 10);
    const sKey = rawS <= rawE ? rawS : rawE;
    const eKey = rawS <= rawE ? rawE : rawS;

    if (sKey === eKey) {
      // Single day view: show hourly trend for this specific date
      mode = 'hourly';
      targetSingleDayKey = sKey;
      const startEpoch = new Date(`${sKey}T00:00:00.000Z`).getTime() + tzOffsetMin * 60000;
      const endEpoch = new Date(`${eKey}T23:59:59.999Z`).getTime() + tzOffsetMin * 60000;
      startIso = new Date(startEpoch).toISOString();
      endIso = new Date(endEpoch).toISOString();
    } else {
      mode = 'daily';
      const startEpoch = new Date(`${sKey}T00:00:00.000Z`).getTime() + tzOffsetMin * 60000;
      const endEpoch = new Date(`${eKey}T23:59:59.999Z`).getTime() + tzOffsetMin * 60000;
      startIso = new Date(startEpoch).toISOString();
      endIso = new Date(endEpoch).toISOString();
    }
  } else {
    mode = 'daily';
    const past7Epoch = Date.now() - tzOffsetMin * 60000 - 6 * 24 * 60 * 60 * 1000;
    const sKey = new Date(past7Epoch).toISOString().slice(0, 10);
    const startEpoch = new Date(`${sKey}T00:00:00.000Z`).getTime() + tzOffsetMin * 60000;
    const endEpoch = new Date(`${clientToday}T23:59:59.999Z`).getTime() + tzOffsetMin * 60000;
    startIso = new Date(startEpoch).toISOString();
    endIso = new Date(endEpoch).toISOString();
  }

  // Query with a 36-hour margin to prevent timezone and boundary drops
  const queryStart = new Date(new Date(startIso).getTime() - 36 * 3600 * 1000).toISOString();
  const queryEnd = new Date(new Date(endIso).getTime() + 36 * 3600 * 1000).toISOString();

  // Fetch sales in range
  const salesRes = await client.execute({
    sql: `
      SELECT created_at, grand_total, profit
      FROM sales
      WHERE (payment_status IS NULL OR payment_status != 'cancelled')
        AND replace(created_at, ' ', 'T') >= ? AND replace(created_at, ' ', 'T') <= ?
    `,
    args: [queryStart, queryEnd],
  });

  // Fetch expenses in range
  const expRes = await client.execute({
    sql: `
      SELECT created_at, amount
      FROM expenses
      WHERE replace(created_at, ' ', 'T') >= ? AND replace(created_at, ' ', 'T') <= ?
    `,
    args: [queryStart, queryEnd],
  });

  if (mode === 'hourly') {
    const hoursMap: Record<number, { label: string; sales: number; profit: number; expenses: number; orders: number }> = {};
    for (let h = 0; h < 24; h++) {
      const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
      hoursMap[h] = { label, sales: 0, profit: 0, expenses: 0, orders: 0 };
    }

    for (const r of salesRes.rows) {
      const rowDateKey = getLocalDateKey(String(r.created_at), tzOffsetMin);
      if (!targetSingleDayKey || rowDateKey === targetSingleDayKey) {
        const h = getLocalHour(String(r.created_at), tzOffsetMin);
        if (hoursMap[h]) {
          hoursMap[h].sales += Number(r.grand_total || 0);
          hoursMap[h].profit += Number(r.profit || 0);
          hoursMap[h].orders += 1;
        }
      }
    }

    for (const r of expRes.rows) {
      const rowDateKey = getLocalDateKey(String(r.created_at), tzOffsetMin);
      if (!targetSingleDayKey || rowDateKey === targetSingleDayKey) {
        const h = getLocalHour(String(r.created_at), tzOffsetMin);
        if (hoursMap[h]) {
          hoursMap[h].expenses += Number(r.amount || 0);
        }
      }
    }

    return Object.keys(hoursMap)
      .map(Number)
      .sort((a, b) => a - b)
      .map((h) => ({
        key: String(h),
        label: hoursMap[h].label,
        sales: Number(hoursMap[h].sales.toFixed(2)),
        profit: Number(hoursMap[h].profit.toFixed(2)),
        expenses: Number(hoursMap[h].expenses.toFixed(2)),
        orders: hoursMap[h].orders,
      }));
  } else {
    // Group by Date string YYYY-MM-DD
    const daysMap: Record<string, { label: string; sales: number; profit: number; expenses: number; orders: number }> = {};
    const startKey = getLocalDateKey(startIso, tzOffsetMin);
    const endKey = getLocalDateKey(endIso, tzOffsetMin);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let curr = new Date(`${startKey}T12:00:00.000Z`);
    const end = new Date(`${endKey}T12:00:00.000Z`);

    while (curr <= end) {
      const dateStr = curr.toISOString().slice(0, 10);
      const parts = dateStr.split('-');
      const mName = monthNames[parseInt(parts[1], 10) - 1] || parts[1];
      const dNum = parseInt(parts[2], 10);
      const label = `${mName} ${dNum}`;

      daysMap[dateStr] = { label, sales: 0, profit: 0, expenses: 0, orders: 0 };
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    for (const r of salesRes.rows) {
      const dateStr = getLocalDateKey(String(r.created_at), tzOffsetMin);
      if (daysMap[dateStr]) {
        daysMap[dateStr].sales += Number(r.grand_total || 0);
        daysMap[dateStr].profit += Number(r.profit || 0);
        daysMap[dateStr].orders += 1;
      } else if (dateStr >= startKey && dateStr <= endKey) {
        const parts = dateStr.split('-');
        const mName = monthNames[parseInt(parts[1], 10) - 1] || parts[1];
        const dNum = parseInt(parts[2], 10);
        daysMap[dateStr] = {
          label: `${mName} ${dNum}`,
          sales: Number(r.grand_total || 0),
          profit: Number(r.profit || 0),
          expenses: 0,
          orders: 1,
        };
      }
    }

    for (const r of expRes.rows) {
      const dateStr = getLocalDateKey(String(r.created_at), tzOffsetMin);
      if (daysMap[dateStr]) {
        daysMap[dateStr].expenses += Number(r.amount || 0);
      } else if (dateStr >= startKey && dateStr <= endKey) {
        const parts = dateStr.split('-');
        const mName = monthNames[parseInt(parts[1], 10) - 1] || parts[1];
        const dNum = parseInt(parts[2], 10);
        daysMap[dateStr] = {
          label: `${mName} ${dNum}`,
          sales: 0,
          profit: 0,
          expenses: Number(r.amount || 0),
          orders: 0,
        };
      }
    }

    return Object.keys(daysMap)
      .sort()
      .map((k) => ({
        key: k,
        label: daysMap[k].label,
        sales: Number(daysMap[k].sales.toFixed(2)),
        profit: Number(daysMap[k].profit.toFixed(2)),
        expenses: Number(daysMap[k].expenses.toFixed(2)),
        orders: daysMap[k].orders,
      }));
  }
}

export async function getPaymentMethodBreakdown(
  range: string = '7d',
  customStart?: string,
  customEnd?: string,
  tzOffset?: number | string
) {
  const tzOffsetMin = parseTzOffset(tzOffset);
  const clientToday = getClientTodayKey(tzOffsetMin);

  let startIso: string;
  let endIso: string;
  let startKey: string;
  let endKey: string;

  if (range === 'today') {
    startKey = clientToday;
    endKey = clientToday;
    const startEpoch = new Date(`${clientToday}T00:00:00.000Z`).getTime() + tzOffsetMin * 60000;
    const endEpoch = new Date(`${clientToday}T23:59:59.999Z`).getTime() + tzOffsetMin * 60000;
    startIso = new Date(startEpoch).toISOString();
    endIso = new Date(endEpoch).toISOString();
  } else if (range === '7d') {
    const past7Epoch = Date.now() - tzOffsetMin * 60000 - 6 * 24 * 60 * 60 * 1000;
    startKey = new Date(past7Epoch).toISOString().slice(0, 10);
    endKey = clientToday;
    const startEpoch = new Date(`${startKey}T00:00:00.000Z`).getTime() + tzOffsetMin * 60000;
    const endEpoch = new Date(`${clientToday}T23:59:59.999Z`).getTime() + tzOffsetMin * 60000;
    startIso = new Date(startEpoch).toISOString();
    endIso = new Date(endEpoch).toISOString();
  } else if (range === '30d') {
    const past30Epoch = Date.now() - tzOffsetMin * 60000 - 29 * 24 * 60 * 60 * 1000;
    startKey = new Date(past30Epoch).toISOString().slice(0, 10);
    endKey = clientToday;
    const startEpoch = new Date(`${startKey}T00:00:00.000Z`).getTime() + tzOffsetMin * 60000;
    const endEpoch = new Date(`${clientToday}T23:59:59.999Z`).getTime() + tzOffsetMin * 60000;
    startIso = new Date(startEpoch).toISOString();
    endIso = new Date(endEpoch).toISOString();
  } else if (range === 'custom') {
    const rawS = (customStart || clientToday).slice(0, 10);
    const rawE = (customEnd || clientToday).slice(0, 10);
    startKey = rawS <= rawE ? rawS : rawE;
    endKey = rawS <= rawE ? rawE : rawS;
    const startEpoch = new Date(`${startKey}T00:00:00.000Z`).getTime() + tzOffsetMin * 60000;
    const endEpoch = new Date(`${endKey}T23:59:59.999Z`).getTime() + tzOffsetMin * 60000;
    startIso = new Date(startEpoch).toISOString();
    endIso = new Date(endEpoch).toISOString();
  } else {
    const past7Epoch = Date.now() - tzOffsetMin * 60000 - 6 * 24 * 60 * 60 * 1000;
    startKey = new Date(past7Epoch).toISOString().slice(0, 10);
    endKey = clientToday;
    const startEpoch = new Date(`${startKey}T00:00:00.000Z`).getTime() + tzOffsetMin * 60000;
    const endEpoch = new Date(`${clientToday}T23:59:59.999Z`).getTime() + tzOffsetMin * 60000;
    startIso = new Date(startEpoch).toISOString();
    endIso = new Date(endEpoch).toISOString();
  }

  const queryStart = new Date(new Date(startIso).getTime() - 36 * 3600 * 1000).toISOString();
  const queryEnd = new Date(new Date(endIso).getTime() + 36 * 3600 * 1000).toISOString();

  const res = await client.execute({
    sql: `
      SELECT payment_method, grand_total, created_at
      FROM sales
      WHERE (payment_status IS NULL OR payment_status != 'cancelled')
        AND replace(created_at, ' ', 'T') >= ? AND replace(created_at, ' ', 'T') <= ?
    `,
    args: [queryStart, queryEnd],
  });

  let grandSum = 0;
  const methods = {
    cash: { count: 0, total: 0 },
    bank: { count: 0, total: 0 },
    credit: { count: 0, total: 0 },
  };

  for (const r of res.rows) {
    const dateStr = getLocalDateKey(String(r.created_at), tzOffsetMin);
    if (dateStr >= startKey && dateStr <= endKey) {
      const m = String(r.payment_method) as 'cash' | 'bank' | 'credit';
      const tot = Number(r.grand_total || 0);
      if (methods[m]) {
        methods[m].count += 1;
        methods[m].total += tot;
        grandSum += tot;
      }
    }
  }

  methods.cash.total = Number(methods.cash.total.toFixed(2));
  methods.bank.total = Number(methods.bank.total.toFixed(2));
  methods.credit.total = Number(methods.credit.total.toFixed(2));

  return [
    {
      method: 'Cash',
      key: 'cash',
      total: methods.cash.total,
      count: methods.cash.count,
      percentage: grandSum > 0 ? Number(((methods.cash.total / grandSum) * 100).toFixed(1)) : 0,
      color: '#f97316', // Orange
    },
    {
      method: 'Bank Transfer',
      key: 'bank',
      total: methods.bank.total,
      count: methods.bank.count,
      percentage: grandSum > 0 ? Number(((methods.bank.total / grandSum) * 100).toFixed(1)) : 0,
      color: '#3b82f6', // Blue
    },
    {
      method: 'Credit',
      key: 'credit',
      total: methods.credit.total,
      count: methods.credit.count,
      percentage: grandSum > 0 ? Number(((methods.credit.total / grandSum) * 100).toFixed(1)) : 0,
      color: '#8b5cf6', // Purple
    },
  ];
}

export async function getTopSellingProducts(limit = 6) {
  const res = await client.execute({
    sql: `
      SELECT
        si.product_id,
        si.product_name,
        si.sku,
        SUM(si.quantity) as total_quantity,
        SUM(si.total_price) as total_revenue,
        SUM(si.profit) as total_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE (s.payment_status IS NULL OR s.payment_status != 'cancelled')
      GROUP BY si.product_id, si.product_name, si.sku
      ORDER BY total_quantity DESC
      LIMIT ?
    `,
    args: [limit],
  });

  return res.rows.map((r) => ({
    productId: String(r.product_id),
    productName: String(r.product_name),
    sku: String(r.sku),
    totalQuantity: Number(r.total_quantity),
    totalRevenue: Number(Number(r.total_revenue).toFixed(2)),
    totalProfit: Number(Number(r.total_profit).toFixed(2)),
  }));
}
