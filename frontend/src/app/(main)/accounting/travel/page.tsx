'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { formatJPY } from '@/lib/format';

type ClaimRow = {
  id: string;
  applicant_name: string;
  destination: string;
  date_start: string;
  date_end: string;
  status: string;
  lines_total: string | number;
};

const statusLabel: Record<string, string> = {
  draft: '下書き',
  submitted: '提出済',
  approved: '承認済',
};

export default function TravelExpenseHubPage() {
  const [rows, setRows] = useState<ClaimRow[]>([]);

  useEffect(() => {
    void api<ClaimRow[]>('/api/travel-expenses/claims').then(setRows);
  }, []);

  return (
    <>
      <PageTitle
        title="出張旅費"
        description="規程に沿った区分で精算を登録します。規程のひな型は別画面で確認・会社別の追記を保存できます。"
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/accounting/travel/new"
          className="inline-flex rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white"
        >
          新規精算
        </Link>
        <Link
          href="/accounting/travel/regulation"
          className="inline-flex rounded-lg border border-navy-900 px-4 py-2 text-sm text-navy-900"
        >
          出張旅費規程（ひな型）
        </Link>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left">申請者</th>
              <th className="px-4 py-3 text-left">行先</th>
              <th className="px-4 py-3 text-left">期間</th>
              <th className="px-4 py-3 text-left">状態</th>
              <th className="px-4 py-3 text-right">合計</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gunmetal-600">
                  精算データはまだありません。「新規精算」から登録してください。
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-4 py-3">{r.applicant_name}</td>
                  <td className="px-4 py-3">{r.destination}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {String(r.date_start).slice(0, 10)} ～ {String(r.date_end).slice(0, 10)}
                  </td>
                  <td className="px-4 py-3">{statusLabel[r.status] ?? r.status}</td>
                  <td className="px-4 py-3 text-right">{formatJPY(r.lines_total)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/accounting/travel/${r.id}`} className="rounded border px-3 py-1.5 text-xs">
                      編集
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
