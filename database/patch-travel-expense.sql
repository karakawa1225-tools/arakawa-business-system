-- 出張旅費規程の追記・出張旅費精算
CREATE TABLE IF NOT EXISTS company_travel_regulation (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  supplement_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travel_expense_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  applicant_name VARCHAR(255) NOT NULL,
  department VARCHAR(255),
  destination TEXT NOT NULL,
  purpose TEXT NOT NULL,
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travel_expense_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES travel_expense_claims(id) ON DELETE CASCADE,
  category VARCHAR(64) NOT NULL,
  description TEXT,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_travel_claims_company ON travel_expense_claims(company_id);
CREATE INDEX IF NOT EXISTS idx_travel_lines_claim ON travel_expense_lines(claim_id);
