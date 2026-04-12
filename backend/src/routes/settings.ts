import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireStaff, requireAdmin, type AuthedRequest } from '../middleware/auth.js';

export const settingsRouter = Router();
settingsRouter.use(requireStaff);

settingsRouter.get('/company', async (req: AuthedRequest, res) => {
  const r = await query(`SELECT * FROM companies WHERE id = $1`, [req.staff!.companyId]);
  res.json(r.rows[0] ?? null);
});

/** 業務・会計の運用メモ（管理者のみ更新） */
settingsRouter.patch('/company-policies', requireAdmin, async (req: AuthedRequest, res) => {
  const b = req.body as { operationsPolicy?: string | null; accountingPolicy?: string | null };
  const op =
    b.operationsPolicy === undefined
      ? undefined
      : b.operationsPolicy === null || b.operationsPolicy === ''
        ? null
        : String(b.operationsPolicy);
  const ap =
    b.accountingPolicy === undefined
      ? undefined
      : b.accountingPolicy === null || b.accountingPolicy === ''
        ? null
        : String(b.accountingPolicy);
  if (op === undefined && ap === undefined) {
    res.status(400).json({ error: '更新する項目がありません' });
    return;
  }
  const cur = await query<{ operations_policy: string | null; accounting_policy: string | null }>(
    `SELECT operations_policy, accounting_policy FROM companies WHERE id = $1`,
    [req.staff!.companyId]
  );
  if (!cur.rows[0]) {
    res.status(404).json({ error: '会社が見つかりません' });
    return;
  }
  const nextOp = op === undefined ? cur.rows[0].operations_policy : op;
  const nextAp = ap === undefined ? cur.rows[0].accounting_policy : ap;
  await query(
    `UPDATE companies SET operations_policy = $1, accounting_policy = $2, updated_at = NOW() WHERE id = $3`,
    [nextOp, nextAp, req.staff!.companyId]
  );
  res.json({ ok: true });
});
