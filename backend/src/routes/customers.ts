import { Router, type Response } from 'express';
import { query } from '../db/pool.js';
import { requireStaff, blockViewerWrite, type AuthedRequest } from '../middleware/auth.js';
import { sendServerError } from '../utils/httpError.js';

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
