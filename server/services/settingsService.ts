import { client } from '../db/index.js';
import { updateAdminCredentials } from './authService.js';

export interface KeyboardShortcutsConfig {
  searchProduct: string;
  creditCustomer: string;
  holdOrder: string;
  checkout: string;
  quickCash: string;
  clearCart: string;
}

const DEFAULT_SHORTCUTS: KeyboardShortcutsConfig = {
  searchProduct: 'F2',
  creditCustomer: 'F4',
  holdOrder: 'F6',
  checkout: 'F8',
  quickCash: 'F9',
  clearCart: 'Escape',
};

export async function getAllSettings(): Promise<Record<string, string>> {
  const res = await client.execute('SELECT key, value FROM settings');
  const map: Record<string, string> = {
    shop_name: 'Orderly Supermarket',
    shop_address: 'Main Boulevard, Retail Commercial Plaza',
    shop_phone: '+1 (555) 349-2810',
    currency: 'Rs.',
    tax_rate: '0',
    tax_enabled: 'false',
    default_low_stock_threshold: '5',
    theme: 'light',
  };

  for (const r of res.rows) {
    map[String(r.key)] = String(r.value);
  }

  return map;
}

export async function updateSetting(key: string, value: string) {
  const now = new Date().toISOString();
  await client.execute({
    sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
    args: [key, value, now, value, now],
  });
}

export async function updateMultipleSettings(entries: Record<string, string>) {
  let passwordToUpdate: string | null = null;
  let currentPasswordForVerify: string | null = null;
  let adminUsernameToUpdate: string | null = null;
  let adminNameToUpdate: string | null = null;

  for (const [key, value] of Object.entries(entries)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === 'password' ||
      lowerKey === 'newpassword' ||
      lowerKey === 'new_password' ||
      lowerKey === 'adminpassword' ||
      lowerKey === 'admin_password' ||
      lowerKey === 'master_password'
    ) {
      if (value && String(value).trim()) {
        passwordToUpdate = String(value).trim();
      }
    } else if (lowerKey === 'currentpassword' || lowerKey === 'current_password') {
      if (value && String(value).trim()) {
        currentPasswordForVerify = String(value).trim();
      }
    } else if (lowerKey === 'adminusername' || lowerKey === 'admin_username') {
      if (value && String(value).trim()) {
        adminUsernameToUpdate = String(value).trim();
      }
    } else if (lowerKey === 'adminname' || lowerKey === 'admin_name') {
      if (value && String(value).trim()) {
        adminNameToUpdate = String(value).trim();
      }
    } else {
      await updateSetting(key, value);
    }
  }

  // If any admin credentials or password were provided in settings payload, update admin in users table
  if (passwordToUpdate || adminUsernameToUpdate || adminNameToUpdate) {
    await updateAdminCredentials('admin', {
      currentPassword: currentPasswordForVerify || undefined,
      newPassword: passwordToUpdate || undefined,
      newUsername: adminUsernameToUpdate || undefined,
      name: adminNameToUpdate || undefined,
      requireCurrentPassword: Boolean(currentPasswordForVerify),
    });
  }

  return getAllSettings();
}

export async function getKeyboardShortcuts(): Promise<KeyboardShortcutsConfig> {
  const res = await client.execute({
    sql: 'SELECT value FROM settings WHERE key = ?',
    args: ['keyboard_shortcuts'],
  });

  if (res.rows.length === 0 || !res.rows[0].value) {
    return DEFAULT_SHORTCUTS;
  }

  try {
    const parsed = JSON.parse(String(res.rows[0].value));
    return { ...DEFAULT_SHORTCUTS, ...parsed };
  } catch {
    return DEFAULT_SHORTCUTS;
  }
}

export async function updateKeyboardShortcuts(shortcuts: KeyboardShortcutsConfig) {
  // Validate duplicate/conflicting shortcut assignments
  const values = Object.values(shortcuts).map((v) => v.trim().toUpperCase());
  const seen = new Set<string>();

  for (const v of values) {
    if (seen.has(v)) {
      throw new Error(`Conflicting shortcut: "${v}" is assigned to more than one action.`);
    }
    seen.add(v);
  }

  await updateSetting('keyboard_shortcuts', JSON.stringify(shortcuts));
  return getKeyboardShortcuts();
}

export async function exportDatabaseData() {
  const tables = [
    'users',
    'categories',
    'products',
    'purchases',
    'purchase_items',
    'customers',
    'customer_transactions',
    'sales',
    'sale_items',
    'cash_sessions',
    'cash_movements',
    'expenses',
    'settings',
  ];

  const dump: Record<string, any> = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
  };

  for (const table of tables) {
    const res = await client.execute(`SELECT * FROM ${table}`);
    dump[table] = res.rows;
  }

  return dump;
}

export async function restoreDatabaseData(backup: any) {
  if (!backup || typeof backup !== 'object' || !backup.products || !backup.users) {
    throw new Error('Invalid backup file format.');
  }

  const tx = await client.transaction('write');
  try {
    // Clear and restore tables safely
    const tables = [
      'sale_items',
      'sales',
      'purchase_items',
      'purchases',
      'customer_transactions',
      'cash_movements',
      'cash_sessions',
      'expenses',
      'products',
      'customers',
      'categories',
      'settings',
    ];

    for (const tbl of tables) {
      await tx.execute(`DELETE FROM ${tbl}`);
      if (Array.isArray(backup[tbl])) {
        for (const row of backup[tbl]) {
          const keys = Object.keys(row);
          if (keys.length === 0) continue;
          const placeholders = keys.map(() => '?').join(', ');
          const values = keys.map((k) => row[k]);
          await tx.execute({
            sql: `INSERT INTO ${tbl} (${keys.join(', ')}) VALUES (${placeholders})`,
            args: values,
          });
        }
      }
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  return { success: true };
}
