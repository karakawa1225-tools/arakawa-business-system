import { Router, type Response } from 'express';
import { query } from '../db/pool.js';
import { requireStaff, blockViewerWrite, type AuthedRequest } from '../middleware/auth.js';
import { badDateMessage, parseIsoDateStrict } from '../utils/isoDate.js';

export const expensesRouter = Router();
expensesRouter.use(requireStaff);

expensesRouter.get('/', async (req: AuthedRequest, res) => {
  const { month } = req.query;
  let sql = `SELECT
      e.id,
      e.company_id,
      to_char(e.expense_date, 'YYYY-MM-DD') AS expense_date,
      e.chart_account_id,
      e.category_id,
      e.amount,
      e.tax_rate,
      e.tax_division_id,
      e.supplier_invoice_no,
      e.payment_destination,
      e.description,
      e.user_id,
      e.receipt_image_url,
      e.created_at,
      e.updated_at,
    a.name AS account_name,
    u.name AS user_name,
    COALESCE(td.label,
      CASE
        WHEN e.tax_rate = 10 THEN '消費税10%'
        WHEN e.tax_rate = 8 THEN '消費税8%'
        WHEN e.tax_rate = 0 THEN '非課税'
        ELSE '不明'
      END
    ) AS tax_division_label,
    td.code AS tax_division_code
     FROM expenses e
     JOIN chart_of_accounts a ON a.id = e.chart_account_id
     LEFT JOIN users u ON u.id = e.user_id
    LEFT JOIN tax_divisions td ON td.id = e.tax_division_id
    WHERE e.company_id = $1`;
  const params: unknown[] = [req.staff!.companyId];
  if (month && typeof month === 'string') {
    sql += ` AND to_char(e.expense_date, 'YYYY-MM') = $2`;
    params.push(month);
  }
  sql += ` ORDER BY e.expense_date DESC`;
  const r = await query(sql, params);
  res.json(r.rows);
});

/**
 * GET /api/expenses/history — :id より先に登録する（パス衝突防止）
 */
expensesRouter.get('/history', async (req: AuthedRequest, res) => {
  const paymentDestination = req.query.paymentDestination;
  if (!paymentDestination || typeof paymentDestination !== 'string') {
    res.status(400).json({ error: 'paymentDestination が必要です' });
    return;
  }

  const co = await query<{
    found: boolean;
    expense_date: string;
    chart_account_id: string;
    tax_division_code: string | null;
    supplier_invoice_no: string | null;
    description: string | null;
  }>(
    `SELECT
      to_char(e.expense_date, 'YYYY-MM-DD') AS expense_date,
      e.chart_account_id::text AS chart_account_id,
      td.code AS tax_division_code,
      e.supplier_invoice_no,
      e.description
     FROM expenses e
     LEFT JOIN tax_divisions td ON td.id = e.tax_division_id
     WHERE e.company_id = $1
       AND e.payment_destination = $2
     ORDER BY e.expense_date DESC, e.created_at DESC
     LIMIT 1`,
    [req.staff!.companyId, paymentDestination]
  );

  if (co.rows.length === 0) {
    res.json({ found: false });
    return;
  }

  const row = co.rows[0];
  res.json({
    found: true,
    expenseDate: row.expense_date,
    chartAccountId: row.chart_account_id,
    taxDivisionCode: row.tax_division_code,
    supplierInvoiceNo: row.supplier_invoice_no,
    description: row.description,
  });
});

/** 1件取得（編集画面用） */
expensesRouter.get('/:id', async (req: AuthedRequest, res) => {
  const r = await query(
    `SELECT
      e.id,
      e.company_id,
      to_char(e.expense_date, 'YYYY-MM-DD') AS expense_date,
      e.chart_account_id,
      e.category_id,
      e.amount,
      e.tax_rate,
      e.tax_division_id,
      e.supplier_invoice_no,
      e.payment_destination,
      e.description,
      e.user_id,
      e.receipt_image_url,
      e.created_at,
      e.updated_at,
    a.name AS account_name,
    u.name AS user_name,
    COALESCE(td.label,
      CASE
        WHEN e.tax_rate = 10 THEN '消費税10%'
        WHEN e.tax_rate = 8 THEN '消費税8%'
        WHEN e.tax_rate = 0 THEN '非課税'
        ELSE '不明'
      END
    ) AS tax_division_label,
    td.code AS tax_division_code
     FROM expenses e
     JOIN chart_of_accounts a ON a.id = e.chart_account_id
     LEFT JOIN users u ON u.id = e.user_id
    LEFT JOIN tax_divisions td ON td.id = e.tax_division_id
    WHERE e.id = $1 AND e.company_id = $2`,
    [req.params.id, req.staff!.companyId]
  );
  if (!r.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  res.json(r.rows[0]);
});

expensesRouter.post('/', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as {
    expenseDate: string;
    chartAccountId: string;
    categoryId?: string | null;
    amount: number;
    taxRate?: number;
    taxDivisionId?: string | null;
    supplierInvoiceNo?: string | null;
    paymentDestination?: string | null;
    description?: string;
    receiptImageUrl?: string | null;
  };
  if (!b.expenseDate || !b.chartAccountId || b.amount == null) {
    res.status(400).json({ error: '日付・勘定科目・金額は必須です' });
    return;
  }
  const expenseDate = parseIsoDateStrict(b.expenseDate);
  if (!expenseDate) {
    res.status(400).json({ error: badDateMessage('経費日付') });
    return;
  }

  const companyId = req.staff!.companyId;
  const resolvedTaxDivisionId = await resolveTaxDivisionId(companyId, b);

  const r = await query(
    `INSERT INTO expenses (
      company_id,
      expense_date,
      chart_account_id,
      category_id,
      amount,
      tax_rate,
      tax_division_id,
      supplier_invoice_no,
      payment_destination,
      description,
      user_id,
      receipt_image_url
    )
     VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING
       id,
       company_id,
       to_char(expense_date, 'YYYY-MM-DD') AS expense_date,
       chart_account_id,
       category_id,
       amount,
       tax_rate,
       tax_division_id,
       supplier_invoice_no,
       payment_destination,
       description,
       user_id,
       receipt_image_url,
       created_at,
       updated_at`,
    [
      companyId,
      expenseDate,
      b.chartAccountId,
      b.categoryId ?? null,
      b.amount,
      b.taxRate ?? 10,
      resolvedTaxDivisionId,
      b.supplierInvoiceNo ?? null,
      b.paymentDestination ?? null,
      b.description ?? null,
      req.staff!.sub,
      b.receiptImageUrl ?? null,
    ]
  );
  res.status(201).json(r.rows[0]);
});

async function resolveTaxDivisionId(
  companyId: string,
  b: {
    taxDivisionId?: string | null;
    taxRate?: number;
  }
): Promise<string | null> {
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let resolvedTaxDivisionId: string | null = b.taxDivisionId ?? null;
  if (resolvedTaxDivisionId && !uuidLike.test(resolvedTaxDivisionId)) {
    const td = await query<{ id: string }>(
      `SELECT id FROM tax_divisions WHERE company_id = $1 AND code = $2 LIMIT 1`,
      [companyId, resolvedTaxDivisionId]
    );
    resolvedTaxDivisionId = td.rows[0]?.id ?? null;
  }
  if (!resolvedTaxDivisionId && b.taxRate != null) {
    const taxRate = Number(b.taxRate);
    const code = taxRate === 10 ? 'T10' : taxRate === 8 ? 'T8' : taxRate === 0 ? 'EXEMPT' : null;
    if (code) {
      const td = await query<{ id: string }>(
        `SELECT id FROM tax_divisions WHERE company_id = $1 AND code = $2 LIMIT 1`,
        [companyId, code]
      );
      resolvedTaxDivisionId = td.rows[0]?.id ?? null;
    }
  }
  return resolvedTaxDivisionId;
}

expensesRouter.patch('/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as {
    expenseDate?: string;
    chartAccountId?: string;
    amount?: number;
    taxRate?: number;
    taxDivisionId?: string | null;
    supplierInvoiceNo?: string | null;
    paymentDestination?: string | null;
    description?: string | null;
    receiptImageUrl?: string | null;
  };
  const companyId = req.staff!.companyId;
  const ex = await query(`SELECT id FROM expenses WHERE id = $1 AND company_id = $2`, [
    req.params.id,
    companyId,
  ]);
  if (!ex.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  const sets: string[] = [];
  const params: unknown[] = [];
  let n = 1;
  if (b.expenseDate !== undefined) {
    const d = parseIsoDateStrict(b.expenseDate);
    if (!d) {
      res.status(400).json({ error: badDateMessage('経費日付') });
      return;
    }
    sets.push(`expense_date = $${n++}::date`);
    params.push(d);
  }
  if (b.chartAccountId !== undefined) {
    sets.push(`chart_account_id = $${n++}`);
    params.push(b.chartAccountId);
  }
  if (b.amount !== undefined) {
    sets.push(`amount = $${n++}`);
    params.push(b.amount);
  }
  if (b.taxRate !== undefined) {
    sets.push(`tax_rate = $${n++}`);
    params.push(b.taxRate);
  }
  if (b.taxDivisionId !== undefined || b.taxRate !== undefined) {
    const resolved = await resolveTaxDivisionId(companyId, b);
    sets.push(`tax_division_id = $${n++}`);
    params.push(resolved);
  }
  if (b.supplierInvoiceNo !== undefined) {
    sets.push(`supplier_invoice_no = $${n++}`);
    params.push(b.supplierInvoiceNo);
  }
  if (b.paymentDestination !== undefined) {
    sets.push(`payment_destination = $${n++}`);
    params.push(b.paymentDestination);
  }
  if (b.description !== undefined) {
    sets.push(`description = $${n++}`);
    params.push(b.description);
  }
  if (b.receiptImageUrl !== undefined) {
    sets.push(`receipt_image_url = $${n++}`);
    params.push(b.receiptImageUrl);
  }
  if (sets.length === 0) {
    res.status(400).json({ error: '更新項目がありません' });
    return;
  }
  sets.push('updated_at = NOW()');
  params.push(req.params.id, companyId);
  await query(`UPDATE expenses SET ${sets.join(', ')} WHERE id = $${n++} AND company_id = $${n++}`, params);
  const row = await query(
    `SELECT
      e.id,
      e.company_id,
      to_char(e.expense_date, 'YYYY-MM-DD') AS expense_date,
      e.chart_account_id,
      e.category_id,
      e.amount,
      e.tax_rate,
      e.tax_division_id,
      e.supplier_invoice_no,
      e.payment_destination,
      e.description,
      e.user_id,
      e.receipt_image_url,
      e.created_at,
      e.updated_at,
    a.name AS account_name,
    u.name AS user_name,
    COALESCE(td.label,
      CASE
        WHEN e.tax_rate = 10 THEN '消費税10%'
        WHEN e.tax_rate = 8 THEN '消費税8%'
        WHEN e.tax_rate = 0 THEN '非課税'
        ELSE '不明'
      END
    ) AS tax_division_label,
    td.code AS tax_division_code
     FROM expenses e
     JOIN chart_of_accounts a ON a.id = e.chart_account_id
     LEFT JOIN users u ON u.id = e.user_id
    LEFT JOIN tax_divisions td ON td.id = e.tax_division_id
    WHERE e.id = $1`,
    [req.params.id]
  );
  res.json(row.rows[0]);
});

async function removeExpense(req: AuthedRequest, res: Response) {
  await query(`DELETE FROM expenses WHERE id = $1 AND company_id = $2`, [
    req.params.id,
    req.staff!.companyId,
  ]);
  res.json({ ok: true });
}

expensesRouter.delete('/:id', blockViewerWrite, removeExpense);
expensesRouter.post('/:id/delete', blockViewerWrite, removeExpense);
