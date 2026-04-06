-- 勘定科目区分マスタ + chart_of_accounts.division_id（冪等に近い適用用）
-- node database/patch-chart-account-divisions.js

CREATE TABLE IF NOT EXISTS chart_account_divisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  division_code VARCHAR(20) NOT NULL,
  division_name VARCHAR(255) NOT NULL,
  account_type account_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, division_code)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chart_of_accounts' AND column_name = 'division_id'
  ) THEN
    ALTER TABLE chart_of_accounts
      ADD COLUMN division_id UUID REFERENCES chart_account_divisions(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- 会社ごとに財務5区分の既定行（まだ無い場合のみ）
INSERT INTO chart_account_divisions (company_id, division_code, division_name, account_type)
SELECT c.id, v.code, v.label, v.typ::account_type
FROM companies c
CROSS JOIN (
  VALUES
    ('B01', '資産', 'asset'),
    ('B02', '負債', 'liability'),
    ('B03', '純資産', 'equity'),
    ('B04', '収益', 'revenue'),
    ('B05', '費用', 'expense')
) AS v(code, label, typ)
WHERE NOT EXISTS (
  SELECT 1 FROM chart_account_divisions d
  WHERE d.company_id = c.id AND d.division_code = v.code
);

-- 既存勘定科目に division_id を紐づけ（account_type に一致する区分）
UPDATE chart_of_accounts co
SET division_id = d.id
FROM chart_account_divisions d
WHERE co.division_id IS NULL
  AND co.company_id = d.company_id
  AND co.account_type = d.account_type;

-- まだ NULL の行があれば費用区分へ
UPDATE chart_of_accounts co
SET division_id = d.id
FROM chart_account_divisions d
WHERE co.division_id IS NULL
  AND co.company_id = d.company_id
  AND d.division_code = 'B05';

-- 会社に区分が無い等で残った NULL はその会社の任意の区分へ
UPDATE chart_of_accounts co
SET division_id = (
  SELECT d.id FROM chart_account_divisions d WHERE d.company_id = co.company_id ORDER BY d.division_code LIMIT 1
)
WHERE co.division_id IS NULL;

ALTER TABLE chart_of_accounts
  ALTER COLUMN division_id SET NOT NULL;
