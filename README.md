# ARAKAWA Business System

中小企業向けの業務システム（Next.js + Express + PostgreSQL）。

## 技術スタック

- **フロント**: Next.js 15, React 19, Tailwind CSS
- **API**: Node.js (ESM), Express 4, TypeScript
- **DB**: PostgreSQL（本番例: [Supabase](https://supabase.com) 無料枠）

## ローカル開発

1. リポジトリルートに `.env` を作成（`.env.example` を参考に `DATABASE_URL` と `JWT_SECRET` を設定）
2. PostgreSQL にスキーマ適用: `npm run db:init`（必要に応じて `database/` 配下の patch も実行）
3. 起動:

```bash
cd arakawa-business-system
npm install
npm run dev:3001
```

- アプリ: http://localhost:3001  
- API（直接）: http://127.0.0.1:4000  

ポート競合時: `npm run dev:3001:clean`

## Vercel へのデプロイ（フロントのみ）

このリポジトリは **Express API が別プロセス**のため、Vercel には **Next.js（`frontend`）だけ**を載せる想定です。API は [Railway](https://railway.app)、[Render](https://render.com)、[Fly.io](https://fly.io) などにデプロイし、Vercel の環境変数でその URL を指します。

### 手順

1. **Supabase で DB を作成**  
   - 新規 Project → **Settings → Database** で接続文字列（URI）をコピー  
   - ローカルまたは CI から `DATABASE_URL` を指定して `npm run db:init` 等でスキーマを流し込む（下記「DB 接続文字列を変える場所」参照）

2. **API サーバーをデプロイ**（`backend`）  
   - ビルド: `npm ci && npm run build`（`backend` ディレクトリ）  
   - 起動: `npm start`（`node dist/index.js`）  
   - 環境変数: `DATABASE_URL`（Supabase URI）、`JWT_SECRET`、`PORT`（ホスト任せで可）

3. **Vercel に Git 連携**  
   - **Root Directory**: 空のまま（リポジトリルート）  
   - `vercel.json` により `npm run build --workspace=frontend` が実行されます（ルートで `npm install` 済みであることが前提）  
   - 初回、Framework Preset が自動で付かない場合は **Next.js** を選択

4. **Vercel の Environment Variables**（Production / Preview いずれも必要なら両方）

   | Name | 例 |
   |------|-----|
   | `BACKEND_PROXY_TARGET` | `https://your-api.example.com`（末尾 `/api` なし） |
   | `NEXT_PUBLIC_API_URL` | 上記と同じ API のオリジン（HTTPS） |

5. デプロイ後、ログインやマスタ取得が通るか確認

### ビルドコマンド（参考）

| 場所 | コマンド |
|------|-----------|
| Vercel（本リポジトリ） | `vercel.json` の `buildCommand` どおり（ルートで `npm install` のあと `npm run build --workspace=frontend`） |
| API ホスト | `cd backend && npm ci && npm run build && npm start` |

---

## データベース接続文字列（`DATABASE_URL`）を変える場所

アプリコードに接続文字列の**直書きはありません**。次のいずれかで **`DATABASE_URL` 環境変数**を設定します。

### 実行時（バックエンド）

| 箇所 | 内容 |
|------|------|
| `backend/src/db/pool.ts` | `connectionString: process.env.DATABASE_URL` のみ参照 |
| `backend/src/index.ts` | ルートの `.env` を `dotenv` で読み込み（`backend` から見て2階層上＝リポジトリルートの `.env`） |
| **本番 API** | ホスティング先のダッシュボードで `DATABASE_URL` に **Supabase の URI** を設定 |

### マイグレーション・スキーマ適用（ローカル CLI）

`database/*.js` はリポジトリルートの **`.env` 内の `DATABASE_URL=` 行**を読む実装が多いです。

| ファイル（例） |
|----------------|
| `database/run-schema.js` |
| `database/apply-patch-setup-columns.js` |
| `database/patch-tax-divisions-and-expenses.js` |
| `database/patch-arap-ledger.js` |
| `database/patch-travel-expense.js` |
| `database/patch-chart-account-divisions.js` |
| `database/patch-payroll.js` |
| `database/patch-payroll-monthly-entries.js` |
| `database/patch-users-payroll-master.js` |

実行例:

```bash
# ルートに .env があり DATABASE_URL が Supabase を指している状態で
npm run db:init
```

または一時指定:

```bash
set DATABASE_URL=postgresql://...   # Windows PowerShell: $env:DATABASE_URL="..."
node database/run-schema.js
```

### Supabase 利用時のメモ

- **IPv4 制限**や **プール**の有無で URI が異なります。接続エラー時は Supabase ドキュメントの「Connect to your database」を参照してください。  
- パスワードに特殊文字が含まれる場合は URI エンコードが必要なことがあります。

---

## 環境変数一覧

詳細はリポジトリルートの **`.env.example`** を参照してください。

---

## ライセンス

Private（社内利用想定）
