import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireStaff, blockViewerWrite, type AuthedRequest } from '../middleware/auth.js';
import { parseCsvToRecords, pickCell } from '../utils/csvTools.js';

export const suppliersRouter = Router();
suppliersRouter.use(requireStaff);

suppliersRouter.get('/', async (req: AuthedRequest, res) => {
  const r = await query(
    `SELECT * FROM suppliers WHERE company_id = $1 ORDER BY supplier_code`,
    [req.staff!.companyId]
  );
  res.json(r.rows);
});

suppliersRouter.post('/import-csv', blockViewerWrite, async (req: AuthedRequest, res) => {
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
    const supplierCode = pickCell(row, 'supplier_code', 'suppliercode', '仕入先コード');
    const name = pickCell(row, 'name', '仕入先名');
    if (!supplierCode || !name) {
      errors.push({ line: lineBase, message: '仕入先コード・仕入先名は必須です' });
      lineBase += 1;
      continue;
    }
    try {
      const r = await query(
        `INSERT INTO suppliers (company_id, supplier_code, name, phone, address, payment_terms, bank_name, bank_branch, bank_account_number, bank_account_holder)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [
          req.staff!.companyId,
          supplierCode,
          name,
          pickCell(row, 'phone', '電話') || null,
          pickCell(row, 'address', '住所') || null,
          pickCell(row, 'payment_terms', 'paymentterms', '支払条件') || null,
          pickCell(row, 'bank_name', 'bankname', '銀行名') || null,
          pickCell(row, 'bank_branch', 'bankbranch', '支店名') || null,
          pickCell(row, 'bank_account_number', 'bankaccountnumber', '口座番号') || null,
          pickCell(row, 'bank_account_holder', 'bankaccountholder', '口座名義') || null,
        ]
      );
      created.push(String(r.rows[0].id));
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === '23505') {
        errors.push({ line: lineBase, message: `仕入先コード「${supplierCode}」が重複しています` });
      } else {
        errors.push({ line: lineBase, message: e instanceof Error ? e.message : '登録に失敗しました' });
      }
    }
    lineBase += 1;
  }
  res.json({ ok: true, created: created.length, errors });
});

suppliersRouter.post('/', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as Record<string, unknown>;
  try {
    const r = await query(
      `INSERT INTO suppliers (company_id, supplier_code, name, phone, address, payment_terms, bank_name, bank_branch, bank_account_number, bank_account_holder)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        req.staff!.companyId,
        b.supplierCode,
        b.name,
        b.phone ?? null,
        b.address ?? null,
        b.paymentTerms ?? null,
        b.bankName ?? null,
        b.bankBranch ?? null,
        b.bankAccountNumber ?? null,
        b.bankAccountHolder ?? null,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === '23505') {
      res.status(400).json({ error: '仕入先コードが重複しています' });
      return;
    }
    throw e;
  }
});

suppliersRouter.put('/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as Record<string, unknown>;
  const r = await query(
    `UPDATE suppliers SET supplier_code=$1, name=$2, phone=$3, address=$4, payment_terms=$5, bank_name=$6, bank_branch=$7, bank_account_number=$8, bank_account_holder=$9, updated_at=NOW()
     WHERE id=$10 AND company_id=$11 RETURNING *`,
    [
      b.supplierCode,
      b.name,
      b.phone ?? null,
      b.address ?? null,
      b.paymentTerms ?? null,
      b.bankName ?? null,
      b.bankBranch ?? null,
      b.bankAccountNumber ?? null,
      b.bankAccountHolder ?? null,
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

suppliersRouter.delete('/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  await query(`DELETE FROM suppliers WHERE id = $1 AND company_id = $2`, [
    req.params.id,
    req.staff!.companyId,
  ]);
  res.json({ ok: true });
});
