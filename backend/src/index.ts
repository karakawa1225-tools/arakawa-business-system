import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { authRouter } from './routes/auth.js';
import { setupRouter } from './routes/setup.js';
import { customersRouter } from './routes/customers.js';
import { productsRouter } from './routes/products.js';
import { suppliersRouter } from './routes/suppliers.js';
import { estimatesRouter } from './routes/estimates.js';
import { salesOrdersRouter } from './routes/salesOrders.js';
import { invoicesRouter } from './routes/invoices.js';
import { paymentsRouter } from './routes/payments.js';
import { bankRouter } from './routes/bank.js';
import { expensesRouter } from './routes/expenses.js';
import { mastersRouter } from './routes/masters.js';
import { dashboardRouter } from './routes/dashboardRoute.js';
import { reportsRouter } from './routes/reports.js';
import { arLedgerRouter } from './routes/arLedger.js';
import { apLedgerRouter } from './routes/apLedger.js';
import { portalRouter } from './routes/portal.js';
import { settingsRouter } from './routes/settings.js';
import { travelExpenseRouter } from './routes/travelExpense.js';
import { payrollRouter } from './routes/payroll.js';
import { searchRouter } from './routes/search.js';
import { extractErrorDetail } from './utils/httpError.js';
import { hintForDatabaseConnectError } from './utils/dbConnectionHint.js';
import { pool } from './db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });

const app = express();
app.use(
  cors({
    origin: true,
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Language', 'X-Requested-With'],
  })
);
// 売掛/買掛管理のPDF添付（DataURL）などで少し大きめを許可
app.use(express.json({ limit: '20mb' }));

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}（${ms}ms タイムアウト）`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/** API 生存確認（DB まで含む。DB が応答しないときブラウザが固まらないよう ping に上限あり） */
app.get('/health', async (_req, res) => {
  const dbMs = Number(process.env.HEALTH_DB_TIMEOUT_MS) || 5000;
  try {
    await withTimeout(pool.query('SELECT 1'), dbMs, 'DB');
    res.json({
      ok: true,
      database: 'ok',
      /** 古いプロセスが 4000 を掴んでいると ar-ledger などが 404 になる。capabilities があるかで切り分け */
      service: 'arakawa-backend',
      capabilities: { arLedger: true, apLedger: true, travelExpenses: true, payroll: true },
    });
  } catch (e) {
    const detail = extractErrorDetail(e);
    const poolerHint = hintForDatabaseConnectError(detail);
    res.status(503).json({
      ok: false,
      database: 'error',
      error: detail,
      hint:
        poolerHint ??
        'PostgreSQL が起動しているか、DATABASE_URL が正しいか確認してください。タスクマネージャーで node を終了し、npm run dev:3001 をやり直すと復旧することがあります。',
    });
  }
});

/** ブラウザで API のオリジン直下を開いたとき（GET / はエンドポイントではない旨を明示） */
app.get('/', (_req, res) => {
  res.json({
    service: 'arakawa-backend',
    message: 'この URL は REST API です。ルート「/」には機能はありません。',
    tryGet: '/health',
    apiPrefix: '/api',
  });
});

app.use('/api/auth', authRouter);
app.use('/api/setup', setupRouter);
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/estimates', estimatesRouter);
app.use('/api/orders', salesOrdersRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/bank', bankRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/masters', mastersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/ar-ledger', arLedgerRouter);
app.use('/api/ap-ledger', apLedgerRouter);
app.use('/api/portal', portalRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/travel-expenses', travelExpenseRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/search', searchRouter);

/**
 * Next.js（Vercel）側の診断用。Render をブラウザで直開きすると誤ってここに来ることがある。
 * 汎用 404 のローカル向けヒントだけだと混乱するため、専用レスポンスを返す。
 */
app.get('/api/proxy-health', (_req, res) => {
  res.status(200).json({
    ok: false,
    whereYouAre: 'render-api',
    message:
      'GET /api/proxy-health は Vercel にデプロイしたフロント（Next.js）専用の診断です。いま開いているのは Render 上の API のため、このパスはここでは提供しません。',
    openOnVercelInstead:
      '社内アプリのドメイン（…vercel.app 等）で同じパスを開いてください（例: https://＜Vercelのホスト＞/api/proxy-health）。',
    renderHealthCheck: '/health',
  });
});

/** 未定義パス（「Cannot GET …」の HTML 404 をやめ、フロントがヒントを表示できるようにする） */
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: `API が見つかりません（${req.method} ${req.originalUrl}）`,
    hint:
      '別アプリや古いバックエンドがポートを占有している可能性があります。PowerShell で netstat -ano | findstr :4000 の PID を taskkill し、プロジェクト直下で npm run dev:3001 を実行し直してください。GET http://127.0.0.1:4000/health の JSON に service / capabilities があるか確認してください。',
  });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const mask = process.env.MASK_API_ERRORS === '1';
  const detail = extractErrorDetail(err);
  res.status(500).json({ error: mask ? 'サーバーエラー' : detail });
});

const port = Number(process.env.PORT) || 4000;
const host = process.env.LISTEN_HOST || '0.0.0.0';

console.log('[arakawa-backend] boot', {
  node: process.version,
  cwd: process.cwd(),
  host,
  port,
  hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
  hasJwtSecret: Boolean(process.env.JWT_SECRET),
});

const server = app.listen(port, host, async () => {
  console.log(`ARAKAWA API listening on http://${host}:${port}`);
  console.log('  → /api/ar-ledger /api/ap-ledger などをマウント済み（ここが出ないプロセスは別アプリの可能性）');
  try {
    await pool.query('SELECT 1');
    console.log('DB接続: OK');
  } catch (e) {
    const detail = extractErrorDetail(e);
    console.error('DB接続: 失敗 —', detail);
    const poolerHint = hintForDatabaseConnectError(detail);
    if (poolerHint) console.error('DB接続: ヒント —', poolerHint);
  }
});

server.on('error', (err) => {
  console.error('[arakawa-backend] listen 失敗:', err);
  process.exit(1);
});
