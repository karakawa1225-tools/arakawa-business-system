import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireStaff, blockViewerWrite, type AuthedRequest } from '../middleware/auth.js';
import { PAYROLL_RATES_REIWA7 } from '../services/payroll/rates2025.js';
import { calcPayrollDeductionsReiwa7, computePayrollEntrySnapshot, type PayrollCategory } from '../services/payroll/calc.js';
import { upsertPayrollMonthlyRow, ymFirstDay } from '../services/payrollPersist.js';

export const payrollRouter = Router();
payrollRouter.use(requireStaff);

function isPayrollCategory(s: string): s is PayrollCategory {
  return s === 'employee' || s === 'officer' || s === 'other';
}

async function selectEntryWithUser(companyId: string, entryId: string) {
  const r = await query(
    `SELECT e.*,
            u.name AS user_name,
            to_char(e.period_month, 'YYYY-MM-DD') AS period_month_iso
     FROM payroll_monthly_entries e
     JOIN users u ON u.id = e.user_id
     WHERE e.id = $1 AND e.company_id = $2`,
    [entryId, companyId]
  );
  return r.rows[0] ?? null;
}

/** 令和7年度の参照料率（協会けんぽ全国平均ベース） */
payrollRouter.get('/rates/reiwa7', (_req: AuthedRequest, res) => {
  res.json(PAYROLL_RATES_REIWA7);
});

/** 給与計算対象ユーザー（社員・役員のみ。月額・年齢マスタ含む） */
payrollRouter.get('/eligible-users', async (req: AuthedRequest, res) => {
  const r = await query(
    `SELECT id, email, name, role::text AS role,
            payroll_category::text AS payroll_category,
            age_years,
            base_monthly_gross::text AS base_monthly_gross
     FROM users
     WHERE company_id = $1
       AND active = TRUE
       AND payroll_category IN ('employee', 'officer')
     ORDER BY name`,
    [req.staff!.companyId]
  );
  res.json(r.rows);
});

/** 社保・雇用保険の概算（令和7年度マスタ。源泉・住民税は含みません） */
payrollRouter.post('/calculate/reiwa7', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as {
    payrollCategory?: string;
    monthlyWagesForEmploymentInsuranceYen?: unknown;
    monthlyEarningsForGradeYen?: unknown;
    age?: unknown;
  };
  const cat = typeof b.payrollCategory === 'string' ? b.payrollCategory : '';
  if (!isPayrollCategory(cat)) {
    res.status(400).json({ error: 'payrollCategory は employee / officer / other を指定してください' });
    return;
  }
  const wages = Number(b.monthlyWagesForEmploymentInsuranceYen);
  const gradeBasis = Number(b.monthlyEarningsForGradeYen);
  const age = Number(b.age);
  if (!Number.isFinite(wages) || wages < 0) {
    res.status(400).json({ error: 'monthlyWagesForEmploymentInsuranceYen が不正です' });
    return;
  }
  if (!Number.isFinite(gradeBasis) || gradeBasis < 0) {
    res.status(400).json({ error: 'monthlyEarningsForGradeYen が不正です' });
    return;
  }
  if (!Number.isFinite(age) || age < 15 || age > 100) {
    res.status(400).json({ error: 'age（15〜100）が必要です' });
    return;
  }

  const result = calcPayrollDeductionsReiwa7({
    payrollCategory: cat,
    monthlyWagesForEmploymentInsuranceYen: wages,
    monthlyEarningsForGradeYen: gradeBasis,
    age: Math.floor(age),
  });

  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

/** 月次給与集計表 PDF（:id より先に定義） */
payrollRouter.get('/entries/summary/:year/:month', async (req: AuthedRequest, res) => {
  const year = parseInt(String(req.params.year), 10);
  const month = parseInt(String(req.params.month), 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    res.status(400).json({ error: '年月が不正です' });
    return;
  }
  try {
    const { buildPayrollMonthlySummaryPdf } = await import('../services/payrollPdf.js');
    const pdf = await buildPayrollMonthlySummaryPdf(req.staff!.companyId, year, month);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payroll-summary-${year}-${String(month).padStart(2, '0')}.pdf"`
    );
    res.send(pdf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'PDFの生成に失敗しました' });
  }
});

payrollRouter.get('/entries/summary/:year/:month/csv', async (req: AuthedRequest, res) => {
  const year = parseInt(String(req.params.year), 10);
  const month = parseInt(String(req.params.month), 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    res.status(400).json({ error: '年月が不正です' });
    return;
  }
  try {
    const { buildPayrollMonthlySummaryCsv } = await import('../services/reportCsv.js');
    const buf = await buildPayrollMonthlySummaryCsv(req.staff!.companyId, year, month);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payroll-summary-${year}-${String(month).padStart(2, '0')}.csv"`
    );
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'CSVの生成に失敗しました' });
  }
});

/** 月次給与一覧（対象年月） */
payrollRouter.get('/entries', async (req: AuthedRequest, res) => {
  const year = parseInt(String(req.query.year), 10);
  const month = parseInt(String(req.query.month), 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    res.status(400).json({ error: 'year・month が不正です' });
    return;
  }
  const r = await query(
    `SELECT e.*,
            u.name AS user_name,
            to_char(e.period_month, 'YYYY-MM-DD') AS period_month_iso
     FROM users u
     JOIN payroll_monthly_entries e ON e.user_id = u.id AND e.company_id = u.company_id
     WHERE e.company_id = $1 AND e.period_month = $2::date AND u.company_id = $1
     ORDER BY u.name`,
    [req.staff!.companyId, ymFirstDay(year, month)]
  );
  res.json(r.rows);
});

/** 個人別 給与明細 PDF */
payrollRouter.get('/entries/:id/pdf', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  try {
    const { buildPayrollPayslipPdf } = await import('../services/payrollPdf.js');
    const pdf = await buildPayrollPayslipPdf(req.staff!.companyId, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payslip-${id.slice(0, 8)}.pdf"`
    );
    res.send(pdf);
  } catch (e: unknown) {
    if ((e as Error).message === 'NOT_FOUND') {
      res.status(404).json({ error: '給与データが見つかりません' });
      return;
    }
    console.error(e);
    res.status(500).json({ error: 'PDFの生成に失敗しました' });
  }
});

/** 1件取得（編集画面用） */
payrollRouter.get('/entries/:id', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const row = await selectEntryWithUser(req.staff!.companyId, id);
  if (!row) {
    res.status(404).json({ error: '給与データが見つかりません' });
    return;
  }
  res.json(row);
});

/** 月次給与の登録・更新（同一ユーザ・月は上書き） */
payrollRouter.post('/entries', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as {
    userId?: string;
    year?: unknown;
    month?: unknown;
    payrollCategory?: string;
    monthlyGross?: unknown;
    gradeBasisAmount?: unknown;
    ageYears?: unknown;
    withholdingTax?: unknown;
    residentTax?: unknown;
    notes?: string;
  };
  const userId = typeof b.userId === 'string' ? b.userId.trim() : '';
  const year = Number(b.year);
  const month = Number(b.month);
  if (!userId || !Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    res.status(400).json({ error: 'userId・year・month は必須です' });
    return;
  }

  let catOverride: PayrollCategory | undefined = undefined;
  if (b.payrollCategory === 'employee' || b.payrollCategory === 'officer') {
    catOverride = b.payrollCategory;
  }

  const monthlyGross = Number(b.monthlyGross);
  const gradeBasisAmount = Number(b.gradeBasisAmount);
  const ageYears = Number(b.ageYears);
  const withholdingTax = Number(b.withholdingTax ?? 0);
  const residentTax = Number(b.residentTax ?? 0);

  const upsert = await upsertPayrollMonthlyRow({
    companyId: req.staff!.companyId,
    userId,
    year,
    month,
    payrollCategoryOverride: catOverride,
    monthlyGross,
    gradeBasisAmount,
    ageYears,
    withholdingTax,
    residentTax,
    notes: typeof b.notes === 'string' ? b.notes : null,
  });
  if (!upsert.ok) {
    res.status(upsert.status).json({ error: upsert.error });
    return;
  }

  const row = await selectEntryWithUser(req.staff!.companyId, upsert.id);
  res.status(201).json(row);
});

/** ユーザーマスタの月額・年齢で、対象月の全員分を一括登録（既存は上書き）。月額0はスキップ */
payrollRouter.post('/entries/bulk-from-master', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as { year?: unknown; month?: unknown };
  const year = Number(b.year);
  const month = Number(b.month);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    res.status(400).json({ error: 'year・month は必須です' });
    return;
  }

  const users = await query<{
    id: string;
    name: string;
    payroll_category: string;
    age_years: string | null;
    base_monthly_gross: string;
  }>(
    `SELECT id, name, payroll_category::text AS payroll_category,
            age_years::text, base_monthly_gross::text
     FROM users
     WHERE company_id = $1 AND active = TRUE
       AND payroll_category IN ('employee', 'officer')
     ORDER BY name`,
    [req.staff!.companyId]
  );

  let created = 0;
  let skipped = 0;
  const errors: { name: string; error: string }[] = [];

  const DEFAULT_AGE = 35;

  for (const u of users.rows) {
    const gross = Number(u.base_monthly_gross) || 0;
    if (gross <= 0) {
      skipped++;
      continue;
    }
    const ageY =
      u.age_years != null && u.age_years !== '' ? Number(u.age_years) : DEFAULT_AGE;
    if (!Number.isFinite(ageY) || ageY < 15 || ageY > 100) {
      errors.push({ name: u.name, error: `年齢が不正です（${u.age_years ?? '未設定'}）` });
      skipped++;
      continue;
    }

    const up = await upsertPayrollMonthlyRow({
      companyId: req.staff!.companyId,
      userId: u.id,
      year,
      month,
      monthlyGross: gross,
      gradeBasisAmount: gross,
      ageYears: ageY,
      withholdingTax: 0,
      residentTax: 0,
      notes: null,
    });
    if (!up.ok) {
      errors.push({ name: u.name, error: up.error });
      continue;
    }
    created++;
  }

  res.json({
    year,
    month,
    created,
    skipped,
    errors,
  });
});

payrollRouter.patch('/entries/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const cur = await query(
    `SELECT * FROM payroll_monthly_entries WHERE id = $1 AND company_id = $2`,
    [id, req.staff!.companyId]
  );
  const row = cur.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: '給与データが見つかりません' });
    return;
  }

  const b = req.body as {
    payrollCategory?: string;
    monthlyGross?: unknown;
    gradeBasisAmount?: unknown;
    ageYears?: unknown;
    withholdingTax?: unknown;
    residentTax?: unknown;
    notes?: string | null;
  };

  const prevCat = String(row.payroll_category);
  let cat: PayrollCategory =
    typeof b.payrollCategory === 'string' && isPayrollCategory(b.payrollCategory)
      ? b.payrollCategory
      : (prevCat as PayrollCategory);

  const monthlyGross =
    b.monthlyGross !== undefined ? Number(b.monthlyGross) : Number(row.monthly_gross);
  const gradeBasisAmount =
    b.gradeBasisAmount !== undefined ? Number(b.gradeBasisAmount) : Number(row.grade_basis_amount);
  const ageYears = b.ageYears !== undefined ? Number(b.ageYears) : Number(row.age_years);
  const withholdingTax =
    b.withholdingTax !== undefined ? Number(b.withholdingTax) : Number(row.withholding_tax);
  const residentTax = b.residentTax !== undefined ? Number(b.residentTax) : Number(row.resident_tax);
  const notes =
    b.notes !== undefined ? (typeof b.notes === 'string' ? b.notes.trim() : '') : String(row.notes ?? '');

  if (!isPayrollCategory(cat)) cat = 'employee';
  if (cat === 'other') {
    res.status(400).json({ error: '給与区分をその他にはできません' });
    return;
  }
  if (!Number.isFinite(monthlyGross) || monthlyGross < 0) {
    res.status(400).json({ error: 'monthlyGross が不正です' });
    return;
  }
  if (!Number.isFinite(gradeBasisAmount) || gradeBasisAmount < 0) {
    res.status(400).json({ error: 'gradeBasisAmount が不正です' });
    return;
  }
  if (!Number.isFinite(ageYears) || ageYears < 15 || ageYears > 100) {
    res.status(400).json({ error: 'ageYears（15〜100）が必要です' });
    return;
  }

  const snap = computePayrollEntrySnapshot(
    cat,
    monthlyGross,
    gradeBasisAmount,
    Math.floor(ageYears),
    withholdingTax,
    residentTax
  );
  if (!snap.ok) {
    res.status(400).json({ error: snap.error });
    return;
  }

  await query(
    `UPDATE payroll_monthly_entries SET
       payroll_category = $1::user_payroll_category,
       monthly_gross = $2,
       grade_basis_amount = $3,
       age_years = $4,
       withholding_tax = $5,
       resident_tax = $6,
       standard_monthly_remuneration = $7,
       grade = $8,
       health_insurance = $9,
       pension_insurance = $10,
       care_insurance = $11,
       employment_insurance = $12,
       employment_insurance_applicable = $13,
       social_insurance_total = $14,
       total_deductions = $15,
       net_pay = $16,
       rate_snapshot_label = $17,
       notes = $18,
       updated_at = NOW()
     WHERE id = $19 AND company_id = $20`,
    [
      cat,
      monthlyGross,
      gradeBasisAmount,
      Math.floor(ageYears),
      snap.withholdingTax,
      snap.residentTax,
      snap.standardMonthlyRemuneration,
      snap.grade,
      snap.healthInsurance,
      snap.pensionInsurance,
      snap.careInsurance,
      snap.employmentInsurance,
      snap.employmentInsuranceApplicable,
      snap.socialInsuranceTotal,
      snap.totalDeductions,
      snap.netPay,
      snap.rateSnapshotLabel,
      notes || null,
      id,
      req.staff!.companyId,
    ]
  );

  const out = await selectEntryWithUser(req.staff!.companyId, id);
  res.json(out);
});

payrollRouter.delete('/entries/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const r = await query(
    `DELETE FROM payroll_monthly_entries WHERE id = $1 AND company_id = $2 RETURNING id`,
    [id, req.staff!.companyId]
  );
  if (!r.rows[0]) {
    res.status(404).json({ error: '給与データが見つかりません' });
    return;
  }
  res.json({ ok: true });
});
