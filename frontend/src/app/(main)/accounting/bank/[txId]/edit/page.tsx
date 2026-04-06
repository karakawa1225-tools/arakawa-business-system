'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { runSave } from '@/lib/save';
import { normalizeToYmd } from '@/lib/format';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DateInput } from '@/components/ui/DateInput';

type Tx = Record<string, unknown>;

export default function BankEditTxPage() {
  const params = useParams();
  const router = useRouter();
  const sp = useSearchParams();
  const txId = typeof params.txId === 'string' ? params.txId : Array.isArray(params.txId) ? params.txId[0] : '';
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    txDate: '',
    txType: 'deposit' as 'deposit' | 'withdrawal',
    description: '',
    amount: 0,
  });
  const [resolvedAccountId, setResolvedAccountId] = useState('');

  const accountHint = sp.get('accountId') ?? '';

  useEffect(() => {
    if (!txId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await api<Tx>(`/api/bank/transactions/${txId}`);
        if (cancelled) return;
        const aid = String(r.bank_account_id ?? accountHint);
        setResolvedAccountId(aid);
        const td = normalizeToYmd(r.tx_date) || String(r.tx_date ?? '');
        setForm({
          txDate: td,
          txType: (r.tx_type === 'withdrawal' ? 'withdrawal' : 'deposit') as 'deposit' | 'withdrawal',
          description: String(r.description ?? ''),
          amount: Number(r.amount ?? 0),
        });
      } catch {
        if (!cancelled) setResolvedAccountId(accountHint);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [txId, accountHint]);

  const accountIdForLink = resolvedAccountId || sp.get('accountId') || '';
  const listHref = accountIdForLink
    ? `/accounting/bank?accountId=${encodeURIComponent(accountIdForLink)}`
    : '/accounting/bank';

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!txId || !form.txDate) {
      window.alert('取引日をカレンダーで選択してください。');
      return;
    }
    await runSave(
      () =>
        api(`/api/bank/transactions/${txId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            txDate: form.txDate,
            txType: form.txType,
            description: form.description || null,
            amount: form.amount,
          }),
        }),
      async () => {
        router.push(listHref);
        router.refresh();
      }
    );
  }

  if (!txId) {
    return <p className="text-sm text-gunmetal-600">ID が不正です。</p>;
  }

  if (loading) {
    return <p className="text-sm text-gunmetal-600">読み込み中…</p>;
  }

  return (
    <>
      <PageTitle title="銀行入出金・編集" description="保存後、一覧に戻ります。" />
      <div className="mb-4">
        <Link href={listHref} className="text-sm text-navy-900 underline">
          ← 一覧へ
        </Link>
      </div>
      <Card className="max-w-xl">
        <form onSubmit={(e) => void saveEdit(e)} className="grid gap-2 sm:grid-cols-2">
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
              保存
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
