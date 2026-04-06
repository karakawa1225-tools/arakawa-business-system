'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import Link from 'next/link';

type EligibleUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  payroll_category: string;
  age_years: number | null;
  base_monthly_gross: string;
};

type PayrollEntryRow = {
  id: string;
  user_id: string;
  payroll_category: string;
  monthly_gross: string;
  grade_basis_amount: string;
  age_years: number;
  withholding_tax: string;
  resident_tax: string;
  notes: string | null;
};

const DEFAULT_AGE = 35;

function num(s: string | number) {
  const n = typeof s === 'string' ? Number(s) : s;
  return Number.isFinite(n) ? n : 0;
}

export function PayrollEntryForm({
  month,
  entryId,
  initialUserId,
}: {
  month: string;
  entryId?: string;
  initialUserId?: string | null;
}) {
  const router = useRouter();
  const [y, m] = month.split('-').map(Number);
  const [eligible, setEligible] = useState<EligibleUser[]>([]);
  const [err, setErr] = useState('');
  const [userId, setUserId] = useState('');
  const [category, setCategory] = useState<'employee' | 'officer'>('employee');
  const [wages, setWages] = useState(0);
  const [gradeBasis, setGradeBasis] = useState(0);
  const [age, setAge] = useState(DEFAULT_AGE);
  const [withholdingTax, setWithholdingTax] = useState(0);
  const [residentTax, setResidentTax] = useState(0);
  const [notes, setNotes] = useState('');
  const [loadingEntry, setLoadingEntry] = useState(!!entryId);

  const loadEligible = useCallback(async () => {
    const u = await api<EligibleUser[]>('/api/payroll/eligible-users');
    setEligible(u);
    return u;
  }, []);

  function applyUserDefaults(u: EligibleUser | undefined) {
    if (!u) return;
    setCategory(u.payroll_category === 'officer' ? 'officer' : 'employee');
    const base = Number(u.base_monthly_gross) || 0;
    setWages(base);
    setGradeBasis(base);
    const a = u.age_years;
    setAge(a != null && Number.isFinite(Number(a)) ? Number(a) : DEFAULT_AGE);
  }

  useEffect(() => {
    setErr('');
    void (async () => {
      try {
        const u = await loadEligible();
        if (!entryId) {
          const pick =
            (initialUserId && u.find((x) => x.id === initialUserId)) || u[0];
          if (pick) {
            setUserId(pick.id);
            applyUserDefaults(pick);
          }
        }
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : '読み込みエラー');
      }
    })();
  }, [entryId, initialUserId, loadEligible]);

  useEffect(() => {
    if (!entryId) {
      setLoadingEntry(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const row = await api<PayrollEntryRow>(`/api/payroll/entries/${entryId}`);
        if (cancelled) return;
        setUserId(row.user_id);
        setCategory(row.payroll_category === 'officer' ? 'officer' : 'employee');
        setWages(num(row.monthly_gross));
        setGradeBasis(num(row.grade_basis_amount));
        setAge(row.age_years);
        setWithholdingTax(num(row.withholding_tax));
        setResidentTax(num(row.resident_tax));
        setNotes(row.notes ?? '');
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : '読み込みエラー');
      } finally {
        if (!cancelled) setLoadingEntry(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  function onPickUser(id: string) {
    setUserId(id);
    applyUserDefaults(eligible.find((x) => x.id === id));
  }

  async function saveEntry(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      if (entryId) {
        await api(`/api/payroll/entries/${entryId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            payrollCategory: category,
            monthlyGross: wages,
            gradeBasisAmount: gradeBasis,
            ageYears: age,
            withholdingTax,
            residentTax,
            notes: notes || null,
          }),
        });
      } else {
        await api('/api/payroll/entries', {
          method: 'POST',
          body: JSON.stringify({
            userId,
            year: y,
            month: m,
            payrollCategory: category,
            monthlyGross: wages,
            gradeBasisAmount: gradeBasis,
            ageYears: age,
            withholdingTax,
            residentTax,
            notes: notes || undefined,
          }),
        });
      }
      router.push(`/accounting/payroll?month=${encodeURIComponent(month)}`);
      router.refresh();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '保存エラー');
    }
  }

  if (loadingEntry) {
    return <p className="text-sm text-gunmetal-600">読み込み中…</p>;
  }

  return (
    <Card className="max-w-xl">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/accounting/payroll?month=${encodeURIComponent(month)}`} className="text-navy-900 underline">
          ← 一覧へ
        </Link>
        <span className="text-gunmetal-500">{y}年{m}月</span>
      </div>
      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}
      <h2 className="mb-2 text-sm font-semibold text-navy-900">
        {entryId ? '登録の修正' : '新規登録'}（{y}年{m}月）
      </h2>
      {!entryId && (
        <p className="mb-3 text-xs text-gunmetal-600">
          対象者を選ぶと、ユーザー管理の「月額支給・役員報酬」「年齢」がフォームに入ります（年齢未設定時は35歳として計算。マスタで設定を推奨）。
        </p>
      )}
      <form onSubmit={saveEntry} className="space-y-3 text-sm">
        <label className="block space-y-1">
          <span className="text-gunmetal-700">対象者</span>
          <select
            value={userId}
            onChange={(e) => onPickUser(e.target.value)}
            className="w-full rounded border px-3 py-2"
            disabled={!!entryId}
          >
            {eligible.length === 0 && <option value="">（社員・役員のユーザーがいません）</option>}
            {eligible.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}（{u.payroll_category === 'officer' ? '役員' : '社員'}）
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-gunmetal-700">給与区分</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as 'employee' | 'officer')}
            className="w-full rounded border px-3 py-2"
          >
            <option value="employee">社員（雇用保険あり）</option>
            <option value="officer">役員（雇用保険なし）</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-gunmetal-700">総支給額（賃金・円）</span>
          <input
            type="number"
            min={0}
            className="w-full rounded border px-3 py-2"
            value={wages}
            onChange={(e) => setWages(Number(e.target.value))}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-gunmetal-700">報酬月額（等級決定・円）</span>
          <input
            type="number"
            min={0}
            className="w-full rounded border px-3 py-2"
            value={gradeBasis}
            onChange={(e) => setGradeBasis(Number(e.target.value))}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-gunmetal-700">年齢（登録時にスナップショット保存）</span>
          <input
            type="number"
            min={15}
            max={100}
            className="w-full rounded border px-3 py-2"
            value={age}
            onChange={(e) => setAge(Number(e.target.value))}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-gunmetal-700">源泉所得税（月額）</span>
          <input
            type="number"
            min={0}
            className="w-full rounded border px-3 py-2"
            value={withholdingTax}
            onChange={(e) => setWithholdingTax(Number(e.target.value))}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-gunmetal-700">住民税（月額）</span>
          <input
            type="number"
            min={0}
            className="w-full rounded border px-3 py-2"
            value={residentTax}
            onChange={(e) => setResidentTax(Number(e.target.value))}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-gunmetal-700">備考（明細PDF）</span>
          <input
            className="w-full rounded border px-3 py-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="任意"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="rounded bg-navy-900 px-4 py-2 text-sm text-white">
            保存（計算して登録）
          </button>
          <Link
            href={`/accounting/payroll?month=${encodeURIComponent(month)}`}
            className="rounded border px-4 py-2 text-sm"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </Card>
  );
}
