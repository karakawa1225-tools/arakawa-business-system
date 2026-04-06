/**
 * 既存DBに対して
 * - tax_divisions テーブル追加（税区分マスタ）
 * - expenses に tax_division_id / supplier_invoice_no / payment_destination 追加
 * - 既存の tax_rate から tax_division_id を自動補完
 * を行うパッチ（冪等）
 *
 * usage:
 *   node database/patch-tax-divisions-and-expenses.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)$/);
    if (m) {
      process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, '');
      break;
    }
  }
}

async function main() {
  loadEnvFile();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL が未設定です。.env を参照するか環境変数を設定してください。');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, 'patch-tax-divisions-and-expenses.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.log('patch-tax-divisions-and-expenses.sql を適用しました。');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

