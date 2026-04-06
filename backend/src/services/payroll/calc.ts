import { PAYROLL_RATES_REIWA7 } from './rates2025.js';
import { standardRemunerationForEarnings } from './standardRemuneration.js';

export type PayrollCategory = 'employee' | 'officer' | 'other';

export type PayrollCalcInput = {
  payrollCategory: PayrollCategory;
  /** 雇用保険の計算基礎となる賃金額（円・概算） */
  monthlyWagesForEmploymentInsuranceYen: number;
  /** 標準報酬月額の等級決定用の報酬月額（円・概算。通勤手当の非課税部分等の扱いは入力時に調整） */
  monthlyEarningsForGradeYen: number;
  /** 年齢（介護保険の要否に使用） */
  age: number;
};

function halfFloor(baseYen: number, totalRate: number): number {
  const raw = (baseYen * totalRate) / 2;
  return Math.floor(raw);
}

export function calcPayrollDeductionsReiwa7(input: PayrollCalcInput) {
  const r = PAYROLL_RATES_REIWA7;
  if (input.payrollCategory === 'other') {
    return {
      ok: false as const,
      error: '給与区分が「その他」のため計算対象外です',
    };
  }

  const wages = Math.max(0, Math.floor(input.monthlyWagesForEmploymentInsuranceYen));
  const gradeBasis = Math.max(0, Math.floor(input.monthlyEarningsForGradeYen));
  const { grade, standardMonthlyRemuneration } = standardRemunerationForEarnings(gradeBasis);

  const base = standardMonthlyRemuneration;
  const healthEmployee = halfFloor(base, r.healthInsuranceTotalRate);
  const pensionEmployee = halfFloor(base, r.pensionInsuranceTotalRate);
  const careApplicable = input.age >= 40 && input.age < 65;
  const careEmployee = careApplicable ? halfFloor(base, r.careInsuranceTotalRate) : 0;

  const employmentInsuranceApplicable = input.payrollCategory === 'employee';
  const employmentInsuranceEmployee = employmentInsuranceApplicable
    ? Math.floor(wages * r.employmentInsuranceEmployeeRateGeneral)
    : 0;

  const totalSocialEmployee = healthEmployee + pensionEmployee + careEmployee + employmentInsuranceEmployee;

  return {
    ok: true as const,
    fiscalYearLabel: r.fiscalYearLabel,
    grade,
    standardMonthlyRemuneration,
    deductions: {
      healthInsuranceEmployee: healthEmployee,
      pensionInsuranceEmployee: pensionEmployee,
      careInsuranceEmployee: careEmployee,
      employmentInsuranceEmployee,
      total: totalSocialEmployee,
    },
    employmentInsuranceApplicable,
  };
}

/** DB 保存用：社保・雇用・源泉・住民税をまとめた控除・手取りスナップショット */
export type PayrollEntrySnapshot =
  | { ok: false; error: string }
  | {
      ok: true;
      payrollCategory: PayrollCategory;
      standardMonthlyRemuneration: number;
      grade: number;
      healthInsurance: number;
      pensionInsurance: number;
      careInsurance: number;
      employmentInsurance: number;
      employmentInsuranceApplicable: boolean;
      socialInsuranceTotal: number;
      withholdingTax: number;
      residentTax: number;
      totalDeductions: number;
      netPay: number;
      rateSnapshotLabel: string;
    };

export function computePayrollEntrySnapshot(
  payrollCategory: PayrollCategory,
  monthlyGross: number,
  gradeBasisAmount: number,
  ageYears: number,
  withholdingTax: number,
  residentTax: number
): PayrollEntrySnapshot {
  const calc = calcPayrollDeductionsReiwa7({
    payrollCategory,
    monthlyWagesForEmploymentInsuranceYen: monthlyGross,
    monthlyEarningsForGradeYen: gradeBasisAmount,
    age: ageYears,
  });
  if (!calc.ok) {
    return { ok: false, error: calc.error };
  }
  const gross = Math.max(0, Math.floor(Number(monthlyGross) || 0));
  const w = Math.max(0, Math.floor(Number(withholdingTax) || 0));
  const rt = Math.max(0, Math.floor(Number(residentTax) || 0));
  const social = calc.deductions.total;
  const totalDed = social + w + rt;
  const netPay = gross - totalDed;
  return {
    ok: true,
    payrollCategory,
    standardMonthlyRemuneration: calc.standardMonthlyRemuneration,
    grade: calc.grade,
    healthInsurance: calc.deductions.healthInsuranceEmployee,
    pensionInsurance: calc.deductions.pensionInsuranceEmployee,
    careInsurance: calc.deductions.careInsuranceEmployee,
    employmentInsurance: calc.deductions.employmentInsuranceEmployee,
    employmentInsuranceApplicable: calc.employmentInsuranceApplicable,
    socialInsuranceTotal: social,
    withholdingTax: w,
    residentTax: rt,
    totalDeductions: totalDed,
    netPay,
    rateSnapshotLabel: PAYROLL_RATES_REIWA7.fiscalYearLabel,
  };
}
