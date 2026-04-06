'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { api, apiDelete } from '@/lib/api';
import { runSave } from '@/lib/save';
import { formatJPY } from '@/lib/format';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { TRAVEL_LINE_CATEGORIES, type TravelLineCategory } from '../_lib/categories';

type LineRow = { category: TravelLineCategory; description: string; amount: number };

function emptyLine(): LineRow {
  return { category: 'transport', description: '', amount: 0 };
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function TravelClaimForm({ claimId }: { claimId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(!!claimId);
  const [applicantName, setApplicantName] = useState('');
  const [department, setDepartment] = useState('');
  const [destination, setDestination] = useState('');
  const [purpose, setPurpose] = useState('');
  const [dateStart, setDateStart] = useState(todayISO);
  const [dateEnd, setDateEnd] = useState(todayISO);
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineRow[]>([emptyLine()]);

  useEffect(() => {
    if (!claimId) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await api<Record<string, unknown>>(`/api/travel-expenses/claims/${claimId}`);
        if (cancelled) return;
        setApplicantName(String(row.applicant_name ?? ''));
        setDepartment(String(row.department ?? ''));
        setDestination(String(row.destination ?? ''));
        setPurpose(String(row.purpose ?? ''));
        setDateStart(String(row.date_start ?? '').slice(0, 10));
        setDateEnd(String(row.date_end ?? '').slice(0, 10));
        setStatus(String(row.status ?? 'draft'));
        setNotes(String(row.notes ?? ''));
        const rawLines = row.lines as Record<string, unknown>[] | undefined;
        if (Array.isArray(rawLines) && rawLines.length > 0) {
          const validCats = new Set(TRAVEL_LINE_CATEGORIES.map((c) => c.value));
          setLines(
            rawLines.map((l) => {
              const cat = String(l.category ?? '');
              const category = (validCats.has(cat as TravelLineCategory) ? cat : 'other') as TravelLineCategory;
              return {
                category,
                description: String(l.description ?? ''),
                amount: Number(l.amount ?? 0),
              };
            })
          );
        } else {
          setLines([emptyLine()]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [claimId]);

  const linesTotal = lines.reduce((s, l) => s + (Number.isFinite(l.amount) ? l.amount : 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      applicantName,
      department: department || null,
      destination,
      purpose,
      dateStart,
      dateEnd,
      status,
      notes: notes || null,
      lines: lines.map((l) => ({
        category: l.category,
        description: l.description || null,
        amount: l.amount,
      })),
    };
    const ok = await runSave(
      () =>
        claimId
          ? api(`/api/travel-expenses/claims/${claimId}`, { method: 'PATCH', body: JSON.stringify(body) })
          : api('/api/travel-expenses/claims', { method: 'POST', body: JSON.stringify(body) }),
      async () => {
        router.push('/accounting/travel');
        router.refresh();
      }
    );
    if (!ok) return;
  }

  async function remove() {
    if (!claimId) return;
    if (!window.confirm('この精算を削除しますか？')) return;
    const ok = await runSave(() => apiDelete(`/api/travel-expenses/claims/${claimId}`), async () => {
      router.push('/accounting/travel');
      router.refresh();
    });
    if (!ok) return;
  }

  if (loading) {
    return <p className="text-sm text-gunmetal-600">読み込み中…</p>;
  }

  return (
    <Card className="max-w-3xl">
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs text-gunmetal-600">申請者名</label>
            <input
              required
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gunmetal-600">部署</label>
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gunmetal-600">ステータス</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            >
              <option value="draft">下書き</option>
              <option value="submitted">提出済</option>
              <option value="approved">承認済</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-gunmetal-600">行先</label>
            <input
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-gunmetal-600">目的</label>
            <textarea
              required
              rows={2}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gunmetal-600">出発日</label>
            <input
              type="date"
              required
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gunmetal-600">帰着日</label>
            <input
              type="date"
              required
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-gunmetal-600">備考</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium">精算明細（規程の区分に沿って入力）</h3>
            <button
              type="button"
              onClick={() => setLines((p) => [...p, emptyLine()])}
              className="rounded border px-3 py-1 text-xs"
            >
              行を追加
            </button>
          </div>
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="flex flex-wrap items-end gap-2 rounded border border-slate-100 bg-slate-50/50 p-2">
                <div className="min-w-[8rem] flex-1">
                  <span className="text-[10px] text-gunmetal-600">区分</span>
                  <select
                    value={line.category}
                    onChange={(e) =>
                      setLines((p) => {
                        const next = [...p];
                        next[idx] = { ...next[idx]!, category: e.target.value as TravelLineCategory };
                        return next;
                      })
                    }
                    className="mt-0.5 w-full rounded border px-2 py-1.5 text-sm"
                  >
                    {TRAVEL_LINE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[10rem] flex-[2]">
                  <span className="text-[10px] text-gunmetal-600">内容</span>
                  <input
                    value={line.description}
                    onChange={(e) =>
                      setLines((p) => {
                        const next = [...p];
                        next[idx] = { ...next[idx]!, description: e.target.value };
                        return next;
                      })
                    }
                    className="mt-0.5 w-full rounded border px-2 py-1.5 text-sm"
                    placeholder="例：新幹線 ○○→△△"
                  />
                </div>
                <div className="w-28">
                  <span className="text-[10px] text-gunmetal-600">金額</span>
                  <CurrencyInput
                    value={line.amount}
                    onChange={(n) =>
                      setLines((p) => {
                        const next = [...p];
                        next[idx] = { ...next[idx]!, amount: n };
                        return next;
                      })
                    }
                    className="mt-0.5 w-full rounded border px-2 py-1.5 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setLines((p) => (p.length <= 1 ? p : p.filter((_, i) => i !== idx)))}
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-right text-sm font-medium text-navy-900">明細合計 {formatJPY(linesTotal)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="rounded bg-navy-900 px-4 py-2 text-sm text-white">
            {claimId ? '更新' : '登録'}
          </button>
          <button type="button" onClick={() => router.push('/accounting/travel')} className="rounded border px-4 py-2 text-sm">
            一覧へ
          </button>
          {claimId ? (
            <button type="button" onClick={() => void remove()} className="rounded border border-red-300 px-4 py-2 text-sm text-red-700">
              削除
            </button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
