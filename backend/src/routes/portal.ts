import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireCustomer, type AuthedRequest } from '../middleware/auth.js';

export const portalRouter = Router();
portalRouter.use(requireCustomer);

portalRouter.get('/summary', async (req: AuthedRequest, res) => {
  const cid = req.customer!.customerId;
  const estimates = await query(
    `SELECT id, estimate_no, title, status::text, to_char(issue_date, 'YYYY-MM-DD') AS issue_date, total FROM estimates WHERE customer_id = $1 ORDER BY issue_date DESC LIMIT 50`,
    [cid]
  );
  const orders = await query(
    `SELECT id, order_no, status::text, to_char(order_date, 'YYYY-MM-DD') AS order_date, total FROM sales_orders WHERE customer_id = $1 ORDER BY order_date DESC LIMIT 50`,
    [cid]
  );
  const invoices = await query(
    `SELECT id, invoice_no, status::text, to_char(issue_date, 'YYYY-MM-DD') AS issue_date, total, paid_amount FROM invoices WHERE customer_id = $1 ORDER BY issue_date DESC LIMIT 50`,
    [cid]
  );
  const payments = await query(
    `SELECT id, payment_no, to_char(payment_date, 'YYYY-MM-DD') AS payment_date, amount FROM payments WHERE customer_id = $1 ORDER BY payment_date DESC LIMIT 50`,
    [cid]
  );
  res.json({
    estimates: estimates.rows,
    orders: orders.rows,
    invoices: invoices.rows,
    payments: payments.rows,
  });
});
