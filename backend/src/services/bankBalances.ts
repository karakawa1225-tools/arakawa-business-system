import { query } from '../db/pool.js';

/**
 * 口座の入出金を日付・作成順に走査し balance_after と current_balance を再計算する
 */
export async function recalculateBankAccountBalances(companyId: string, bankAccountId: string): Promise<void> {
  const acc = await query<{ opening_balance: string }>(
    `SELECT opening_balance::text FROM bank_accounts WHERE id = $1 AND company_id = $2`,
    [bankAccountId, companyId]
  );
  if (!acc.rows[0]) return;

  let running = parseFloat(acc.rows[0].opening_balance);
  const txs = await query<{ id: string; tx_type: string; amount: string }>(
    `SELECT id, tx_type::text AS tx_type, amount::text FROM bank_transactions
     WHERE company_id = $1 AND bank_account_id = $2
     ORDER BY tx_date ASC, created_at ASC, id ASC`,
    [companyId, bankAccountId]
  );

  for (const t of txs.rows) {
    const amt = parseFloat(t.amount);
    if (t.tx_type === 'deposit') running += amt;
    else running -= amt;
    await query(`UPDATE bank_transactions SET balance_after = $1, updated_at = NOW() WHERE id = $2`, [
      running,
      t.id,
    ]);
  }

  await query(`UPDATE bank_accounts SET current_balance = $1, updated_at = NOW() WHERE id = $2`, [
    running,
    bankAccountId,
  ]);
}
