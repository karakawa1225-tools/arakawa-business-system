'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { formatDateJa } from '@/lib/format';

type Row = {
  id: string;
  order_no: string;
  status: string;
  order_date: string;
  total: string;
  customer_name: string;
};

export default function OrdersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    api<Row[]>('/api/orders').then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <>
      <PageTitle title="受注一覧" />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left">受注番号</th>
              <th className="px-4 py-3 text-left">顧客</th>
              <th className="px-4 py-3 text-left">日付</th>
              <th className="px-4 py-3 text-left">状態</th>
              <th className="px-4 py-3 text-right">合計</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-4 py-3">
                  <Link href={`/sales/orders/${r.id}`} className="text-navy-800 hover:underline">
                    {r.order_no}
                  </Link>
                </td>
                <td className="px-4 py-3">{r.customer_name}</td>
                <td className="px-4 py-3">{formatDateJa(r.order_date)}</td>
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
