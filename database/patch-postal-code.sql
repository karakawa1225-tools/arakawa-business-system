-- 顧客・仕入先に郵便番号列を追加（冪等）
ALTER TABLE customers ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
