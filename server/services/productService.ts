import { client } from '../db/index.js';

export interface ProductFilter {
  search?: string;
  categoryId?: string;
  status?: 'all' | 'healthy' | 'low' | 'out';
  activeOnly?: boolean;
}

export async function listProducts(filter: ProductFilter = {}) {
  let query = `
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const args: any[] = [];

  if (filter.activeOnly !== false) {
    query += ` AND p.is_active = 1`;
  }

  if (filter.categoryId && filter.categoryId !== 'all') {
    query += ` AND p.category_id = ?`;
    args.push(filter.categoryId);
  }

  if (filter.search && filter.search.trim()) {
    const s = `%${filter.search.trim().toLowerCase()}%`;
    query += ` AND (LOWER(p.name) LIKE ? OR LOWER(p.sku) LIKE ? OR LOWER(COALESCE(p.barcode, '')) LIKE ?)`;
    args.push(s, s, s);
  }

  query += ` ORDER BY p.name ASC`;

  const result = await client.execute({ sql: query, args });

  let items = result.rows.map((r) => {
    const currentStock = Number(r.current_stock || 0);
    const lowStockThreshold = Number(r.low_stock_threshold || 5);
    let stockStatus: 'healthy' | 'low' | 'out' = 'healthy';
    if (currentStock <= 0) {
      stockStatus = 'out';
    } else if (currentStock <= lowStockThreshold) {
      stockStatus = 'low';
    }

    return {
      id: String(r.id),
      name: String(r.name),
      categoryId: r.category_id ? String(r.category_id) : null,
      categoryName: r.category_name ? String(r.category_name) : 'Uncategorized',
      sku: String(r.sku),
      barcode: r.barcode ? String(r.barcode) : null,
      costPrice: Number(r.cost_price || 0),
      sellingPrice: Number(r.selling_price || 0),
      currentStock,
      lowStockThreshold,
      stockStatus,
      isActive: Number(r.is_active) === 1,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  });

  if (filter.status && filter.status !== 'all') {
    items = items.filter((p) => p.stockStatus === filter.status);
  }

  return items;
}

export async function getProductById(id: string) {
  const result = await client.execute({
    sql: `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `,
    args: [id],
  });

  if (result.rows.length === 0) return null;

  const r = result.rows[0];
  const currentStock = Number(r.current_stock || 0);
  const lowStockThreshold = Number(r.low_stock_threshold || 5);
  let stockStatus: 'healthy' | 'low' | 'out' = 'healthy';
  if (currentStock <= 0) stockStatus = 'out';
  else if (currentStock <= lowStockThreshold) stockStatus = 'low';

  return {
    id: String(r.id),
    name: String(r.name),
    categoryId: r.category_id ? String(r.category_id) : null,
    categoryName: r.category_name ? String(r.category_name) : 'Uncategorized',
    sku: String(r.sku),
    barcode: r.barcode ? String(r.barcode) : null,
    costPrice: Number(r.cost_price || 0),
    sellingPrice: Number(r.selling_price || 0),
    currentStock,
    lowStockThreshold,
    stockStatus,
    isActive: Number(r.is_active) === 1,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function createProduct(data: {
  name: string;
  categoryId?: string | null;
  sku: string;
  barcode?: string | null;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  lowStockThreshold?: number;
}) {
  if (!data.name.trim()) throw new Error('Product name is required');
  if (!data.sku.trim()) throw new Error('Product SKU is required');
  if (data.costPrice < 0) throw new Error('Cost price cannot be negative');
  if (data.sellingPrice < 0) throw new Error('Selling price cannot be negative');
  if (data.currentStock < 0) throw new Error('Current stock cannot be negative');

  // Check SKU uniqueness
  const existingSku = await client.execute({
    sql: 'SELECT id FROM products WHERE LOWER(sku) = ?',
    args: [data.sku.trim().toLowerCase()],
  });
  if (existingSku.rows.length > 0) {
    throw new Error(`A product with SKU "${data.sku.trim()}" already exists.`);
  }

  const id = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  await client.execute({
    sql: `
      INSERT INTO products (
        id, name, category_id, sku, barcode, cost_price, selling_price,
        current_stock, low_stock_threshold, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `,
    args: [
      id,
      data.name.trim(),
      data.categoryId || null,
      data.sku.trim().toUpperCase(),
      data.barcode?.trim() || null,
      data.costPrice,
      data.sellingPrice,
      Math.floor(data.currentStock),
      data.lowStockThreshold ? Math.floor(data.lowStockThreshold) : 5,
      now,
      now,
    ],
  });

  return getProductById(id);
}

export async function updateProduct(
  id: string,
  data: {
    name: string;
    categoryId?: string | null;
    sku: string;
    barcode?: string | null;
    costPrice: number;
    sellingPrice: number;
    lowStockThreshold?: number;
  }
) {
  if (!data.name.trim()) throw new Error('Product name is required');
  if (!data.sku.trim()) throw new Error('Product SKU is required');
  if (data.costPrice < 0) throw new Error('Cost price cannot be negative');
  if (data.sellingPrice < 0) throw new Error('Selling price cannot be negative');

  // Check SKU uniqueness excluding this product
  const existingSku = await client.execute({
    sql: 'SELECT id FROM products WHERE LOWER(sku) = ? AND id != ?',
    args: [data.sku.trim().toLowerCase(), id],
  });
  if (existingSku.rows.length > 0) {
    throw new Error(`Another product with SKU "${data.sku.trim()}" already exists.`);
  }

  const now = new Date().toISOString();
  await client.execute({
    sql: `
      UPDATE products
      SET name = ?, category_id = ?, sku = ?, barcode = ?, cost_price = ?,
          selling_price = ?, low_stock_threshold = ?, updated_at = ?
      WHERE id = ?
    `,
    args: [
      data.name.trim(),
      data.categoryId || null,
      data.sku.trim().toUpperCase(),
      data.barcode?.trim() || null,
      data.costPrice,
      data.sellingPrice,
      data.lowStockThreshold ? Math.floor(data.lowStockThreshold) : 5,
      now,
      id,
    ],
  });

  return getProductById(id);
}

export async function adjustStock(id: string, newStock: number, reason: string) {
  if (isNaN(newStock) || newStock < 0) {
    throw new Error('Stock quantity cannot be negative.');
  }

  const now = new Date().toISOString();
  await client.execute({
    sql: `UPDATE products SET current_stock = ?, updated_at = ? WHERE id = ?`,
    args: [Math.floor(newStock), now, id],
  });

  return getProductById(id);
}

export async function deleteProduct(id: string) {
  // Check if product is in historical sales or purchases
  const salesRes = await client.execute({
    sql: 'SELECT COUNT(*) as c FROM sale_items WHERE product_id = ?',
    args: [id],
  });
  const purRes = await client.execute({
    sql: 'SELECT COUNT(*) as c FROM purchase_items WHERE product_id = ?',
    args: [id],
  });

  const saleCount = Number(salesRes.rows[0]?.c || 0);
  const purCount = Number(purRes.rows[0]?.c || 0);

  if (saleCount > 0 || purCount > 0) {
    // Safe soft-delete / archive
    await client.execute({
      sql: 'UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?',
      args: [new Date().toISOString(), id],
    });
    return { archived: true, message: 'Product has historical transactions and has been archived.' };
  } else {
    // Hard delete
    await client.execute({
      sql: 'DELETE FROM products WHERE id = ?',
      args: [id],
    });
    return { archived: false, message: 'Product deleted permanently.' };
  }
}

export async function listCategories() {
  const res = await client.execute('SELECT * FROM categories ORDER BY name ASC');
  return res.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    description: r.description ? String(r.description) : null,
    createdAt: String(r.created_at),
  }));
}

export async function createCategory(name: string, description?: string) {
  if (!name.trim()) throw new Error('Category name is required');
  const id = `cat_${Date.now()}`;
  const now = new Date().toISOString();

  await client.execute({
    sql: 'INSERT INTO categories (id, name, description, created_at) VALUES (?, ?, ?, ?)',
    args: [id, name.trim(), description?.trim() || null, now],
  });

  return { id, name: name.trim(), description: description?.trim() || null, createdAt: now };
}

export async function deleteCategory(id: string) {
  await client.execute({
    sql: 'UPDATE products SET category_id = NULL WHERE category_id = ?',
    args: [id],
  });
  await client.execute({
    sql: 'DELETE FROM categories WHERE id = ?',
    args: [id],
  });
  return { success: true, message: 'Category deleted successfully' };
}

