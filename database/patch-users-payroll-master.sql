-- ユーザー：年齢・月額支給マスタ（給与の初期値）
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_years SMALLINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS base_monthly_gross NUMERIC(18, 2) NOT NULL DEFAULT 0;
