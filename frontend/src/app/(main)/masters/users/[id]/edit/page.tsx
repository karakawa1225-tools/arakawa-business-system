'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function UsersEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('sales');
  const [editPayrollCategory, setEditPayrollCategory] = useState('other');
  const [editAge, setEditAge] = useState('');
  const [editBaseGross, setEditBaseGross] = useState(0);
  const [editActive, setEditActive] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await api<Record<string, unknown>>(`/api/masters/users/${id}`);
        if (cancelled) return;
        setEmail(String(r.email ?? ''));
        setEditName(String(r.name ?? ''));
        setEditRole(String(r.role ?? 'sales'));
        setEditPayrollCategory(String(r.payroll_category ?? 'other'));
        const a = numOrNull(r.age_years);
        setEditAge(a === null ? '' : String(a));
        setEditBaseGross(Number(r.base_monthly_gross ?? 0) || 0);
        setEditActive(Boolean(r.active ?? true));
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : '読み込みエラー');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setErr('');
    try {
      await api(`/api/masters/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName,
          role: editRole,
          payrollCategory: editPayrollCategory,
          ageYears: editAge.trim() === '' ? null : editAge,
          baseMonthlyGross: editBaseGross,
          active: editActive,
        }),
      });
      router.push('/masters/users');
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'エラー');
    }
  }

  if (!id) {
    return <p className="text-sm text-gunmetal-600">ID が不正です。</p>;
  }

  if (loading) {
    return <p className="text-sm text-gunmetal-600">読み込み中…</p>;
  }

  return (
    <>
      <PageTitle title="ユーザー・編集" description="保存後、一覧に戻ります。" />
      <div className="mb-4">
        <Link href="/masters/users" className="text-sm text-navy-900 underline">
          ← 一覧へ
        </Link>
      </div>
      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}
      <Card className="max-w-xl">
        <p className="mb-3 text-xs text-gunmetal-600">メール: {email}</p>
        <form onSubmit={save} className="space-y-3 text-sm">
          <label className="block space-y-1">
            <span>氏名</span>
            <input
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </label>
          <label className="block space-y-1">
            <span>ロール</span>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="admin">管理者</option>
              <option value="sales">営業</option>
              <option value="accounting">経理</option>
              <option value="viewer">閲覧のみ</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span>給与区分</span>
            <select
              value={editPayrollCategory}
              onChange={(e) => setEditPayrollCategory(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="other">その他</option>
              <option value="employee">社員</option>
              <option value="officer">役員</option>
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-gunmetal-700">
              年齢
              <input
                type="number"
                min={15}
                max={100}
                placeholder="—"
                value={editAge}
                onChange={(e) => setEditAge(e.target.value)}
                className="mt-0.5 w-full rounded border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-gunmetal-700">
              月額支給・役員報酬（円）
              <input
                type="number"
                min={0}
                value={editBaseGross}
                onChange={(e) => setEditBaseGross(Number(e.target.value))}
                className="mt-0.5 w-full rounded border px-3 py-2 text-sm tabular-nums"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span>状態</span>
            <select
              value={editActive ? '1' : '0'}
              onChange={(e) => setEditActive(e.target.value === '1')}
              className="w-full rounded border px-3 py-2"
            >
              <option value="1">有効</option>
              <option value="0">無効</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" className="rounded bg-navy-900 px-4 py-2 text-sm text-white">
              保存
            </button>
            <Link href="/masters/users" className="rounded border px-4 py-2 text-sm">
              キャンセル
            </Link>
          </div>
        </form>
      </Card>
    </>
  );
}
