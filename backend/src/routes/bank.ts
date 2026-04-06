import { Router, type Response } from 'express';
import { query } from '../db/pool.js';
import { requireStaff, blockViewerWrite, type AuthedRequest } from '../middleware/auth.js';
import { recalculateBankAccountBalances } from '../services/bankBalances.js';
import { badDateMessage, parseIsoDateStrict } from '../utils/isoDate.js';

export const bankRouter = Router();
bankRouter.use(requireStaff);

const BANK_TX_ROW = `t.id,
      t.company_id,
      t.bank_account_id,
      to_char(t.tx_date, 'YYYY-MM-DD') AS tx_date,
      t.tx_type,
      t.description,
      t.amount,
      t.balance_after,
      t.reference,
      t.created_at,
      t.updated_at`;

bankRouter.get('/accounts', async (req: AuthedRequest, res) => {
  const r = await query(`SELECT * FROM bank_accounts WHERE company_id = $1 ORDER BY name`, [
    req.staff!.companyId,
  ]);
  res.json(r.rows);
});

bankRouter.get('/transactions', async (req: AuthedRequest, res) => {
  const { accountId } = req.query;
  const r = await query(
    `SELECT
       t.id,
       t.company_id,
       t.bank_account_id,
       to_char(t.tx_date, 'YYYY-MM-DD') AS tx_date,
       t.tx_type,
       t.description,
       t.amount,
       t.balance_after,
       t.reference,
       t.created_at,
       t.updated_at,
       b.name AS bank_account_name
     FROM bank_transactions t
     JOIN bank_accounts b ON b.id = t.bank_account_id
     WHERE t.company_id = $1
     AND ($2::uuid IS NULL OR t.bank_account_id = $2::uuid)
     ORDER BY t.tx_date DESC, t.created_at DESC
     LIMIT 500`,
    [req.staff!.companyId, accountId ?? null]
  );
  res.json(r.rows);
});

/** 1件取得（診断用・編集前の確認用）。一覧は GET /transactions */
bankRouter.get('/transactions/:id', async (req: AuthedRequest, res) => {
  const r = await query(
    `SELECT
       ${BANK_TX_ROW},
       b.name AS bank_account_name
     FROM bank_transactions t
     JOIN bank_accounts b ON b.id = t.bank_account_id
     WHERE t.id = $1 AND t.company_id = $2`,
    [req.params.id, req.staff!.companyId]
  );
  if (!r.rows[0]) {
    res.status(404).json({ error: '取引が見つかりません' });
    return;
  }
  res.json(r.rows[0]);
});

bankRouter.post('/transactions', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as {
    bankAccountId: string;
    txDate: string;
    txType: 'deposit' | 'withdrawal';
    description?: string;
    amount: number;
  };
  if (!b.bankAccountId || !b.txDate || !b.txType || b.amount == null) {
    res.status(400).json({ error: '口座・日付・区分・金額は必須です' });
    return;
  }
  const txDate = parseIsoDateStrict(b.txDate);
  if (!txDate) {
    res.status(400).json({ error: badDateMessage('取引日') });
    return;
  }
  const balRow = await query<{ id: string }>(
    `SELECT id FROM bank_accounts WHERE id = $1 AND company_id = $2`,
    [b.bankAccountId, req.staff!.companyId]
  );
  if (!balRow.rows[0]) {
    res.status(404).json({ error: '口座が見つかりません' });
    return;
  }
  const amt = Number(b.amount);
  const ins = await query(
    `INSERT INTO bank_transactions (company_id, bank_account_id, tx_date, tx_type, description, amount, balance_after)
     VALUES ($1,$2,$3::date,$4::bank_tx_type,$5,$6, NULL) RETURNING *`,
    [req.staff!.companyId, b.bankAccountId, txDate, b.txType, b.description ?? null, amt]
  );
  await recalculateBankAccountBalances(req.staff!.companyId, b.bankAccountId);
  const again = await query(`SELECT * FROM bank_transactions WHERE id = $1`, [ins.rows[0].id]);
  res.status(201).json(again.rows[0]);
});

async function updateBankTransaction(req: AuthedRequest, res: Response) {
  const id = req.params.id;
  const b = req.body as {
    bankAccountId?: string;
    txDate?: string;
    txType?: 'deposit' | 'withdrawal';
    description?: string | null;
    amount?: number;
  };
  const ex = await query<{ bank_account_id: string }>(
    `SELECT bank_account_id FROM bank_transactions WHERE id = $1 AND company_id = $2`,
    [id, req.staff!.companyId]
  );
  if (!ex.rows[0]) {
    res.status(404).json({ error: '取引が見つかりません' });
    return;
  }
  const oldAcc = ex.rows[0].bank_account_id;
  let nextAcc = b.bankAccountId ?? oldAcc;
  if (nextAcc !== oldAcc) {
    const accOk = await query(`SELECT id FROM bank_accounts WHERE id = $1 AND company_id = $2`, [
      nextAcc,
      req.staff!.companyId,
    ]);
    if (!accOk.rows[0]) {
      res.status(400).json({ error: '口座が見つかりません' });
      return;
    }
  }
  let txDateSql: string | null = null;
  if (b.txDate !== undefined) {
    const d = parseIsoDateStrict(b.txDate);
    if (!d) {
      res.status(400).json({ error: badDateMessage('取引日') });
      return;
    }
    txDateSql = d;
  }
  const sets: string[] = [];
  const params: unknown[] = [];
  let n = 1;
  if (b.bankAccountId !== undefined) {
    sets.push(`bank_account_id = $${n++}`);
    params.push(nextAcc);
  }
  if (txDateSql !== null) {
    sets.push(`tx_date = $${n++}::date`);
    params.push(txDateSql);
  }
  if (b.txType !== undefined) {
    sets.push(`tx_type = $${n++}::bank_tx_type`);
    params.push(b.txType);
  }
  if (b.description !== undefined) {
    sets.push(`description = $${n++}`);
    params.push(b.description);
  }
  if (b.amount !== undefined) {
    sets.push(`amount = $${n++}`);
    params.push(Number(b.amount));
  }
  if (sets.length === 0) {
    res.status(400).json({ error: '更新項目がありません' });
    return;
  }
  sets.push('updated_at = NOW()');
  params.push(id, req.staff!.companyId);
  await query(
    `UPDATE bank_transactions SET ${sets.join(', ')} WHERE id = $${n++} AND company_id = $${n++}`,
    params
  );
  const toRecalc = new Set<string>([oldAcc, nextAcc]);
  for (const accId of toRecalc) {
    await recalculateBankAccountBalances(req.staff!.companyId, accId);
  }
  const row = await query(`SELECT ${BANK_TX_ROW} FROM bank_transactions t WHERE t.id = $1`, [id]);
  res.json(row.rows[0]);
}

bankRouter.patch('/transactions/:id', blockViewerWrite, updateBankTransaction);
bankRouter.put('/transactions/:id', blockViewerWrite, updateBankTransaction);

async function removeBankTransaction(req: AuthedRequest, res: Response) {
  const id = req.params.id;
  const ex = await query<{ bank_account_id: string }>(
    `SELECT bank_account_id FROM bank_transactions WHERE id = $1 AND company_id = $2`,
    [id, req.staff!.companyId]
  );
  if (!ex.rows[0]) {
    res.status(404).json({ error: '取引が見つかりません' });
    return;
  }
  const accId = ex.rows[0].bank_account_id;
  await query(`DELETE FROM bank_transactions WHERE id = $1 AND company_id = $2`, [id, req.staff!.companyId]);
  await recalculateBankAccountBalances(req.staff!.companyId, accId);
  res.json({ ok: true });
}

bankRouter.delete('/transactions/:id', blockViewerWrite, removeBankTransaction);
