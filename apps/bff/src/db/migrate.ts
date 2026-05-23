import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { pool } from './client';

export async function runMigrations(): Promise<void> {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schema);
  console.log('[db] schema applied');
}

export async function runSeed(): Promise<void> {
  const seedSQL = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
  await pool.query(seedSQL);

  const passwordHash = await bcrypt.hash('demo1234', 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ('demo@example.com', $1, 'Demo User')
     ON CONFLICT (email) DO NOTHING`,
    [passwordHash],
  );

  // Seed a few orders for the demo user so get_order_status has data to return
  const { rows: users } = await pool.query(
    `SELECT id FROM users WHERE email = 'demo@example.com'`,
  );
  const { rows: products } = await pool.query(`SELECT id FROM products LIMIT 4`);
  const statuses = ['delivered', 'shipped', 'processing', 'pending'];

  const { rows: existing } = await pool.query(`SELECT COUNT(*) FROM orders`);
  if (parseInt(existing[0].count) === 0 && users[0]) {
    for (let i = 0; i < products.length; i++) {
      await pool.query(
        `INSERT INTO orders (user_id, product_id, status, quantity) VALUES ($1, $2, $3, $4)`,
        [users[0].id, products[i].id, statuses[i], i + 1],
      );
    }
  }

  console.log('[db] seed complete — demo@example.com / demo1234');
}
