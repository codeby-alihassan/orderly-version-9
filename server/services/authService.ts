import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { client } from '../db/index.js';

export interface UserSession {
  token: string;
  user: {
    id: string;
    username: string;
    name: string;
    role: string;
    permissions: string[];
  };
}

export const ALL_MODULE_PERMISSIONS = [
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
];

export async function loginUser(username: string, password: string): Promise<UserSession | null> {
  const cleanIdentifier = (username || '').trim().toLowerCase();
  const rawIdentifier = (username || '').trim();
  const cleanPassword = String(password ?? '');
  const trimmedPassword = cleanPassword.trim();

  if (!cleanIdentifier || cleanPassword === '') {
    return null;
  }

  // Look up user by either lowercase username, lowercase full name, ID, or fallback for admin
  const result = await client.execute({
    sql: `
      SELECT id, username, password_hash, name, role, permissions, is_active 
      FROM users 
      WHERE LOWER(TRIM(username)) = ? 
         OR LOWER(TRIM(name)) = ? 
         OR LOWER(TRIM(id)) = ?
         OR username = ? COLLATE NOCASE
         OR name = ? COLLATE NOCASE
         OR LOWER(TRIM(name)) LIKE ?
         OR (role = 'admin' AND (? = 'admin' OR ? = 'administrator'))
    `,
    args: [cleanIdentifier, cleanIdentifier, cleanIdentifier, rawIdentifier, rawIdentifier, `${cleanIdentifier}%`, cleanIdentifier, cleanIdentifier],
  });

  if (result.rows.length === 0) {
    throw new Error('User not found. Please check your username or staff name.');
  }

  // Find the matching row whose password matches
  let matchedRow: any = null;
  for (const row of result.rows) {
    const hash = String(row.password_hash || '');
    const matches =
      bcrypt.compareSync(cleanPassword, hash) ||
      bcrypt.compareSync(trimmedPassword, hash) ||
      hash === cleanPassword ||
      hash === trimmedPassword;

    if (matches) {
      matchedRow = row;
      break;
    }
  }

  if (!matchedRow) {
    throw new Error('Invalid password or PIN.');
  }

  if (matchedRow.is_active === 0 || matchedRow.is_active === '0' || matchedRow.is_active === false) {
    throw new Error('This staff account is deactivated. Please contact an administrator.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const createdAt = new Date().toISOString();

  await client.execute({
    sql: 'INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [`sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, String(matchedRow.id), token, expiresAt, createdAt],
  });

  let permissions: string[] = ALL_MODULE_PERMISSIONS;
  if (matchedRow.role !== 'admin') {
    try {
      if (Array.isArray(matchedRow.permissions)) {
        permissions = matchedRow.permissions;
      } else if (typeof matchedRow.permissions === 'string' && matchedRow.permissions.trim()) {
        const parsed = JSON.parse(matchedRow.permissions);
        permissions = Array.isArray(parsed) && parsed.length > 0 ? parsed : ['pos', 'invoices'];
      } else {
        permissions = ['pos', 'invoices'];
      }
    } catch {
      permissions = ['pos', 'invoices'];
    }
  }

  return {
    token,
    user: {
      id: String(matchedRow.id),
      username: String(matchedRow.username),
      name: String(matchedRow.name),
      role: String(matchedRow.role),
      permissions,
    },
  };
}

export async function getUserByToken(token: string) {
  if (!token) return null;

  const result = await client.execute({
    sql: `
      SELECT u.id, u.username, u.name, u.role, u.permissions, s.expires_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ?
    `,
    args: [token],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  if (new Date(String(row.expires_at)) < new Date()) {
    return null;
  }

  let permissions: string[] = ALL_MODULE_PERMISSIONS;
  if (row.role !== 'admin') {
    try {
      permissions = row.permissions ? JSON.parse(String(row.permissions)) : ['pos', 'invoices'];
    } catch {
      permissions = ['pos', 'invoices'];
    }
  }

  return {
    id: String(row.id),
    username: String(row.username),
    name: String(row.name),
    role: String(row.role),
    permissions,
  };
}

export async function logoutUser(token: string) {
  await client.execute({
    sql: 'DELETE FROM sessions WHERE token = ?',
    args: [token],
  });
}

export async function updatePassword(
  userIdOrIdentifier: string,
  currentPassOrNewPass: string,
  maybeNewPass?: string
) {
  let currentPassword = '';
  let newPassword = '';

  if (maybeNewPass !== undefined) {
    currentPassword = currentPassOrNewPass;
    newPassword = maybeNewPass;
  } else {
    newPassword = currentPassOrNewPass;
  }

  return updateAdminCredentials(userIdOrIdentifier, {
    currentPassword: currentPassword || undefined,
    newPassword,
    requireCurrentPassword: Boolean(maybeNewPass !== undefined && currentPassword),
  });
}

export async function updateAdminCredentials(
  userIdOrIdentifier: string,
  data: {
    currentPassword?: string;
    newUsername?: string;
    newPassword?: string;
    name?: string;
    requireCurrentPassword?: boolean;
  }
) {
  let resolvedUser: any = null;
  const cleanId = String(userIdOrIdentifier || '').trim();

  if (cleanId) {
    const userRes = await client.execute({
      sql: `
        SELECT id, username, password_hash, name, role, permissions, is_active 
        FROM users 
        WHERE id = ? 
           OR LOWER(username) = LOWER(?) 
           OR LOWER(name) = LOWER(?) 
           OR (role = 'admin' AND (? = 'admin' OR ? = 'usr_admin_default'))
        LIMIT 1
      `,
      args: [cleanId, cleanId, cleanId, cleanId, cleanId],
    });
    if (userRes.rows.length > 0) {
      resolvedUser = userRes.rows[0];
    }
  }

  // Fallback: If still not resolved or empty identifier, find the primary admin
  if (!resolvedUser) {
    const adminRes = await client.execute({
      sql: `SELECT id, username, password_hash, name, role, permissions, is_active FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`,
    });
    if (adminRes.rows.length > 0) {
      resolvedUser = adminRes.rows[0];
    }
  }

  if (!resolvedUser) {
    throw new Error('Administrator account not found.');
  }

  const targetUserId = String(resolvedUser.id);
  const currentHash = String(resolvedUser.password_hash || '');
  const currentPass = String(data.currentPassword ?? '').trim();
  const shouldRequireCurrentPass = data.requireCurrentPassword !== false && (data.currentPassword !== undefined);

  if (shouldRequireCurrentPass && currentPass) {
    const matches =
      bcrypt.compareSync(currentPass, currentHash) ||
      bcrypt.compareSync(String(data.currentPassword), currentHash) ||
      currentHash === currentPass ||
      currentHash === String(data.currentPassword) ||
      (currentPass === 'admin123' && (currentHash === 'admin123' || bcrypt.compareSync('admin123', currentHash)));

    if (!matches) {
      throw new Error('Current password does not match. Please verify and try again.');
    }
  } else if (data.requireCurrentPassword === true && !currentPass) {
    throw new Error('Current password is required to verify your administrator credentials.');
  }

  let finalUsername = String(resolvedUser.username);
  if (data.newUsername && data.newUsername.trim()) {
    const cleanUsername = data.newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) {
      throw new Error('Username must be at least 3 characters long and alphanumeric.');
    }
    // Check if taken by another user
    const check = await client.execute({
      sql: 'SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?',
      args: [cleanUsername, targetUserId],
    });
    if (check.rows.length > 0) {
      throw new Error('Username is already taken by another staff or admin account.');
    }
    finalUsername = cleanUsername;
    await client.execute({
      sql: 'UPDATE users SET username = ? WHERE id = ?',
      args: [finalUsername, targetUserId],
    });
  }

  let finalName = String(resolvedUser.name);
  if (data.name && data.name.trim()) {
    finalName = data.name.trim();
    await client.execute({
      sql: 'UPDATE users SET name = ? WHERE id = ?',
      args: [finalName, targetUserId],
    });
  }

  if (data.newPassword && String(data.newPassword).trim()) {
    const cleanNewPass = String(data.newPassword).trim();
    if (cleanNewPass.length < 4) {
      throw new Error('New password must be at least 4 characters long.');
    }
    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(cleanNewPass, salt);
    await client.execute({
      sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
      args: [newHash, targetUserId],
    });
  }

  // Ensure admin account retains master role and all permissions
  if (resolvedUser.role === 'admin') {
    const adminPerms = JSON.stringify(ALL_MODULE_PERMISSIONS);
    await client.execute({
      sql: "UPDATE users SET role = 'admin', is_active = 1, permissions = ? WHERE id = ?",
      args: [adminPerms, targetUserId],
    });
  }

  let permissions: string[] = ALL_MODULE_PERMISSIONS;
  if (resolvedUser.role !== 'admin') {
    try {
      if (Array.isArray(resolvedUser.permissions)) {
        permissions = resolvedUser.permissions;
      } else if (typeof resolvedUser.permissions === 'string' && resolvedUser.permissions.trim()) {
        const parsed = JSON.parse(resolvedUser.permissions);
        permissions = Array.isArray(parsed) ? parsed : ['pos', 'invoices'];
      }
    } catch {
      permissions = ['pos', 'invoices'];
    }
  }

  return {
    id: targetUserId,
    username: finalUsername,
    name: finalName,
    role: String(resolvedUser.role),
    permissions,
  };
}

export async function listUsers() {
  const res = await client.execute('SELECT id, username, name, role, is_active, permissions, created_at FROM users ORDER BY created_at ASC');
  return res.rows.map((r) => {
    let permissions: string[] = ALL_MODULE_PERMISSIONS;
    if (r.role !== 'admin') {
      try {
        permissions = r.permissions ? JSON.parse(String(r.permissions)) : ['pos', 'invoices'];
      } catch {
        permissions = ['pos', 'invoices'];
      }
    }
    return {
      id: String(r.id),
      username: String(r.username),
      name: String(r.name),
      role: String(r.role),
      isActive: Boolean(r.is_active),
      permissions,
      createdAt: String(r.created_at),
    };
  });
}

export async function getSetupStatus() {
  const result = await client.execute("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
  const adminCount = Number(result.rows[0]?.count || 0);
  return {
    setupRequired: adminCount === 0,
    hasUsers: adminCount > 0,
  };
}

export async function setupInitialAdmin(data: {
  name: string;
  username: string;
  password: string;
  storeName?: string;
  currency?: string;
}): Promise<UserSession> {
  const status = await getSetupStatus();
  if (!status.setupRequired) {
    throw new Error('Initial system administrator has already been established.');
  }

  const name = data.name?.trim();
  const username = data.username?.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const password = data.password?.trim();

  if (!name || name.length < 2) {
    throw new Error('Administrator name must be at least 2 characters.');
  }
  if (!username || username.length < 3) {
    throw new Error('Username must be at least 3 characters and contain alphanumeric characters.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);
  const userId = `usr_${Date.now()}_admin`;
  const now = new Date().toISOString();
  const adminPermissions = JSON.stringify(ALL_MODULE_PERMISSIONS);

  await client.execute({
    sql: 'INSERT INTO users (id, username, password_hash, name, role, is_active, permissions, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
    args: [userId, username, hash, name, 'admin', adminPermissions, now],
  });

  if (data.storeName?.trim()) {
    await client.execute({
      sql: "INSERT INTO settings (key, value, updated_at) VALUES ('shop_name', ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?",
      args: [data.storeName.trim(), now, data.storeName.trim(), now],
    });
  }

  if (data.currency?.trim()) {
    await client.execute({
      sql: "INSERT INTO settings (key, value, updated_at) VALUES ('currency', ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?",
      args: [data.currency.trim(), now, data.currency.trim(), now],
    });
  }

  // Generate session token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await client.execute({
    sql: 'INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [`sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, userId, token, expiresAt, now],
  });

  return {
    token,
    user: {
      id: userId,
      username,
      name,
      role: 'admin',
      permissions: ALL_MODULE_PERMISSIONS,
    },
  };
}

export async function createUser(data: {
  name: string;
  username?: string;
  pin: string;
  role: 'admin' | 'cashier';
  permissions?: string[];
}) {
  if (!data.name?.trim()) throw new Error('Staff member name is required');
  if (!data.pin?.trim()) throw new Error('PIN or Password is required');

  let username = data.username?.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!username) {
    username = data.name.trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '');
    if (!username) {
      username = `staff_${Date.now().toString().slice(-4)}`;
    }
  }

  // Check if username taken
  const check = await client.execute({
    sql: 'SELECT id FROM users WHERE LOWER(username) = LOWER(?)',
    args: [username],
  });
  if (check.rows.length > 0) {
    username = `${username}_${Math.floor(1 + Math.random() * 99)}`;
  }

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(String(data.pin).trim(), salt);
  const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const perms = data.role === 'admin'
    ? ALL_MODULE_PERMISSIONS
    : (Array.isArray(data.permissions) && data.permissions.length > 0 ? data.permissions : ['pos', 'invoices']);

  await client.execute({
    sql: 'INSERT INTO users (id, username, password_hash, name, role, is_active, permissions, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
    args: [id, username, hash, data.name.trim(), data.role, JSON.stringify(perms), now],
  });

  return { id, username, name: data.name.trim(), role: data.role, permissions: perms };
}

export async function updateUserPermissions(userId: string, permissions: string[]) {
  const check = await client.execute({
    sql: 'SELECT role FROM users WHERE id = ?',
    args: [userId],
  });
  if (check.rows.length === 0) {
    throw new Error('User not found');
  }

  const finalPerms = check.rows[0].role === 'admin' ? ALL_MODULE_PERMISSIONS : permissions;
  await client.execute({
    sql: 'UPDATE users SET permissions = ? WHERE id = ?',
    args: [JSON.stringify(finalPerms), userId],
  });

  return { success: true, permissions: finalPerms };
}

export async function deleteUser(userId: string, currentUserId?: string) {
  if (userId === currentUserId) {
    throw new Error('Cannot delete your own active administrator account.');
  }
  const check = await client.execute({
    sql: 'SELECT id, role, name FROM users WHERE id = ?',
    args: [userId],
  });
  if (check.rows.length === 0) {
    throw new Error('User account not found.');
  }

  // Clear active sessions
  await client.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [userId] });

  // Clear held orders created by user if any
  try {
    await client.execute({ sql: 'DELETE FROM held_orders WHERE user_id = ?', args: [userId] });
  } catch {
    // ignore
  }

  // Delete user record safely
  try {
    await client.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] });
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY')) {
      // Historical references exist: temporarily disable foreign keys to delete the user or handle gracefully
      await client.execute('PRAGMA foreign_keys = OFF;');
      await client.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] });
      await client.execute('PRAGMA foreign_keys = ON;');
    } else {
      throw err;
    }
  }

  return { success: true };
}

