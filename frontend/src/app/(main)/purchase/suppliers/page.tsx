'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';

type Row = Record<string, unknown>;

export default function SuppliersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    api<Row[]>('/api/suppliers').then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <>
      <div className="mb-8 flex justify-between">
        <PageTitle title="仕入先一覧" />
        <Link href="/purchase/suppliers/new" className="rounded-lg bg-navy-900 px-4 py-2 text-sm text-white">
          仕入先登録
        </Link>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left">コード</th>
              <th className="px-4 py-3 text-left">仕入先名</th>
              <th className="px-4 py-3 text-left">電話</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b border-slate-100">
                <td className="px-4 py-3">{String(r.supplier_code)}</td>
                <td className="px-4 py-3">{String(r.name)}</td>
                <td className="px-4 py-3">{String(r.phone ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
