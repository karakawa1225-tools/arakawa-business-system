-- 会社ごとの「業務運用」「会計処理」の運用メモ（管理者が編集）
ALTER TABLE companies ADD COLUMN IF NOT EXISTS operations_policy TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS accounting_policy TEXT;
