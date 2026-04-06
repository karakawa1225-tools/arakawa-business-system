'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';

type Customer = { id: string; company_name: string; customer_code: string };

export default function NewEstimatePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [title, setTitle] = useState('');
  const [lines, setLines] = useState([{ description: '', quantity: 1, unitPrice: 0, taxRate: 10 }]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<Customer[]>('/api/customers').then(setCustomers);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const body = {
        customerId,
        title,
        lines: lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
        })),
      };
      const r = await api<{ id: string }>('/api/estimates', { method: 'POST', body: JSON.stringify(body) });
      router.push(`/sales/estimates/${r.id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'エラー');
    }
  }

  return (
    <>
      <PageTitle title="見積作成" />
      <Card className="max-w-3xl">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs text-gunmetal-600">顧客 *</label>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">選択</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_code} — {c.company_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gunmetal-600">件名</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">明細</p>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <input
                  placeholder="内容"
                  className="col-span-5 rounded border px-2 py-1.5 text-sm"
                  value={l.description}
                  onChange={(e) => {
                    const n = [...lines];
                    n[i].description = e.target.value;
                    setLines(n);
                  }}
                />
                <input
                  type="number"
                  placeholder="数量"
                  className="col-span-2 rounded border px-2 py-1.5 text-sm"
                  value={l.quantity}
                  onChange={(e) => {
                    const n = [...lines];
                    n[i].quantity = Number(e.target.value);
                    setLines(n);
                  }}
                />
                <input
                  type="number"
                  placeholder="単価"
                  className="col-span-3 rounded border px-2 py-1.5 text-sm"
                  value={l.unitPrice}
                  onChange={(e) => {
                    const n = [...lines];
                    n[i].unitPrice = Number(e.target.value);
                    setLines(n);
                  }}
                />
                <input
                  type="number"
                  placeholder="税率"
                  className="col-span-2 rounded border px-2 py-1.5 text-sm"
                  value={l.taxRate}
                  onChange={(e) => {
                    const n = [...lines];
                    n[i].taxRate = Number(e.target.value);
                    setLines(n);
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className="text-xs text-navy-800 underline"
              onClick={() => setLines([...lines, { description: '', quantity: 1, unitPrice: 0, taxRate: 10 }])}
            >
              行を追加
            </button>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <Link href="/sales/estimates" className="rounded-lg border px-4 py-2 text-sm">
              戻る
            </Link>
            <button type="submit" className="rounded-lg bg-navy-900 px-4 py-2 text-sm text-white">
              保存
            </button>
          </div>
        </form>
      </Card>
    </>
  );
}
