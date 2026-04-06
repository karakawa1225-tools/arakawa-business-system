-- 月次給与登録（個人別・集計・PDF用スナップショット）
-- usage: node database/patch-payroll-monthly-entries.js

CREATE TABLE IF NOT EXISTS payroll_monthly_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  payroll_category user_payroll_category NOT NULL,
  monthly_gross NUMERIC(18, 2) NOT NULL,
  grade_basis_amount NUMERIC(18, 2) NOT NULL,
  age_years SMALLINT NOT NULL,
  withholding_tax NUMERIC(18, 2) NOT NULL DEFAULT 0,
  resident_tax NUMERIC(18, 2) NOT NULL DEFAULT 0,
  standard_monthly_remuneration NUMERIC(18, 2) NOT NULL,
  grade SMALLINT NOT NULL,
  health_insurance NUMERIC(18, 2) NOT NULL,
  pension_insurance NUMERIC(18, 2) NOT NULL,
  care_insurance NUMERIC(18, 2) NOT NULL,
  employment_insurance NUMERIC(18, 2) NOT NULL,
  employment_insurance_applicable BOOLEAN NOT NULL DEFAULT FALSE,
  social_insurance_total NUMERIC(18, 2) NOT NULL,
  total_deductions NUMERIC(18, 2) NOT NULL,
  net_pay NUMERIC(18, 2) NOT NULL,
  rate_snapshot_label VARCHAR(120),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, user_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_monthly_entries_company_period
  ON payroll_monthly_entries(company_id, period_month);
