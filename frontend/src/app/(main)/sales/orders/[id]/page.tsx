'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { formatJPY } from '@/lib/format';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api<Record<string, unknown>>(`/api/orders/${id}`).then(setD);
  }, [id]);

  if (!d) return <p className="p-6">読み込み中…</p>;

  const lines = (d.lines as Record<string, unknown>[]) || [];

  return (
    <>
      <PageTitle title={`受注 ${String(d.order_no)}`} description="受注詳細" />
      <Card className="max-w-3xl">
        <p className="text-sm text-gunmetal-600">状態: {String(d.status)}</p>
        <p className="text-sm tabular-nums">合計: {formatJPY(d.total)}</p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gunmetal-600">
              <th className="py-2">内容</th>
              <th className="py-2">数量</th>
              <th className="py-2">単価</th>
              <th className="py-2">金額</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={String(l.id)} className="border-b border-slate-100">
                <td className="py-2">{String(l.description)}</td>
                <td className="py-2">{String(l.quantity)}</td>
                <td className="py-2 text-right tabular-nums">{formatJPY(l.unit_price)}</td>
                <td className="py-2 text-right tabular-nums">{formatJPY(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Link href="/sales/orders" className="mt-4 inline-block text-sm text-navy-800 underline">
          一覧へ
        </Link>
      </Card>
    </>
  );
}
