import { Router, type Response } from 'express';
import { query } from '../db/pool.js';
import { requireStaff, blockViewerWrite, type AuthedRequest } from '../middleware/auth.js';

export const apLedgerRouter = Router();
apLedgerRouter.use(requireStaff);

function monthStart(ym: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(ym)) return null;
  return `${ym}-01`;
}

apLedgerRouter.get('/', async (req: AuthedRequest, res) => {
  const month = typeof req.query.month === 'string' ? req.query.month : '';
  const start = monthStart(month);
  if (!start) {
    res.status(400).json({ error: 'month は YYYY-MM 形式で指定してください' });
    return;
  }
  const r = await query(
    `SELECT a.*, s.name AS supplier_name
     FROM ap_ledger a
     JOIN suppliers s ON s.id = a.supplier_id
     WHERE a.company_id = $1 AND a.period_month = $2::date
     ORDER BY s.supplier_code, s.name`,
    [req.staff!.companyId, start]
  );
  res.json(r.rows);
});

apLedgerRouter.post('/', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as {
    supplierId: string;
    month: string; // YYYY-MM
    closingDay?: number | null;
    amount: number;
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
  if (!b.supplierId) {
    res.status(400).json({ error: 'supplierId は必須です' });
    return;
  }
  const amt = Number(b.amount ?? 0);
  const tax = Number(b.taxAmount ?? 0);
  const total = Number.isFinite(Number(b.totalAmount)) ? Number(b.totalAmount) : amt + tax;

  const r = await query(
    `INSERT INTO ap_ledger (company_id, supplier_id, period_month, closing_day, amount, tax_amount, total_amount, pdf_data_url, notes)
     VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      req.staff!.companyId,
      b.supplierId,
      start,
      b.closingDay ?? null,
      amt,
      tax,
      total,
      b.pdfDataUrl ?? null,
      b.notes ?? null,
    ]
  );
  res.status(201).json(r.rows[0]);
});

apLedgerRouter.patch('/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as {
    supplierId?: string;
    closingDay?: number | null;
    amount?: number;
    taxAmount?: number;
    totalAmount?: number;
    pdfDataUrl?: string | null;
    notes?: string | null;
  };
  const ex = await query(`SELECT id FROM ap_ledger WHERE id = $1 AND company_id = $2`, [
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
  if (b.supplierId !== undefined) {
    const c = await query(`SELECT id FROM suppliers WHERE id = $1 AND company_id = $2`, [
      b.supplierId,
      req.staff!.companyId,
    ]);
    if (!c.rows[0]) {
      res.status(400).json({ error: '仕入先が見つかりません' });
      return;
    }
    sets.push(`supplier_id = $${n++}`);
    params.push(b.supplierId);
  }
  if (b.closingDay !== undefined) {
    sets.push(`closing_day = $${n++}`);
    params.push(b.closingDay);
  }
  if (b.amount !== undefined) {
    sets.push(`amount = $${n++}`);
    params.push(b.amount);
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
  await query(`UPDATE ap_ledger SET ${sets.join(', ')} WHERE id = $${n++} AND company_id = $${n++}`, params);
  const row = await query(
    `SELECT a.*, s.name AS supplier_name
     FROM ap_ledger a
     JOIN suppliers s ON s.id = a.supplier_id
     WHERE a.id = $1`,
    [req.params.id]
  );
  res.json(row.rows[0]);
});

async function removeApLedgerRow(req: AuthedRequest, res: Response) {
  await query(`DELETE FROM ap_ledger WHERE id = $1 AND company_id = $2`, [req.params.id, req.staff!.companyId]);
  res.json({ ok: true });
}

apLedgerRouter.delete('/:id', blockViewerWrite, removeApLedgerRow);
apLedgerRouter.post('/:id/delete', blockViewerWrite, removeApLedgerRow);

apLedgerRouter.get('/:id/pdf', async (req: AuthedRequest, res) => {
  const r = await query<{ pdf_data_url: string | null }>(
    `SELECT pdf_data_url FROM ap_ledger WHERE id = $1 AND company_id = $2`,
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

