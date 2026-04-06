'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';

type Customer = { id: string; company_name: string; customer_code: string };

export default function NewInvoicePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState([{ description: '', quantity: 1, unitPrice: 0, taxRate: 10 }]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<Customer[]>('/api/customers').then(setCustomers);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          status: 'issued',
          lines: lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate,
          })),
        }),
      });
      router.push('/sales/invoices');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'エラー');
    }
  }

  return (
    <>
      <PageTitle title="請求作成" />
      <Card className="max-w-3xl">
        <form onSubmit={submit} className="space-y-4">
          <select
            required
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">顧客を選択</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.customer_code} — {c.company_name}
              </option>
            ))}
          </select>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input
                className="col-span-5 rounded border px-2 py-1 text-sm"
                placeholder="内容"
                value={l.description}
                onChange={(e) => {
                  const n = [...lines];
                  n[i].description = e.target.value;
                  setLines(n);
                }}
              />
              <input
                type="number"
                className="col-span-2 rounded border px-2 py-1 text-sm"
                value={l.quantity}
                onChange={(e) => {
                  const n = [...lines];
                  n[i].quantity = Number(e.target.value);
                  setLines(n);
                }}
              />
              <input
                type="number"
                className="col-span-3 rounded border px-2 py-1 text-sm"
                value={l.unitPrice}
                onChange={(e) => {
                  const n = [...lines];
                  n[i].unitPrice = Number(e.target.value);
                  setLines(n);
                }}
              />
              <input
                type="number"
                className="col-span-2 rounded border px-2 py-1 text-sm"
                value={l.taxRate}
                onChange={(e) => {
                  const n = [...lines];
                  n[i].taxRate = Number(e.target.value);
                  setLines(n);
                }}
              />
            </div>
          ))}
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <Link href="/sales/invoices" className="rounded border px-4 py-2 text-sm">
              戻る
            </Link>
            <button type="submit" className="rounded bg-navy-900 px-4 py-2 text-sm text-white">
              保存
            </button>
          </div>
        </form>
      </Card>
    </>
  );
}
