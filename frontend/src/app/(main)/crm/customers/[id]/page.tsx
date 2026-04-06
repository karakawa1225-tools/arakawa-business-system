'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api, apiDelete } from '@/lib/api';
import { runSave } from '@/lib/save';

type Customer = Record<string, unknown>;

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<Customer | null>(null);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({
    customerCode: '',
    companyName: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    closingDay: '',
    paymentTerms: '',
  });

  useEffect(() => {
    api<Customer>(`/api/customers/${id}`).then((row) => {
      setC(row);
      setF({
        customerCode: String(row.customer_code ?? ''),
        companyName: String(row.company_name ?? ''),
        contactName: String(row.contact_name ?? ''),
        phone: String(row.phone ?? ''),
        email: String(row.email ?? ''),
        address: String(row.address ?? ''),
        closingDay: row.closing_day != null ? String(row.closing_day) : '',
        paymentTerms: String(row.payment_terms ?? ''),
      });
    });
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await runSave(
      () =>
        api(`/api/customers/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            customerCode: f.customerCode,
            companyName: f.companyName,
            contactName: f.contactName || null,
            phone: f.phone || null,
            email: f.email || null,
            address: f.address || null,
            closingDay: f.closingDay ? Number(f.closingDay) : null,
            paymentTerms: f.paymentTerms || null,
          }),
        }),
      async () => {
        const row = await api<Customer>(`/api/customers/${id}`);
        setC(row);
        setF({
          customerCode: String(row.customer_code ?? ''),
          companyName: String(row.company_name ?? ''),
          contactName: String(row.contact_name ?? ''),
          phone: String(row.phone ?? ''),
          email: String(row.email ?? ''),
          address: String(row.address ?? ''),
          closingDay: row.closing_day != null ? String(row.closing_day) : '',
          paymentTerms: String(row.payment_terms ?? ''),
        });
        setEdit(false);
      }
    );
  }

  async function remove() {
    if (!confirm('削除しますか？')) return;
    try {
      await apiDelete(`/api/customers/${id}`);
      router.push('/crm/customers');
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '削除に失敗しました');
    }
  }

  if (!c) return <p className="p-6">読み込み中…</p>;

  return (
    <>
      <div className="mb-8 flex justify-between">
        <PageTitle title={String(c.company_name)} description={`コード: ${String(c.customer_code)}`} />
        <div className="flex gap-2">
          <Link href="/crm/customers" className="text-sm text-navy-800 hover:underline">
            一覧へ
          </Link>
        </div>
      </div>
      <Card className="max-w-2xl">
        {!edit ? (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-gunmetal-500">担当者:</span> {String(c.contact_name ?? '—')}
            </p>
            <p>
              <span className="text-gunmetal-500">電話:</span> {String(c.phone ?? '—')}
            </p>
            <p>
              <span className="text-gunmetal-500">メール:</span> {String(c.email ?? '—')}
            </p>
            <p>
              <span className="text-gunmetal-500">住所:</span> {String(c.address ?? '—')}
            </p>
            <p>
              <span className="text-gunmetal-500">締日:</span> {String(c.closing_day ?? '—')}
            </p>
            <p>
              <span className="text-gunmetal-500">支払サイト:</span> {String(c.payment_terms ?? '—')}
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setEdit(true)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                編集
              </button>
              <button type="button" onClick={remove} className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700">
                削除
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={f.customerCode}
              onChange={(e) => setF({ ...f, customerCode: e.target.value })}
            />
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={f.companyName}
              onChange={(e) => setF({ ...f, companyName: e.target.value })}
            />
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={f.contactName}
              onChange={(e) => setF({ ...f, contactName: e.target.value })}
            />
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={f.phone}
              onChange={(e) => setF({ ...f, phone: e.target.value })}
            />
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
            />
            <textarea
              className="w-full rounded border px-3 py-2 text-sm"
              value={f.address}
              onChange={(e) => setF({ ...f, address: e.target.value })}
              rows={2}
            />
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={f.closingDay}
              onChange={(e) => setF({ ...f, closingDay: e.target.value })}
            />
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={f.paymentTerms}
              onChange={(e) => setF({ ...f, paymentTerms: e.target.value })}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setEdit(false)} className="rounded border px-4 py-2 text-sm">
                戻る
              </button>
              <button type="submit" className="rounded bg-navy-900 px-4 py-2 text-sm text-white">
                保存
              </button>
            </div>
          </form>
        )}
      </Card>
    </>
  );
}
