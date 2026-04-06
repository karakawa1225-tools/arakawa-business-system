-- 税区分マスタ + 経費に税区分/インボイス番号/支払先を保存するためのDBパッチ
-- 冪等（何度実行しても壊れない）を意識しています。

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tax_divisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  label VARCHAR(100) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  requires_invoice_no BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, code)
);

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS tax_division_id UUID REFERENCES tax_divisions(id) ON DELETE SET NULL;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS supplier_invoice_no VARCHAR(100);

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS payment_destination TEXT;

CREATE INDEX IF NOT EXISTS idx_expenses_tax_division_id ON expenses(company_id, tax_division_id);

-- 初期の税区分（10%/8%/非課税/課税対象外）を各会社に作成（既存があればスキップ）
WITH defaults(code, label, tax_rate, requires_invoice_no) AS (
  VALUES
    ('T10', '消費税10%', 10, TRUE),
    ('T8', '消費税8%', 8, TRUE),
    ('EXEMPT', '非課税', 0, FALSE),
    ('OUT', '課税対象外', 0, FALSE)
)
INSERT INTO tax_divisions (company_id, code, label, tax_rate, requires_invoice_no)
SELECT
  c.id,
  d.code,
  d.label,
  d.tax_rate,
  d.requires_invoice_no
FROM companies c
JOIN defaults d ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM tax_divisions td
  WHERE td.company_id = c.id AND td.code = d.code
);

-- 既存の expenses.tax_rate から税区分を推測して補完
UPDATE expenses e
SET tax_division_id = td.id
FROM tax_divisions td
WHERE e.tax_division_id IS NULL
  AND td.company_id = e.company_id
  AND (
    (e.tax_rate = 10 AND td.code = 'T10') OR
    (e.tax_rate = 8 AND td.code = 'T8') OR
    (e.tax_rate = 0 AND td.code IN ('EXEMPT','OUT'))
  );

