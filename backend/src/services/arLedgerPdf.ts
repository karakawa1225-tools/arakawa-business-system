import { query } from '../db/pool.js';
import { withPdfPage } from './pdfBrowser.js';

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function buildArLedgerMonthlyPdf(companyId: string, year: number, month: number): Promise<Buffer> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const cname = (await query<{ name: string }>(`SELECT name FROM companies WHERE id = $1`, [companyId]))
    .rows[0]?.name ?? '';

  const rows = await query<{
    customer_code: string;
    customer_name: string;
    closing_day: string | null;
    sales_amount: string;
    tax_amount: string;
    total_amount: string;
  }>(
    `SELECT
      c.customer_code,
      c.company_name AS customer_name,
      a.closing_day::text AS closing_day,
      a.sales_amount::text AS sales_amount,
      a.tax_amount::text AS tax_amount,
      a.total_amount::text AS total_amount
     FROM ar_ledger a
     JOIN customers c ON c.id = a.customer_id
     WHERE a.company_id = $1 AND a.period_month = $2::date
     ORDER BY c.customer_code, c.company_name`,
    [companyId, start]
  );

  const totals = await query<{ sales: string; tax: string; total: string }>(
    `SELECT
      COALESCE(SUM(sales_amount),0)::text AS sales,
      COALESCE(SUM(tax_amount),0)::text AS tax,
      COALESCE(SUM(total_amount),0)::text AS total
     FROM ar_ledger
     WHERE company_id = $1 AND period_month = $2::date`,
    [companyId, start]
  );

  const body = rows.rows
    .map((r) => {
      return `<tr>
        <td>${esc(r.customer_code)}</td>
        <td>${esc(r.customer_name)}</td>
        <td style="text-align:center">${esc(r.closing_day ?? '')}</td>
        <td style="text-align:right">${esc(r.sales_amount)}</td>
        <td style="text-align:right">${esc(r.tax_amount)}</td>
        <td style="text-align:right">${esc(r.total_amount)}</td>
      </tr>`;
    })
    .join('');

  const t = totals.rows[0] ?? { sales: '0', tax: '0', total: '0' };

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: "Segoe UI", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, sans-serif; font-size: 11px; color: #1e293b; padding: 24px; }
  h1 { font-size: 18px; color: #0f172a; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
  th { background: #f1f5f9; text-align: left; }
  tfoot td { background: #f8fafc; font-weight: 600; }
</style></head><body>
  <h1>月別売掛金集計表</h1>
  <p>${esc(cname)}</p>
  <p>対象月: ${year}年${month}月</p>
  <table>
    <thead>
      <tr><th>顧客コード</th><th>顧客名</th><th>締め日</th><th>売上金額</th><th>消費税額</th><th>合計</th></tr>
    </thead>
    <tbody>
      ${body || '<tr><td colspan="6">データなし</td></tr>'}
    </tbody>
    <tfoot>
      <tr><td colspan="3">合計</td><td style="text-align:right">${esc(t.sales)}</td><td style="text-align:right">${esc(t.tax)}</td><td style="text-align:right">${esc(t.total)}</td></tr>
    </tfoot>
  </table>
</body></html>`;

  return withPdfPage(async (page) => {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf);
  });
}

