import { client } from '../db/index.js';
import { getActiveCashSession } from './cashService.js';

export interface PurchaseItemInput {
  productId: string;
  productName: string;
  costPrice: number;
  quantity: number;
  totalPrice: number;
}

export interface CreatePurchaseInput {
  supplierName: string;
  purchaseDate: string;
  paymentMethod: 'cash' | 'bank' | 'credit';
  notes?: string;
  items: PurchaseItemInput[];
}

export async function listPurchases(params: { search?: string; startDate?: string; endDate?: string } = {}) {
  let query = `SELECT * FROM purchases WHERE 1=1`;
  const args: any[] = [];

  if (params.search && params.search.trim()) {
    const s = `%${params.search.trim().toLowerCase()}%`;
    query += ` AND (LOWER(invoice_number) LIKE ? OR LOWER(supplier_name) LIKE ?)`;
    args.push(s, s);
  }

  if (params.startDate) {
    query += ` AND purchase_date >= ?`;
    args.push(params.startDate);
  }

  if (params.endDate) {
    query += ` AND purchase_date <= ?`;
    args.push(params.endDate);
  }

  query += ` ORDER BY purchase_date DESC, created_at DESC`;

  const result = await client.execute({ sql: query, args });

  return result.rows.map((r) => ({
    id: String(r.id),
    invoiceNumber: String(r.invoice_number),
    supplierName: String(r.supplier_name),
    purchaseDate: String(r.purchase_date),
    totalAmount: Number(r.total_amount),
    paymentMethod: String(r.payment_method),
    notes: r.notes ? String(r.notes) : null,
    createdAt: String(r.created_at),
  }));
}

export async function getPurchaseById(id: string) {
  const purRes = await client.execute({
    sql: 'SELECT * FROM purchases WHERE id = ?',
    args: [id],
  });

  if (purRes.rows.length === 0) return null;
  const pur = purRes.rows[0];

  const itemsRes = await client.execute({
    sql: 'SELECT * FROM purchase_items WHERE purchase_id = ?',
    args: [id],
  });

  return {
    id: String(pur.id),
    invoiceNumber: String(pur.invoice_number),
    supplierName: String(pur.supplier_name),
    purchaseDate: String(pur.purchase_date),
    totalAmount: Number(pur.total_amount),
    paymentMethod: String(pur.payment_method),
    notes: pur.notes ? String(pur.notes) : null,
    createdAt: String(pur.created_at),
    items: itemsRes.rows.map((item) => ({
      id: String(item.id),
      productId: String(item.product_id),
      productName: String(item.product_name),
      costPrice: Number(item.cost_price),
      quantity: Number(item.quantity),
      totalPrice: Number(item.total_price),
    })),
  };
}

export async function createPurchase(data: CreatePurchaseInput) {
  const supplier = data.supplierName?.trim() || 'General Supplier';
  if (!data.items || data.items.length === 0) {
    throw new Error('Purchase must contain at least one item');
  }

  const purchaseId = `pur_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  // Generate unique purchase invoice number
  const countRes = await client.execute('SELECT COUNT(*) as c FROM purchases');
  const count = Number(countRes.rows[0]?.c || 0) + 1;
  const year = new Date().getFullYear();
  const invoiceNumber = `PUR-${year}-${String(count).padStart(4, '0')}`;

  let totalAmount = 0;
  for (const item of data.items) {
    const qty = Number(item.quantity ?? 1);
    const cost = Number(item.costPrice ?? 0);
    if (qty <= 0) throw new Error('Item quantity must be greater than zero');
    if (cost < 0) throw new Error('Item cost price cannot be negative');
    totalAmount += cost * qty;
  }
  totalAmount = Number(totalAmount.toFixed(2));

  // Atomic database operations
  const tx = await client.transaction('write');
  try {
    // 1. Insert Purchase
    await tx.execute({
      sql: `
        INSERT INTO purchases (id, invoice_number, supplier_name, purchase_date, total_amount, payment_method, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        purchaseId,
        invoiceNumber,
        supplier,
        data.purchaseDate?.trim() || now.slice(0, 10),
        totalAmount,
        data.paymentMethod || 'cash',
        data.notes?.trim() ? data.notes.trim() : null,
        now,
      ],
    });

    // 2. Insert items and update product stock & cost price
    for (const item of data.items) {
      const pitemId = `pitem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const costPrice = Number(item.costPrice ?? 0);
      const quantity = Math.max(1, Number(item.quantity ?? 1));
      const itemTotal = Number((costPrice * quantity).toFixed(2));
      const productId = String(item.productId || '');

      let productName = item.productName?.trim();
      if (!productName) {
        const pRes = await tx.execute({
          sql: 'SELECT name FROM products WHERE id = ?',
          args: [productId],
        });
        if (pRes.rows.length > 0 && pRes.rows[0].name) {
          productName = String(pRes.rows[0].name);
        } else {
          productName = 'Inventory Item';
        }
      }

      await tx.execute({
        sql: `
          INSERT INTO purchase_items (id, purchase_id, product_id, product_name, cost_price, quantity, total_price)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          pitemId,
          purchaseId,
          productId,
          productName,
          costPrice,
          quantity,
          itemTotal,
        ],
      });

      // Increase stock and update cost price atomically
      await tx.execute({
        sql: `
          UPDATE products
          SET current_stock = current_stock + ?, cost_price = ?, updated_at = ?
          WHERE id = ?
        `,
        args: [quantity, costPrice, now, productId],
      });
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  return getPurchaseById(purchaseId);
}
