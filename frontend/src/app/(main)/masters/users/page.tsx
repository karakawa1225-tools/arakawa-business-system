'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminGate } from '@/components/admin/AdminGate';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api, apiDelete } from '@/lib/api';
import { formatJPY } from '@/lib/format';

export default function UsersMasterPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [err, setErr] = useState('');

  async function load() {
    setErr('');
    try {
      const data = await api<Record<string, unknown>[]>('/api/masters/users');
      setRows(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '読み込みエラー');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function deactivate(id: string) {
    if (!window.confirm('このユーザーを無効化しますか？')) return;
    setErr('');
    try {
      await apiDelete(`/api/masters/users/${id}`);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'エラー');
    }
  }

  return (
    <AdminGate>
      <PageTitle
        title="ユーザー管理"
        description="ログインアカウントの追加・変更はこの画面のみです。新規は「新規ユーザー」から登録し、保存後に一覧へ戻ります。"
      />
      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-gunmetal-700">年齢・月額支給は給与登録の初期値に使われます。</p>
        <Link href="/masters/users/new" className="rounded bg-navy-900 px-4 py-2 text-sm text-white">
          新規ユーザー
        </Link>
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b bg-slate-50/80">
            <tr>
              <th className="px-3 py-3 text-left">名前</th>
              <th className="px-3 py-3 text-left">メール</th>
              <th className="px-3 py-3 text-left">ロール</th>
              <th className="px-3 py-3 text-left">給与区分</th>
              <th className="px-3 py-3 text-right">年齢</th>
              <th className="px-3 py-3 text-right">月額(初期)</th>
              <th className="px-3 py-3 text-left">状態</th>
              <th className="px-3 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b border-slate-100">
                <td className="px-3 py-3">{String(r.name)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{String(r.email)}</td>
                <td className="px-3 py-3">{String(r.role)}</td>
                <td className="px-3 py-3">
                  {r.payroll_category === 'employee'
                    ? '社員'
                    : r.payroll_category === 'officer'
                      ? '役員'
                      : 'その他'}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {r.age_years != null && r.age_years !== '' ? String(r.age_years) : '—'}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatJPY(Number(r.base_monthly_gross ?? 0) || 0)}
                </td>
                <td className="px-3 py-3">{Boolean(r.active ?? true) ? '有効' : '無効'}</td>
                <td className="px-3 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/masters/users/${String(r.id)}/edit`}
                      className="rounded border px-3 py-1.5 text-xs"
                    >
                      編集
                    </Link>
                    <button
                      type="button"
                      onClick={() => deactivate(String(r.id))}
                      className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-700"
                    >
                      無効化
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AdminGate>
  );
}
