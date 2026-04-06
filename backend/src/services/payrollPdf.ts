import { query } from '../db/pool.js';
import { withPdfPage } from './pdfBrowser.js';

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function yen(raw: string | number) {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('ja-JP').format(Math.round(n));
}

function catLabel(c: string) {
  if (c === 'employee') return '社員';
  if (c === 'officer') return '役員';
  return c;
}

export async function buildPayrollPayslipPdf(companyId: string, entryId: string): Promise<Buffer> {
  const r = await query<{
    company_name: string;
    user_name: string;
    user_email: string | null;
    period_month: string;
    payroll_category: string;
    monthly_gross: string;
    grade_basis_amount: string;
    age_years: number;
    withholding_tax: string;
    resident_tax: string;
    standard_monthly_remuneration: string;
    grade: number;
    health_insurance: string;
    pension_insurance: string;
    care_insurance: string;
    employment_insurance: string;
    employment_insurance_applicable: boolean;
    social_insurance_total: string;
    total_deductions: string;
    net_pay: string;
    rate_snapshot_label: string | null;
    notes: string | null;
  }>(
    `SELECT c.name AS company_name, u.name AS user_name, u.email AS user_email,
            to_char(e.period_month, 'YYYY-MM-DD') AS period_month,
            e.payroll_category::text AS payroll_category,
            e.monthly_gross::text, e.grade_basis_amount::text, e.age_years,
            e.withholding_tax::text, e.resident_tax::text,
            e.standard_monthly_remuneration::text,
            e.grade::int,
            e.health_insurance::text, e.pension_insurance::text, e.care_insurance::text,
            e.employment_insurance::text, e.employment_insurance_applicable,
            e.social_insurance_total::text,
            e.total_deductions::text, e.net_pay::text,
            e.rate_snapshot_label, e.notes
     FROM payroll_monthly_entries e
     JOIN users u ON u.id = e.user_id
     JOIN companies c ON c.id = e.company_id
     WHERE e.id = $1 AND e.company_id = $2`,
    [entryId, companyId]
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error('NOT_FOUND');
  }

  const pm = row.period_month;
  const [py, pmM] = pm.split('-').map((x) => parseInt(x, 10));
  const periodJa = `${py}年${pmM}月分`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: "Segoe UI", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, sans-serif; font-size: 11px; color: #1e293b; padding: 24px; }
  h1 { font-size: 18px; color: #0f172a; margin-bottom: 4px; }
  .meta { margin-bottom: 16px; color: #475569; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px 10px; }
  th { background: #f1f5f9; text-align: left; width: 42%; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .section { font-size: 13px; font-weight: 600; margin-top: 20px; color: #334155; }
</style></head><body>
  <h1>給与明細</h1>
  <p class="meta">${esc(row.company_name)}</p>
  <p class="meta">${esc(periodJa)}　${esc(row.user_name)}（${esc(catLabel(row.payroll_category))}）</p>
  ${row.user_email ? `<p class="meta">${esc(row.user_email)}</p>` : ''}

  <p class="section">計算の前提</p>
  <table>
    <tr><th>料率参照</th><td>${esc(row.rate_snapshot_label ?? '')}</td></tr>
    <tr><th>報酬月額（等級用）</th><td class="num">${yen(row.grade_basis_amount)} 円</td></tr>
    <tr><th>標準報酬月額［等級${row.grade}］</th><td class="num">${yen(row.standard_monthly_remuneration)} 円</td></tr>
    <tr><th>年齢（介護該当判定）</th><td>${row.age_years} 歳</td></tr>
    <tr><th>雇用保険</th><td>${row.employment_insurance_applicable ? '計上（社員）' : '計上なし（役員）'}</td></tr>
  </table>

  <p class="section">支給</p>
  <table>
    <tr><th>総支給額（賃金・概算）</th><td class="num">${yen(row.monthly_gross)} 円</td></tr>
  </table>

  <p class="section">控除</p>
  <table>
    <tr><th>健康保険（被保険者分）</th><td class="num">${yen(row.health_insurance)} 円</td></tr>
    <tr><th>厚生年金（被保険者分）</th><td class="num">${yen(row.pension_insurance)} 円</td></tr>
    <tr><th>介護保険（被保険者分）</th><td class="num">${yen(row.care_insurance)} 円</td></tr>
    <tr><th>雇用保険（労働者分）</th><td class="num">${yen(row.employment_insurance)} 円</td></tr>
    <tr><th>社保・雇用計</th><td class="num">${yen(row.social_insurance_total)} 円</td></tr>
    <tr><th>源泉所得税</th><td class="num">${yen(row.withholding_tax)} 円</td></tr>
    <tr><th>住民税（特別徴収等）</th><td class="num">${yen(row.resident_tax)} 円</td></tr>
    <tr><th>控除合計</th><td class="num"><strong>${yen(row.total_deductions)} 円</strong></td></tr>
  </table>

  <p class="section">差引支給額</p>
  <table>
    <tr><th>手取り（概算）</th><td class="num"><strong style="font-size:14px">${yen(row.net_pay)} 円</strong></td></tr>
  </table>

  ${row.notes?.trim() ? `<p class="section">備考</p><p>${esc(row.notes.trim())}</p>` : ''}

  <p style="margin-top:28px;font-size:9px;color:#64748b">本明細はシステムによる概算です。実際の支払・控除は給与規程・法令に従って確認してください。</p>
</body></html>`;

  return withPdfPage(async (page) => {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf);
  });
}

export async function buildPayrollMonthlySummaryPdf(
  companyId: string,
  year: number,
  month: number
): Promise<Buffer> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const co = await query<{ name: string }>(`SELECT name FROM companies WHERE id = $1`, [companyId]);
  const companyName = co.rows[0]?.name ?? '';

  const lines = await query<{
    user_name: string;
    payroll_category: string;
    monthly_gross: string;
    health_insurance: string;
    pension_insurance: string;
    care_insurance: string;
    employment_insurance: string;
    social_insurance_total: string;
    withholding_tax: string;
    resident_tax: string;
    total_deductions: string;
    net_pay: string;
  }>(
    `SELECT u.name AS user_name, e.payroll_category::text AS payroll_category,
            e.monthly_gross::text,
            e.health_insurance::text, e.pension_insurance::text, e.care_insurance::text,
            e.employment_insurance::text, e.social_insurance_total::text,
            e.withholding_tax::text, e.resident_tax::text,
            e.total_deductions::text, e.net_pay::text
     FROM payroll_monthly_entries e
     JOIN users u ON u.id = e.user_id
     WHERE e.company_id = $1 AND e.period_month = $2::date
     ORDER BY u.name`,
    [companyId, start]
  );

  let sumGross = 0;
  let sumSoc = 0;
  let sumWh = 0;
  let sumRt = 0;
  let sumDed = 0;
  let sumNet = 0;

  const rowsHtml = lines.rows
    .map((line) => {
      sumGross += Number(line.monthly_gross);
      sumSoc += Number(line.social_insurance_total);
      sumWh += Number(line.withholding_tax);
      sumRt += Number(line.resident_tax);
      sumDed += Number(line.total_deductions);
      sumNet += Number(line.net_pay);
      return `<tr>
        <td>${esc(line.user_name)}</td>
        <td>${esc(catLabel(line.payroll_category))}</td>
        <td class="num">${yen(line.monthly_gross)}</td>
        <td class="num">${yen(line.health_insurance)}</td>
        <td class="num">${yen(line.pension_insurance)}</td>
        <td class="num">${yen(line.care_insurance)}</td>
        <td class="num">${yen(line.employment_insurance)}</td>
        <td class="num">${yen(line.social_insurance_total)}</td>
        <td class="num">${yen(line.withholding_tax)}</td>
        <td class="num">${yen(line.resident_tax)}</td>
        <td class="num">${yen(line.total_deductions)}</td>
        <td class="num"><strong>${yen(line.net_pay)}</strong></td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: "Segoe UI", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, sans-serif; font-size: 9px; color: #1e293b; padding: 20px; }
  h1 { font-size: 16px; color: #0f172a; margin-bottom: 4px; }
  .meta { color: #475569; margin-bottom: 12px; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 4px; }
  th { background: #f1f5f9; text-align: left; font-size: 8px; line-height: 1.2; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 600; background: #f8fafc; }
</style></head><body>
  <h1>月次給与集計表</h1>
  <p class="meta">${esc(companyName)}／${year}年${month}月分／${lines.rows.length}名</p>
  <table>
    <thead>
      <tr>
        <th>氏名</th>
        <th>区分</th>
        <th>総支給</th>
        <th>健康</th>
        <th>厚年</th>
        <th>介護</th>
        <th>雇保</th>
        <th>社保計</th>
        <th>源泉</th>
        <th>住民</th>
        <th>控除計</th>
        <th>手取</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="12">登録がありません</td></tr>'}
    </tbody>
    ${
      lines.rows.length
        ? `<tfoot>
      <tr>
        <td colspan="2">合計</td>
        <td class="num">${yen(sumGross)}</td>
        <td colspan="4"></td>
        <td class="num">${yen(sumSoc)}</td>
        <td class="num">${yen(sumWh)}</td>
        <td class="num">${yen(sumRt)}</td>
        <td class="num">${yen(sumDed)}</td>
        <td class="num">${yen(sumNet)}</td>
      </tr>
    </tfoot>`
        : ''
    }
  </table>
  <p style="margin-top:16px;font-size:8px;color:#64748b">金額は登録時点の令和7年度料率スナップショットに基づきます。</p>
</body></html>`;

  return withPdfPage(async (page) => {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({ format: 'A4', landscape: true, printBackground: true });
    return Buffer.from(pdf);
  });
}
