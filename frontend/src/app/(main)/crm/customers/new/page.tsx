'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';

export default function NewCustomerPage() {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [f, setF] = useState({
    customerCode: '',
    companyName: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    closingDay: '' as string,
    paymentTerms: '',
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api('/api/customers', {
        method: 'POST',
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
      });
      router.push('/crm/customers');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'エラー');
    }
  }

  return (
    <>
      <PageTitle title="顧客登録" />
      <Card className="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="顧客コード *" value={f.customerCode} onChange={(v) => setF({ ...f, customerCode: v })} />
            <Field label="会社名 *" value={f.companyName} onChange={(v) => setF({ ...f, companyName: v })} />
            <Field label="担当者" value={f.contactName} onChange={(v) => setF({ ...f, contactName: v })} />
            <Field label="電話" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} />
            <Field label="メール" type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} />
            <Field label="締日" value={f.closingDay} onChange={(v) => setF({ ...f, closingDay: v })} />
          </div>
          <div>
            <label className="text-xs text-gunmetal-600">住所</label>
            <textarea
              value={f.address}
              onChange={(e) => setF({ ...f, address: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={2}
            />
          </div>
          <Field label="支払サイト" value={f.paymentTerms} onChange={(v) => setF({ ...f, paymentTerms: v })} />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <Link href="/crm/customers" className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
              キャンセル
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

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-gunmetal-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
    </div>
  );
}
