import { query } from '../db/pool.js';
import { withPdfPage } from './pdfBrowser.js';

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function buildExpenseSettlementPdf(
  companyId: string,
  year: number,
  month: number
): Promise<Buffer> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const company = await query<{ name: string }>(
    `SELECT name FROM companies WHERE id = $1`,
    [companyId]
  );
  const cname = company.rows[0]?.name ?? '';

  const lines = await query<{
    expense_date: string;
    account_name: string;
    amount: string;
    tax_division_label: string;
    supplier_invoice_no: string | null;
    payment_destination: string | null;
    description: string | null;
    user_name: string | null;
  }>(
    `SELECT to_char(e.expense_date, 'YYYY年MM月DD日') AS expense_date, a.name AS account_name, e.amount::text,
            COALESCE(td.label,
              CASE
                WHEN e.tax_rate = 10 THEN '消費税10%'
                WHEN e.tax_rate = 8 THEN '消費税8%'
                WHEN e.tax_rate = 0 THEN '非課税'
                ELSE '不明'
              END
            ) AS tax_division_label,
            e.supplier_invoice_no,
            e.payment_destination,
            e.description, u.name AS user_name
     FROM expenses e
     JOIN chart_of_accounts a ON a.id = e.chart_account_id
     LEFT JOIN users u ON u.id = e.user_id
     LEFT JOIN tax_divisions td ON td.id = e.tax_division_id
     WHERE e.company_id = $1
       AND e.expense_date >= $2::date
       AND e.expense_date < ($2::date + interval '1 month')::date
     ORDER BY e.expense_date, e.id`,
    [companyId, start]
  );

  const byAccount = await query<{ name: string; sum: string }>(
    `SELECT a.name, COALESCE(SUM(e.amount),0)::text AS sum
     FROM expenses e
     JOIN chart_of_accounts a ON a.id = e.chart_account_id
     WHERE e.company_id = $1
       AND e.expense_date >= $2::date
       AND e.expense_date < ($2::date + interval '1 month')::date
     GROUP BY a.name ORDER BY a.name`,
    [companyId, start]
  );

  const byTax = await query<{ tax_rate: string; sum: string }>(
    `SELECT e.tax_rate::text, COALESCE(SUM(e.amount),0)::text AS sum
     FROM expenses e
     WHERE e.company_id = $1
       AND e.expense_date >= $2::date
       AND e.expense_date < ($2::date + interval '1 month')::date
     GROUP BY e.tax_rate ORDER BY e.tax_rate`,
    [companyId, start]
  );

  const rowsHtml = lines.rows
    .map(
      (r: {
        expense_date: string;
        account_name: string;
        amount: string;
        tax_division_label: string;
        supplier_invoice_no: string | null;
        payment_destination: string | null;
        description: string | null;
        user_name: string | null;
      }) =>
        `<tr><td>${esc(r.expense_date)}</td><td>${esc(r.account_name)}</td><td style="text-align:right">${esc(r.amount)}</td><td>${esc(r.tax_division_label)}</td><td>${esc(r.supplier_invoice_no ?? '')}</td><td>${esc(r.payment_destination ?? '')}</td><td>${esc(r.description ?? '')}</td><td>${esc(r.user_name ?? '')}</td></tr>`
    )
    .join('');

  const accHtml = byAccount.rows
    .map((r: { name: string; sum: string }) => `<tr><td>${esc(r.name)}</td><td style="text-align:right">${esc(r.sum)}</td></tr>`)
    .join('');

  const taxHtml = byTax.rows
    .map((r: { tax_rate: string; sum: string }) => {
      const label = r.tax_rate === '0' ? '非課税（または課税対象外）' : `${r.tax_rate}%`;
      return `<tr><td>${esc(label)}</td><td style="text-align:right">${esc(r.sum)}</td></tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: "Segoe UI", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, sans-serif; font-size: 11px; color: #1e293b; padding: 24px; }
  h1 { font-size: 18px; color: #0f172a; margin-bottom: 4px; }
  h2 { font-size: 13px; margin-top: 20px; color: #334155; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
  th { background: #f1f5f9; text-align: left; }
</style></head><body>
  <h1>月次経費精算書</h1>
  <p>${esc(cname)}</p>
  <p>対象月: ${year}年${month}月</p>
  <h2>経費一覧</h2>
  <table>
    <thead><tr><th>日付</th><th>勘定科目</th><th>金額</th><th>税区分</th><th>インボイス番号</th><th>支払先</th><th>摘要</th><th>担当</th></tr></thead>
    <tbody>${rowsHtml || '<tr><td colspan="8">データなし</td></tr>'}</tbody>
  </table>
  <h2>勘定科目別集計</h2>
  <table><thead><tr><th>勘定科目</th><th>合計</th></tr></thead><tbody>${accHtml || '<tr><td colspan="2">データなし</td></tr>'}</tbody></table>
  <h2>消費税率別集計</h2>
  <p>税率区分: 10% / 8% / 非課税（課税対象外含む）</p>
  <table><thead><tr><th>区分</th><th>合計</th></tr></thead><tbody>${taxHtml || '<tr><td colspan="2">データなし</td></tr>'}</tbody></table>
</body></html>`;

  return withPdfPage(async (page) => {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf);
  });
}
