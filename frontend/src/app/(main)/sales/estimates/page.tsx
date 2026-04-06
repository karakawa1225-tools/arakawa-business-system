'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { formatDateJa } from '@/lib/format';

type Row = {
  id: string;
  estimate_no: string;
  title: string | null;
  status: string;
  issue_date: string;
  total: string;
  customer_name: string;
};

export default function EstimatesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    api<Row[]>('/api/estimates').then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <>
      <div className="mb-8 flex justify-between">
        <PageTitle title="見積一覧" />
        <Link href="/sales/estimates/new" className="rounded-lg bg-navy-900 px-4 py-2 text-sm text-white">
          見積作成
        </Link>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left">番号</th>
              <th className="px-4 py-3 text-left">顧客</th>
              <th className="px-4 py-3 text-left">件名</th>
              <th className="px-4 py-3 text-left">日付</th>
              <th className="px-4 py-3 text-left">状態</th>
              <th className="px-4 py-3 text-right">合計</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-4 py-3">
                  <Link href={`/sales/estimates/${r.id}`} className="text-navy-800 hover:underline">
                    {r.estimate_no}
                  </Link>
                </td>
                <td className="px-4 py-3">{r.customer_name}</td>
                <td className="px-4 py-3">{r.title ?? '—'}</td>
                <td className="px-4 py-3">{formatDateJa(r.issue_date)}</td>
                <td className="px-4 py-3">{r.status}</td>
                <td className="px-4 py-3 text-right">¥{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
