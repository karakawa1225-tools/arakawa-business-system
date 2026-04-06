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
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('ja-JP').format(Math.round(n));
}

function catLabel(c: string) {
  if (c === 'employee') return '社員';
  if (c === 'officer') return '役員';
  return c;
}

function noteShort(s: string | null, max = 16) {
  if (!s?.trim()) return '';
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/** レポート用：会社全体の月別給与「明細」一覧（控除内訳＋備考） */
export async function buildPayrollMonthlyDetailListPdf(
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
    grade: number;
    standard_monthly_remuneration: string;
    age_years: number;
    notes: string | null;
  }>(
    `SELECT u.name AS user_name, e.payroll_category::text AS payroll_category,
            e.monthly_gross::text,
            e.health_insurance::text, e.pension_insurance::text, e.care_insurance::text,
            e.employment_insurance::text, e.social_insurance_total::text,
            e.withholding_tax::text, e.resident_tax::text,
            e.total_deductions::text, e.net_pay::text,
            e.grade::int, e.standard_monthly_remuneration::text,
            e.age_years::int, e.notes
     FROM payroll_monthly_entries e
     JOIN users u ON u.id = e.user_id
     WHERE e.company_id = $1 AND e.period_month = $2::date
     ORDER BY u.name`,
    [companyId, start]
  );

  let sumGross = 0;
  let sumNet = 0;

  const rowsHtml = lines.rows
    .map((line) => {
      sumGross += Number(line.monthly_gross);
      sumNet += Number(line.net_pay);
      return `<tr>
        <td>${esc(line.user_name)}</td>
        <td>${esc(catLabel(line.payroll_category))}</td>
        <td class="num">${line.age_years}</td>
        <td class="num">${line.grade}</td>
        <td class="num">${yen(line.standard_monthly_remuneration)}</td>
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
        <td>${esc(noteShort(line.notes))}</td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: "Segoe UI", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, sans-serif; font-size: 8px; color: #1e293b; padding: 16px; }
  h1 { font-size: 15px; color: #0f172a; margin-bottom: 4px; }
  .meta { color: #475569; margin-bottom: 10px; font-size: 9px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 3px; }
  th { background: #f1f5f9; text-align: left; font-size: 7px; line-height: 1.15; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 600; background: #f8fafc; }
</style></head><body>
  <h1>月別給与明細一覧表（会社全体）</h1>
  <p class="meta">${esc(companyName)}／${year}年${month}月分／${lines.rows.length}名</p>
  <table>
    <thead>
      <tr>
        <th>氏名</th><th>区分</th><th>年齢</th><th>等級</th><th>標準報酬</th><th>総支給</th>
        <th>健康</th><th>厚年</th><th>介護</th><th>雇保</th><th>社保計</th>
        <th>源泉</th><th>住民</th><th>控除計</th><th>手取</th><th>備考</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="16">登録がありません</td></tr>'}
    </tbody>
    ${
      lines.rows.length
        ? `<tfoot><tr>
        <td colspan="5">合計</td>
        <td class="num">${yen(sumGross)}</td>
        <td colspan="8"></td>
        <td class="num">${yen(sumNet)}</td>
        <td></td>
      </tr></tfoot>`
        : ''
    }
  </table>
  <p style="margin-top:12px;font-size:7px;color:#64748b">登録データに基づきます。控除は登録時点の料率スナップショットです。</p>
</body></html>`;

  return withPdfPage(async (page) => {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({ format: 'A4', landscape: true, printBackground: true });
    return Buffer.from(pdf);
  });
}

type MonthNet = Record<number, number>;

/** 暦年ベースの支給別一覧（手取りを月別セルに表示） */
export async function buildPayrollAnnualCalendarPdf(
  companyId: string,
  year: number
): Promise<Buffer> {
  const start = `${year}-01-01`;
  const endNext = `${year + 1}-01-01`;
  const co = await query<{ name: string }>(`SELECT name FROM companies WHERE id = $1`, [companyId]);
  const companyName = co.rows[0]?.name ?? '';

  const raw = await query<{
    user_id: string;
    user_name: string;
    payroll_category: string;
    m: number;
    net_pay: string;
    monthly_gross: string;
  }>(
    `SELECT e.user_id, u.name AS user_name, u.payroll_category::text AS payroll_category,
            EXTRACT(MONTH FROM e.period_month)::int AS m,
            e.net_pay::text, e.monthly_gross::text
     FROM payroll_monthly_entries e
     JOIN users u ON u.id = e.user_id
     WHERE e.company_id = $1
       AND e.period_month >= $2::date
       AND e.period_month < $3::date
     ORDER BY u.name, m`,
    [companyId, start, endNext]
  );

  const byUser = new Map<
    string,
    { name: string; category: string; months: MonthNet; grossMonths: MonthNet; yearNet: number; yearGross: number }
  >();

  for (const row of raw.rows) {
    let rec = byUser.get(row.user_id);
    if (!rec) {
      rec = {
        name: row.user_name,
        category: row.payroll_category,
        months: {},
        grossMonths: {},
        yearNet: 0,
        yearGross: 0,
      };
      byUser.set(row.user_id, rec);
    }
    const net = Number(row.net_pay);
    const gross = Number(row.monthly_gross);
    rec.months[row.m] = net;
    rec.grossMonths[row.m] = gross;
    rec.yearNet += net;
    rec.yearGross += gross;
  }

  const people = [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  const monthTotalsNet: number[] = Array.from({ length: 12 }, () => 0);
  const monthTotalsGross: number[] = Array.from({ length: 12 }, () => 0);
  for (const p of people) {
    for (let m = 1; m <= 12; m++) {
      if (p.months[m] !== undefined) monthTotalsNet[m - 1]! += p.months[m]!;
      if (p.grossMonths[m] !== undefined) monthTotalsGross[m - 1]! += p.grossMonths[m]!;
    }
  }
  let grandNet = 0;
  let grandGross = 0;
  for (const p of people) {
    grandNet += p.yearNet;
    grandGross += p.yearGross;
  }

  const headMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    .map((m) => `<th class="num">${m}月手取</th><th class="num numg">${m}月支給</th>`)
    .join('');

  const rowsHtml = people
    .map((p) => {
      const cells = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        .map((m) => {
          const n = p.months[m];
          const g = p.grossMonths[m];
          return `<td class="num">${n !== undefined ? yen(n) : '—'}</td><td class="num numg">${g !== undefined ? yen(g) : '—'}</td>`;
        })
        .join('');
      return `<tr>
        <td>${esc(p.name)}</td>
        <td>${esc(catLabel(p.category))}</td>
        ${cells}
        <td class="num"><strong>${yen(p.yearNet)}</strong></td>
        <td class="num numg"><strong>${yen(p.yearGross)}</strong></td>
      </tr>`;
    })
    .join('');

  const footCells = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    .map((i) => `<td class="num">${yen(monthTotalsNet[i]!)}</td><td class="num numg">${yen(monthTotalsGross[i]!)}</td>`)
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: "Segoe UI", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, sans-serif; font-size: 6.5px; color: #1e293b; padding: 12px; }
  h1 { font-size: 13px; color: #0f172a; margin-bottom: 4px; }
  .meta { color: #475569; margin-bottom: 8px; font-size: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 3px 2px; vertical-align: middle; }
  th { background: #f1f5f9; text-align: left; font-size: 6px; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .numg { background: #fafafa; color: #475569; }
  tfoot td { font-weight: 600; background: #f0f9ff; }
</style></head><body>
  <h1>給与支給・手取り 年度一覧表（暦年）</h1>
  <p class="meta">${esc(companyName)}／${year}年1月〜12月／対象 ${people.length}名（登録のあるユーザのみ）</p>
  <table>
    <thead>
      <tr>
        <th>氏名</th><th>区分</th>
        ${headMonths}
        <th class="num">年間手取計</th><th class="num numg">年間支給計</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="28">データがありません</td></tr>'}
    </tbody>
    ${
      people.length
        ? `<tfoot><tr>
        <td colspan="2">月計</td>
        ${footCells}
        <td class="num">${yen(grandNet)}</td>
        <td class="num numg">${yen(grandGross)}</td>
      </tr></tfoot>`
        : ''
    }
  </table>
  <p style="margin-top:10px;font-size:6px;color:#64748b">暦年（1〜12月）の登録ベース。行がないユーザは当年登録がないため表に出ません。</p>
</body></html>`;

  return withPdfPage(async (page) => {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({ format: 'A4', landscape: true, printBackground: true });
    return Buffer.from(pdf);
  });
}
