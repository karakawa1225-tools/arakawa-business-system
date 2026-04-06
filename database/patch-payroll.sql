-- 給与区分（ログイン権限 user_role とは別）
-- usage: node database/patch-payroll.js
DO $$ BEGIN
  CREATE TYPE user_payroll_category AS ENUM ('employee', 'officer', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS payroll_category user_payroll_category NOT NULL DEFAULT 'other';
