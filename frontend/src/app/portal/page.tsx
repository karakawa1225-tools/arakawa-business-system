'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiBaseUrl, getCustomerToken, setCustomerToken } from '@/lib/api';
import { formatDateJa, formatJPY } from '@/lib/format';

const DATE_COLS = new Set(['issue_date', 'order_date', 'payment_date']);

function cellLabel(col: string, val: unknown): string {
  if (val == null || val === '') return '';
  if (DATE_COLS.has(col)) return formatDateJa(val);
  if (col === 'total' || col === 'paid_amount' || col === 'amount') return formatJPY(val);
  return String(val);
}

type Summary = {
  estimates: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  payments: Record<string, unknown>[];
};

export default function PortalPage() {
  const router = useRouter();
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    const t = getCustomerToken();
    if (!t) {
      router.replace('/portal/login');
      return;
    }
    fetch(`${apiBaseUrl()}/api/portal/summary`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error('認証エラー');
        return r.json();
      })
      .then(setData)
      .catch(() => router.replace('/portal/login'));
  }, [router]);

  if (!data) {
    return <div className="flex min-h-screen items-center justify-center">読み込み中…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-navy-950">マイページ</h1>
          <button
            type="button"
            onClick={() => {
              setCustomerToken(null);
              router.push('/portal/login');
            }}
            className="text-sm text-gunmetal-600 hover:text-navy-900"
          >
            ログアウト
          </button>
        </div>
        <Section title="見積履歴" rows={data.estimates} cols={['estimate_no', 'issue_date', 'total', 'status']} />
        <Section title="注文履歴" rows={data.orders} cols={['order_no', 'order_date', 'total', 'status']} />
        <Section title="請求" rows={data.invoices} cols={['invoice_no', 'issue_date', 'total', 'paid_amount', 'status']} />
        <Section title="入金" rows={data.payments} cols={['payment_no', 'payment_date', 'amount']} />
        <p className="mt-8 text-center text-xs">
          <Link href="/login" className="text-navy-800 hover:underline">
            社内システムへ
          </Link>
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  rows,
  cols,
}: {
  title: string;
  rows: Record<string, unknown>[];
  cols: string[];
}) {
  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <h2 className="text-sm font-semibold text-navy-900">{title}</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gunmetal-500">
              {cols.map((c) => (
                <th key={c} className="py-2 pr-4">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-t border-slate-100">
                {cols.map((c) => (
                  <td key={c} className="py-2 pr-4">
                    {cellLabel(c, r[c])}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="py-4 text-gunmetal-500">
                  データなし
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
