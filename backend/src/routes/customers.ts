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

function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
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
  let saved = 0;
  let inserted = 0;
  let updated = 0;
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
      const r = await query<{ was_insert: boolean }>(
        `INSERT INTO customers (company_id, customer_code, company_name, barcode_code, contact_name, phone, email, postal_code, address, closing_day, payment_terms, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (company_id, customer_code) DO UPDATE SET
           company_name = EXCLUDED.company_name,
           barcode_code = EXCLUDED.barcode_code,
           phone = EXCLUDED.phone,
           postal_code = EXCLUDED.postal_code,
           address = EXCLUDED.address,
           closing_day = EXCLUDED.closing_day,
           payment_terms = EXCLUDED.payment_terms,
           notes = EXCLUDED.notes,
           updated_at = NOW()
         RETURNING (xmax = 0) AS was_insert`,
        [
          req.staff!.companyId,
          customerCode,
          companyName,
          pickCell(row, 'barcode_code', 'barcodecode', 'バーコード用コード', 'バーコード') || null,
          null,
          pickCell(row, 'phone', '電話') || null,
          null,
          pickCell(row, 'postal_code', 'postalcode', '郵便番号', 'zip') || null,
          pickCell(row, 'address', '住所') || null,
          optionalSmallInt(pickCell(row, 'closing_day', 'closingday', '締日') || undefined),
          pickCell(row, 'payment_terms', 'paymentterms', '支払サイト', '支払条件') || null,
          pickCell(row, 'notes', '備考') || null,
        ]
      );
      saved += 1;
      if (r.rows[0]?.was_insert) inserted += 1;
      else updated += 1;
    } catch (e: unknown) {
      errors.push({ line: lineBase, message: e instanceof Error ? e.message : '登録に失敗しました' });
    }
    lineBase += 1;
  }
  res.json({ ok: true, saved, inserted, updated, created: saved, errors });
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
      `INSERT INTO customers (company_id, customer_code, company_name, barcode_code, contact_name, phone, email, postal_code, address, closing_day, payment_terms, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        req.staff!.companyId,
        b.customerCode,
        b.companyName,
        strOrNull(b.barcodeCode),
        null,
        b.phone ?? null,
        null,
        strOrNull(b.postalCode),
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
    `UPDATE customers SET customer_code=$1, company_name=$2, barcode_code=$3, contact_name=$4, phone=$5, email=$6, postal_code=$7, address=$8, closing_day=$9, payment_terms=$10, notes=$11, updated_at=NOW()
     WHERE id=$12 AND company_id=$13 RETURNING *`,
    [
      b.customerCode,
      b.companyName,
      strOrNull(b.barcodeCode),
      null,
      b.phone ?? null,
      null,
      strOrNull(b.postalCode),
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
