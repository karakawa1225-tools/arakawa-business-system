-- 古い DB に companies はあるが setup_* 列がない場合に実行（冪等）
ALTER TABLE companies ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS setup_step SMALLINT NOT NULL DEFAULT 0;
