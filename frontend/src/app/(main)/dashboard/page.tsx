'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';

type Stats = {
  todaySales: string;
  monthSales: string;
  unpaidAmount: string;
  pendingEstimates: number;
  monthlyInvoiceTotals: { m: string; total: string }[];
  monthlyPaymentTotals: { m: string; total: string }[];
};

function formatYen(n: string | number) {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (Number.isNaN(v)) return '¥0';
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(v);
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api<Stats>('/api/dashboard/stats').then(setStats).catch(() => setStats(null));
  }, []);

  const chartData =
    stats?.monthlyInvoiceTotals.map((row) => ({
      month: row.m,
      請求: parseFloat(row.total),
      入金:
        parseFloat(stats.monthlyPaymentTotals.find((p) => p.m === row.m)?.total ?? '0') || 0,
    })) ?? [];

  return (
    <>
      <PageTitle title="Dashboard" description="今日の数字と売上トレンド" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-gunmetal-500">今日の入金</p>
          <p className="mt-2 text-2xl font-semibold text-navy-950">
            {stats ? formatYen(stats.todaySales) : '—'}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-gunmetal-500">今月の入金</p>
          <p className="mt-2 text-2xl font-semibold text-navy-950">
            {stats ? formatYen(stats.monthSales) : '—'}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-gunmetal-500">未入金</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">
            {stats ? formatYen(stats.unpaidAmount) : '—'}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-gunmetal-500">未処理見積</p>
          <p className="mt-2 text-2xl font-semibold text-navy-950">
            {stats ? `${stats.pendingEstimates} 件` : '—'}
          </p>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-1">
        <Card className="min-h-[320px]">
          <h2 className="text-sm font-semibold text-navy-900">月別売上・入金状況</h2>
          <p className="text-xs text-gunmetal-500">直近12ヶ月（請求合計と入金）</p>
          <div className="mt-6 h-[260px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                  <Tooltip
                    formatter={(v: number) => formatYen(v)}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  <Bar dataKey="請求" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="入金" fill="#64748b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-gunmetal-500">
                データがありません
              </p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
