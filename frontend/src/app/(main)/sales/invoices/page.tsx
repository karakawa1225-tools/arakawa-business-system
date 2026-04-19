'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { formatDateJa, formatJPY } from '@/lib/format';

type Row = {
  id: string;
  invoice_no: string;
  status: string;
  issue_date: string;
  total: string;
  paid_amount: string;
  customer_name: string;
};

export default function InvoicesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    api<Row[]>('/api/invoices').then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <>
      <div className="mb-8 flex justify-between">
        <PageTitle title="請求一覧" />
        <Link href="/sales/invoices/new" className="rounded-lg bg-navy-900 px-4 py-2 text-sm text-white">
          請求作成
        </Link>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left">番号</th>
              <th className="px-4 py-3 text-left">顧客</th>
              <th className="px-4 py-3 text-left">日付</th>
              <th className="px-4 py-3 text-left">状態</th>
              <th className="px-4 py-3 text-right">合計</th>
              <th className="px-4 py-3 text-right">入金済</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-4 py-3">{r.invoice_no}</td>
                <td className="px-4 py-3">{r.customer_name}</td>
                <td className="px-4 py-3">{formatDateJa(r.issue_date)}</td>
                <td className="px-4 py-3">{r.status}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatJPY(r.total)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatJPY(r.paid_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
