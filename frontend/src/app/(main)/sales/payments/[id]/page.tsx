'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { normalizeToYmd } from '@/lib/format';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DateInput } from '@/components/ui/DateInput';

export default function EditPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [err, setErr] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState('');
  const [paymentNo, setPaymentNo] = useState('');

  useEffect(() => {
    api<Record<string, unknown>>(`/api/payments/${id}`)
      .then((p) => {
        setPaymentNo(String(p.payment_no ?? ''));
        setPaymentDate(normalizeToYmd(p.payment_date) || String(p.payment_date ?? ''));
        setAmount(Number(p.amount ?? 0));
        setNotes(String(p.notes ?? ''));
        setMethod(String(p.method ?? ''));
      })
      .catch(() => setErr('読み込みに失敗しました'));
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!paymentDate) {
      setErr('入金日をカレンダーで選択してください。');
      return;
    }
    try {
      await api(`/api/payments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          paymentDate,
          amount,
          notes: notes || null,
          method: method || null,
        }),
      });
      router.push('/sales/payments');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'エラー';
      setErr(msg);
      window.alert(msg);
    }
  }

  async function remove() {
    if (!window.confirm('入金を削除します。請求の入金額・銀行残高への反映も戻します。よろしいですか？')) return;
    setErr('');
    try {
      await api(`/api/payments/${id}`, { method: 'DELETE' });
      router.push('/sales/payments');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'エラー';
      setErr(msg);
      window.alert(msg);
    }
  }

  return (
    <>
      <PageTitle title={`入金 ${paymentNo || '…'}`} description="編集・削除" />
      <Card className="max-w-lg">
        <form onSubmit={save} className="space-y-4">
          <DateInput value={paymentDate} onChange={setPaymentDate} required className="w-full rounded-lg border px-3 py-2 text-sm" />
          <CurrencyInput value={amount} onChange={setAmount} className="w-full rounded-lg border px-3 py-2 text-sm" />
          <input
            placeholder="支払方法（任意）"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <textarea
            placeholder="摘要・メモ"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            rows={2}
          />
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Link href="/sales/payments" className="rounded border px-4 py-2 text-sm">
              戻る
            </Link>
            <button type="submit" className="rounded bg-navy-900 px-4 py-2 text-sm text-white">
              保存
            </button>
            <button type="button" onClick={() => void remove()} className="rounded border border-red-400 px-4 py-2 text-sm text-red-800">
              削除
            </button>
          </div>
          <p className="text-xs text-gunmetal-600">
            顧客・請求・入金先口座の紐づけは新規登録で行ってください。ここでは日付・金額・摘要・方法のみ変更できます。金額変更時は請求書の入金累計と、連動している銀行口座残高を再計算します。
          </p>
        </form>
      </Card>
    </>
  );
}
