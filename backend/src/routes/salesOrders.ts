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
};

async function recalcOrder(orderId: string) {
  const lines = await query<{ amount: string }>(
    `SELECT amount::text FROM sales_order_lines WHERE sales_order_id = $1`,
    [orderId]
  );
  const subtotal = lines.rows.reduce((s: number, l: { amount: string }) => s + parseFloat(l.amount), 0);
  const tax = subtotal * 0.1;
  await query(
    `UPDATE sales_orders SET subtotal = $1, tax_amount = $2, total = $1 + $2, updated_at = NOW() WHERE id = $3`,
    [subtotal, tax, orderId]
  );
}

export const salesOrdersRouter = Router();
salesOrdersRouter.use(requireStaff);

const ORDER_SELECT = `o.id,
      o.company_id,
      o.customer_id,
      o.estimate_id,
      o.order_no,
      o.status,
      to_char(o.order_date, 'YYYY-MM-DD') AS order_date,
      to_char(o.delivery_date, 'YYYY-MM-DD') AS delivery_date,
      o.subtotal,
      o.tax_amount,
      o.total,
      o.notes,
      o.created_by,
      o.created_at,
      o.updated_at`;

salesOrdersRouter.get('/', async (req: AuthedRequest, res) => {
  const r = await query(
    `SELECT ${ORDER_SELECT}, c.company_name AS customer_name FROM sales_orders o
     JOIN customers c ON c.id = o.customer_id
     WHERE o.company_id = $1 ORDER BY o.order_date DESC`,
    [req.staff!.companyId]
  );
  res.json(r.rows);
});

salesOrdersRouter.get('/:id', async (req: AuthedRequest, res) => {
  const orow = await query(
    `SELECT ${ORDER_SELECT} FROM sales_orders o WHERE o.id = $1 AND o.company_id = $2`,
    [req.params.id, req.staff!.companyId]
  );
  if (!orow.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  const lr = await query(
    `SELECT * FROM sales_order_lines WHERE sales_order_id = $1 ORDER BY line_no`,
    [req.params.id]
  );
  res.json({ ...orow.rows[0], lines: lr.rows });
});

salesOrdersRouter.post('/', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as {
    customerId: string;
    estimateId?: string | null;
    orderDate?: string;
    status?: string;
    notes?: string;
    lines: LineInput[];
  };
  if (!b.customerId || !b.lines?.length) {
    res.status(400).json({ error: '顧客と明細は必須です' });
    return;
  }
  const odRaw = b.orderDate ?? new Date().toISOString().slice(0, 10);
  const orderDate = parseIsoDateStrict(odRaw);
  if (!orderDate) {
    res.status(400).json({ error: badDateMessage('受注日') });
    return;
  }
  const orderNo = await nextDocumentNo(req.staff!.companyId, 'order');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO sales_orders (company_id, customer_id, estimate_id, order_no, status, order_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5::order_status,$6::date,$7,$8) RETURNING id`,
      [
        req.staff!.companyId,
        b.customerId,
        b.estimateId ?? null,
        orderNo,
        b.status ?? 'open',
        orderDate,
        b.notes ?? null,
        req.staff!.sub,
      ]
    );
    const id = ins.rows[0].id as string;
    let lineNo = 1;
    for (const ln of b.lines) {
      const qty = Number(ln.quantity) || 0;
      const up = Number(ln.unitPrice) || 0;
      await client.query(
        `INSERT INTO sales_order_lines (sales_order_id, line_no, product_id, description, quantity, unit_price, amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, lineNo++, ln.productId ?? null, ln.description, qty, up, qty * up]
      );
    }
    await client.query('COMMIT');
    await recalcOrder(id);
    const full = await query(`SELECT ${ORDER_SELECT} FROM sales_orders o WHERE o.id = $1`, [id]);
    const lr = await query(
      `SELECT * FROM sales_order_lines WHERE sales_order_id = $1 ORDER BY line_no`,
      [id]
    );
    res.status(201).json({ ...full.rows[0], lines: lr.rows });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

salesOrdersRouter.put('/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const oid = String(req.params.id);
  const b = req.body as {
    customerId: string;
    estimateId?: string | null;
    orderDate?: string;
    status?: string;
    notes?: string;
    lines: LineInput[];
  };
  const ex = await query(`SELECT id FROM sales_orders WHERE id = $1 AND company_id = $2`, [
    oid,
    req.staff!.companyId,
  ]);
  if (!ex.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  const odRaw = b.orderDate ?? new Date().toISOString().slice(0, 10);
  const orderDate = parseIsoDateStrict(odRaw);
  if (!orderDate) {
    res.status(400).json({ error: badDateMessage('受注日') });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE sales_orders SET customer_id=$1, estimate_id=$2, status=$3::order_status, order_date=$4::date, notes=$5, updated_at=NOW() WHERE id=$6`,
      [
        b.customerId,
        b.estimateId ?? null,
        b.status ?? 'open',
        orderDate,
        b.notes ?? null,
        oid,
      ]
    );
    await client.query(`DELETE FROM sales_order_lines WHERE sales_order_id = $1`, [oid]);
    let lineNo = 1;
    for (const ln of b.lines ?? []) {
      const qty = Number(ln.quantity) || 0;
      const up = Number(ln.unitPrice) || 0;
      await client.query(
        `INSERT INTO sales_order_lines (sales_order_id, line_no, product_id, description, quantity, unit_price, amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [oid, lineNo++, ln.productId ?? null, ln.description, qty, up, qty * up]
      );
    }
    await client.query('COMMIT');
    await recalcOrder(oid);
    const full = await query(`SELECT ${ORDER_SELECT} FROM sales_orders o WHERE o.id = $1`, [oid]);
    const lr = await query(
      `SELECT * FROM sales_order_lines WHERE sales_order_id = $1 ORDER BY line_no`,
      [oid]
    );
    res.json({ ...full.rows[0], lines: lr.rows });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
