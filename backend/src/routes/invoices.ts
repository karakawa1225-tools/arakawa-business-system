import { Router } from 'express';
import { query } from '../db/pool.js';
import { pool } from '../db/pool.js';
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

async function recalcInvoice(invoiceId: string) {
  const lines = await query<{ amount: string; tax_rate: string }>(
    `SELECT amount::text, tax_rate::text FROM invoice_lines WHERE invoice_id = $1`,
    [invoiceId]
  );
  let subtotal = 0;
  let tax = 0;
  for (const l of lines.rows) {
    const a = parseFloat(l.amount);
    const tr = parseFloat(l.tax_rate);
    subtotal += a;
    tax += (a * tr) / 100;
  }
  const total = subtotal + tax;
  await query(
    `UPDATE invoices SET subtotal = $1, tax_amount = $2, total = $3, updated_at = NOW() WHERE id = $4`,
    [subtotal, tax, total, invoiceId]
  );
}

export const invoicesRouter = Router();
invoicesRouter.use(requireStaff);

const INVOICE_SELECT = `i.id,
      i.company_id,
      i.customer_id,
      i.sales_order_id,
      i.invoice_no,
      i.status,
      to_char(i.issue_date, 'YYYY-MM-DD') AS issue_date,
      to_char(i.due_date, 'YYYY-MM-DD') AS due_date,
      i.subtotal,
      i.tax_amount,
      i.total,
      i.paid_amount,
      i.notes,
      i.created_by,
      i.created_at,
      i.updated_at`;

invoicesRouter.get('/', async (req: AuthedRequest, res) => {
  const r = await query(
    `SELECT ${INVOICE_SELECT}, c.company_name AS customer_name FROM invoices i
     JOIN customers c ON c.id = i.customer_id
     WHERE i.company_id = $1 ORDER BY i.issue_date DESC`,
    [req.staff!.companyId]
  );
  res.json(r.rows);
});

invoicesRouter.get('/:id', async (req: AuthedRequest, res) => {
  const ir = await query(
    `SELECT ${INVOICE_SELECT} FROM invoices i WHERE i.id = $1 AND i.company_id = $2`,
    [req.params.id, req.staff!.companyId]
  );
  if (!ir.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  const lr = await query(`SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY line_no`, [
    req.params.id,
  ]);
  res.json({ ...ir.rows[0], lines: lr.rows });
});

invoicesRouter.post('/', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as {
    customerId: string;
    salesOrderId?: string | null;
    issueDate?: string;
    dueDate?: string;
    status?: string;
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
    res.status(400).json({ error: badDateMessage('請求日') });
    return;
  }
  let dueDate: string | null = null;
  if (b.dueDate != null && String(b.dueDate).trim() !== '') {
    const dd = parseIsoDateStrict(b.dueDate);
    if (!dd) {
      res.status(400).json({ error: badDateMessage('支払期日') });
      return;
    }
    dueDate = dd;
  }
  const invoiceNo = await nextDocumentNo(req.staff!.companyId, 'invoice');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO invoices (company_id, customer_id, sales_order_id, invoice_no, status, issue_date, due_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5::invoice_status,$6::date,$7::date,$8,$9) RETURNING id`,
      [
        req.staff!.companyId,
        b.customerId,
        b.salesOrderId ?? null,
        invoiceNo,
        b.status ?? 'draft',
        issueDate,
        dueDate,
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
        `INSERT INTO invoice_lines (invoice_id, line_no, product_id, description, quantity, unit_price, amount, tax_rate)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, lineNo++, ln.productId ?? null, ln.description, qty, up, amount, tr]
      );
    }
    await client.query('COMMIT');
    await recalcInvoice(id);
    const full = await query(`SELECT ${INVOICE_SELECT} FROM invoices i WHERE i.id = $1`, [id]);
    const lr = await query(`SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY line_no`, [id]);
    res.status(201).json({ ...full.rows[0], lines: lr.rows });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

invoicesRouter.patch('/:id/status', blockViewerWrite, async (req: AuthedRequest, res) => {
  const { status } = req.body as { status?: string };
  const r = await query(
    `UPDATE invoices SET status = $1::invoice_status, updated_at = NOW() WHERE id = $2 AND company_id = $3 RETURNING *`,
    [status ?? 'issued', req.params.id, req.staff!.companyId]
  );
  if (!r.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  res.json(r.rows[0]);
});
