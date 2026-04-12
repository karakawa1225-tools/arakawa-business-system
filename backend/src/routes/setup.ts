import { Router } from 'express';
import { query } from '../db/pool.js';
import { hashPassword } from '../utils/password.js';
import { requireStaff } from '../middleware/auth.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { sendServerError } from '../utils/httpError.js';

export const setupRouter = Router();

/** DB と companies テーブルの存在確認（ブラウザで http://localhost:4000/api/setup/db-check ） */
setupRouter.get('/db-check', async (_req, res) => {
  try {
    await query('SELECT 1');
  } catch (e) {
    return res.status(200).json({
      ok: false,
      phase: 'connect',
      message: String(e instanceof Error ? e.message : e),
    });
  }
  try {
    await query('SELECT 1 FROM companies LIMIT 1');
  } catch (e) {
    return res.status(200).json({
      ok: false,
      phase: 'companies_table',
      message: String(e instanceof Error ? e.message : e),
      hint: 'プロジェクトルートで node database/run-schema.js を実行し、.env の DATABASE_URL と同じDBにテーブルを作成してください。',
    });
  }
  return res.json({ ok: true, message: 'PostgreSQL と companies テーブルに接続できています。' });
});

/** 未ログイン時: 会社が0件ならセットアップ必要 */
setupRouter.get('/status', async (_req, res) => {
  try {
    const c = await query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM companies`);
    const count = parseInt(c.rows[0]?.n ?? '0', 10);
    if (count === 0) {
      res.json({ needsSetup: true, setupCompleted: false, step: 0 });
      return;
    }
    try {
      const co = await query<{ id: string; setup_completed: boolean; setup_step: number }>(
        `SELECT id, setup_completed, setup_step FROM companies ORDER BY created_at LIMIT 1`
      );
      const row = co.rows[0];
      res.json({
        needsSetup: false,
        setupCompleted: row?.setup_completed ?? false,
        step: row?.setup_step ?? 0,
        companyId: row?.id,
      });
    } catch (inner: unknown) {
      const code = (inner as { code?: string }).code;
      // 42703: 列がない（古いスキーマ）→ 最低限 id だけ取り、フロントを止めない
      if (code === '42703') {
        const co = await query<{ id: string }>(`SELECT id FROM companies ORDER BY id LIMIT 1`);
        const row = co.rows[0];
        res.json({
          needsSetup: false,
          setupCompleted: false,
          step: 0,
          companyId: row?.id,
          schemaHint:
            'companies に setup_completed / setup_step がありません。プロジェクトルートで npm run db:patch-setup-cols を実行してください。',
        });
        return;
      }
      throw inner;
    }
  } catch (e) {
    const code = (e as { code?: string }).code;
    // 28P01: PostgreSQL のユーザー/パスワード認証失敗
    // ローカル開発でも「サーバーエラー」だけになることがあるので、ここだけは分かる文言を返す。
    if (code === '28P01') {
      res.status(503).json({
        error: 'PostgreSQL の認証に失敗しています。',
        hint: 'プロジェクトルートの `.env` の `DATABASE_URL` が、実際に動いている PostgreSQL の接続情報と一致しているか確認してください（バックエンドを再起動）。',
      });
      return;
    }
    if (code === '42P01') {
      res.status(503).json({
        error: 'companies テーブルがありません。',
        hint: 'プロジェクトルートで node database/run-schema.js を実行してください。',
      });
      return;
    }
    sendServerError(res, e);
  }
});

/** STEP1 会社情報（初回は認証なしで1社目作成） */
setupRouter.post('/company', async (req, res) => {
  try {
    const existing = await query(`SELECT id FROM companies LIMIT 1`);
    if (existing.rows.length > 0) {
      res.status(400).json({ error: '既に会社が登録されています' });
      return;
    }
    const body = req.body as Record<string, string | undefined>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const postalCode = body.postalCode?.trim() || null;
    const address = body.address?.trim() || null;
    const phone = body.phone?.trim() || null;
    const invoiceRegistration = body.invoiceRegistration?.trim() || null;
    if (!name) {
      res.status(400).json({ error: '会社名は必須です' });
      return;
    }
    const r = await query<{ id: string }>(
      `INSERT INTO companies (name, postal_code, address, phone, invoice_registration, setup_step)
       VALUES ($1,$2,$3,$4,$5, 1) RETURNING id`,
      [name, postalCode, address, phone, invoiceRegistration]
    );
    res.json({ companyId: r.rows[0].id, step: 1 });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === '42P01') {
      res.status(503).json({
        error: 'companies テーブルがありません。',
        hint:
          'PostgreSQL に schema が未適用です。ローカルでプロジェクトルートから `npm run db:init`（または `node database/run-schema.js`）を、Render の DATABASE_URL と同じ DB に対して実行するか、Supabase の SQL Editor で `database/schema.sql` を実行してください。',
      });
      return;
    }
    sendServerError(res, e);
  }
});

/** STEP2 銀行口座（会社IDをクエリで取得 — 初回フロー用） */
setupRouter.post('/bank', async (req, res) => {
  try {
    const co = await query<{ id: string }>(`SELECT id FROM companies ORDER BY created_at LIMIT 1`);
    const companyId = co.rows[0]?.id;
    if (!companyId) {
      res.status(400).json({ error: '先に会社情報を登録してください' });
      return;
    }
    const b = req.body as Record<string, string | undefined>;
    await query(
      `INSERT INTO bank_accounts (company_id, name, bank_name, branch_name, account_number, holder_name, is_default)
       VALUES ($1,$2,$3,$4,$5,$6, TRUE)`,
      [
        companyId,
        b.name ?? 'メイン口座',
        b.bankName ?? null,
        b.branchName ?? null,
        b.accountNumber ?? null,
        b.holderName ?? null,
      ]
    );
    await query(`UPDATE companies SET setup_step = 2 WHERE id = $1`, [companyId]);
    res.json({ ok: true, step: 2 });
  } catch (e) {
    sendServerError(res, e);
  }
});

/** STEP3 税率 */
setupRouter.post('/tax', async (req, res) => {
  try {
    const { defaultTaxRate } = req.body as { defaultTaxRate?: number };
    const co = await query<{ id: string }>(`SELECT id FROM companies ORDER BY created_at LIMIT 1`);
    const companyId = co.rows[0]?.id;
    if (!companyId) {
      res.status(400).json({ error: '会社が未登録です' });
      return;
    }
    await query(`UPDATE companies SET default_tax_rate = $1, setup_step = 3 WHERE id = $2`, [
      defaultTaxRate ?? 10,
      companyId,
    ]);
    res.json({ ok: true, step: 3 });
  } catch (e) {
    sendServerError(res, e);
  }
});

/** STEP4 管理者ユーザー */
setupRouter.post('/user', async (req, res) => {
  try {
    const { email, password, name } = req.body as {
      email?: string;
      password?: string;
      name?: string;
    };
    if (!email || !password || !name) {
      res.status(400).json({ error: 'メール・パスワード・氏名は必須です' });
      return;
    }
    const co = await query<{ id: string; setup_completed: boolean }>(
      `SELECT id, setup_completed FROM companies ORDER BY created_at LIMIT 1`
    );
    const companyId = co.rows[0]?.id;
    if (!companyId) {
      res.status(400).json({ error: '会社が未登録です' });
      return;
    }
    if (co.rows[0]?.setup_completed) {
      res.status(400).json({
        error: 'セットアップは完了済みです。ユーザーの追加は管理者メニュー（ユーザー管理）から行ってください。',
      });
      return;
    }
    const uc = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM users WHERE company_id = $1`,
      [companyId]
    );
    if (parseInt(uc.rows[0]?.n ?? '0', 10) > 0) {
      res.status(400).json({
        error:
          '既にユーザーが登録されています。追加のユーザーは管理者メニューの「ユーザー管理」からのみ登録できます。',
      });
      return;
    }
    const hash = await hashPassword(password);
    await query(
      `INSERT INTO users (company_id, email, password_hash, name, role)
       VALUES ($1,$2,$3,$4,'admin')`,
      [companyId, email, hash, name]
    );
    await query(`UPDATE companies SET setup_step = 4 WHERE id = $1`, [companyId]);
    res.json({ ok: true, step: 4 });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === '23505') {
      res.status(400).json({ error: 'このメールは既に使用されています' });
      return;
    }
    sendServerError(res, e);
  }
});

/** STEP5 初期マスタ（勘定科目区分 + 勘定科目サンプル） */
setupRouter.post('/masters', async (req, res) => {
  try {
    const co = await query<{ id: string }>(`SELECT id FROM companies ORDER BY created_at LIMIT 1`);
    const companyId = co.rows[0]?.id;
    if (!companyId) {
      res.status(400).json({ error: '会社が未登録です' });
      return;
    }
    const divisionSeeds = [
      ['B01', '資産', 'asset'],
      ['B02', '負債', 'liability'],
      ['B03', '純資産', 'equity'],
      ['B04', '収益', 'revenue'],
      ['B05', '費用', 'expense'],
    ] as const;
    for (const [dcode, dname, typ] of divisionSeeds) {
      await query(
        `INSERT INTO chart_account_divisions (company_id, division_code, division_name, account_type)
         VALUES ($1,$2,$3,$4::account_type)
         ON CONFLICT (company_id, division_code) DO NOTHING`,
        [companyId, dcode, dname, typ]
      );
    }
    const divRows = await query<{ id: string; account_type: string }>(
      `SELECT id, account_type FROM chart_account_divisions WHERE company_id = $1`,
      [companyId]
    );
    const byType = Object.fromEntries(divRows.rows.map((r) => [r.account_type, r.id])) as Record<
      string,
      string
    >;
    const defaults = [
      ['401', '売上', 'revenue'],
      ['511', '仕入', 'expense'],
      ['523', '旅費交通費', 'expense'],
      ['524', '通信費', 'expense'],
      ['525', '消耗品費', 'expense'],
    ] as const;
    for (const [code, n, t] of defaults) {
      const divisionId = byType[t];
      if (!divisionId) continue;
      const ex = await query(`SELECT 1 FROM chart_of_accounts WHERE company_id = $1 AND code = $2`, [
        companyId,
        code,
      ]);
      if (ex.rows.length === 0) {
        await query(
          `INSERT INTO chart_of_accounts (company_id, division_id, code, name, account_type)
           VALUES ($1,$2,$3,$4,$5::account_type)`,
          [companyId, divisionId, code, n, t]
        );
      }
    }
    await query(`UPDATE companies SET setup_step = 5 WHERE id = $1`, [companyId]);
    res.json({ ok: true, step: 5 });
  } catch (e) {
    sendServerError(res, e);
  }
});

setupRouter.post('/complete', async (req, res) => {
  try {
    const co = await query<{ id: string }>(`SELECT id FROM companies ORDER BY created_at LIMIT 1`);
    const companyId = co.rows[0]?.id;
    if (!companyId) {
      res.status(400).json({ error: '会社が未登録です' });
      return;
    }
    await query(`UPDATE companies SET setup_completed = TRUE, setup_step = 5 WHERE id = $1`, [
      companyId,
    ]);
    res.json({ ok: true });
  } catch (e) {
    sendServerError(res, e);
  }
});

/** セットアップ完了後の会社更新（要ログイン） */
setupRouter.patch('/company-profile', requireStaff, async (req: AuthedRequest, res) => {
  const cid = req.staff!.companyId;
  const b = req.body as Record<string, string | undefined>;
  await query(
    `UPDATE companies SET name = COALESCE($1,name), postal_code = COALESCE($2,postal_code),
     address = COALESCE($3,address), phone = COALESCE($4,phone),
     invoice_registration = COALESCE($5,invoice_registration), updated_at = NOW() WHERE id = $6`,
    [b.name, b.postalCode, b.address, b.phone, b.invoiceRegistration, cid]
  );
  res.json({ ok: true });
});
