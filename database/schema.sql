-- ARAKAWA Business System - PostgreSQL schema
-- 商社型販売（在庫なし）向け

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 会社・セットアップ
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  postal_code VARCHAR(20),
  address TEXT,
  phone VARCHAR(50),
  invoice_registration VARCHAR(50),
  default_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  setup_completed BOOLEAN NOT NULL DEFAULT FALSE,
  setup_step SMALLINT NOT NULL DEFAULT 0,
  operations_policy TEXT,
  accounting_policy TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 部署
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 社内ユーザー
CREATE TYPE user_role AS ENUM ('admin', 'sales', 'accounting', 'viewer');

-- 給与計算対象区分（システム権限 user_role とは別。employee/officer のみ給与計算 UI に出す）
CREATE TYPE user_payroll_category AS ENUM ('employee', 'officer', 'other');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'sales',
  payroll_category user_payroll_category NOT NULL DEFAULT 'other',
  age_years SMALLINT,
  base_monthly_gross NUMERIC(18, 2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, email)
);

-- 月次給与登録（令和7年度料率スナップショットを保持）
CREATE TABLE payroll_monthly_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  payroll_category user_payroll_category NOT NULL,
  monthly_gross NUMERIC(18, 2) NOT NULL,
  grade_basis_amount NUMERIC(18, 2) NOT NULL,
  age_years SMALLINT NOT NULL,
  withholding_tax NUMERIC(18, 2) NOT NULL DEFAULT 0,
  resident_tax NUMERIC(18, 2) NOT NULL DEFAULT 0,
  standard_monthly_remuneration NUMERIC(18, 2) NOT NULL,
  grade SMALLINT NOT NULL,
  health_insurance NUMERIC(18, 2) NOT NULL,
  pension_insurance NUMERIC(18, 2) NOT NULL,
  care_insurance NUMERIC(18, 2) NOT NULL,
  employment_insurance NUMERIC(18, 2) NOT NULL,
  employment_insurance_applicable BOOLEAN NOT NULL DEFAULT FALSE,
  social_insurance_total NUMERIC(18, 2) NOT NULL,
  total_deductions NUMERIC(18, 2) NOT NULL,
  net_pay NUMERIC(18, 2) NOT NULL,
  rate_snapshot_label VARCHAR(120),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, user_id, period_month)
);

CREATE INDEX idx_payroll_monthly_entries_company_period ON payroll_monthly_entries(company_id, period_month);

-- 勘定科目
CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

-- 勘定科目区分（区分コード・区分名。account_type は既存ロジック／PDF用に保持）
CREATE TABLE chart_account_divisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  division_code VARCHAR(20) NOT NULL,
  division_name VARCHAR(255) NOT NULL,
  account_type account_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, division_code)
);

CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES chart_account_divisions(id) ON DELETE RESTRICT,
  code VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  account_type account_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 銀行口座マスタ
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  bank_name VARCHAR(255),
  branch_name VARCHAR(255),
  account_type_label VARCHAR(50),
  account_number VARCHAR(50),
  holder_name VARCHAR(255),
  opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 経費カテゴリ
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  chart_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 税区分マスタ（消費税 10%/8%/非課税/課税対象外）
CREATE TABLE tax_divisions (
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

-- 顧客
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_code VARCHAR(50) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  closing_day SMALLINT,
  payment_terms VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, customer_code)
);

-- 顧客ポータルユーザー
CREATE TABLE customer_portal_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, email)
);

-- 仕入先
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  payment_terms TEXT,
  bank_name VARCHAR(255),
  bank_branch VARCHAR(255),
  bank_account_number VARCHAR(50),
  bank_account_holder VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, supplier_code)
);

-- 商品（在庫なし）
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(255),
  manufacturer VARCHAR(255),
  manufacturer_part_no VARCHAR(255),
  trusco_order_code VARCHAR(255),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_price NUMERIC(18,2),
  sale_price NUMERIC(18,2),
  photo_url TEXT,
  spec_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, product_code)
);

-- 見積
CREATE TYPE estimate_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');

CREATE TABLE estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  estimate_no VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  status estimate_status NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 10,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, estimate_no)
);

CREATE TABLE estimate_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  line_no INT NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(18,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 10
);

-- 受注
CREATE TYPE order_status AS ENUM ('open', 'confirmed', 'delivered', 'cancelled');

CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  order_no VARCHAR(50) NOT NULL,
  status order_status NOT NULL DEFAULT 'open',
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, order_no)
);

CREATE TABLE sales_order_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  line_no INT NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(18,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0
);

-- 請求
CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'paid', 'partial', 'cancelled');

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
  invoice_no VARCHAR(50) NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total NUMERIC(18,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, invoice_no)
);

CREATE TABLE invoice_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_no INT NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(18,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 10
);

-- 入金
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  payment_no VARCHAR(50) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(18,2) NOT NULL,
  method VARCHAR(50),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, payment_no)
);

-- 銀行入出金
CREATE TYPE bank_tx_type AS ENUM ('deposit', 'withdrawal');

CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  tx_date DATE NOT NULL,
  tx_type bank_tx_type NOT NULL,
  description TEXT,
  amount NUMERIC(18,2) NOT NULL,
  balance_after NUMERIC(18,2),
  reference VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 経費
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  chart_account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  amount NUMERIC(18,2) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 10,
  tax_division_id UUID REFERENCES tax_divisions(id) ON DELETE SET NULL,
  supplier_invoice_no VARCHAR(100),
  payment_destination TEXT,
  description TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  receipt_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_tax_division_id ON expenses(company_id, tax_division_id);

CREATE INDEX idx_customers_company ON customers(company_id);
CREATE INDEX idx_products_company ON products(company_id);
CREATE INDEX idx_estimates_company ON estimates(company_id);
CREATE INDEX idx_sales_orders_company ON sales_orders(company_id);
CREATE INDEX idx_invoices_company ON invoices(company_id);
CREATE INDEX idx_payments_company ON payments(company_id);
CREATE INDEX idx_expenses_company_date ON expenses(company_id, expense_date);

-- 出張旅費規程の追記・出張旅費精算
CREATE TABLE company_travel_regulation (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  supplement_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE travel_expense_claims (
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

CREATE TABLE travel_expense_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES travel_expense_claims(id) ON DELETE CASCADE,
  category VARCHAR(64) NOT NULL,
  description TEXT,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_travel_claims_company ON travel_expense_claims(company_id);
CREATE INDEX idx_travel_lines_claim ON travel_expense_lines(claim_id);
