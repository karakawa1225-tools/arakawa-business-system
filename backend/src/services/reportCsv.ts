import { query } from '../db/pool.js';

const BOM = '\uFEFF';

function cell(v: string | number | null | undefined): string {
  const s = v == null || v === '' ? '' : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function line(cells: (string | number | null | undefined)[]): string {
  return cells.map(cell).join(',') + '\r\n';
}

function out(s: string): Buffer {
  return Buffer.from(BOM + s, 'utf8');
}

function catLabel(c: string) {
  if (c === 'employee') return '社員';
  if (c === 'officer') return '役員';
  return c;
}

export async function buildExpenseSettlementCsv(
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
  let csv = line([`月次経費精算（CSV）`, cname]);
  csv += line([`対象月`, `${year}-${String(month).padStart(2, '0')}`]);
  csv += line([]);

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
    `SELECT to_char(e.expense_date, 'YYYY-MM-DD') AS expense_date, a.name AS account_name, e.amount::text,
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

  csv += line(['【経費一覧】']);
  csv += line(['日付', '勘定科目', '金額', '税区分', 'インボイス番号', '支払先', '摘要', '担当']);
  for (const r of lines.rows) {
    csv += line([
      r.expense_date,
      r.account_name,
      r.amount,
      r.tax_division_label,
      r.supplier_invoice_no,
      r.payment_destination,
      r.description,
      r.user_name,
    ]);
  }
  csv += line([]);

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
  csv += line(['【勘定科目別集計】']);
  csv += line(['勘定科目', '合計']);
  for (const r of byAccount.rows) csv += line([r.name, r.sum]);
  csv += line([]);

  const byTax = await query<{ tax_rate: string; sum: string }>(
    `SELECT e.tax_rate::text, COALESCE(SUM(e.amount),0)::text AS sum
     FROM expenses e
     WHERE e.company_id = $1
       AND e.expense_date >= $2::date
       AND e.expense_date < ($2::date + interval '1 month')::date
     GROUP BY e.tax_rate ORDER BY e.tax_rate`,
    [companyId, start]
  );
  csv += line(['【消費税率別集計】']);
  csv += line(['税率(%)', '合計']);
  for (const r of byTax.rows) csv += line([r.tax_rate, r.sum]);

  return out(csv);
}

export async function buildBankInOutCsv(
  companyId: string,
  year: number,
  month: number
): Promise<Buffer> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const cname = (await query<{ name: string }>(`SELECT name FROM companies WHERE id = $1`, [companyId]))
    .rows[0]?.name ?? '';

  const summary = await query<{ deposit: string; withdrawal: string; net: string }>(
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
  const s = summary.rows[0] ?? { deposit: '0', withdrawal: '0', net: '0' };

  const txs = await query<{
    tx_date: string;
    tx_type: string;
    description: string | null;
    amount: string;
    balance_after: string | null;
    bank_account_name: string;
  }>(
    `SELECT
      to_char(t.tx_date, 'YYYY-MM-DD') AS tx_date,
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

  let csv = line([`月次銀行入出金（CSV）`, cname]);
  csv += line([`対象月`, `${year}-${String(month).padStart(2, '0')}`]);
  csv += line([]);
  csv += line(['【サマリ】']);
  csv += line(['入金合計', '出金合計', '差引（純増減）']);
  csv += line([s.deposit, s.withdrawal, s.net]);
  csv += line([]);
  csv += line(['【明細】']);
  csv += line(['日付', '口座', '区分', '金額', '残高', '摘要']);
  for (const r of txs.rows) {
    const typeJa = r.tx_type === 'withdrawal' ? '出金' : '入金';
    csv += line([r.tx_date, r.bank_account_name, typeJa, r.amount, r.balance_after, r.description]);
  }
  return out(csv);
}

export async function buildArLedgerMonthlyCsv(
  companyId: string,
  year: number,
  month: number
): Promise<Buffer> {
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
  const t = totals.rows[0] ?? { sales: '0', tax: '0', total: '0' };

  let csv = line([`月別売掛金（CSV）`, cname]);
  csv += line([`対象月`, `${year}-${String(month).padStart(2, '0')}`]);
  csv += line([]);
  csv += line(['顧客コード', '顧客名', '締め日', '売上金額', '消費税額', '合計']);
  for (const r of rows.rows) {
    csv += line([r.customer_code, r.customer_name, r.closing_day, r.sales_amount, r.tax_amount, r.total_amount]);
  }
  csv += line(['合計', '', '', t.sales, t.tax, t.total]);
  return out(csv);
}

export async function buildApLedgerMonthlyCsv(
  companyId: string,
  year: number,
  month: number
): Promise<Buffer> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const cname = (await query<{ name: string }>(`SELECT name FROM companies WHERE id = $1`, [companyId]))
    .rows[0]?.name ?? '';

  const rows = await query<{
    supplier_code: string;
    supplier_name: string;
    closing_day: string | null;
    amount: string;
    tax_amount: string;
    total_amount: string;
  }>(
    `SELECT
      s.supplier_code,
      s.name AS supplier_name,
      a.closing_day::text AS closing_day,
      a.amount::text AS amount,
      a.tax_amount::text AS tax_amount,
      a.total_amount::text AS total_amount
     FROM ap_ledger a
     JOIN suppliers s ON s.id = a.supplier_id
     WHERE a.company_id = $1 AND a.period_month = $2::date
     ORDER BY s.supplier_code, s.name`,
    [companyId, start]
  );

  const totals = await query<{ amount: string; tax: string; total: string }>(
    `SELECT
      COALESCE(SUM(amount),0)::text AS amount,
      COALESCE(SUM(tax_amount),0)::text AS tax,
      COALESCE(SUM(total_amount),0)::text AS total
     FROM ap_ledger
     WHERE company_id = $1 AND period_month = $2::date`,
    [companyId, start]
  );
  const t = totals.rows[0] ?? { amount: '0', tax: '0', total: '0' };

  let csv = line([`月別買掛金（CSV）`, cname]);
  csv += line([`対象月`, `${year}-${String(month).padStart(2, '0')}`]);
  csv += line([]);
  csv += line(['仕入先コード', '仕入先名', '締め日', '金額', '消費税額', '合計']);
  for (const r of rows.rows) {
    csv += line([r.supplier_code, r.supplier_name, r.closing_day, r.amount, r.tax_amount, r.total_amount]);
  }
  csv += line(['合計', '', '', t.amount, t.tax, t.total]);
  return out(csv);
}

export async function buildPayrollMonthlyDetailListCsv(
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

  let csv = line([`月別給与明細一覧（CSV）`, companyName]);
  csv += line([`対象月`, `${year}-${String(month).padStart(2, '0')}`]);
  csv += line([]);
  csv += line([
    '氏名',
    '区分',
    '年齢',
    '等級',
    '標準報酬',
    '総支給',
    '健康',
    '厚年',
    '介護',
    '雇保',
    '社保計',
    '源泉',
    '住民',
    '控除計',
    '手取',
    '備考',
  ]);
  let sumGross = 0;
  let sumNet = 0;
  for (const lineRow of lines.rows) {
    sumGross += Number(lineRow.monthly_gross);
    sumNet += Number(lineRow.net_pay);
    csv += line([
      lineRow.user_name,
      catLabel(lineRow.payroll_category),
      lineRow.age_years,
      lineRow.grade,
      lineRow.standard_monthly_remuneration,
      lineRow.monthly_gross,
      lineRow.health_insurance,
      lineRow.pension_insurance,
      lineRow.care_insurance,
      lineRow.employment_insurance,
      lineRow.social_insurance_total,
      lineRow.withholding_tax,
      lineRow.resident_tax,
      lineRow.total_deductions,
      lineRow.net_pay,
      lineRow.notes,
    ]);
  }
  if (lines.rows.length) {
    csv += line(['合計', '', '', '', '', sumGross, '', '', '', '', '', '', '', '', sumNet, '']);
  }
  return out(csv);
}

type MonthNet = Record<number, number>;

export async function buildPayrollAnnualCalendarCsv(
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

  const header: string[] = ['氏名', '区分'];
  for (let m = 1; m <= 12; m++) {
    header.push(`${m}月手取`, `${m}月支給`);
  }
  header.push('年間手取計', '年間支給計');

  let csv = line([`給与支給・手取り 年度一覧（CSV）`, companyName]);
  csv += line([`対象年`, String(year)]);
  csv += line([]);
  csv += line(header);

  for (const p of people) {
    const row: (string | number)[] = [p.name, catLabel(p.category)];
    for (let m = 1; m <= 12; m++) {
      row.push(p.months[m] ?? '', p.grossMonths[m] ?? '');
    }
    row.push(p.yearNet, p.yearGross);
    csv += line(row);
  }

  return out(csv);
}

export async function buildPayrollMonthlySummaryCsv(
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

  let csv = line([`月次給与集計表（CSV）`, companyName]);
  csv += line([`対象月`, `${year}-${String(month).padStart(2, '0')}`]);
  csv += line([]);
  csv += line([
    '氏名',
    '区分',
    '総支給',
    '健康',
    '厚年',
    '介護',
    '雇保',
    '社保計',
    '源泉',
    '住民',
    '控除計',
    '手取',
  ]);
  let sumGross = 0;
  let sumSoc = 0;
  let sumWh = 0;
  let sumRt = 0;
  let sumDed = 0;
  let sumNet = 0;
  for (const l of lines.rows) {
    sumGross += Number(l.monthly_gross);
    sumSoc += Number(l.social_insurance_total);
    sumWh += Number(l.withholding_tax);
    sumRt += Number(l.resident_tax);
    sumDed += Number(l.total_deductions);
    sumNet += Number(l.net_pay);
    csv += line([
      l.user_name,
      catLabel(l.payroll_category),
      l.monthly_gross,
      l.health_insurance,
      l.pension_insurance,
      l.care_insurance,
      l.employment_insurance,
      l.social_insurance_total,
      l.withholding_tax,
      l.resident_tax,
      l.total_deductions,
      l.net_pay,
    ]);
  }
  if (lines.rows.length) {
    csv += line(['合計', '', sumGross, '', '', '', '', sumSoc, sumWh, sumRt, sumDed, sumNet]);
  }
  return out(csv);
}
