import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne } from '../db/client';

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
}

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = await queryOne<UserRow>(`SELECT * FROM users WHERE email = $1`, [email]);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({ id: user.id, email: user.email, name: user.name });
});

export default router;
