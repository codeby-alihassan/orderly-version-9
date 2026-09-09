import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import * as schema from './schema.js';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'orderly.db');
const dbUrl = `file:${DB_PATH}`;

export const client = createClient({
  url: dbUrl,
});

export const db = drizzle(client, { schema });

export async function initDatabase() {
  await client.execute('PRAGMA foreign_keys = ON;');
  try {
    await client.execute('PRAGMA journal_mode = WAL;');
    await client.execute('PRAGMA synchronous = NORMAL;');
  } catch {
    // WAL mode fallback for environments that do not support it
  }

  // Ensure tables exist
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier',
      is_active INTEGER NOT NULL DEFAULT 1,
      permissions TEXT NOT NULL DEFAULT '["pos","invoices"]',
      created_at TEXT NOT NULL
    );
  `);

  try {
    await client.execute('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;');
  } catch {
    // Column already exists or table was just created
  }

  try {
    await client.execute('ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT \'["pos","invoices"]\';');
  } catch {
    // Column already exists or table was just created
  }

  // Ensure any admin user has full permissions
  try {
    await client.execute(`
      UPDATE users 
      SET permissions = '["dashboard","pos","products","purchases","credit","invoices","analytics","cash","expenses","settings"]'
      WHERE role = 'admin'
    `);
  } catch {
    // ignore
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS cash_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      opening_cash REAL NOT NULL DEFAULT 0,
      closing_cash REAL,
      expected_cash REAL,
      actual_cash REAL,
      difference REAL,
      status TEXT NOT NULL DEFAULT 'open',
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      notes TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category_id TEXT,
      sku TEXT NOT NULL UNIQUE,
      barcode TEXT,
      cost_price REAL NOT NULL DEFAULT 0,
      selling_price REAL NOT NULL DEFAULT 0,
      current_stock INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      supplier_name TEXT NOT NULL,
      purchase_date TEXT NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      cost_price REAL NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 1,
      total_price REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      address TEXT,
      notes TEXT,
      opening_balance REAL NOT NULL DEFAULT 0,
      current_balance REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      customer_id TEXT,
      user_id TEXT NOT NULL,
      cash_session_id TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      profit REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'completed',
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id)
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      unit_cost REAL NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 1,
      total_price REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      profit REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS customer_transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      sale_id TEXT,
      type TEXT NOT NULL,
      payment_method TEXT,
      amount REAL NOT NULL DEFAULT 0,
      balance_after REAL NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS cash_movements (
      id TEXT PRIMARY KEY,
      cash_session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      reference_id TEXT,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id)
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      category TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      cash_session_id TEXT,
      notes TEXT,
      expense_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id)
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS held_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      reference_name TEXT NOT NULL,
      cart_data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Initialize essential system configuration and default admin if needed
  await initDefaultSettings();
  await initDefaultAdmin();
}

async function initDefaultAdmin() {
  const usersCount = await client.execute('SELECT COUNT(*) as count FROM users');
  const count = Number(usersCount.rows[0]?.count || 0);

  if (count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);
    const now = new Date().toISOString();
    const adminPermissions = JSON.stringify([
      'dashboard',
      'pos',
      'products',
      'purchases',
      'credit',
      'invoices',
      'analytics',
      'cash',
      'expenses',
      'settings',
    ]);
    await client.execute({
      sql: `INSERT INTO users (id, username, password_hash, name, role, is_active, permissions, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      args: ['usr_admin_default', 'admin', hash, 'Administrator', 'admin', adminPermissions, now],
    });
    console.log('Default administrator initialized: admin / admin123');
  }
}

async function initDefaultSettings() {
  const settingsCount = await client.execute('SELECT COUNT(*) as count FROM settings');
  const count = Number(settingsCount.rows[0]?.count || 0);

  if (count === 0) {
    const now = new Date().toISOString();
    const defaultSettings = [
      ['shop_name', 'Orderly Supermarket'],
      ['shop_address', 'Main Commercial Avenue'],
      ['shop_phone', '+1 (555) 000-0000'],
      ['currency', 'Rs.'],
      ['tax_rate', '0'],
      ['tax_enabled', 'false'],
      ['default_low_stock_threshold', '5'],
      ['theme', 'light'],
      ['keyboard_shortcuts', JSON.stringify({
        searchProduct: 'F2',
        creditCustomer: 'F4',
        holdOrder: 'F6',
        checkout: 'F8',
        quickCash: 'F9',
        clearCart: 'Escape',
      })],
    ];

    for (const [key, value] of defaultSettings) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`,
        args: [key, value, now],
      });
    }
  }
}
