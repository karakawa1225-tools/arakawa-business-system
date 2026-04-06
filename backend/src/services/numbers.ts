import { query } from '../db/pool.js';

type DocKind = 'estimate' | 'order' | 'invoice' | 'payment';

const MAP: Record<DocKind, { table: string; column: string; prefix: string }> = {
  estimate: { table: 'estimates', column: 'estimate_no', prefix: 'EST' },
  order: { table: 'sales_orders', column: 'order_no', prefix: 'SO' },
  invoice: { table: 'invoices', column: 'invoice_no', prefix: 'INV' },
  payment: { table: 'payments', column: 'payment_no', prefix: 'PAY' },
};

export async function nextDocumentNo(companyId: string, kind: DocKind): Promise<string> {
  const { table, column, prefix } = MAP[kind];
  const r = await query<{ max: string | null }>(
    `SELECT MAX(${column}) AS max FROM ${table} WHERE company_id = $1 AND ${column} LIKE $2`,
    [companyId, `${prefix}-%`]
  );
  const max = r.rows[0]?.max;
  let n = 1;
  if (max) {
    const part = max.replace(`${prefix}-`, '');
    const num = parseInt(part, 10);
    if (!Number.isNaN(num)) n = num + 1;
  }
  return `${prefix}-${String(n).padStart(5, '0')}`;
}
