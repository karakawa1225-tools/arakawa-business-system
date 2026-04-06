import { Router, type Response } from 'express';
import { query } from '../db/pool.js';
import { requireStaff, blockViewerWrite, type AuthedRequest } from '../middleware/auth.js';

export const arLedgerRouter = Router();
arLedgerRouter.use(requireStaff);

function monthStart(ym: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(ym)) return null;
  return `${ym}-01`;
}

arLedgerRouter.get('/', async (req: AuthedRequest, res) => {
  const month = typeof req.query.month === 'string' ? req.query.month : '';
  const start = monthStart(month);
  if (!start) {
    res.status(400).json({ error: 'month は YYYY-MM 形式で指定してください' });
    return;
  }
  const r = await query(
    `SELECT a.*, c.company_name AS customer_name
     FROM ar_ledger a
     JOIN customers c ON c.id = a.customer_id
     WHERE a.company_id = $1 AND a.period_month = $2::date
     ORDER BY c.customer_code, c.company_name`,
    [req.staff!.companyId, start]
  );
  res.json(r.rows);
});

arLedgerRouter.post('/', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as {
    customerId: string;
    month: string; // YYYY-MM
    closingDay?: number | null;
    salesAmount: number;
    taxAmount: number;
    totalAmount?: number;
    pdfDataUrl?: string | null;
    notes?: string | null;
  };
  const start = monthStart(b.month);
  if (!start) {
    res.status(400).json({ error: 'month は YYYY-MM 形式で指定してください' });
    return;
  }
  if (!b.customerId) {
    res.status(400).json({ error: 'customerId は必須です' });
    return;
  }
  const sales = Number(b.salesAmount ?? 0);
  const tax = Number(b.taxAmount ?? 0);
  const total = Number.isFinite(Number(b.totalAmount)) ? Number(b.totalAmount) : sales + tax;

  const r = await query(
    `INSERT INTO ar_ledger (company_id, customer_id, period_month, closing_day, sales_amount, tax_amount, total_amount, pdf_data_url, notes)
     VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      req.staff!.companyId,
      b.customerId,
      start,
      b.closingDay ?? null,
      sales,
      tax,
      total,
      b.pdfDataUrl ?? null,
      b.notes ?? null,
    ]
  );
  res.status(201).json(r.rows[0]);
});

arLedgerRouter.patch('/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as {
    customerId?: string;
    closingDay?: number | null;
    salesAmount?: number;
    taxAmount?: number;
    totalAmount?: number;
    pdfDataUrl?: string | null;
    notes?: string | null;
  };
  const ex = await query(`SELECT id FROM ar_ledger WHERE id = $1 AND company_id = $2`, [
    req.params.id,
    req.staff!.companyId,
  ]);
  if (!ex.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  const sets: string[] = [];
  const params: unknown[] = [];
  let n = 1;
  if (b.customerId !== undefined) {
    const c = await query(`SELECT id FROM customers WHERE id = $1 AND company_id = $2`, [
      b.customerId,
      req.staff!.companyId,
    ]);
    if (!c.rows[0]) {
      res.status(400).json({ error: '顧客が見つかりません' });
      return;
    }
    sets.push(`customer_id = $${n++}`);
    params.push(b.customerId);
  }
  if (b.closingDay !== undefined) {
    sets.push(`closing_day = $${n++}`);
    params.push(b.closingDay);
  }
  if (b.salesAmount !== undefined) {
    sets.push(`sales_amount = $${n++}`);
    params.push(b.salesAmount);
  }
  if (b.taxAmount !== undefined) {
    sets.push(`tax_amount = $${n++}`);
    params.push(b.taxAmount);
  }
  if (b.totalAmount !== undefined) {
    sets.push(`total_amount = $${n++}`);
    params.push(b.totalAmount);
  }
  if (b.pdfDataUrl !== undefined) {
    sets.push(`pdf_data_url = $${n++}`);
    params.push(b.pdfDataUrl);
  }
  if (b.notes !== undefined) {
    sets.push(`notes = $${n++}`);
    params.push(b.notes);
  }
  if (sets.length === 0) {
    res.status(400).json({ error: '更新項目がありません' });
    return;
  }
  sets.push('updated_at = NOW()');
  params.push(req.params.id, req.staff!.companyId);
  await query(`UPDATE ar_ledger SET ${sets.join(', ')} WHERE id = $${n++} AND company_id = $${n++}`, params);
  const row = await query(
    `SELECT a.*, c.company_name AS customer_name
     FROM ar_ledger a
     JOIN customers c ON c.id = a.customer_id
     WHERE a.id = $1`,
    [req.params.id]
  );
  res.json(row.rows[0]);
});

async function removeArLedgerRow(req: AuthedRequest, res: Response) {
  await query(`DELETE FROM ar_ledger WHERE id = $1 AND company_id = $2`, [req.params.id, req.staff!.companyId]);
  res.json({ ok: true });
}

arLedgerRouter.delete('/:id', blockViewerWrite, removeArLedgerRow);
arLedgerRouter.post('/:id/delete', blockViewerWrite, removeArLedgerRow);

arLedgerRouter.get('/:id/pdf', async (req: AuthedRequest, res) => {
  const r = await query<{ pdf_data_url: string | null }>(
    `SELECT pdf_data_url FROM ar_ledger WHERE id = $1 AND company_id = $2`,
    [req.params.id, req.staff!.companyId]
  );
  const dataUrl = r.rows[0]?.pdf_data_url;
  if (!dataUrl) {
    res.status(404).json({ error: 'PDFがありません' });
    return;
  }
  const m = dataUrl.match(/^data:application\/pdf;base64,(.+)$/);
  if (!m) {
    res.status(400).json({ error: 'PDF形式が不正です' });
    return;
  }
  const buf = Buffer.from(m[1], 'base64');
  res.setHeader('Content-Type', 'application/pdf');
  res.send(buf);
});

