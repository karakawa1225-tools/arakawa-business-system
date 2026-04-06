'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { MonthInput } from '@/components/ui/MonthInput';
import { api, apiBlob, apiDelete } from '@/lib/api';
import { triggerBlobDownload } from '@/lib/downloadBlob';
import { currentYearMonthLocal, formatJPY } from '@/lib/format';

type EligibleUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  payroll_category: string;
  age_years: number | null;
  base_monthly_gross: string;
};

type Rates = {
  fiscalYearLabel: string;
  healthInsuranceTotalRate: number;
  careInsuranceTotalRate: number;
  pensionInsuranceTotalRate: number;
  employmentInsuranceEmployeeRateGeneral: number;
};

type PayrollEntryRow = {
  id: string;
  user_id: string;
  user_name: string;
  period_month_iso: string;
  payroll_category: string;
  monthly_gross: string;
  grade_basis_amount: string;
  age_years: number;
  withholding_tax: string;
  resident_tax: string;
  standard_monthly_remuneration: string;
  grade: number;
  health_insurance: string;
  pension_insurance: string;
  care_insurance: string;
  employment_insurance: string;
  employment_insurance_applicable: boolean;
  social_insurance_total: string;
  total_deductions: string;
  net_pay: string;
  rate_snapshot_label: string | null;
  notes: string | null;
};

function catJa(c: string) {
  if (c === 'employee') return '社員';
  if (c === 'officer') return '役員';
  return c;
}

function num(s: string | number) {
  const n = typeof s === 'string' ? Number(s) : s;
  return Number.isFinite(n) ? n : 0;
}

export default function PayrollPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [month, setMonth] = useState(() => searchParams.get('month') || currentYearMonthLocal());
  const [eligible, setEligible] = useState<EligibleUser[]>([]);
  const [rates, setRates] = useState<Rates | null>(null);
  const [entries, setEntries] = useState<PayrollEntryRow[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  const [y, m] = month.split('-').map(Number);

  useEffect(() => {
    const q = searchParams.get('month');
    if (q && /^\d{4}-\d{2}$/.test(q)) {
      setMonth((cur) => (cur === q ? cur : q));
    }
  }, [searchParams]);

  const loadEntries = useCallback(async () => {
    if (!Number.isFinite(y) || !Number.isFinite(m)) return;
    const data = await api<PayrollEntryRow[]>(`/api/payroll/entries?year=${y}&month=${m}`);
    setEntries(data);
  }, [y, m]);

  useEffect(() => {
    setErr('');
    setMsg('');
    void (async () => {
      try {
        const [u, r] = await Promise.all([
          api<EligibleUser[]>('/api/payroll/eligible-users'),
          api<Rates>('/api/payroll/rates/reiwa7'),
        ]);
        setEligible(u);
        setRates(r);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : '読み込みエラー');
      }
    })();
  }, []);

  useEffect(() => {
    setErr('');
    void (async () => {
      try {
        await loadEntries();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : '一覧の読み込みエラー');
      }
    })();
  }, [loadEntries]);

  function onMonthChange(next: string) {
    setMonth(next);
    router.replace(`/accounting/payroll?month=${encodeURIComponent(next)}`);
  }

  async function bulkFromMaster() {
    if (
      !window.confirm(
        `全員分を ${y}年${m}月 に登録しますか？\nユーザーマスタの「月額支給」が0の人はスキップされます。\n既に登録がある場合は上書きします。`
      )
    ) {
      return;
    }
    setErr('');
    setMsg('');
    try {
      const res = await api<{ created: number; skipped: number; errors: { name: string; error: string }[] }>(
        '/api/payroll/entries/bulk-from-master',
        {
          method: 'POST',
          body: JSON.stringify({ year: y, month: m }),
        }
      );
      await loadEntries();
      const er = res.errors.length ? ` エラー: ${res.errors.map((e) => `${e.name}(${e.error})`).join(' ')}` : '';
      setMsg(`一括処理完了。登録 ${res.created} 件、スキップ ${res.skipped} 件。${er}`);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '一括登録エラー');
    }
  }

  async function removeEntry(id: string) {
    if (!window.confirm('この月の登録を削除しますか？')) return;
    setErr('');
    try {
      await apiDelete(`/api/payroll/entries/${id}`);
      await loadEntries();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '削除エラー');
    }
  }

  async function downloadPayslipPdf(entryId: string) {
    if (pdfBusy) return;
    setErr('');
    setPdfBusy(true);
    try {
      const blob = await apiBlob(`/api/payroll/entries/${entryId}/pdf`);
      triggerBlobDownload(blob, `給与明細-${month}-${entryId.slice(0, 8)}.pdf`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '明細PDFのダウンロードに失敗しました');
    } finally {
      setPdfBusy(false);
    }
  }

  async function downloadSummaryPdf() {
    if (pdfBusy) return;
    setErr('');
    setPdfBusy(true);
    try {
      const blob = await apiBlob(`/api/payroll/entries/summary/${y}/${m}`);
      triggerBlobDownload(blob, `給与集計-${month}.pdf`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '集計PDFのダウンロードに失敗しました');
    } finally {
      setPdfBusy(false);
    }
  }

  async function downloadSummaryCsv() {
    if (pdfBusy) return;
    setErr('');
    setPdfBusy(true);
    try {
      const blob = await apiBlob(`/api/payroll/entries/summary/${y}/${m}/csv`);
      triggerBlobDownload(blob, `給与集計-${month}.csv`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '集計CSVのダウンロードに失敗しました');
    } finally {
      setPdfBusy(false);
    }
  }

  const sumGross = entries.reduce((a, r) => a + num(r.monthly_gross), 0);
  const sumDed = entries.reduce((a, r) => a + num(r.total_deductions), 0);
  const sumNet = entries.reduce((a, r) => a + num(r.net_pay), 0);
  const newHref = `/accounting/payroll/new?month=${encodeURIComponent(month)}`;

  return (
    <>
      <PageTitle
        title="給与管理"
        description="一覧で対象月を選び、行の編集・明細PDF・削除ができます。新規は入力画面へ進み、保存後にここへ戻ります。"
      />
      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}
      {msg && <p className="mb-4 text-sm text-green-800">{msg}</p>}
      {pdfBusy ? (
        <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          PDF を生成しています。数十秒かかることがあります。完了までほかの PDF ボタンは押せません。
        </p>
      ) : null}

      <Card className="mb-4 text-sm text-gunmetal-700">
        <p>
          会社全体の帳票は{' '}
          <Link href="/reports" className="font-medium text-navy-900 underline">
            レポート
          </Link>
          から出力できます（月別給与明細一覧・暦年の年度一覧）。
        </p>
      </Card>

      <Card className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium text-gunmetal-600">対象月</p>
          <MonthInput value={month} onChange={onMonthChange} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={newHref}
            className="inline-flex items-center rounded bg-navy-900 px-4 py-2 text-sm text-white"
          >
            新規登録
          </Link>
          {eligible.length > 0 && (
            <div className="relative inline-block text-left">
              <details className="group rounded border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none rounded px-4 py-2 text-sm text-navy-900 marker:hidden [&::-webkit-details-marker]:hidden">
                  名指しで新規…
                </summary>
                <div className="absolute right-0 z-10 mt-1 max-h-60 min-w-[12rem] overflow-auto rounded border bg-white py-1 shadow-md">
                  {eligible.map((u) => (
                    <Link
                      key={u.id}
                      href={`${newHref}&userId=${encodeURIComponent(u.id)}`}
                      className="block px-3 py-2 text-xs hover:bg-slate-50"
                    >
                      {u.name}
                    </Link>
                  ))}
                </div>
              </details>
            </div>
          )}
          <button
            type="button"
            onClick={() => void bulkFromMaster()}
            className="rounded border border-navy-800 bg-white px-4 py-2 text-sm text-navy-900"
          >
            全員一括登録（マスタの月額）
          </button>
          <button
            type="button"
            disabled={pdfBusy}
            onClick={() => void downloadSummaryPdf()}
            className="rounded border border-navy-800 bg-white px-4 py-2 text-sm text-navy-900 disabled:opacity-50"
          >
            当月・集計表 PDF
          </button>
          <button
            type="button"
            disabled={pdfBusy}
            onClick={() => void downloadSummaryCsv()}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-navy-900 disabled:opacity-50"
          >
            当月・集計表 CSV
          </button>
        </div>
      </Card>

      {rates && (
        <Card className="mb-6 text-sm text-gunmetal-700">
          <p className="font-medium text-navy-900">{rates.fiscalYearLabel} の参照料率</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
            <li>協会けんぽ健康保険（全国平均・合計）: {(rates.healthInsuranceTotalRate * 100).toFixed(2)}%</li>
            <li>介護保険（合計・40〜64歳）: {(rates.careInsuranceTotalRate * 100).toFixed(2)}%</li>
            <li>厚生年金（合計）: {(rates.pensionInsuranceTotalRate * 100).toFixed(2)}%</li>
            <li>雇用保険 労働者負担（一般・社員のみ）: {(rates.employmentInsuranceEmployeeRateGeneral * 100).toFixed(2)}%</li>
          </ul>
        </Card>
      )}

      <Card className="mb-6 overflow-x-auto p-0">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-navy-900">
            {y}年{m}月の給与一覧（{entries.length}名）
          </h2>
        </div>
        <table className="w-full min-w-[880px] text-sm">
          <thead className="border-b bg-slate-50/80">
            <tr>
              <th className="px-3 py-2 text-left">氏名</th>
              <th className="px-3 py-2 text-left">区分</th>
              <th className="px-3 py-2 text-right">総支給</th>
              <th className="px-3 py-2 text-right">控除計</th>
              <th className="px-3 py-2 text-right">手取</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gunmetal-600">
                  この月の登録がありません。一括登録するか、
                  <Link href={newHref} className="mx-1 font-medium text-navy-900 underline">
                    新規登録
                  </Link>
                  から追加してください。
                </td>
              </tr>
            )}
            {entries.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-3 py-2">{row.user_name}</td>
                <td className="px-3 py-2">{catJa(row.payroll_category)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatJPY(num(row.monthly_gross))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatJPY(num(row.total_deductions))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatJPY(num(row.net_pay))}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Link
                      href={`/accounting/payroll/${row.id}/edit?month=${encodeURIComponent(month)}`}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      編集
                    </Link>
                    <button
                      type="button"
                      disabled={pdfBusy}
                      className="rounded border border-navy-800 px-2 py-1 text-xs text-navy-900 disabled:opacity-50"
                      onClick={() => void downloadPayslipPdf(row.id)}
                    >
                      明細PDF
                    </button>
                    <button
                      type="button"
                      className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                      onClick={() => void removeEntry(row.id)}
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {entries.length > 0 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50/80 font-medium">
              <tr>
                <td className="px-3 py-2" colSpan={2}>
                  合計
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatJPY(sumGross)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatJPY(sumDed)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatJPY(sumNet)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </>
  );
}
