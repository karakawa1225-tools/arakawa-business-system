import { Router } from 'express';
import { query, pool } from '../db/pool.js';
import { nextDocumentNo } from '../services/numbers.js';
import { requireStaff, blockViewerWrite, type AuthedRequest } from '../middleware/auth.js';
import { badDateMessage, parseIsoDateStrict } from '../utils/isoDate.js';

type LineInput = {
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
};

async function recalcEstimate(estimateId: string) {
  const lines = await query<{ amount: string; tax_rate: string }>(
    `SELECT amount::text, tax_rate::text FROM estimate_lines WHERE estimate_id = $1 ORDER BY line_no`,
    [estimateId]
  );
  let subtotal = 0;
  let tax = 0;
  for (const l of lines.rows) {
    const a = parseFloat(l.amount);
    const tr = parseFloat(l.tax_rate);
    subtotal += a;
    tax += (a * tr) / 100;
  }
  await query(
    `UPDATE estimates SET subtotal = $1, tax_amount = $2, total = $1 + $2, updated_at = NOW() WHERE id = $3`,
    [subtotal, tax, estimateId]
  );
}

export const estimatesRouter = Router();
estimatesRouter.use(requireStaff);

const ESTIMATE_SELECT = `e.id,
      e.company_id,
      e.customer_id,
      e.estimate_no,
      e.title,
      e.status,
      to_char(e.issue_date, 'YYYY-MM-DD') AS issue_date,
      to_char(e.valid_until, 'YYYY-MM-DD') AS valid_until,
      e.subtotal,
      e.tax_rate,
      e.tax_amount,
      e.total,
      e.notes,
      e.created_by,
      e.created_at,
      e.updated_at`;

estimatesRouter.get('/', async (req: AuthedRequest, res) => {
  const r = await query(
    `SELECT ${ESTIMATE_SELECT}, c.company_name AS customer_name FROM estimates e
     JOIN customers c ON c.id = e.customer_id
     WHERE e.company_id = $1 ORDER BY e.issue_date DESC, e.created_at DESC`,
    [req.staff!.companyId]
  );
  res.json(r.rows);
});

estimatesRouter.get('/:id', async (req: AuthedRequest, res) => {
  const er = await query(
    `SELECT ${ESTIMATE_SELECT} FROM estimates e WHERE e.id = $1 AND e.company_id = $2`,
    [req.params.id, req.staff!.companyId]
  );
  if (!er.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  const lr = await query(
    `SELECT * FROM estimate_lines WHERE estimate_id = $1 ORDER BY line_no`,
    [req.params.id]
  );
  res.json({ ...er.rows[0], lines: lr.rows });
});

estimatesRouter.post('/', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as {
    customerId: string;
    title?: string;
    status?: string;
    issueDate?: string;
    validUntil?: string;
    notes?: string;
    lines: LineInput[];
  };
  if (!b.customerId || !b.lines?.length) {
    res.status(400).json({ error: '顧客と明細は必須です' });
    return;
  }
  const issueRaw = b.issueDate ?? new Date().toISOString().slice(0, 10);
  const issueDate = parseIsoDateStrict(issueRaw);
  if (!issueDate) {
    res.status(400).json({ error: badDateMessage('見積日') });
    return;
  }
  let validUntil: string | null = null;
  if (b.validUntil != null && String(b.validUntil).trim() !== '') {
    const vu = parseIsoDateStrict(b.validUntil);
    if (!vu) {
      res.status(400).json({ error: badDateMessage('有効期限') });
      return;
    }
    validUntil = vu;
  }
  const estimateNo = await nextDocumentNo(req.staff!.companyId, 'estimate');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO estimates (company_id, customer_id, estimate_no, title, status, issue_date, valid_until, notes, created_by)
       VALUES ($1,$2,$3,$4,$5::estimate_status,$6::date,$7::date,$8,$9) RETURNING id`,
      [
        req.staff!.companyId,
        b.customerId,
        estimateNo,
        b.title ?? null,
        b.status ?? 'draft',
        issueDate,
        validUntil,
        b.notes ?? null,
        req.staff!.sub,
      ]
    );
    const id = ins.rows[0].id as string;
    let lineNo = 1;
    for (const ln of b.lines) {
      const qty = Number(ln.quantity) || 0;
      const up = Number(ln.unitPrice) || 0;
      const amount = qty * up;
      const tr = ln.taxRate ?? 10;
      await client.query(
        `INSERT INTO estimate_lines (estimate_id, line_no, product_id, description, quantity, unit_price, amount, tax_rate)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          id,
          lineNo++,
          ln.productId ?? null,
          ln.description,
          qty,
          up,
          amount,
          tr,
        ]
      );
    }
    await client.query('COMMIT');
    await recalcEstimate(id);
    const full = await query(`SELECT ${ESTIMATE_SELECT} FROM estimates e WHERE e.id = $1`, [id]);
    const lr = await query(`SELECT * FROM estimate_lines WHERE estimate_id = $1 ORDER BY line_no`, [id]);
    res.status(201).json({ ...full.rows[0], lines: lr.rows });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

estimatesRouter.put('/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as {
    customerId: string;
    title?: string;
    status?: string;
    issueDate?: string;
    validUntil?: string;
    notes?: string;
    lines: LineInput[];
  };
  const id = String(req.params.id);
  const ex = await query(`SELECT id FROM estimates WHERE id = $1 AND company_id = $2`, [
    id,
    req.staff!.companyId,
  ]);
  if (!ex.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  const issueRaw = b.issueDate ?? new Date().toISOString().slice(0, 10);
  const issueDate = parseIsoDateStrict(issueRaw);
  if (!issueDate) {
    res.status(400).json({ error: badDateMessage('見積日') });
    return;
  }
  let validUntil: string | null = null;
  if (b.validUntil != null && String(b.validUntil).trim() !== '') {
    const vu = parseIsoDateStrict(b.validUntil);
    if (!vu) {
      res.status(400).json({ error: badDateMessage('有効期限') });
      return;
    }
    validUntil = vu;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE estimates SET customer_id=$1, title=$2, status=$3::estimate_status, issue_date=$4::date, valid_until=$5::date, notes=$6, updated_at=NOW()
       WHERE id=$7`,
      [
        b.customerId,
        b.title ?? null,
        b.status ?? 'draft',
        issueDate,
        validUntil,
        b.notes ?? null,
        id,
      ]
    );
    await client.query(`DELETE FROM estimate_lines WHERE estimate_id = $1`, [id]);
    let lineNo = 1;
    for (const ln of b.lines ?? []) {
      const qty = Number(ln.quantity) || 0;
      const up = Number(ln.unitPrice) || 0;
      const amount = qty * up;
      const tr = ln.taxRate ?? 10;
      await client.query(
        `INSERT INTO estimate_lines (estimate_id, line_no, product_id, description, quantity, unit_price, amount, tax_rate)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          id,
          lineNo++,
          ln.productId ?? null,
          ln.description,
          qty,
          up,
          amount,
          tr,
        ]
      );
    }
    await client.query('COMMIT');
    await recalcEstimate(id);
    const full = await query(`SELECT ${ESTIMATE_SELECT} FROM estimates e WHERE e.id = $1`, [id]);
    const lr = await query(
      `SELECT * FROM estimate_lines WHERE estimate_id = $1 ORDER BY line_no`,
      [id]
    );
    res.json({ ...full.rows[0], lines: lr.rows });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

estimatesRouter.delete('/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  await query(`DELETE FROM estimates WHERE id = $1 AND company_id = $2`, [
    String(req.params.id),
    req.staff!.companyId,
  ]);
  res.json({ ok: true });
});
