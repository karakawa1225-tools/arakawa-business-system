'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api, apiBlob, apiDelete } from '@/lib/api';
import { triggerBlobDownload } from '@/lib/downloadBlob';
import { runSave } from '@/lib/save';
import { formatDateJa, formatJPY, currentYearMonthLocal } from '@/lib/format';
import { MonthInput } from '@/components/ui/MonthInput';

export default function ExpensesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [month, setMonth] = useState(() => searchParams.get('month') || currentYearMonthLocal());
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    const q = searchParams.get('month');
    if (q && /^\d{4}-\d{2}$/.test(q)) {
      setMonth((cur) => (cur === q ? cur : q));
    }
  }, [searchParams]);

  async function load() {
    const data = await api<Record<string, unknown>[]>(`/api/expenses?month=${month}`);
    setRows(data);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  function onMonthChange(next: string) {
    setMonth(next);
    router.replace(`/accounting/expenses?month=${encodeURIComponent(next)}`);
  }

  async function downloadPdf() {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const [y, m] = month.split('-').map(Number);
      const blob = await apiBlob(`/api/reports/expense-settlement/${y}/${m}`);
      triggerBlobDownload(blob, `expense-${month}.pdf`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'PDFのダウンロードに失敗しました');
    } finally {
      setPdfBusy(false);
    }
  }

  async function downloadCsv() {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const [y, m] = month.split('-').map(Number);
      const blob = await apiBlob(`/api/reports/expense-settlement/${y}/${m}/csv`);
      triggerBlobDownload(blob, `expense-${month}.csv`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'CSVのダウンロードに失敗しました');
    } finally {
      setPdfBusy(false);
    }
  }

  const newHref = `/accounting/expenses/new?month=${encodeURIComponent(month)}`;

  return (
    <>
      <PageTitle title="経費管理" description="一覧で月を選び、行から編集へ進みます。新規は入力画面で登録します。" />
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs text-gunmetal-600">表示月</label>
          <MonthInput value={month} onChange={onMonthChange} className="ml-2 rounded border px-3 py-2 text-sm" />
        </div>
        <Link href={newHref} className="rounded bg-navy-900 px-4 py-2 text-sm text-white">
          経費を追加
        </Link>
        <button
          type="button"
          disabled={pdfBusy}
          onClick={() => void downloadPdf()}
          className="rounded-lg border border-navy-900 px-4 py-2 text-sm text-navy-900 disabled:opacity-50"
        >
          月次経費精算書 PDF
        </button>
        <button
          type="button"
          disabled={pdfBusy}
          onClick={() => void downloadCsv()}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-navy-900 disabled:opacity-50"
        >
          月次経費精算 CSV
        </button>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left">日付</th>
              <th className="px-4 py-3 text-left">支払先</th>
              <th className="px-4 py-3 text-left">科目</th>
              <th className="px-4 py-3 text-right">金額</th>
              <th className="px-4 py-3 text-left">税区分</th>
              <th className="px-4 py-3 text-left">インボイス番号</th>
              <th className="px-4 py-3 text-left">摘要</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gunmetal-600">
                  この月の経費がありません。
                  <Link href={newHref} className="mx-1 font-medium text-navy-900 underline">
                    経費を追加
                  </Link>
                  から登録できます。
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const id = String(r.id);
              const rowMonth = String(r.expense_date ?? '').slice(0, 7) || month;
              return (
                <tr key={id} className="border-b border-slate-100">
                  <td className="px-4 py-3">{formatDateJa(r.expense_date)}</td>
                  <td className="px-4 py-3">{String(r.payment_destination ?? '')}</td>
                  <td className="px-4 py-3">{String(r.account_name)}</td>
                  <td className="px-4 py-3 text-right">{formatJPY(r.amount)}</td>
                  <td className="px-4 py-3">{String(r.tax_division_label ?? `${r.tax_rate}%`)}</td>
                  <td className="px-4 py-3">{String(r.supplier_invoice_no ?? '')}</td>
                  <td className="px-4 py-3">{String(r.description ?? '')}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/accounting/expenses/${id}/edit?month=${encodeURIComponent(rowMonth)}`}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        編集
                      </Link>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm('削除しますか？')) return;
                          await runSave(() => apiDelete(`/api/expenses/${id}`), load);
                        }}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
