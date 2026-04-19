'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { runSave } from '@/lib/save';
import { DateInput } from '@/components/ui/DateInput';
import { formatJPY, normalizeToYmd } from '@/lib/format';

export default function EstimateEditPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [customers, setCustomers] = useState<{ id: string; company_name: string; customer_code: string }[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('draft');
  const [issueDate, setIssueDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [lines, setLines] = useState<
    { description: string; quantity: number; unitPrice: number; taxRate: number }[]
  >([]);

  useEffect(() => {
    api<{ id: string; company_name: string; customer_code: string }[]>('/api/customers').then(setCustomers);
  }, []);

  useEffect(() => {
    api<Record<string, unknown> & { lines: Record<string, unknown>[] }>(`/api/estimates/${id}`).then((d) => {
      setData(d);
      setCustomerId(String(d.customer_id));
      setTitle(String(d.title ?? ''));
      setStatus(String(d.status));
      setIssueDate(normalizeToYmd(d.issue_date) || String(d.issue_date ?? ''));
      setValidUntil(d.valid_until ? normalizeToYmd(d.valid_until) || String(d.valid_until) : '');
      setLines(
        (d.lines || []).map((l) => ({
          description: String(l.description),
          quantity: Number(l.quantity),
          unitPrice: Number(l.unit_price),
          taxRate: Number(l.tax_rate),
        }))
      );
    });
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!issueDate) {
      window.alert('見積日をカレンダーで選択してください。');
      return;
    }
    await runSave(
      () =>
        api(`/api/estimates/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            customerId,
            title,
            status,
            issueDate,
            validUntil: validUntil || null,
            lines: lines.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              taxRate: l.taxRate,
            })),
          }),
        }),
      async () => {
        const d = await api<Record<string, unknown> & { lines: Record<string, unknown>[] }>(`/api/estimates/${id}`);
        setData(d);
        setIssueDate(normalizeToYmd(d.issue_date) || String(d.issue_date ?? ''));
        setValidUntil(d.valid_until ? normalizeToYmd(d.valid_until) || String(d.valid_until) : '');
        setLines(
          (d.lines || []).map((l) => ({
            description: String(l.description),
            quantity: Number(l.quantity),
            unitPrice: Number(l.unit_price),
            taxRate: Number(l.tax_rate),
          }))
        );
      }
    );
  }

  if (!data) return <p className="p-6">読み込み中…</p>;

  return (
    <>
      <PageTitle title={`見積 ${String(data.estimate_no)}`} description="見積編集" />
      <Card className="max-w-3xl">
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="text-xs text-gunmetal-600">顧客</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_code} — {c.company_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-gunmetal-600">見積日</label>
              <DateInput
                value={issueDate}
                onChange={setIssueDate}
                required
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gunmetal-600">有効期限（任意）</label>
              <DateInput value={validUntil} onChange={setValidUntil} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gunmetal-600">状態</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="draft">draft</option>
              <option value="sent">sent</option>
              <option value="accepted">accepted</option>
              <option value="rejected">rejected</option>
            </select>
          </div>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="件名"
          />
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input
                className="col-span-5 rounded border px-2 py-1 text-sm"
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
          <p className="text-sm tabular-nums">
            合計: {formatJPY(data.total)}（税込内訳は保存後に再計算）
          </p>
          <div className="flex gap-2">
            <Link href="/sales/estimates" className="rounded border px-4 py-2 text-sm">
              一覧
            </Link>
            <button type="submit" className="rounded bg-navy-900 px-4 py-2 text-sm text-white">
              更新
            </button>
          </div>
        </form>
      </Card>
    </>
  );
}
