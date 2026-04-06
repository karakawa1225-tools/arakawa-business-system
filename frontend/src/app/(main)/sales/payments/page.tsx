'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { formatDateJa, formatJPY } from '@/lib/format';

type Row = {
  id: string;
  payment_no: string;
  payment_date: string;
  amount: string;
  customer_name: string;
};

export default function PaymentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    api<Row[]>('/api/payments').then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <>
      <div className="mb-8 flex justify-between">
        <PageTitle title="入金一覧" />
        <Link href="/sales/payments/new" className="rounded-lg bg-navy-900 px-4 py-2 text-sm text-white">
          入金登録
        </Link>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left">番号</th>
              <th className="px-4 py-3 text-left">顧客</th>
              <th className="px-4 py-3 text-left">日付</th>
              <th className="px-4 py-3 text-right">金額</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-4 py-3">{r.payment_no}</td>
                <td className="px-4 py-3">{r.customer_name}</td>
                <td className="px-4 py-3">{formatDateJa(r.payment_date)}</td>
                <td className="px-4 py-3 text-right">{formatJPY(r.amount)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/sales/payments/${r.id}`} className="text-sm text-navy-800 underline">
                    編集
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
