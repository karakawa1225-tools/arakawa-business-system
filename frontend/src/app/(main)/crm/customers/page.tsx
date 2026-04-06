'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';

type Customer = {
  id: string;
  customer_code: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
};

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);

  useEffect(() => {
    api<Customer[]>('/api/customers').then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <>
      <div className="mb-8 flex items-start justify-between">
        <PageTitle title="顧客一覧" description="顧客マスタ" />
        <Link
          href="/crm/customers/new"
          className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800"
        >
          顧客登録
        </Link>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 font-medium text-gunmetal-600">コード</th>
              <th className="px-4 py-3 font-medium text-gunmetal-600">会社名</th>
              <th className="px-4 py-3 font-medium text-gunmetal-600">担当者</th>
              <th className="px-4 py-3 font-medium text-gunmetal-600">電話</th>
              <th className="px-4 py-3 font-medium text-gunmetal-600">メール</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <Link href={`/crm/customers/${c.id}`} className="text-navy-800 hover:underline">
                    {c.customer_code}
                  </Link>
                </td>
                <td className="px-4 py-3">{c.company_name}</td>
                <td className="px-4 py-3 text-gunmetal-600">{c.contact_name ?? '—'}</td>
                <td className="px-4 py-3 text-gunmetal-600">{c.phone ?? '—'}</td>
                <td className="px-4 py-3 text-gunmetal-600">{c.email ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gunmetal-500">
                  顧客がまだありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
