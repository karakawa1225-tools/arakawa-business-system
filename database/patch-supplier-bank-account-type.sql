-- 仕入先: 口座種別（普通・当座など）。CSVは bank_branch と bank_account_number の間。
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_account_type VARCHAR(50);
