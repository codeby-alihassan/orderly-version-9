import { client } from '../db/index.js';

export async function listHeldOrders(userId?: string) {
  const query = userId
    ? 'SELECT * FROM held_orders WHERE user_id = ? ORDER BY created_at DESC'
    : 'SELECT * FROM held_orders ORDER BY created_at DESC';
  const args = userId ? [userId] : [];

  const res = await client.execute({ sql: query, args });

  return res.rows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    referenceName: String(r.reference_name),
    cartData: JSON.parse(String(r.cart_data_json)),
    createdAt: String(r.created_at),
  }));
}

export async function holdOrder(userId: string, referenceName: string, cartData: any) {
  if (!cartData || !cartData.items || cartData.items.length === 0) {
    throw new Error('Cannot hold an empty cart');
  }

  const id = `hold_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  await client.execute({
    sql: 'INSERT INTO held_orders (id, user_id, reference_name, cart_data_json, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [id, userId, referenceName.trim() || `Hold #${Date.now().toString().slice(-4)}`, JSON.stringify(cartData), now],
  });

  return { id, referenceName, cartData, createdAt: now };
}

export async function deleteHeldOrder(id: string) {
  await client.execute({
    sql: 'DELETE FROM held_orders WHERE id = ?',
    args: [id],
  });
  return { success: true };
}
