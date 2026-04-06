import { query } from '../db/pool.js';

export async function getDashboardStats(companyId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;

  const [todaySales, monthSales, unpaid, pendingEstimates, monthlyRevenue, monthlyPayments] =
    await Promise.all([
      query<{ s: string }>(
        `SELECT COALESCE(SUM(amount),0)::text AS s FROM payments 
         WHERE company_id = $1 AND payment_date = $2::date`,
        [companyId, today]
      ),
      query<{ s: string }>(
        `SELECT COALESCE(SUM(amount),0)::text AS s FROM payments 
         WHERE company_id = $1 AND payment_date >= $2::date`,
        [companyId, monthStart]
      ),
      query<{ s: string }>(
        `SELECT COALESCE(SUM(total - paid_amount),0)::text AS s FROM invoices 
         WHERE company_id = $1 AND status NOT IN ('paid','cancelled') AND total > paid_amount`,
        [companyId]
      ),
      query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM estimates 
         WHERE company_id = $1 AND status IN ('draft','sent')`,
        [companyId]
      ),
      query<{ m: string; total: string }>(
        `SELECT to_char(issue_date, 'YYYY-MM') AS m, COALESCE(SUM(total),0)::text AS total
         FROM invoices WHERE company_id = $1 AND issue_date >= ($2::date - interval '11 months')
         GROUP BY 1 ORDER BY 1`,
        [companyId, monthStart]
      ),
      query<{ m: string; total: string }>(
        `SELECT to_char(payment_date, 'YYYY-MM') AS m, COALESCE(SUM(amount),0)::text AS total
         FROM payments WHERE company_id = $1 AND payment_date >= ($2::date - interval '11 months')
         GROUP BY 1 ORDER BY 1`,
        [companyId, monthStart]
      ),
    ]);

  return {
    todaySales: todaySales.rows[0]?.s ?? '0',
    monthSales: monthSales.rows[0]?.s ?? '0',
    unpaidAmount: unpaid.rows[0]?.s ?? '0',
    pendingEstimates: parseInt(pendingEstimates.rows[0]?.c ?? '0', 10),
    monthlyInvoiceTotals: monthlyRevenue.rows,
    monthlyPaymentTotals: monthlyPayments.rows,
  };
}
