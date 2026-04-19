-- 顧客・仕入先・勘定科目・商品にバーコード用コード（任意）
ALTER TABLE customers ADD COLUMN IF NOT EXISTS barcode_code VARCHAR(120);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS barcode_code VARCHAR(120);
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS barcode_code VARCHAR(120);
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode_code VARCHAR(120);
