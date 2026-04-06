-- 売掛金管理 / 買掛金管理（見積・請求とは別入力）のためのテーブル
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ar_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  period_month DATE NOT NULL, -- 月次（YYYY-MM-01）
  closing_day SMALLINT,
  sales_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  pdf_data_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ar_ledger_company_month ON ar_ledger(company_id, period_month);
CREATE INDEX IF NOT EXISTS idx_ar_ledger_company_customer ON ar_ledger(company_id, customer_id);

CREATE TABLE IF NOT EXISTS ap_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  period_month DATE NOT NULL, -- 月次（YYYY-MM-01）
  closing_day SMALLINT,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  pdf_data_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ap_ledger_company_month ON ap_ledger(company_id, period_month);
CREATE INDEX IF NOT EXISTS idx_ap_ledger_company_supplier ON ap_ledger(company_id, supplier_id);

