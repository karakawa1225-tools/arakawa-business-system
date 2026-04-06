import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireStaff, type AuthedRequest } from '../middleware/auth.js';

export const settingsRouter = Router();
settingsRouter.use(requireStaff);

settingsRouter.get('/company', async (req: AuthedRequest, res) => {
  const r = await query(`SELECT * FROM companies WHERE id = $1`, [req.staff!.companyId]);
  res.json(r.rows[0] ?? null);
});
