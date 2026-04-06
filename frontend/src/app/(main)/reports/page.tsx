'use client';

import { useState } from 'react';
import { MonthInput } from '@/components/ui/MonthInput';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { apiBlob } from '@/lib/api';
import { currentYearMonthLocal } from '@/lib/format';
import { triggerBlobDownload } from '@/lib/downloadBlob';

function yearFromMonth(ym: string) {
  const y = ym.split('-')[0];
  const n = parseInt(y ?? '', 10);
  return Number.isFinite(n) ? n : new Date().getFullYear();
}

export default function ReportsPage() {
  const [month, setMonth] = useState(() => currentYearMonthLocal());
  const [payrollYear, setPayrollYear] = useState(() => yearFromMonth(currentYearMonthLocal()));
  const [exportBusy, setExportBusy] = useState(false);

  async function runExport(work: () => Promise<void>) {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      await work();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '帳票の出力に失敗しました');
    } finally {
      setExportBusy(false);
    }
  }

  function downloadExpensePdf() {
    void runExport(async () => {
      const [y, m] = month.split('-').map(Number);
      const blob = await apiBlob(`/api/reports/expense-settlement/${y}/${m}`);
      triggerBlobDownload(blob, `経費精算-${month}.pdf`);
    });
  }

  function downloadExpenseCsv() {
    void runExport(async () => {
      const [y, m] = month.split('-').map(Number);
      const blob = await apiBlob(`/api/reports/expense-settlement/${y}/${m}/csv`);
      triggerBlobDownload(blob, `経費精算-${month}.csv`);
    });
  }

  function downloadBankInOutPdf() {
    void runExport(async () => {
      const [y, m] = month.split('-').map(Number);
      const blob = await apiBlob(`/api/reports/bank-inout/${y}/${m}`);
      triggerBlobDownload(blob, `銀行入出金-${month}.pdf`);
    });
  }

  function downloadBankInOutCsv() {
    void runExport(async () => {
      const [y, m] = month.split('-').map(Number);
      const blob = await apiBlob(`/api/reports/bank-inout/${y}/${m}/csv`);
      triggerBlobDownload(blob, `銀行入出金-${month}.csv`);
    });
  }

  function downloadArApPdf() {
    void runExport(async () => {
      const [y, m] = month.split('-').map(Number);
      const blob = await apiBlob(`/api/reports/ar/${y}/${m}`);
      triggerBlobDownload(blob, `売掛金-${month}.pdf`);
    });
  }

  function downloadArCsv() {
    void runExport(async () => {
      const [y, m] = month.split('-').map(Number);
      const blob = await apiBlob(`/api/reports/ar/${y}/${m}/csv`);
      triggerBlobDownload(blob, `売掛金-${month}.csv`);
    });
  }

  function downloadApPdf() {
    void runExport(async () => {
      const [y, m] = month.split('-').map(Number);
      const blob = await apiBlob(`/api/reports/ap/${y}/${m}`);
      triggerBlobDownload(blob, `買掛金-${month}.pdf`);
    });
  }

  function downloadApCsv() {
    void runExport(async () => {
      const [y, m] = month.split('-').map(Number);
      const blob = await apiBlob(`/api/reports/ap/${y}/${m}/csv`);
      triggerBlobDownload(blob, `買掛金-${month}.csv`);
    });
  }

  function downloadPayrollMonthlyDetailPdf() {
    void runExport(async () => {
      const [y, m] = month.split('-').map(Number);
      const blob = await apiBlob(`/api/reports/payroll-monthly-detail/${y}/${m}`);
      triggerBlobDownload(blob, `給与明細一覧-${month}.pdf`);
    });
  }

  function downloadPayrollMonthlyDetailCsv() {
    void runExport(async () => {
      const [y, m] = month.split('-').map(Number);
      const blob = await apiBlob(`/api/reports/payroll-monthly-detail/${y}/${m}/csv`);
      triggerBlobDownload(blob, `給与明細一覧-${month}.csv`);
    });
  }

  function downloadPayrollAnnualPdf() {
    const y = payrollYear;
    if (!Number.isFinite(y) || y < 2000) return;
    void runExport(async () => {
      const blob = await apiBlob(`/api/reports/payroll-annual-calendar/${y}`);
      triggerBlobDownload(blob, `給与年度一覧-${y}.pdf`);
    });
  }

  function downloadPayrollAnnualCsv() {
    const y = payrollYear;
    if (!Number.isFinite(y) || y < 2000) return;
    void runExport(async () => {
      const blob = await apiBlob(`/api/reports/payroll-annual-calendar/${y}/csv`);
      triggerBlobDownload(blob, `給与年度一覧-${y}.csv`);
    });
  }

  const btnPdf = 'rounded-lg bg-navy-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50';
  const btnCsv =
    'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-navy-900 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <>
      <PageTitle title="レポート" description="帳票出力" />
      {exportBusy ? (
        <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          帳票を出力しています。PDF
          はバックエンドで Chromium を1本ずつ処理するため数十秒かかることがあります。CSV は通常すぐ終わります。この間も他のタブの操作は可能です。
        </p>
      ) : null}
      <div className="max-w-2xl">
        <Card className="mb-4 max-w-xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-navy-900">対象月</h2>
              <p className="mt-1 text-xs text-gunmetal-600">月次帳票の出力に使います</p>
            </div>
            <MonthInput value={month} onChange={setMonth} className="rounded border px-3 py-2 text-sm" />
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="max-w-md">
            <h2 className="text-sm font-semibold text-navy-900">月次経費精算書（A4 PDF）</h2>
            <p className="mt-1 text-xs text-gunmetal-600">
              経費一覧・勘定科目別集計・消費税区分別集計（10% / 8% / 非課税 / 課税対象外）。CSV は明細中心です。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={exportBusy} onClick={downloadExpensePdf} className={btnPdf}>
                PDF
              </button>
              <button type="button" disabled={exportBusy} onClick={downloadExpenseCsv} className={btnCsv}>
                CSV
              </button>
            </div>
          </Card>

          <Card className="max-w-md">
            <h2 className="text-sm font-semibold text-navy-900">月次銀行入出金集計表（A4 PDF）</h2>
            <p className="mt-1 text-xs text-gunmetal-600">入金/出金と口座別残高を出力します</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={exportBusy} onClick={downloadBankInOutPdf} className={btnPdf}>
                PDF
              </button>
              <button type="button" disabled={exportBusy} onClick={downloadBankInOutCsv} className={btnCsv}>
                CSV
              </button>
            </div>
          </Card>

          <Card className="max-w-md">
            <h2 className="text-sm font-semibold text-navy-900">月別売掛金集計表（A4 PDF）</h2>
            <p className="mt-1 text-xs text-gunmetal-600">顧客ごとの売掛金（売上/税/合計）</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={exportBusy} onClick={downloadArApPdf} className={btnPdf}>
                PDF
              </button>
              <button type="button" disabled={exportBusy} onClick={downloadArCsv} className={btnCsv}>
                CSV
              </button>
            </div>
          </Card>

          <Card className="max-w-md">
            <h2 className="text-sm font-semibold text-navy-900">月別買掛金集計表（A4 PDF）</h2>
            <p className="mt-1 text-xs text-gunmetal-600">仕入先ごとの買掛金（金額/税/合計）</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={exportBusy} onClick={downloadApPdf} className={btnPdf}>
                PDF
              </button>
              <button type="button" disabled={exportBusy} onClick={downloadApCsv} className={btnCsv}>
                CSV
              </button>
            </div>
          </Card>

          <Card className="max-w-md">
            <h2 className="text-sm font-semibold text-navy-900">月別給与明細一覧表（会社全体）</h2>
            <p className="mt-1 text-xs text-gunmetal-600">
              控除内訳・標準報酬・備考込み。上の「対象月」と同じ年月で出力します。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={exportBusy} onClick={downloadPayrollMonthlyDetailPdf} className={btnPdf}>
                PDF
              </button>
              <button
                type="button"
                disabled={exportBusy}
                onClick={downloadPayrollMonthlyDetailCsv}
                className={btnCsv}
              >
                CSV
              </button>
            </div>
          </Card>

          <Card className="max-w-md">
            <h2 className="text-sm font-semibold text-navy-900">給与・手取り 年度一覧表（暦年）</h2>
            <p className="mt-1 text-xs text-gunmetal-600">1〜12月の手取り・支給を人×月で一覧。登録のあるユーザのみ。</p>
            <label className="mt-3 block text-xs text-gunmetal-700">
              対象年（暦年）
              <input
                type="number"
                min={2000}
                max={2100}
                value={payrollYear}
                onChange={(e) => setPayrollYear(Number(e.target.value))}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={exportBusy} onClick={downloadPayrollAnnualPdf} className={btnPdf}>
                PDF
              </button>
              <button type="button" disabled={exportBusy} onClick={downloadPayrollAnnualCsv} className={btnCsv}>
                CSV
              </button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
