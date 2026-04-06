import { query } from '../db/pool.js';
import { withPdfPage } from './pdfBrowser.js';

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function buildArApPdf(companyId: string, year: number, month: number): Promise<Buffer> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;

  const cname = (await query<{ name: string }>(`SELECT name FROM companies WHERE id = $1`, [companyId]))
    .rows[0]?.name ?? '';

  // 売掛（請求書）: 月内の発行で、残金があるもの
  const arLines = await query<{
    invoice_no: string;
    issue_date: string;
    due_date: string | null;
    customer_name: string;
    total: string;
    paid_amount: string;
    remaining: string;
    status: string;
  }>(
    `SELECT
      i.invoice_no,
      to_char(i.issue_date, 'YYYY年MM月DD日') AS issue_date,
      to_char(i.due_date, 'YYYY年MM月DD日') AS due_date,
      c.company_name AS customer_name,
      i.total::text AS total,
      i.paid_amount::text AS paid_amount,
      (i.total - i.paid_amount)::text AS remaining,
      i.status::text AS status
     FROM invoices i
     JOIN customers c ON c.id = i.customer_id
     WHERE i.company_id = $1
       AND i.issue_date >= $2::date
       AND i.issue_date < ($2::date + interval '1 month')::date
       AND (i.total - i.paid_amount) > 0
     ORDER BY i.issue_date, i.due_date, i.invoice_no`,
    [companyId, start]
  );

  const arByCustomer = await query<{ customer_name: string; sum: string }>(
    `SELECT
      c.company_name AS customer_name,
      COALESCE(SUM(i.total - i.paid_amount),0)::text AS sum
     FROM invoices i
     JOIN customers c ON c.id = i.customer_id
     WHERE i.company_id = $1
       AND i.issue_date >= $2::date
       AND i.issue_date < ($2::date + interval '1 month')::date
       AND (i.total - i.paid_amount) > 0
     GROUP BY c.company_name
     ORDER BY sum DESC`,
    [companyId, start]
  );

  // 買掛（この簡易モデルでは「負債系の勘定科目に紐づく経費」を仕入先の未払として扱う）
  const apLines = await query<{
    expense_date: string;
    payment_destination: string | null;
    supplier_invoice_no: string | null;
    tax_division_label: string;
    amount: string;
    account_name: string;
  }>(
    `SELECT
      to_char(e.expense_date, 'YYYY年MM月DD日') AS expense_date,
      e.payment_destination,
      e.supplier_invoice_no,
      COALESCE(td.label,
        CASE
          WHEN e.tax_rate = 10 THEN '消費税10%'
          WHEN e.tax_rate = 8 THEN '消費税8%'
          WHEN e.tax_rate = 0 THEN '非課税'
          ELSE '不明'
        END
      ) AS tax_division_label,
      e.amount::text AS amount,
      a.name AS account_name
     FROM expenses e
     JOIN chart_of_accounts a ON a.id = e.chart_account_id
     LEFT JOIN tax_divisions td ON td.id = e.tax_division_id
     WHERE e.company_id = $1
       AND e.expense_date >= $2::date
       AND e.expense_date < ($2::date + interval '1 month')::date
       AND a.account_type = 'liability'
     ORDER BY e.expense_date, e.id`,
    [companyId, start]
  );

  const apByVendor = await query<{ vendor: string; sum: string }>(
    `SELECT
      COALESCE(e.payment_destination,'—') AS vendor,
      COALESCE(SUM(e.amount),0)::text AS sum
     FROM expenses e
     JOIN chart_of_accounts a ON a.id = e.chart_account_id
     WHERE e.company_id = $1
       AND e.expense_date >= $2::date
       AND e.expense_date < ($2::date + interval '1 month')::date
       AND a.account_type = 'liability'
     GROUP BY COALESCE(e.payment_destination,'—')
     ORDER BY sum DESC`,
    [companyId, start]
  );

  const arLinesHtml = arLines.rows
    .map((r: {
      invoice_no: string;
      issue_date: string;
      due_date: string | null;
      customer_name: string;
      remaining: string;
      status: string;
    }) => {
      return `<tr>
        <td>${esc(r.invoice_no)}</td>
        <td>${esc(r.issue_date)}</td>
        <td>${esc(r.due_date ?? '')}</td>
        <td>${esc(r.customer_name)}</td>
        <td style="text-align:right">${esc(r.remaining)}</td>
        <td>${esc(r.status)}</td>
      </tr>`;
    })
    .join('');

  const arByCustomerHtml = arByCustomer.rows
    .map((r: { customer_name: string; sum: string }) => (
      `<tr><td>${esc(r.customer_name)}</td><td style="text-align:right">${esc(r.sum)}</td></tr>`
    ))
    .join('');

  const apLinesHtml = apLines.rows
    .map((r: {
      expense_date: string;
      account_name: string;
      payment_destination: string | null;
      tax_division_label: string;
      supplier_invoice_no: string | null;
      amount: string;
    }) => {
      return `<tr>
        <td>${esc(r.expense_date)}</td>
        <td>${esc(r.account_name)}</td>
        <td>${esc(r.payment_destination ?? '')}</td>
        <td>${esc(r.tax_division_label)}</td>
        <td>${esc(r.supplier_invoice_no ?? '')}</td>
        <td style="text-align:right">${esc(r.amount)}</td>
      </tr>`;
    })
    .join('');

  const apByVendorHtml = apByVendor.rows
    .map((r: { vendor: string; sum: string }) => (
      `<tr><td>${esc(r.vendor)}</td><td style="text-align:right">${esc(r.sum)}</td></tr>`
    ))
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
  <h1>月次 売掛・買掛集計表</h1>
  <p>${esc(cname)}</p>
  <p>対象月: ${year}年${month}月</p>

  <h2>売掛（請求書）合計</h2>
  <table>
    <thead><tr><th>得意先</th><th>残金合計</th></tr></thead>
    <tbody>${arByCustomerHtml || '<tr><td colspan="2">データなし</td></tr>'}</tbody>
  </table>
  <h2>売掛（請求書一覧）</h2>
  <table>
    <thead><tr><th>請求番号</th><th>発行日</th><th>支払期日</th><th>得意先</th><th>残金</th><th>ステータス</th></tr></thead>
    <tbody>${arLinesHtml || '<tr><td colspan="6">データなし</td></tr>'}</tbody>
  </table>

  <h2>買掛（経費/負債勘定）合計</h2>
  <table>
    <thead><tr><th>支払先</th><th>合計</th></tr></thead>
    <tbody>${apByVendorHtml || '<tr><td colspan="2">データなし</td></tr>'}</tbody>
  </table>
  <h2>買掛（経費/負債勘定一覧）</h2>
  <table>
    <thead><tr><th>日付</th><th>勘定科目</th><th>支払先</th><th>税区分</th><th>インボイス番号</th><th>金額</th></tr></thead>
    <tbody>${apLinesHtml || '<tr><td colspan="6">データなし</td></tr>'}</tbody>
  </table>
</body></html>`;

  return withPdfPage(async (page) => {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf);
  });
}

