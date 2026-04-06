import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireStaff, blockViewerWrite, type AuthedRequest } from '../middleware/auth.js';

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
      `INSERT INTO products (company_id, product_code, name, category, manufacturer, manufacturer_part_no, trusco_order_code, supplier_id, purchase_price, sale_price, photo_url, spec_text)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        req.staff!.companyId,
        b.productCode,
        b.name,
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
    `UPDATE products SET product_code=$1, name=$2, category=$3, manufacturer=$4, manufacturer_part_no=$5, trusco_order_code=$6, supplier_id=$7, purchase_price=$8, sale_price=$9, photo_url=$10, spec_text=$11, updated_at=NOW()
     WHERE id=$12 AND company_id=$13 RETURNING *`,
    [
      b.productCode,
      b.name,
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
