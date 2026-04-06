import { Router } from 'express';
import { query } from '../db/pool.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signStaffToken, signCustomerToken } from '../utils/jwt.js';
import { requireStaff, type AuthedRequest } from '../middleware/auth.js';
import { sendServerError } from '../utils/httpError.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'メールとパスワードを入力してください' });
      return;
    }
    const r = await query<{
      id: string;
      company_id: string;
      password_hash: string;
      role: string;
      name: string;
    }>(
      `SELECT id, company_id, password_hash, role::text, name FROM users WHERE email = $1 AND active = TRUE`,
      [email]
    );
    const u = r.rows[0];
    if (!u || !(await verifyPassword(password, u.password_hash))) {
      res.status(401).json({ error: 'ログインに失敗しました' });
      return;
    }
    const token = signStaffToken({
      sub: u.id,
      companyId: u.company_id,
      role: u.role,
    });
    res.json({
      token,
      user: { id: u.id, name: u.name, role: u.role, companyId: u.company_id },
    });
  } catch (e) {
    sendServerError(res, e);
  }
});

authRouter.post('/customer-login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'メールとパスワードを入力してください' });
      return;
    }
    const r = await query<{
      id: string;
      customer_id: string;
      password_hash: string;
      company_id: string;
    }>(
      `SELECT cpu.id, cpu.customer_id, cpu.password_hash, c.company_id
       FROM customer_portal_users cpu
       JOIN customers c ON c.id = cpu.customer_id
       WHERE cpu.email = $1 AND cpu.active = TRUE`,
      [email]
    );
    const row = r.rows[0];
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      res.status(401).json({ error: 'ログインに失敗しました' });
      return;
    }
    const token = signCustomerToken({
      sub: row.id,
      companyId: row.company_id,
      customerId: row.customer_id,
    });
    res.json({ token, customerId: row.customer_id, companyId: row.company_id });
  } catch (e) {
    sendServerError(res, e);
  }
});

authRouter.get('/me', requireStaff, async (req: AuthedRequest, res) => {
  try {
    const r = await query<{ id: string; name: string; email: string; role: string }>(
      `SELECT id, name, email, role::text FROM users WHERE id = $1`,
      [req.staff!.sub]
    );
    const u = r.rows[0];
    if (!u) {
      res.status(404).json({ error: 'ユーザーが見つかりません' });
      return;
    }
    res.json({ ...u, companyId: req.staff!.companyId });
  } catch (e) {
    sendServerError(res, e);
  }
});
