import { Router, type Response } from 'express';
import { query } from '../db/pool.js';
import { requireStaff, blockViewerWrite, type AuthedRequest } from '../middleware/auth.js';
import { sendServerError } from '../utils/httpError.js';
import { parseCsvToRecords, pickCell } from '../utils/csvTools.js';

function optionalSmallInt(v: unknown): number | null {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const customersRouter = Router();
customersRouter.use(requireStaff);

customersRouter.get('/', async (req: AuthedRequest, res) => {
  const r = await query(
    `SELECT * FROM customers WHERE company_id = $1 ORDER BY customer_code`,
    [req.staff!.companyId]
  );
  res.json(r.rows);
});

customersRouter.post('/import-csv', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as { csvText?: string };
  const csvText = typeof b.csvText === 'string' ? b.csvText : '';
  if (!csvText.trim()) {
    res.status(400).json({ error: 'CSV本文が空です' });
    return;
  }
  let rows: Record<string, string>[];
  try {
    rows = parseCsvToRecords(csvText);
  } catch (e: unknown) {
    res.status(400).json({ error: `CSVの解析に失敗しました: ${e instanceof Error ? e.message : String(e)}` });
    return;
  }
  const created: string[] = [];
  const errors: { line: number; message: string }[] = [];
  let lineBase = 2;
  for (const row of rows) {
    const customerCode = pickCell(row, 'customer_code', 'customercode', '顧客コード');
    const companyName = pickCell(row, 'company_name', 'companyname', '会社名');
    if (!customerCode || !companyName) {
      errors.push({ line: lineBase, message: '顧客コード・会社名は必須です' });
      lineBase += 1;
      continue;
    }
    try {
      const r = await query(
        `INSERT INTO customers (company_id, customer_code, company_name, contact_name, phone, email, address, closing_day, payment_terms, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [
          req.staff!.companyId,
          customerCode,
          companyName,
          pickCell(row, 'contact_name', 'contactname', '担当者') || null,
          pickCell(row, 'phone', '電話') || null,
          pickCell(row, 'email', 'メール') || null,
          pickCell(row, 'address', '住所') || null,
          optionalSmallInt(pickCell(row, 'closing_day', 'closingday', '締日') || undefined),
          pickCell(row, 'payment_terms', 'paymentterms', '支払サイト', '支払条件') || null,
          pickCell(row, 'notes', '備考') || null,
        ]
      );
      created.push(String(r.rows[0].id));
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === '23505') {
        errors.push({ line: lineBase, message: `顧客コード「${customerCode}」が重複しています` });
      } else {
        errors.push({ line: lineBase, message: e instanceof Error ? e.message : '登録に失敗しました' });
      }
    }
    lineBase += 1;
  }
  res.json({ ok: true, created: created.length, errors });
});

customersRouter.get('/:id', async (req: AuthedRequest, res) => {
  const r = await query(`SELECT * FROM customers WHERE id = $1 AND company_id = $2`, [
    req.params.id,
    req.staff!.companyId,
  ]);
  if (!r.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  res.json(r.rows[0]);
});

customersRouter.post('/', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as Record<string, unknown>;
  try {
    const r = await query(
      `INSERT INTO customers (company_id, customer_code, company_name, contact_name, phone, email, address, closing_day, payment_terms, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        req.staff!.companyId,
        b.customerCode,
        b.companyName,
        b.contactName ?? null,
        b.phone ?? null,
        b.email ?? null,
        b.address ?? null,
        optionalSmallInt(b.closingDay),
        b.paymentTerms === '' ? null : (b.paymentTerms as string | null) ?? null,
        b.notes ?? null,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === '23505') {
      res.status(400).json({ error: '顧客コードが重複しています' });
      return;
    }
    sendServerError(res, e);
  }
});

customersRouter.put('/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as Record<string, unknown>;
  const r = await query(
    `UPDATE customers SET customer_code=$1, company_name=$2, contact_name=$3, phone=$4, email=$5, address=$6, closing_day=$7, payment_terms=$8, notes=$9, updated_at=NOW()
     WHERE id=$10 AND company_id=$11 RETURNING *`,
    [
      b.customerCode,
      b.companyName,
      b.contactName ?? null,
      b.phone ?? null,
      b.email ?? null,
      b.address ?? null,
      optionalSmallInt(b.closingDay),
      b.paymentTerms === '' ? null : (b.paymentTerms as string | null) ?? null,
      b.notes ?? null,
      req.params.id,
      req.staff!.companyId,
    ]
  );
  if (!r.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  res.json(r.rows[0]);
});

async function removeCustomer(req: AuthedRequest, res: Response) {
  const r = await query(`DELETE FROM customers WHERE id = $1 AND company_id = $2 RETURNING id`, [
    req.params.id,
    req.staff!.companyId,
  ]);
  if (!r.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  res.json({ ok: true });
}

customersRouter.delete('/:id', blockViewerWrite, removeCustomer);
customersRouter.post('/:id/delete', blockViewerWrite, removeCustomer);
