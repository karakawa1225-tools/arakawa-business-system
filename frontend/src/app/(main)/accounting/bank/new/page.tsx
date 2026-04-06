'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { runSave } from '@/lib/save';
import { todayYmdLocal } from '@/lib/format';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DateInput } from '@/components/ui/DateInput';

export default function BankNewTxPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const [accounts, setAccounts] = useState<
    { id: string; name: string; bank_name?: string | null; branch_name?: string | null }[]
  >([]);
  const [accountId, setAccountId] = useState('');
  const [form, setForm] = useState({
    txDate: todayYmdLocal(),
    txType: 'deposit' as 'deposit' | 'withdrawal',
    description: '',
    amount: 0,
  });

  useEffect(() => {
    api<{ id: string; name: string; bank_name?: string | null; branch_name?: string | null }[]>(
      '/api/bank/accounts'
    ).then((a) => {
      setAccounts(a);
      const fromUrl = sp.get('accountId');
      const pick = fromUrl && a.some((x) => x.id === fromUrl) ? fromUrl : a[0]?.id ?? '';
      setAccountId(pick);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listHref = accountId
    ? `/accounting/bank?accountId=${encodeURIComponent(accountId)}`
    : '/accounting/bank';

  async function addTx(e: React.FormEvent) {
    e.preventDefault();
    if (!form.txDate) {
      window.alert('取引日をカレンダーで選択してください。');
      return;
    }
    if (!accountId) {
      window.alert('口座がありません。');
      return;
    }
    await runSave(
      () =>
        api('/api/bank/transactions', {
          method: 'POST',
          body: JSON.stringify({
            bankAccountId: accountId,
            txDate: form.txDate,
            txType: form.txType,
            description: form.description,
            amount: form.amount,
          }),
        }),
      async () => {
        router.push(listHref);
        router.refresh();
      }
    );
  }

  return (
    <>
      <PageTitle title="銀行入出金・新規" description="登録後、一覧に戻ります。" />
      <div className="mb-4">
        <Link href={listHref} className="text-sm text-navy-900 underline">
          ← 一覧へ
        </Link>
      </div>
      <Card className="max-w-xl">
        <h2 className="text-sm font-medium">取引追加</h2>
        <div className="mt-3 mb-3">
          <label className="text-xs text-gunmetal-600">口座</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="ml-2 rounded border px-3 py-2 text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <form onSubmit={(e) => void addTx(e)} className="grid gap-2 sm:grid-cols-2">
          <DateInput
            value={form.txDate}
            onChange={(v) => setForm({ ...form, txDate: v })}
            required
            className="rounded border px-2 py-1 text-sm"
          />
          <select
            value={form.txType}
            onChange={(e) => setForm({ ...form, txType: e.target.value as 'deposit' | 'withdrawal' })}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="deposit">入金</option>
            <option value="withdrawal">出金</option>
          </select>
          <input
            placeholder="摘要"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded border px-2 py-1 text-sm sm:col-span-2"
          />
          <CurrencyInput
            placeholder="金額"
            value={form.amount}
            onChange={(n) => setForm({ ...form, amount: n })}
            className="rounded border px-2 py-1 text-sm"
          />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className="rounded bg-navy-900 px-3 py-1 text-sm text-white">
              登録
            </button>
            <Link href={listHref} className="rounded border px-3 py-1 text-sm">
              キャンセル
            </Link>
          </div>
        </form>
      </Card>
    </>
  );
}
