import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// ルートの .env を優先（親システムの DATABASE_URL より上書きする）
dotenv.config({ path: path.join(__dirname, '../../../.env'), override: true });
// 任意: backend/.env でローカル上書き
dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  /** 接続できないときに pool.query が無限待ちしないようにする */
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS) || 8000,
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  const res = await pool.query<T>(text, params);
  return res;
}
