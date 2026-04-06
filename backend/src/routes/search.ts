import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireStaff, type AuthedRequest } from '../middleware/auth.js';

export const searchRouter = Router();
searchRouter.use(requireStaff);

/** ILIKE 用に % _ を除去（ワイルドカード注入防止） */
function sanitizeQuery(raw: string): string {
  return raw.trim().replace(/%/g, '').replace(/_/g, '').slice(0, 80);
}

type SearchHit = {
  kind: string;
  id: string;
  title: string;
  subtitle: string | null;
  meta?: Record<string, string>;
};

const PER = 6;

searchRouter.get('/', async (req: AuthedRequest, res) => {
  const raw = typeof req.query.q === 'string' ? req.query.q : '';
  const q = sanitizeQuery(raw);
  if (q.length < 2) {
    res.json({ hits: [] as SearchHit[], hint: '2文字以上入力してください' });
    return;
  }
  const like = `%${q}%`;
  const companyId = req.staff!.companyId;
  const p: unknown[] = [companyId, like];

  try {
    const [
      customers,
      suppliers,
      products,
      estimates,
      orders,
      invoices,
      payments,
      expenses,
      bankTx,
      travel,
      payroll,
      arL,
      apL,
      users,
    ] = await Promise.all([
      query<{ id: string; title: string; sub: string | null }>(
        `SELECT id::text, company_name AS title, customer_code AS sub FROM customers
         WHERE company_id = $1 AND (
           company_name ILIKE $2 OR customer_code ILIKE $2 OR COALESCE(contact_name,'') ILIKE $2
           OR COALESCE(email,'') ILIKE $2 OR COALESCE(phone,'') ILIKE $2
         ) ORDER BY customer_code LIMIT ${PER}`,
        p
      ),
      query<{ id: string; title: string; sub: string | null }>(
        `SELECT id::text, name AS title, supplier_code AS sub FROM suppliers
         WHERE company_id = $1 AND (name ILIKE $2 OR supplier_code ILIKE $2 OR COALESCE(phone,'') ILIKE $2)
         ORDER BY supplier_code LIMIT ${PER}`,
        p
      ),
      query<{ id: string; title: string; sub: string | null }>(
        `SELECT id::text, name AS title, product_code AS sub FROM products
         WHERE company_id = $1 AND (
           name ILIKE $2 OR product_code ILIKE $2 OR COALESCE(category,'') ILIKE $2
           OR COALESCE(manufacturer,'') ILIKE $2 OR COALESCE(spec_text,'') ILIKE $2
         ) ORDER BY product_code LIMIT ${PER}`,
        p
      ),
      query<{ id: string; title: string; sub: string | null }>(
        `SELECT e.id::text,
                COALESCE(NULLIF(e.title,''), e.estimate_no) AS title,
                c.company_name || ' · ' || e.estimate_no AS sub
         FROM estimates e
         JOIN customers c ON c.id = e.customer_id
         WHERE e.company_id = $1 AND (
           e.estimate_no ILIKE $2 OR COALESCE(e.title,'') ILIKE $2 OR c.company_name ILIKE $2
         ) ORDER BY e.issue_date DESC LIMIT ${PER}`,
        p
      ),
      query<{ id: string; title: string; sub: string | null }>(
        `SELECT o.id::text, o.order_no AS title, c.company_name AS sub
         FROM sales_orders o
         JOIN customers c ON c.id = o.customer_id
         WHERE o.company_id = $1 AND (o.order_no ILIKE $2 OR c.company_name ILIKE $2 OR COALESCE(o.notes,'') ILIKE $2)
         ORDER BY o.order_date DESC LIMIT ${PER}`,
        p
      ),
      query<{ id: string; title: string; sub: string | null }>(
        `SELECT i.id::text, i.invoice_no AS title, c.company_name AS sub
         FROM invoices i
         JOIN customers c ON c.id = i.customer_id
         WHERE i.company_id = $1 AND (i.invoice_no ILIKE $2 OR c.company_name ILIKE $2 OR COALESCE(i.notes,'') ILIKE $2)
         ORDER BY i.issue_date DESC LIMIT ${PER}`,
        p
      ),
      query<{ id: string; title: string; sub: string | null }>(
        `SELECT p.id::text, p.payment_no AS title, c.company_name AS sub
         FROM payments p
         JOIN customers c ON c.id = p.customer_id
         WHERE p.company_id = $1 AND (p.payment_no ILIKE $2 OR c.company_name ILIKE $2 OR COALESCE(p.notes,'') ILIKE $2)
         ORDER BY p.payment_date DESC LIMIT ${PER}`,
        p
      ),
      query<{ id: string; title: string; sub: string | null; month: string }>(
        `SELECT e.id::text,
                COALESCE(NULLIF(e.payment_destination,''), NULLIF(e.description,''), a.name) AS title,
                to_char(e.expense_date,'YYYY-MM-DD') || ' · ¥' || e.amount::text AS sub,
                to_char(e.expense_date,'YYYY-MM') AS month
         FROM expenses e
         JOIN chart_of_accounts a ON a.id = e.chart_account_id
         WHERE e.company_id = $1 AND (
           COALESCE(e.payment_destination,'') ILIKE $2 OR COALESCE(e.description,'') ILIKE $2
           OR COALESCE(e.supplier_invoice_no,'') ILIKE $2 OR a.name ILIKE $2
         ) ORDER BY e.expense_date DESC LIMIT ${PER}`,
        p
      ),
      query<{ id: string; title: string; sub: string | null; account_id: string }>(
        `SELECT t.id::text,
                COALESCE(NULLIF(t.description,''), t.tx_type || ' ' || t.amount::text) AS title,
                b.name || ' · ' || to_char(t.tx_date,'YYYY-MM-DD') AS sub,
                t.bank_account_id::text AS account_id
         FROM bank_transactions t
         JOIN bank_accounts b ON b.id = t.bank_account_id
         WHERE t.company_id = $1 AND (
           COALESCE(t.description,'') ILIKE $2 OR COALESCE(t.reference,'') ILIKE $2 OR t.tx_type::text ILIKE $2
         ) ORDER BY t.tx_date DESC, t.created_at DESC LIMIT ${PER}`,
        p
      ),
      query<{ id: string; title: string; sub: string | null }>(
        `SELECT id::text,
                applicant_name || ' → ' || destination AS title,
                purpose AS sub
         FROM travel_expense_claims
         WHERE company_id = $1 AND (
           applicant_name ILIKE $2 OR destination ILIKE $2 OR purpose ILIKE $2
           OR COALESCE(department,'') ILIKE $2 OR COALESCE(notes,'') ILIKE $2
         ) ORDER BY updated_at DESC LIMIT ${PER}`,
        p
      ),
      query<{ id: string; title: string; sub: string | null; month: string }>(
        `SELECT e.id::text, u.name AS title, to_char(e.period_month,'YYYY-MM') || ' · 手取 ¥' || e.net_pay::text AS sub,
                to_char(e.period_month,'YYYY-MM') AS month
         FROM payroll_monthly_entries e
         JOIN users u ON u.id = e.user_id AND u.company_id = e.company_id
         WHERE e.company_id = $1 AND u.name ILIKE $2
         ORDER BY e.period_month DESC LIMIT ${PER}`,
        p
      ),
      query<{ id: string; title: string; sub: string | null; month: string }>(
        `SELECT a.id::text, c.company_name AS title,
                to_char(a.period_month,'YYYY-MM') || ' · 売上 ¥' || a.sales_amount::text AS sub,
                to_char(a.period_month,'YYYY-MM') AS month
         FROM ar_ledger a
         JOIN customers c ON c.id = a.customer_id
         WHERE a.company_id = $1 AND c.company_name ILIKE $2
         ORDER BY a.period_month DESC LIMIT ${PER}`,
        p
      ),
      query<{ id: string; title: string; sub: string | null; month: string }>(
        `SELECT ap.id::text, s.name AS title,
                to_char(ap.period_month,'YYYY-MM') || ' · ¥' || ap.amount::text AS sub,
                to_char(ap.period_month,'YYYY-MM') AS month
         FROM ap_ledger ap
         JOIN suppliers s ON s.id = ap.supplier_id
         WHERE ap.company_id = $1 AND s.name ILIKE $2
         ORDER BY ap.period_month DESC LIMIT ${PER}`,
        p
      ),
      query<{ id: string; title: string; sub: string | null }>(
        `SELECT id::text, name AS title, email AS sub FROM users
         WHERE company_id = $1 AND active = TRUE AND (name ILIKE $2 OR email ILIKE $2)
         ORDER BY name LIMIT ${PER}`,
        p
      ),
    ]);

    const hits: SearchHit[] = [
      ...customers.rows.map((r) => ({
        kind: 'customer',
        id: r.id,
        title: r.title,
        subtitle: r.sub,
      })),
      ...suppliers.rows.map((r) => ({
        kind: 'supplier',
        id: r.id,
        title: r.title,
        subtitle: r.sub,
      })),
      ...products.rows.map((r) => ({ kind: 'product', id: r.id, title: r.title, subtitle: r.sub })),
      ...estimates.rows.map((r) => ({ kind: 'estimate', id: r.id, title: r.title, subtitle: r.sub })),
      ...orders.rows.map((r) => ({ kind: 'sales_order', id: r.id, title: r.title, subtitle: r.sub })),
      ...invoices.rows.map((r) => ({ kind: 'invoice', id: r.id, title: r.title, subtitle: r.sub })),
      ...payments.rows.map((r) => ({ kind: 'payment', id: r.id, title: r.title, subtitle: r.sub })),
      ...expenses.rows.map((r) => ({
        kind: 'expense',
        id: r.id,
        title: r.title,
        subtitle: r.sub,
        meta: { month: r.month },
      })),
      ...bankTx.rows.map((r) => ({
        kind: 'bank_transaction',
        id: r.id,
        title: r.title,
        subtitle: r.sub,
        meta: { accountId: r.account_id },
      })),
      ...travel.rows.map((r) => ({ kind: 'travel_claim', id: r.id, title: r.title, subtitle: r.sub })),
      ...payroll.rows.map((r) => ({
        kind: 'payroll_entry',
        id: r.id,
        title: r.title,
        subtitle: r.sub,
        meta: { month: r.month },
      })),
      ...arL.rows.map((r) => ({
        kind: 'ar_ledger',
        id: r.id,
        title: r.title,
        subtitle: r.sub,
        meta: { month: r.month },
      })),
      ...apL.rows.map((r) => ({
        kind: 'ap_ledger',
        id: r.id,
        title: r.title,
        subtitle: r.sub,
        meta: { month: r.month },
      })),
      ...users.rows.map((r) => ({ kind: 'user', id: r.id, title: r.title, subtitle: r.sub })),
    ];

    res.json({ hits, query: q });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '検索に失敗しました' });
  }
});
