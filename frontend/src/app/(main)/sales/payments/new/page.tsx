'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { formatJPY, todayYmdLocal } from '@/lib/format';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DateInput } from '@/components/ui/DateInput';

export default function NewPaymentPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<{ id: string; company_name: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [invoices, setInvoices] = useState<{ id: string; invoice_no: string; total: string; paid_amount: string }[]>(
    []
  );
  const [customerId, setCustomerId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [amount, setAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(() => todayYmdLocal());

  useEffect(() => {
    api<{ id: string; company_name: string }[]>('/api/customers').then(setCustomers);
    api<{ id: string; name: string }[]>('/api/bank/accounts').then(setAccounts);
    api<{ id: string; invoice_no: string; total: string; paid_amount: string }[]>('/api/invoices').then(setInvoices);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentDate) {
      window.alert('入金日をカレンダーで選択してください。');
      return;
    }
    try {
      await api('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          invoiceId: invoiceId || null,
          bankAccountId: bankAccountId || null,
          amount,
          paymentDate,
        }),
      });
      router.push('/sales/payments');
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : '登録に失敗しました');
    }
  }

  return (
    <>
      <PageTitle title="入金登録" />
      <Card className="max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <select
            required
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">顧客</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </select>
          <select
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">請求（任意）</option>
            {invoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.invoice_no} / {formatJPY(i.total)}
              </option>
            ))}
          </select>
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">入金先口座（任意・残高連動）</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <DateInput
            value={paymentDate}
            onChange={setPaymentDate}
            required
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <CurrencyInput
            value={amount}
            onChange={setAmount}
            placeholder="金額"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Link href="/sales/payments" className="rounded border px-4 py-2 text-sm">
              戻る
            </Link>
            <button type="submit" className="rounded bg-navy-900 px-4 py-2 text-sm text-white">
              登録
            </button>
          </div>
        </form>
      </Card>
    </>
  );
}
