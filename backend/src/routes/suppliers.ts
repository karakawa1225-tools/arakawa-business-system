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
  let saved = 0;
  let inserted = 0;
  let updated = 0;
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
      const r = await query<{ was_insert: boolean }>(
        `INSERT INTO suppliers (company_id, supplier_code, name, barcode_code, phone, postal_code, address, payment_terms, bank_name, bank_branch, bank_account_type, bank_account_number, bank_account_holder)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (company_id, supplier_code) DO UPDATE SET
           name = EXCLUDED.name,
           barcode_code = EXCLUDED.barcode_code,
           bank_name = EXCLUDED.bank_name,
           bank_branch = EXCLUDED.bank_branch,
           bank_account_type = EXCLUDED.bank_account_type,
           bank_account_number = EXCLUDED.bank_account_number,
           bank_account_holder = EXCLUDED.bank_account_holder,
           updated_at = NOW()
         RETURNING (xmax = 0) AS was_insert`,
        [
          req.staff!.companyId,
          supplierCode,
          name,
          pickCell(row, 'barcode_code', 'barcodecode', 'バーコード用コード', 'バーコード') || null,
          null,
          null,
          null,
          null,
          pickCell(row, 'bank_name', 'bankname', '銀行名') || null,
          pickCell(row, 'bank_branch', 'bankbranch', '支店名') || null,
          pickCell(row, 'bank_account_type', 'bankaccounttype', '口座種別', '種別') || null,
          pickCell(row, 'bank_account_number', 'bankaccountnumber', '口座番号') || null,
          pickCell(row, 'bank_account_holder', 'bankaccountholder', '口座名義') || null,
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

suppliersRouter.post('/', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as Record<string, unknown>;
  try {
    const r = await query(
      `INSERT INTO suppliers (company_id, supplier_code, name, barcode_code, phone, postal_code, address, payment_terms, bank_name, bank_branch, bank_account_type, bank_account_number, bank_account_holder)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        req.staff!.companyId,
        b.supplierCode,
        b.name,
        typeof b.barcodeCode === 'string' ? b.barcodeCode.trim() || null : null,
        b.phone ?? null,
        typeof b.postalCode === 'string' ? b.postalCode.trim() || null : null,
        b.address ?? null,
        b.paymentTerms ?? null,
        b.bankName ?? null,
        b.bankBranch ?? null,
        typeof b.bankAccountType === 'string' ? b.bankAccountType.trim() || null : null,
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
    `UPDATE suppliers SET supplier_code=$1, name=$2, barcode_code=$3, phone=$4, postal_code=$5, address=$6, payment_terms=$7, bank_name=$8, bank_branch=$9, bank_account_type=$10, bank_account_number=$11, bank_account_holder=$12, updated_at=NOW()
     WHERE id=$13 AND company_id=$14 RETURNING *`,
    [
      b.supplierCode,
      b.name,
      typeof b.barcodeCode === 'string' ? b.barcodeCode.trim() || null : null,
      b.phone ?? null,
      typeof b.postalCode === 'string' ? b.postalCode.trim() || null : null,
      b.address ?? null,
      b.paymentTerms ?? null,
      b.bankName ?? null,
      b.bankBranch ?? null,
      typeof b.bankAccountType === 'string' ? b.bankAccountType.trim() || null : null,
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
