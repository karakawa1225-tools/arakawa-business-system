import { Router, type Response } from 'express';
import { query } from '../db/pool.js';
import { hashPassword } from '../utils/password.js';
import { requireStaff, blockViewerWrite, type AuthedRequest } from '../middleware/auth.js';

export const mastersRouter = Router();
mastersRouter.use(requireStaff);

function isFkViolation(e: unknown): boolean {
  return (e as { code?: string })?.code === '23503';
}

mastersRouter.get('/departments', async (req: AuthedRequest, res) => {
  const r = await query(`SELECT * FROM departments WHERE company_id = $1 ORDER BY name`, [
    req.staff!.companyId,
  ]);
  res.json(r.rows);
});

mastersRouter.post('/departments', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as { code?: string; name: string };
  const r = await query(
    `INSERT INTO departments (company_id, code, name) VALUES ($1,$2,$3) RETURNING *`,
    [req.staff!.companyId, b.code ?? null, b.name]
  );
  res.status(201).json(r.rows[0]);
});

mastersRouter.patch('/departments/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const b = req.body as { code?: string | null; name?: string };
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: '部署名は必須です' });
    return;
  }
  const code = typeof b.code === 'string' ? b.code.trim() : null;
  const r = await query(
    `UPDATE departments SET code = $1, name = $2, updated_at = NOW()
     WHERE id = $3 AND company_id = $4
     RETURNING *`,
    [code || null, name, id, req.staff!.companyId]
  );
  if (!r.rows[0]) {
    res.status(404).json({ error: '部署が見つかりません' });
    return;
  }
  res.json(r.rows[0]);
});

async function removeDepartment(req: AuthedRequest, res: Response) {
  try {
    await query(`DELETE FROM departments WHERE id = $1 AND company_id = $2`, [
      req.params.id,
      req.staff!.companyId,
    ]);
    res.json({ ok: true });
  } catch (e) {
    if (isFkViolation(e)) {
      res.status(400).json({ error: '他のデータで使用中のため削除できません' });
      return;
    }
    throw e;
  }
}

mastersRouter.delete('/departments/:id', blockViewerWrite, removeDepartment);
mastersRouter.post('/departments/:id/delete', blockViewerWrite, removeDepartment);

/** 勘定科目区分マスタ（区分コード・区分名。account_type は帳票・既存クエリ用） */
mastersRouter.get('/account-divisions', async (req: AuthedRequest, res) => {
  const r = await query(
    `SELECT * FROM chart_account_divisions WHERE company_id = $1 ORDER BY division_code`,
    [req.staff!.companyId]
  );
  res.json(r.rows);
});

mastersRouter.post('/account-divisions', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as { divisionCode: string; divisionName: string; accountType: string };
  const divisionCode = typeof b.divisionCode === 'string' ? b.divisionCode.trim() : '';
  if (!divisionCode) {
    res.status(400).json({ error: '区分コードは必須です' });
    return;
  }
  const divisionName = typeof b.divisionName === 'string' ? b.divisionName.trim() : '';
  if (!divisionName) {
    res.status(400).json({ error: '区分は必須です' });
    return;
  }
  const accountType = String(b.accountType || '').trim();
  if (!['asset', 'liability', 'equity', 'revenue', 'expense'].includes(accountType)) {
    res.status(400).json({ error: '財務区分（asset/liability/equity/revenue/expense）が不正です' });
    return;
  }
  try {
    const r = await query(
      `INSERT INTO chart_account_divisions (company_id, division_code, division_name, account_type)
       VALUES ($1,$2,$3,$4::account_type) RETURNING *`,
      [req.staff!.companyId, divisionCode, divisionName, accountType]
    );
    res.status(201).json(r.rows[0]);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === '23505') {
      res.status(400).json({ error: 'この区分コードは既に使われています' });
      return;
    }
    throw e;
  }
});

mastersRouter.patch('/account-divisions/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const b = req.body as { divisionCode?: string; divisionName?: string; accountType?: string };
  const divisionCode =
    b.divisionCode !== undefined ? String(b.divisionCode).trim() : undefined;
  const divisionName =
    b.divisionName !== undefined ? String(b.divisionName).trim() : undefined;
  const accountType =
    b.accountType !== undefined ? String(b.accountType).trim() : undefined;
  if (divisionCode !== undefined && !divisionCode) {
    res.status(400).json({ error: '区分コードは必須です' });
    return;
  }
  if (divisionName !== undefined && !divisionName) {
    res.status(400).json({ error: '区分は必須です' });
    return;
  }
  if (
    accountType !== undefined &&
    !['asset', 'liability', 'equity', 'revenue', 'expense'].includes(accountType)
  ) {
    res.status(400).json({ error: '財務区分が不正です' });
    return;
  }
  const cur = await query<{ account_type: string }>(
    `SELECT account_type FROM chart_account_divisions WHERE id = $1 AND company_id = $2`,
    [id, req.staff!.companyId]
  );
  if (!cur.rows[0]) {
    res.status(404).json({ error: '勘定科目区分が見つかりません' });
    return;
  }
  try {
    const r = await query(
      `UPDATE chart_account_divisions
       SET division_code = COALESCE($1, division_code),
           division_name = COALESCE($2, division_name),
           account_type = COALESCE($3::account_type, account_type),
           updated_at = NOW()
       WHERE id = $4 AND company_id = $5
       RETURNING *`,
      [
        divisionCode ?? null,
        divisionName ?? null,
        accountType ?? null,
        id,
        req.staff!.companyId,
      ]
    );
    const row = r.rows[0];
    if (accountType != null && accountType !== cur.rows[0].account_type) {
      await query(
        `UPDATE chart_of_accounts SET account_type = $1::account_type, updated_at = NOW()
         WHERE division_id = $2 AND company_id = $3`,
        [accountType, id, req.staff!.companyId]
      );
    }
    res.json(row);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === '23505') {
      res.status(400).json({ error: 'この区分コードは既に使われています' });
      return;
    }
    throw e;
  }
});

async function removeAccountDivision(req: AuthedRequest, res: Response) {
  try {
    await query(`DELETE FROM chart_account_divisions WHERE id = $1 AND company_id = $2`, [
      req.params.id,
      req.staff!.companyId,
    ]);
    res.json({ ok: true });
  } catch (e: unknown) {
    if (isFkViolation(e)) {
      res.status(400).json({ error: '勘定科目で使用されているため削除できません' });
      return;
    }
    throw e;
  }
}

mastersRouter.delete('/account-divisions/:id', blockViewerWrite, removeAccountDivision);
mastersRouter.post('/account-divisions/:id/delete', blockViewerWrite, removeAccountDivision);

mastersRouter.get('/accounts', async (req: AuthedRequest, res) => {
  const r = await query(
    `SELECT co.*,
            d.division_code,
            d.division_name
     FROM chart_of_accounts co
     JOIN chart_account_divisions d ON d.id = co.division_id
     WHERE co.company_id = $1
     ORDER BY d.division_code, co.code, co.name`,
    [req.staff!.companyId]
  );
  res.json(r.rows);
});

/** 弥生式「勘定科目一覧」（3桁コード表）に基づく区分・科目の一括投入。既存コードはスキップ。 */
mastersRouter.post('/accounts/import-yayoi-catalog', blockViewerWrite, async (req: AuthedRequest, res) => {
  try {
    const { importYayoiStyleChart } = await import('../services/yayoiStyleChartSeed.js');
    const result = await importYayoiStyleChart(req.staff!.companyId);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '勘定科目の取り込みに失敗しました' });
  }
});

mastersRouter.post('/accounts', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as { code?: string; name: string; divisionId: string };
  const code = typeof b.code === 'string' ? b.code.trim() : '';
  if (!/^\d{3}$/.test(code)) {
    res.status(400).json({ error: '勘定科目コードは半角数字3桁で入力してください（例: 101）' });
    return;
  }
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: '勘定科目名は必須です' });
    return;
  }
  const divisionId = typeof b.divisionId === 'string' ? b.divisionId.trim() : '';
  if (!divisionId) {
    res.status(400).json({ error: '勘定科目区分を選択してください' });
    return;
  }
  const div = await query<{ account_type: string }>(
    `SELECT account_type FROM chart_account_divisions WHERE id = $1 AND company_id = $2`,
    [divisionId, req.staff!.companyId]
  );
  if (!div.rows[0]) {
    res.status(404).json({ error: '勘定科目区分が見つかりません' });
    return;
  }
  const r = await query(
    `INSERT INTO chart_of_accounts (company_id, division_id, code, name, account_type)
     VALUES ($1,$2,$3,$4,$5::account_type) RETURNING *`,
    [req.staff!.companyId, divisionId, code, name, div.rows[0].account_type]
  );
  const row = r.rows[0];
  const full = await query(
    `SELECT co.*, d.division_code, d.division_name
     FROM chart_of_accounts co
     JOIN chart_account_divisions d ON d.id = co.division_id
     WHERE co.id = $1`,
    [row.id]
  );
  res.status(201).json(full.rows[0]);
});

mastersRouter.patch('/accounts/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const b = req.body as { code?: string | null; name?: string; divisionId?: string };
  const code = typeof b.code === 'string' ? b.code.trim() : '';
  if (!/^\d{3}$/.test(code)) {
    res.status(400).json({ error: '勘定科目コードは半角数字3桁で入力してください（例: 101）' });
    return;
  }
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: '勘定科目名は必須です' });
    return;
  }
  const divisionId = typeof b.divisionId === 'string' ? b.divisionId.trim() : '';
  if (!divisionId) {
    res.status(400).json({ error: '勘定科目区分を選択してください' });
    return;
  }
  const div = await query<{ account_type: string }>(
    `SELECT account_type FROM chart_account_divisions WHERE id = $1 AND company_id = $2`,
    [divisionId, req.staff!.companyId]
  );
  if (!div.rows[0]) {
    res.status(404).json({ error: '勘定科目区分が見つかりません' });
    return;
  }
  const r = await query(
    `UPDATE chart_of_accounts
     SET code = $1,
         name = $2,
         division_id = $3,
         account_type = $4::account_type,
         updated_at = NOW()
     WHERE id = $5 AND company_id = $6
     RETURNING *`,
    [code, name, divisionId, div.rows[0].account_type, id, req.staff!.companyId]
  );
  if (!r.rows[0]) {
    res.status(404).json({ error: '勘定科目が見つかりません' });
    return;
  }
  const full = await query(
    `SELECT co.*, d.division_code, d.division_name
     FROM chart_of_accounts co
     JOIN chart_account_divisions d ON d.id = co.division_id
     WHERE co.id = $1`,
    [id]
  );
  res.json(full.rows[0]);
});

async function removeAccount(req: AuthedRequest, res: Response) {
  try {
    await query(`DELETE FROM chart_of_accounts WHERE id = $1 AND company_id = $2`, [
      req.params.id,
      req.staff!.companyId,
    ]);
    res.json({ ok: true });
  } catch (e) {
    if (isFkViolation(e)) {
      res.status(400).json({ error: '他のデータで使用中のため削除できません' });
      return;
    }
    throw e;
  }
}

mastersRouter.delete('/accounts/:id', blockViewerWrite, removeAccount);
mastersRouter.post('/accounts/:id/delete', blockViewerWrite, removeAccount);

mastersRouter.get('/bank-accounts', async (req: AuthedRequest, res) => {
  const r = await query(`SELECT * FROM bank_accounts WHERE company_id = $1`, [req.staff!.companyId]);
  res.json(r.rows);
});

mastersRouter.post('/bank-accounts', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as Record<string, unknown>;
  const r = await query(
    `INSERT INTO bank_accounts (company_id, name, bank_name, branch_name, account_number, holder_name, opening_balance, current_balance)
     VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,0),COALESCE($7,0)) RETURNING *`,
    [
      req.staff!.companyId,
      b.name,
      b.bankName ?? null,
      b.branchName ?? null,
      b.accountNumber ?? null,
      b.holderName ?? null,
      b.openingBalance ?? 0,
    ]
  );
  res.status(201).json(r.rows[0]);
});

mastersRouter.patch('/bank-accounts/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const b = req.body as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: '表示名は必須です' });
    return;
  }
  const r = await query(
    `UPDATE bank_accounts
     SET name = $1,
         bank_name = $2,
         branch_name = $3,
         account_number = $4,
         holder_name = $5,
         updated_at = NOW()
     WHERE id = $6 AND company_id = $7
     RETURNING *`,
    [
      name,
      (b.bankName as string) ?? null,
      (b.branchName as string) ?? null,
      (b.accountNumber as string) ?? null,
      (b.holderName as string) ?? null,
      id,
      req.staff!.companyId,
    ]
  );
  if (!r.rows[0]) {
    res.status(404).json({ error: '銀行口座が見つかりません' });
    return;
  }
  res.json(r.rows[0]);
});

async function removeBankAccountMaster(req: AuthedRequest, res: Response) {
  try {
    await query(`DELETE FROM bank_accounts WHERE id = $1 AND company_id = $2`, [
      req.params.id,
      req.staff!.companyId,
    ]);
    res.json({ ok: true });
  } catch (e) {
    if (isFkViolation(e)) {
      res.status(400).json({ error: '他のデータで使用中のため削除できません' });
      return;
    }
    throw e;
  }
}

mastersRouter.delete('/bank-accounts/:id', blockViewerWrite, removeBankAccountMaster);
mastersRouter.post('/bank-accounts/:id/delete', blockViewerWrite, removeBankAccountMaster);

mastersRouter.get('/expense-categories', async (req: AuthedRequest, res) => {
  const r = await query(
    `SELECT ec.*, a.name AS account_name FROM expense_categories ec
     LEFT JOIN chart_of_accounts a ON a.id = ec.chart_account_id
     WHERE ec.company_id = $1`,
    [req.staff!.companyId]
  );
  res.json(r.rows);
});

mastersRouter.post('/expense-categories', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as { name: string; chartAccountId?: string | null };
  const r = await query(
    `INSERT INTO expense_categories (company_id, name, chart_account_id) VALUES ($1,$2,$3) RETURNING *`,
    [req.staff!.companyId, b.name, b.chartAccountId ?? null]
  );
  res.status(201).json(r.rows[0]);
});

mastersRouter.patch('/expense-categories/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const b = req.body as { name?: string; chartAccountId?: string | null };
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: 'カテゴリ名は必須です' });
    return;
  }
  const r = await query(
    `UPDATE expense_categories
     SET name = $1,
         chart_account_id = $2,
         updated_at = NOW()
     WHERE id = $3 AND company_id = $4
     RETURNING *`,
    [name, b.chartAccountId ?? null, id, req.staff!.companyId]
  );
  if (!r.rows[0]) {
    res.status(404).json({ error: '経費カテゴリが見つかりません' });
    return;
  }
  res.json(r.rows[0]);
});

async function removeExpenseCategory(req: AuthedRequest, res: Response) {
  try {
    await query(`DELETE FROM expense_categories WHERE id = $1 AND company_id = $2`, [
      req.params.id,
      req.staff!.companyId,
    ]);
    res.json({ ok: true });
  } catch (e) {
    if (isFkViolation(e)) {
      res.status(400).json({ error: '他のデータで使用中のため削除できません' });
      return;
    }
    throw e;
  }
}

mastersRouter.delete('/expense-categories/:id', blockViewerWrite, removeExpenseCategory);
mastersRouter.post('/expense-categories/:id/delete', blockViewerWrite, removeExpenseCategory);

mastersRouter.get('/tax-divisions', async (req: AuthedRequest, res) => {
  // まだ税区分マスタが無い場合でも、最低限の 4 区分を自動作成してUIを壊さない
  const r0 = await query(
    `SELECT * FROM tax_divisions WHERE company_id = $1 ORDER BY tax_rate, code`,
    [req.staff!.companyId]
  );
  if (r0.rows.length === 0) {
    await query(
      `INSERT INTO tax_divisions (company_id, code, label, tax_rate, requires_invoice_no)
       VALUES
         ($1,'T10','消費税10%',10,TRUE),
         ($1,'T8','消費税8%',8,TRUE),
         ($1,'EXEMPT','非課税',0,FALSE),
         ($1,'OUT','課税対象外',0,FALSE)
       ON CONFLICT (company_id, code) DO NOTHING`,
      [req.staff!.companyId]
    );
  }
  const r = await query(
    `SELECT * FROM tax_divisions WHERE company_id = $1 ORDER BY tax_rate, code`,
    [req.staff!.companyId]
  );
  res.json(r.rows);
});

mastersRouter.post('/tax-divisions', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as { code?: string };
  const code = b.code ?? '';

  const mapping: Record<
    string,
    { label: string; taxRate: number; requiresInvoiceNo: boolean }
  > = {
    T10: { label: '消費税10%', taxRate: 10, requiresInvoiceNo: true },
    T8: { label: '消費税8%', taxRate: 8, requiresInvoiceNo: true },
    EXEMPT: { label: '非課税', taxRate: 0, requiresInvoiceNo: false },
    OUT: { label: '課税対象外', taxRate: 0, requiresInvoiceNo: false },
  };

  if (!mapping[code]) {
    res.status(400).json({ error: 'tax division code が不正です' });
    return;
  }

  const m = mapping[code];
  const r = await query(
    `INSERT INTO tax_divisions (company_id, code, label, tax_rate, requires_invoice_no)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (company_id, code) DO UPDATE
     SET label = EXCLUDED.label,
         tax_rate = EXCLUDED.tax_rate,
         requires_invoice_no = EXCLUDED.requires_invoice_no,
         updated_at = NOW()
     RETURNING *`,
    [req.staff!.companyId, code, m.label, m.taxRate, m.requiresInvoiceNo]
  );
  res.status(201).json(r.rows[0]);
});

mastersRouter.patch('/tax-divisions/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const b = req.body as { label?: string; requiresInvoiceNo?: boolean };

  const label = typeof b.label === 'string' ? b.label.trim() : '';
  const requiresInvoiceNo = typeof b.requiresInvoiceNo === 'boolean' ? b.requiresInvoiceNo : null;

  if (!id || !label) {
    res.status(400).json({ error: 'label は必須です' });
    return;
  }
  if (requiresInvoiceNo === null) {
    res.status(400).json({ error: 'requiresInvoiceNo は必須です' });
    return;
  }

  const r = await query(
    `UPDATE tax_divisions
     SET label = $1,
         requires_invoice_no = $2,
         updated_at = NOW()
     WHERE id = $3
       AND company_id = $4
     RETURNING *`,
    [label, requiresInvoiceNo, id, req.staff!.companyId]
  );

  if (!r.rows[0]) {
    res.status(404).json({ error: '税区分が見つかりません' });
    return;
  }
  res.json(r.rows[0]);
});

async function removeTaxDivision(req: AuthedRequest, res: Response) {
  const { id } = req.params;
  await query(`DELETE FROM tax_divisions WHERE id = $1 AND company_id = $2`, [id, req.staff!.companyId]);
  res.json({ ok: true });
}

mastersRouter.delete('/tax-divisions/:id', blockViewerWrite, removeTaxDivision);
mastersRouter.post('/tax-divisions/:id/delete', blockViewerWrite, removeTaxDivision);

function parsePayrollCategory(raw: string | undefined, fallback: 'employee' | 'officer' | 'other'): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (s === 'employee' || s === 'officer' || s === 'other') return s;
  return fallback;
}

mastersRouter.get('/users', async (req: AuthedRequest, res) => {
  if (req.staff!.role !== 'admin') {
    res.status(403).json({ error: '管理者のみ' });
    return;
  }
  const r = await query(
    `SELECT id, email, name, role::text, payroll_category::text AS payroll_category,
            age_years, base_monthly_gross::text AS base_monthly_gross,
            active, department_id, created_at
     FROM users WHERE company_id = $1`,
    [req.staff!.companyId]
  );
  res.json(r.rows);
});

mastersRouter.get('/users/:id', async (req: AuthedRequest, res) => {
  if (req.staff!.role !== 'admin') {
    res.status(403).json({ error: '管理者のみ' });
    return;
  }
  const r = await query(
    `SELECT id, email, name, role::text, payroll_category::text AS payroll_category,
            age_years, base_monthly_gross::text AS base_monthly_gross,
            active, department_id, created_at
     FROM users WHERE id = $1 AND company_id = $2`,
    [req.params.id, req.staff!.companyId]
  );
  if (!r.rows[0]) {
    res.status(404).json({ error: 'ユーザーが見つかりません' });
    return;
  }
  res.json(r.rows[0]);
});

mastersRouter.post('/users', blockViewerWrite, async (req: AuthedRequest, res) => {
  if (req.staff!.role !== 'admin') {
    res.status(403).json({ error: '管理者のみ' });
    return;
  }
  const b = req.body as {
    email: string;
    password: string;
    name: string;
    role?: string;
    payrollCategory?: string;
    ageYears?: unknown;
    baseMonthlyGross?: unknown;
    departmentId?: string | null;
  };
  const payrollCat = parsePayrollCategory(b.payrollCategory, 'other');
  let ageInsert: number | null = null;
  if (b.ageYears !== undefined && b.ageYears !== null && b.ageYears !== '') {
    const a = Math.floor(Number(b.ageYears));
    if (!Number.isFinite(a) || a < 15 || a > 100) {
      res.status(400).json({ error: '年齢は15〜100の範囲、または未入力' });
      return;
    }
    ageInsert = a;
  }
  const baseInsert = Math.max(0, Number(b.baseMonthlyGross ?? 0) || 0);
  const hash = await hashPassword(b.password);
  try {
    const r = await query(
      `INSERT INTO users (company_id, email, password_hash, name, role, payroll_category, age_years, base_monthly_gross, department_id)
       VALUES ($1,$2,$3,$4,$5::user_role,$6::user_payroll_category,$7,$8,$9)
       RETURNING id, email, name, role::text, payroll_category::text AS payroll_category,
                 age_years, base_monthly_gross::text AS base_monthly_gross, active, department_id`,
      [
        req.staff!.companyId,
        b.email,
        hash,
        b.name,
        b.role ?? 'sales',
        payrollCat,
        ageInsert,
        baseInsert,
        b.departmentId ?? null,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === '23505') {
      res.status(400).json({ error: 'メールが重複しています' });
      return;
    }
    throw e;
  }
});

mastersRouter.patch('/users/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  if (req.staff!.role !== 'admin') {
    res.status(403).json({ error: '管理者のみ' });
    return;
  }
  const id = String(req.params.id);
  const b = req.body as {
    name?: string;
    role?: string;
    payrollCategory?: string;
    ageYears?: unknown;
    baseMonthlyGross?: unknown;
    active?: boolean;
    departmentId?: string | null;
  };
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const role = typeof b.role === 'string' ? b.role : '';
  const active = typeof b.active === 'boolean' ? b.active : true;
  const payrollParam =
    typeof b.payrollCategory === 'string' ? parsePayrollCategory(b.payrollCategory, 'other') : null;
  if (!name || !role) {
    res.status(400).json({ error: '氏名とロールは必須です' });
    return;
  }

  const cur = await query<{
    age_years: string | null;
    base_monthly_gross: string;
  }>(
    `SELECT age_years::text, base_monthly_gross::text FROM users WHERE id = $1 AND company_id = $2`,
    [id, req.staff!.companyId]
  );
  if (!cur.rows[0]) {
    res.status(404).json({ error: 'ユーザーが見つかりません' });
    return;
  }

  let ageVal: number | null;
  if ('ageYears' in b) {
    if (b.ageYears === null || b.ageYears === '') {
      ageVal = null;
    } else {
      const a = Math.floor(Number(b.ageYears));
      if (!Number.isFinite(a) || a < 15 || a > 100) {
        res.status(400).json({ error: '年齢は15〜100の範囲、または空欄でクリア' });
        return;
      }
      ageVal = a;
    }
  } else {
    ageVal = cur.rows[0].age_years != null ? Number(cur.rows[0].age_years) : null;
  }

  const baseVal =
    'baseMonthlyGross' in b
      ? Math.max(0, Number(b.baseMonthlyGross) || 0)
      : Number(cur.rows[0].base_monthly_gross);

  const r = await query(
    `UPDATE users
     SET name = $1,
         role = $2::user_role,
         payroll_category = COALESCE($3::user_payroll_category, payroll_category),
         active = $4,
         department_id = $5,
         age_years = $6,
         base_monthly_gross = $7,
         updated_at = NOW()
     WHERE id = $8 AND company_id = $9
     RETURNING id, email, name, role::text AS role, payroll_category::text AS payroll_category,
               age_years, base_monthly_gross::text AS base_monthly_gross, active, department_id, created_at`,
    [name, role, payrollParam, active, b.departmentId ?? null, ageVal, baseVal, id, req.staff!.companyId]
  );
  if (!r.rows[0]) {
    res.status(404).json({ error: 'ユーザーが見つかりません' });
    return;
  }
  res.json(r.rows[0]);
});

// ユーザーは参照が多いので「削除」ではなく無効化
async function deactivateUser(req: AuthedRequest, res: Response) {
  if (req.staff!.role !== 'admin') {
    res.status(403).json({ error: '管理者のみ' });
    return;
  }
  const { id } = req.params;
  await query(
    `UPDATE users SET active = FALSE, updated_at = NOW()
     WHERE id = $1 AND company_id = $2`,
    [id, req.staff!.companyId]
  );
  res.json({ ok: true });
}

mastersRouter.delete('/users/:id', blockViewerWrite, deactivateUser);
mastersRouter.post('/users/:id/delete', blockViewerWrite, deactivateUser);

mastersRouter.post('/portal-users', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as { customerId: string; email: string; password: string };
  const hash = await hashPassword(b.password);
  try {
    const r = await query(
      `INSERT INTO customer_portal_users (customer_id, email, password_hash)
       SELECT $1,$2,$3 FROM customers c WHERE c.id = $1 AND c.company_id = $4
       RETURNING id, customer_id, email`,
      [b.customerId, b.email, hash, req.staff!.companyId]
    );
    if (!r.rows[0]) {
      res.status(400).json({ error: '顧客が見つかりません' });
      return;
    }
    res.status(201).json(r.rows[0]);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === '23505') {
      res.status(400).json({ error: 'この顧客に同じメールが既にあります' });
      return;
    }
    throw e;
  }
});
