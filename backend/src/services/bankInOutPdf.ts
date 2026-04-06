import { withPdfPage } from './pdfBrowser.js';
import { query } from '../db/pool.js';

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function buildBankInOutPdf(
  companyId: string,
  year: number,
  month: number
): Promise<Buffer> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;

  const accounts = await query<{
    id: string;
    name: string;
    start_balance: string;
    end_balance: string;
  }>(
    `SELECT
      ba.id,
      ba.name,
      COALESCE((
        SELECT t.balance_after::text
        FROM bank_transactions t
        WHERE t.company_id = $1
          AND t.bank_account_id = ba.id
          AND t.tx_date < $2::date
        ORDER BY t.tx_date DESC, t.created_at DESC
        LIMIT 1
      ), ba.opening_balance::text) AS start_balance,
      COALESCE((
        SELECT t.balance_after::text
        FROM bank_transactions t
        WHERE t.company_id = $1
          AND t.bank_account_id = ba.id
          AND t.tx_date >= $2::date
          AND t.tx_date < ($2::date + interval '1 month')::date
        ORDER BY t.tx_date DESC, t.created_at DESC
        LIMIT 1
      ), ba.current_balance::text) AS end_balance
    FROM bank_accounts ba
    WHERE ba.company_id = $1
    ORDER BY ba.name`,
    [companyId, start]
  );

  const txs = await query<{
    tx_date: string;
    tx_type: string;
    description: string | null;
    amount: string;
    balance_after: string | null;
    bank_account_name: string;
  }>(
    `SELECT
      to_char(t.tx_date, 'YYYY年MM月DD日') AS tx_date,
      t.tx_type::text,
      t.description,
      t.amount::text,
      t.balance_after::text,
      b.name AS bank_account_name
    FROM bank_transactions t
    JOIN bank_accounts b ON b.id = t.bank_account_id
    WHERE t.company_id = $1
      AND t.tx_date >= $2::date
      AND t.tx_date < ($2::date + interval '1 month')::date
    ORDER BY t.tx_date, t.created_at`,
    [companyId, start]
  );

  const summary = await query<{
    deposit: string;
    withdrawal: string;
    net: string;
  }>(
    `SELECT
      COALESCE(SUM(CASE WHEN tx_type = 'deposit' THEN amount END),0)::text AS deposit,
      COALESCE(SUM(CASE WHEN tx_type = 'withdrawal' THEN amount END),0)::text AS withdrawal,
      COALESCE(SUM(CASE WHEN tx_type = 'deposit' THEN amount
                          WHEN tx_type = 'withdrawal' THEN -amount
                          ELSE 0 END),0)::text AS net
     FROM bank_transactions
     WHERE company_id = $1
       AND tx_date >= $2::date
       AND tx_date < ($2::date + interval '1 month')::date`,
    [companyId, start]
  );

  const cname = (await query<{ name: string }>(`SELECT name FROM companies WHERE id = $1`, [companyId]))
    .rows[0]?.name ?? '';

  const txRowsHtml = txs.rows
    .map((r: { tx_date: string; tx_type: string; description: string | null; amount: string; balance_after: string | null; bank_account_name: string }) => {
      const label = r.tx_type === 'deposit' ? '入金' : '出金';
      return `<tr>
        <td>${esc(r.tx_date)}</td>
        <td>${esc(r.bank_account_name)}</td>
        <td>${esc(label)}</td>
        <td style="text-align:right">${esc(r.amount)}</td>
        <td style="text-align:right">${esc(r.balance_after ?? '')}</td>
        <td>${esc(String(r.description ?? ''))}</td>
      </tr>`;
    })
    .join('');

  const accRowsHtml = accounts.rows
    .map((a: { name: string; start_balance: string; end_balance: string }) => {
      return `<tr>
        <td>${esc(a.name)}</td>
        <td style="text-align:right">${esc(a.start_balance)}</td>
        <td style="text-align:right">${esc(a.end_balance)}</td>
      </tr>`;
    })
    .join('');

  const s = summary.rows[0] ?? { deposit: '0', withdrawal: '0', net: '0' };

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
<h1>月次銀行入出金集計表</h1>
<p>${esc(cname)}</p>
<p>対象月: ${year}年${month}月</p>

<h2>入出金サマリ</h2>
<table>
  <thead><tr>
    <th>入金合計</th>
    <th>出金合計</th>
    <th>差引（純増減）</th>
  </tr></thead>
  <tbody>
    <tr>
      <td style="text-align:right">${esc(s.deposit)}</td>
      <td style="text-align:right">${esc(s.withdrawal)}</td>
      <td style="text-align:right">${esc(s.net)}</td>
    </tr>
  </tbody>
</table>

<h2>口座別 残高</h2>
<table>
  <thead><tr><th>口座</th><th>月初残高</th><th>月末残高</th></tr></thead>
  <tbody>${accRowsHtml || '<tr><td colspan="3">データなし</td></tr>'}</tbody>
</table>

<h2>入出金明細</h2>
<table>
  <thead><tr>
    <th>日付</th><th>口座</th><th>区分</th><th>金額</th><th>残高</th><th>摘要</th>
  </tr></thead>
  <tbody>${txRowsHtml || '<tr><td colspan="6">データなし</td></tr>'}</tbody>
</table>
</body></html>`;

  return withPdfPage(async (page) => {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf);
  });
}

