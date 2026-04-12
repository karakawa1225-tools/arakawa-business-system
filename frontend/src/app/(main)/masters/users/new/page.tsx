'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminGate } from '@/components/admin/AdminGate';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';

export default function UsersNewPage() {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [f, setF] = useState({
    email: '',
    password: '',
    name: '',
    role: 'sales',
    payrollCategory: 'other',
    ageYears: '',
    baseMonthlyGross: 0,
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api('/api/masters/users', {
        method: 'POST',
        body: JSON.stringify({
          ...f,
          ageYears: f.ageYears.trim() === '' ? undefined : f.ageYears,
          baseMonthlyGross: f.baseMonthlyGross,
        }),
      });
      router.push('/masters/users');
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'エラー');
    }
  }

  return (
    <AdminGate>
      <PageTitle title="ユーザー・新規" description="登録後、一覧に戻ります。" />
      <div className="mb-4">
        <Link href="/masters/users" className="text-sm text-navy-900 underline">
          ← 一覧へ
        </Link>
      </div>
      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}
      <Card className="max-w-xl space-y-2">
        <form onSubmit={add} className="space-y-2">
          <input
            required
            placeholder="氏名"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <input
            required
            type="email"
            placeholder="メール"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <input
            required
            type="password"
            placeholder="パスワード"
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <select
            value={f.role}
            onChange={(e) => setF({ ...f, role: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          >
            <option value="admin">管理者</option>
            <option value="sales">営業</option>
            <option value="accounting">経理</option>
            <option value="viewer">閲覧のみ</option>
          </select>
          <select
            value={f.payrollCategory}
            onChange={(e) => setF({ ...f, payrollCategory: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          >
            <option value="other">その他（給与計算対象外）</option>
            <option value="employee">社員</option>
            <option value="officer">役員</option>
          </select>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-gunmetal-700">
              年齢（介護判定・給与デフォルト）
              <input
                type="number"
                min={15}
                max={100}
                placeholder="未設定可"
                value={f.ageYears}
                onChange={(e) => setF({ ...f, ageYears: e.target.value })}
                className="mt-0.5 w-full rounded border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-gunmetal-700">
              月額支給・役員報酬（円・初期値）
              <input
                type="number"
                min={0}
                value={f.baseMonthlyGross || ''}
                onChange={(e) => setF({ ...f, baseMonthlyGross: Number(e.target.value) })}
                className="mt-0.5 w-full rounded border px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" className="rounded bg-navy-900 px-4 py-2 text-sm text-white">
              追加
            </button>
            <Link href="/masters/users" className="rounded border px-4 py-2 text-sm">
              キャンセル
            </Link>
          </div>
        </form>
      </Card>
    </AdminGate>
  );
}
