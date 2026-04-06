import { Router, type Response } from 'express';
import { query } from '../db/pool.js';
import { nextDocumentNo } from '../services/numbers.js';
import { recalculateBankAccountBalances } from '../services/bankBalances.js';
import { requireStaff, blockViewerWrite, type AuthedRequest } from '../middleware/auth.js';
import { badDateMessage, parseIsoDateStrict } from '../utils/isoDate.js';

export const paymentsRouter = Router();
paymentsRouter.use(requireStaff);

const PAYMENT_ROW = `p.id,
      p.company_id,
      p.customer_id,
      p.invoice_id,
      p.bank_account_id,
      p.payment_no,
      to_char(p.payment_date, 'YYYY-MM-DD') AS payment_date,
      p.amount,
      p.method,
      p.notes,
      p.created_by,
      p.created_at,
      p.updated_at`;

async function findPaymentDepositTxId(
  companyId: string,
  bankAccountId: string,
  txDate: string,
  amount: string | number,
  paymentNo: string,
  notes: string | null
): Promise<string | null> {
  const amt = typeof amount === 'string' ? amount : String(amount);
  const primaryDesc = notes ?? `入金 ${paymentNo}`;
  const r = await query<{ id: string }>(
    `SELECT id FROM bank_transactions
     WHERE company_id = $1 AND bank_account_id = $2 AND tx_date = $3::date
       AND tx_type = 'deposit' AND amount = $4::numeric
       AND (description = $5 OR description = $6)
     ORDER BY created_at DESC LIMIT 1`,
    [companyId, bankAccountId, txDate, amt, primaryDesc, `入金 ${paymentNo}`]
  );
  return r.rows[0]?.id ?? null;
}

paymentsRouter.get('/', async (req: AuthedRequest, res) => {
  const r = await query(
    `SELECT ${PAYMENT_ROW}, c.company_name AS customer_name FROM payments p
     JOIN customers c ON c.id = p.customer_id
     WHERE p.company_id = $1 ORDER BY p.payment_date DESC`,
    [req.staff!.companyId]
  );
  res.json(r.rows);
});

paymentsRouter.get('/:id', async (req: AuthedRequest, res) => {
  const r = await query(
    `SELECT ${PAYMENT_ROW}, c.company_name AS customer_name FROM payments p
     JOIN customers c ON c.id = p.customer_id
     WHERE p.id = $1 AND p.company_id = $2`,
    [req.params.id, req.staff!.companyId]
  );
  if (!r.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  res.json(r.rows[0]);
});

paymentsRouter.post('/', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as {
    customerId: string;
    invoiceId?: string | null;
    bankAccountId?: string | null;
    paymentDate?: string;
    amount: number;
    method?: string;
    notes?: string;
  };
  if (!b.customerId || b.amount == null) {
    res.status(400).json({ error: '顧客と金額は必須です' });
    return;
  }
  const payDateRaw = b.paymentDate ?? new Date().toISOString().slice(0, 10);
  const payDate = parseIsoDateStrict(payDateRaw);
  if (!payDate) {
    res.status(400).json({ error: badDateMessage('入金日') });
    return;
  }
  const paymentNo = await nextDocumentNo(req.staff!.companyId, 'payment');
  const pr = await query(
    `INSERT INTO payments (company_id, customer_id, invoice_id, bank_account_id, payment_no, payment_date, amount, method, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10)
     RETURNING
       id,
       company_id,
       customer_id,
       invoice_id,
       bank_account_id,
       payment_no,
       to_char(payment_date, 'YYYY-MM-DD') AS payment_date,
       amount,
       method,
       notes,
       created_by,
       created_at,
       updated_at`,
    [
      req.staff!.companyId,
      b.customerId,
      b.invoiceId ?? null,
      b.bankAccountId ?? null,
      paymentNo,
      payDate,
      b.amount,
      b.method ?? null,
      b.notes ?? null,
      req.staff!.sub,
    ]
  );

  if (b.invoiceId) {
    await query(
      `UPDATE invoices SET paid_amount = paid_amount + $1,
       status = CASE WHEN paid_amount + $1 >= total THEN 'paid'::invoice_status
            WHEN paid_amount + $1 > 0 THEN 'partial'::invoice_status ELSE status END,
       updated_at = NOW()
       WHERE id = $2 AND company_id = $3`,
      [b.amount, b.invoiceId, req.staff!.companyId]
    );
  }

  if (b.bankAccountId) {
    await query(
      `INSERT INTO bank_transactions (company_id, bank_account_id, tx_date, tx_type, description, amount, balance_after)
       VALUES ($1,$2,$3::date,'deposit',$4,$5,NULL)`,
      [
        req.staff!.companyId,
        b.bankAccountId,
        payDate,
        b.notes ?? `入金 ${paymentNo}`,
        b.amount,
      ]
    );
    await recalculateBankAccountBalances(req.staff!.companyId, b.bankAccountId);
  }

  res.status(201).json(pr.rows[0]);
});

paymentsRouter.patch('/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as {
    paymentDate?: string;
    amount?: number;
    notes?: string | null;
    method?: string | null;
  };
  const companyId = req.staff!.companyId;
  const ex = await query<{
    id: string;
    invoice_id: string | null;
    bank_account_id: string | null;
    payment_no: string;
    payment_date: string;
    amount: string;
    notes: string | null;
  }>(
    `SELECT id, invoice_id, bank_account_id, payment_no, to_char(payment_date, 'YYYY-MM-DD') AS payment_date, amount::text AS amount, notes
     FROM payments WHERE id = $1 AND company_id = $2`,
    [req.params.id, companyId]
  );
  const row = ex.rows[0];
  if (!row) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  let nextDate = row.payment_date.slice(0, 10);
  if (b.paymentDate !== undefined) {
    const d = parseIsoDateStrict(b.paymentDate);
    if (!d) {
      res.status(400).json({ error: badDateMessage('入金日') });
      return;
    }
    nextDate = d;
  }
  let nextAmount = parseFloat(row.amount);
  if (b.amount !== undefined) nextAmount = Number(b.amount);

  const delta = nextAmount - parseFloat(row.amount);

  if (b.amount !== undefined && row.invoice_id) {
    await query(
      `UPDATE invoices SET paid_amount = GREATEST(0, paid_amount + $1::numeric),
       status = CASE
         WHEN GREATEST(0, paid_amount + $1::numeric) >= total THEN 'paid'::invoice_status
         WHEN GREATEST(0, paid_amount + $1::numeric) > 0 THEN 'partial'::invoice_status
         ELSE 'issued'::invoice_status
       END,
       updated_at = NOW()
       WHERE id = $2 AND company_id = $3`,
      [delta, row.invoice_id, companyId]
    );
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  let n = 1;
  if (b.paymentDate !== undefined) {
    sets.push(`payment_date = $${n++}::date`);
    params.push(nextDate);
  }
  if (b.amount !== undefined) {
    sets.push(`amount = $${n++}`);
    params.push(nextAmount);
  }
  if (b.notes !== undefined) {
    sets.push(`notes = $${n++}`);
    params.push(b.notes);
  }
  if (b.method !== undefined) {
    sets.push(`method = $${n++}`);
    params.push(b.method);
  }
  if (sets.length > 0) {
    sets.push('updated_at = NOW()');
    params.push(req.params.id, companyId);
    await query(`UPDATE payments SET ${sets.join(', ')} WHERE id = $${n++} AND company_id = $${n++}`, params);
  }

  const touchesBank =
    b.paymentDate !== undefined || b.amount !== undefined || b.notes !== undefined;
  if (row.bank_account_id && touchesBank) {
    const txId = await findPaymentDepositTxId(
      companyId,
      row.bank_account_id,
      row.payment_date.slice(0, 10),
      row.amount,
      row.payment_no,
      row.notes
    );
    if (txId) {
      const fresh = await query<{
        payment_date: string;
        amount: string;
        notes: string | null;
        payment_no: string;
      }>(
        `SELECT to_char(payment_date, 'YYYY-MM-DD') AS payment_date, amount::text, notes, payment_no FROM payments WHERE id = $1`,
        [req.params.id]
      );
      const fr = fresh.rows[0];
      if (fr) {
        const desc = fr.notes ?? `入金 ${fr.payment_no}`;
        await query(
          `UPDATE bank_transactions SET tx_date = $1::date, amount = $2::numeric, description = $3, updated_at = NOW() WHERE id = $4`,
          [fr.payment_date.slice(0, 10), fr.amount, desc, txId]
        );
      }
    }
    await recalculateBankAccountBalances(companyId, row.bank_account_id);
  }

  const out = await query(
    `SELECT ${PAYMENT_ROW}, c.company_name AS customer_name FROM payments p
     JOIN customers c ON c.id = p.customer_id WHERE p.id = $1`,
    [req.params.id]
  );
  res.json(out.rows[0]);
});

async function removePayment(req: AuthedRequest, res: Response) {
  const companyId = req.staff!.companyId;
  const ex = await query<{
    invoice_id: string | null;
    bank_account_id: string | null;
    payment_no: string;
    payment_date: string;
    amount: string;
    notes: string | null;
  }>(
    `SELECT invoice_id, bank_account_id, payment_no, to_char(payment_date, 'YYYY-MM-DD') AS payment_date, amount::text AS amount, notes
     FROM payments WHERE id = $1 AND company_id = $2`,
    [req.params.id, companyId]
  );
  const row = ex.rows[0];
  if (!row) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  const amt = parseFloat(row.amount);
  if (row.invoice_id) {
    await query(
      `UPDATE invoices SET paid_amount = GREATEST(0, paid_amount - $1::numeric),
       status = CASE
         WHEN GREATEST(0, paid_amount - $1::numeric) >= total THEN 'paid'::invoice_status
         WHEN GREATEST(0, paid_amount - $1::numeric) > 0 THEN 'partial'::invoice_status
         ELSE 'issued'::invoice_status
       END,
       updated_at = NOW()
       WHERE id = $2 AND company_id = $3`,
      [amt, row.invoice_id, companyId]
    );
  }
  let bankId: string | null = row.bank_account_id;
  if (row.bank_account_id) {
    const txId = await findPaymentDepositTxId(
      companyId,
      row.bank_account_id,
      row.payment_date.slice(0, 10),
      row.amount,
      row.payment_no,
      row.notes
    );
    if (txId) {
      await query(`DELETE FROM bank_transactions WHERE id = $1`, [txId]);
    }
  }
  await query(`DELETE FROM payments WHERE id = $1 AND company_id = $2`, [req.params.id, companyId]);
  if (bankId) {
    await recalculateBankAccountBalances(companyId, bankId);
  }
  res.json({ ok: true });
}

paymentsRouter.delete('/:id', blockViewerWrite, removePayment);
paymentsRouter.post('/:id/delete', blockViewerWrite, removePayment);
