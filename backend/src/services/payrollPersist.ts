import { query } from '../db/pool.js';
import { computePayrollEntrySnapshot, type PayrollCategory } from './payroll/calc.js';

export function ymFirstDay(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export type UpsertPayrollInput = {
  companyId: string;
  userId: string;
  year: number;
  month: number;
  /** 未指定なら users.payroll_category を使用 */
  payrollCategoryOverride?: PayrollCategory;
  monthlyGross: number;
  gradeBasisAmount: number;
  ageYears: number;
  withholdingTax: number;
  residentTax: number;
  notes: string | null;
};

export async function upsertPayrollMonthlyRow(
  input: UpsertPayrollInput
): Promise<{ ok: true; id: string } | { ok: false; status: number; error: string }> {
  const u = await query<{ payroll_category: string }>(
    `SELECT payroll_category::text AS payroll_category FROM users
     WHERE id = $1 AND company_id = $2 AND active = TRUE`,
    [input.userId, input.companyId]
  );
  if (!u.rows[0]) {
    return { ok: false, status: 400, error: 'ユーザーが見つかりません' };
  }

  let cat: PayrollCategory =
    input.payrollCategoryOverride === 'employee' || input.payrollCategoryOverride === 'officer'
      ? input.payrollCategoryOverride
      : (u.rows[0].payroll_category as PayrollCategory);
  if (cat !== 'employee' && cat !== 'officer') {
    cat = 'other';
  }
  if (cat === 'other') {
    return { ok: false, status: 400, error: '給与区分が「その他」のユーザーは登録できません' };
  }

  const { monthlyGross, gradeBasisAmount, ageYears, withholdingTax, residentTax } = input;

  if (!Number.isFinite(monthlyGross) || monthlyGross < 0) {
    return { ok: false, status: 400, error: 'monthlyGross が不正です' };
  }
  if (!Number.isFinite(gradeBasisAmount) || gradeBasisAmount < 0) {
    return { ok: false, status: 400, error: 'gradeBasisAmount が不正です' };
  }
  if (!Number.isFinite(ageYears) || ageYears < 15 || ageYears > 100) {
    return { ok: false, status: 400, error: 'ageYears（15〜100）が必要です' };
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
    return { ok: false, status: 400, error: snap.error };
  }

  const notes = (input.notes ?? '').trim();
  const period = ymFirstDay(input.year, input.month);

  const ins = await query<{ id: string }>(
    `INSERT INTO payroll_monthly_entries (
       company_id, user_id, period_month, payroll_category,
       monthly_gross, grade_basis_amount, age_years,
       withholding_tax, resident_tax,
       standard_monthly_remuneration, grade,
       health_insurance, pension_insurance, care_insurance, employment_insurance,
       employment_insurance_applicable,
       social_insurance_total, total_deductions, net_pay,
       rate_snapshot_label, notes
     ) VALUES (
       $1, $2, $3::date, $4::user_payroll_category,
       $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
     )
     ON CONFLICT (company_id, user_id, period_month) DO UPDATE SET
       payroll_category = EXCLUDED.payroll_category,
       monthly_gross = EXCLUDED.monthly_gross,
       grade_basis_amount = EXCLUDED.grade_basis_amount,
       age_years = EXCLUDED.age_years,
       withholding_tax = EXCLUDED.withholding_tax,
       resident_tax = EXCLUDED.resident_tax,
       standard_monthly_remuneration = EXCLUDED.standard_monthly_remuneration,
       grade = EXCLUDED.grade,
       health_insurance = EXCLUDED.health_insurance,
       pension_insurance = EXCLUDED.pension_insurance,
       care_insurance = EXCLUDED.care_insurance,
       employment_insurance = EXCLUDED.employment_insurance,
       employment_insurance_applicable = EXCLUDED.employment_insurance_applicable,
       social_insurance_total = EXCLUDED.social_insurance_total,
       total_deductions = EXCLUDED.total_deductions,
       net_pay = EXCLUDED.net_pay,
       rate_snapshot_label = EXCLUDED.rate_snapshot_label,
       notes = EXCLUDED.notes,
       updated_at = NOW()
     RETURNING id`,
    [
      input.companyId,
      input.userId,
      period,
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
    ]
  );

  return { ok: true, id: ins.rows[0]!.id };
}
