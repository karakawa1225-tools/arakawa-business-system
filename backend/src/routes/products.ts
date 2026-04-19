import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireStaff, blockViewerWrite, type AuthedRequest } from '../middleware/auth.js';
import { parseCsvToRecords, pickCell } from '../utils/csvTools.js';

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const productsRouter = Router();
productsRouter.use(requireStaff);

productsRouter.get('/', async (req: AuthedRequest, res) => {
  const r = await query(
    `SELECT p.*, s.name AS supplier_name FROM products p
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.company_id = $1 ORDER BY p.product_code`,
    [req.staff!.companyId]
  );
  res.json(r.rows);
});

productsRouter.post('/import-csv', blockViewerWrite, async (req: AuthedRequest, res) => {
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
  const companyId = req.staff!.companyId;
  const created: string[] = [];
  const errors: { line: number; message: string }[] = [];
  let lineBase = 2;
  for (const row of rows) {
    const productCode = pickCell(row, 'product_code', 'productcode', '商品コード');
    const name = pickCell(row, 'name', '商品名');
    if (!productCode || !name) {
      errors.push({ line: lineBase, message: '商品コード・商品名は必須です' });
      lineBase += 1;
      continue;
    }
    const supplierCode = pickCell(row, 'supplier_code', 'suppliercode', '仕入先コード');
    let supplierId: string | null = null;
    if (supplierCode) {
      const sr = await query(`SELECT id FROM suppliers WHERE company_id = $1 AND supplier_code = $2`, [
        companyId,
        supplierCode,
      ]);
      if (!sr.rows[0]) {
        errors.push({ line: lineBase, message: `仕入先コード「${supplierCode}」が見つかりません（先に仕入先マスタへ登録してください）` });
        lineBase += 1;
        continue;
      }
      supplierId = String(sr.rows[0].id);
    }
    try {
      const r = await query(
        `INSERT INTO products (company_id, product_code, name, barcode_code, category, manufacturer, manufacturer_part_no, trusco_order_code, supplier_id, purchase_price, sale_price, photo_url, spec_text)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [
          companyId,
          productCode,
          name,
          pickCell(row, 'barcode_code', 'barcodecode', 'バーコード用コード', 'バーコード') || null,
          pickCell(row, 'category', 'カテゴリ') || null,
          pickCell(row, 'manufacturer', 'メーカー') || null,
          pickCell(row, 'manufacturer_part_no', 'manufacturerpartno', 'メーカー品番') || null,
          pickCell(row, 'trusco_order_code', 'truscoordercode', 'トラスコ発注コード') || null,
          supplierId,
          numOrNull(pickCell(row, 'purchase_price', 'purchaseprice', '仕入価格')),
          numOrNull(pickCell(row, 'sale_price', 'saleprice', '販売価格')),
          null,
          pickCell(row, 'spec_text', 'spectext', '仕様・備考') || null,
        ]
      );
      created.push(String(r.rows[0].id));
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === '23505') {
        errors.push({ line: lineBase, message: `商品コード「${productCode}」が重複しています` });
      } else {
        errors.push({ line: lineBase, message: e instanceof Error ? e.message : '登録に失敗しました' });
      }
    }
    lineBase += 1;
  }
  res.json({ ok: true, created: created.length, errors });
});

productsRouter.get('/:id', async (req: AuthedRequest, res) => {
  const r = await query(
    `SELECT p.*, s.name AS supplier_name FROM products p
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.id = $1 AND p.company_id = $2`,
    [req.params.id, req.staff!.companyId]
  );
  if (!r.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  res.json(r.rows[0]);
});

productsRouter.post('/', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as Record<string, unknown>;
  try {
    const r = await query(
      `INSERT INTO products (company_id, product_code, name, barcode_code, category, manufacturer, manufacturer_part_no, trusco_order_code, supplier_id, purchase_price, sale_price, photo_url, spec_text)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        req.staff!.companyId,
        b.productCode,
        b.name,
        typeof b.barcodeCode === 'string' ? b.barcodeCode.trim() || null : null,
        b.category ?? null,
        b.manufacturer ?? null,
        b.manufacturerPartNo ?? null,
        b.truscoOrderCode ?? null,
        b.supplierId ?? null,
        b.purchasePrice ?? null,
        b.salePrice ?? null,
        b.photoUrl ?? null,
        b.specText ?? null,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === '23505') {
      res.status(400).json({ error: '商品コードが重複しています' });
      return;
    }
    throw e;
  }
});

productsRouter.put('/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as Record<string, unknown>;
  const r = await query(
    `UPDATE products SET product_code=$1, name=$2, barcode_code=$3, category=$4, manufacturer=$5, manufacturer_part_no=$6, trusco_order_code=$7, supplier_id=$8, purchase_price=$9, sale_price=$10, photo_url=$11, spec_text=$12, updated_at=NOW()
     WHERE id=$13 AND company_id=$14 RETURNING *`,
    [
      b.productCode,
      b.name,
      typeof b.barcodeCode === 'string' ? b.barcodeCode.trim() || null : null,
      b.category ?? null,
      b.manufacturer ?? null,
      b.manufacturerPartNo ?? null,
      b.truscoOrderCode ?? null,
      b.supplierId ?? null,
      b.purchasePrice ?? null,
      b.salePrice ?? null,
      b.photoUrl ?? null,
      b.specText ?? null,
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

productsRouter.delete('/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const r = await query(`DELETE FROM products WHERE id = $1 AND company_id = $2 RETURNING id`, [
    req.params.id,
    req.staff!.companyId,
  ]);
  if (!r.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  res.json({ ok: true });
});
