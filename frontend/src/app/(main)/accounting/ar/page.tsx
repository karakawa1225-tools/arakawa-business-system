'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api, apiBlob, apiDelete } from '@/lib/api';
import { triggerBlobDownload } from '@/lib/downloadBlob';
import { runSave } from '@/lib/save';
import { currentYearMonthLocal, formatJPY } from '@/lib/format';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { MonthInput } from '@/components/ui/MonthInput';
import { taxFromExclusiveNet, ratePercentFromKey, type LedgerTaxRateKey } from '@/lib/taxCalc';

type Customer = { id: string; customer_code: string; company_name: string; closing_day: number | null };

export default function ArLedgerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [month, setMonth] = useState(() => searchParams.get('month') || currentYearMonthLocal());
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eTaxRateKey, setETaxRateKey] = useState<LedgerTaxRateKey>('10');
  const [eRow, setERow] = useState({
    customerId: '',
    closingDay: '' as string,
    salesAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
  });

  useEffect(() => {
    const q = searchParams.get('month');
    if (q && /^\d{4}-\d{2}$/.test(q)) {
      setMonth((cur) => (cur === q ? cur : q));
    }
  }, [searchParams]);

  useEffect(() => {
    setERow((p) => {
      const r = ratePercentFromKey(eTaxRateKey);
      const tax = taxFromExclusiveNet(p.salesAmount, r);
      return { ...p, taxAmount: tax, totalAmount: p.salesAmount + tax };
    });
  }, [eRow.salesAmount, eTaxRateKey]);

  async function load() {
    const data = await api<Record<string, unknown>[]>(`/api/ar-ledger?month=${month}`);
    setRows(data);
  }

  useEffect(() => {
    api<Customer[]>('/api/customers').then((c) => {
      setCustomers(c);
    });
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  function onMonthChange(next: string) {
    setMonth(next);
    router.replace(`/accounting/ar?month=${encodeURIComponent(next)}`);
  }

  async function saveArRow(rowId: string) {
    await runSave(
      () =>
        api(`/api/ar-ledger/${rowId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            customerId: eRow.customerId,
            closingDay: eRow.closingDay ? Number(eRow.closingDay) : null,
            salesAmount: eRow.salesAmount,
            taxAmount: eRow.taxAmount,
            totalAmount: eRow.totalAmount || eRow.salesAmount + eRow.taxAmount,
          }),
        }),
      async () => {
        setEditingId(null);
        await load();
      }
    );
  }

  async function downloadMonthlyPdf() {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const [y, m] = month.split('-').map(Number);
      const blob = await apiBlob(`/api/reports/ar/${y}/${m}`);
      triggerBlobDownload(blob, `売掛金-${month}.pdf`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'PDFのダウンロードに失敗しました');
    } finally {
      setPdfBusy(false);
    }
  }

  async function downloadMonthlyCsv() {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const [y, m] = month.split('-').map(Number);
      const blob = await apiBlob(`/api/reports/ar/${y}/${m}/csv`);
      triggerBlobDownload(blob, `売掛金-${month}.csv`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'CSVのダウンロードに失敗しました');
    } finally {
      setPdfBusy(false);
    }
  }

  const newHref = `/accounting/ar/new?month=${encodeURIComponent(month)}`;

  return (
    <>
      <PageTitle title="売掛金管理" description="一覧で月を選び、行から編集します。新規は入力画面で登録します。" />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs text-gunmetal-600">対象月</label>
          <MonthInput value={month} onChange={onMonthChange} className="ml-2 rounded border px-3 py-2 text-sm" />
        </div>
        <Link href={newHref} className="rounded bg-navy-900 px-4 py-2 text-sm text-white">
          売掛金を追加
        </Link>
        <button
          type="button"
          disabled={pdfBusy}
          onClick={() => void downloadMonthlyPdf()}
          className="rounded-lg border border-navy-900 px-4 py-2 text-sm text-navy-900 disabled:opacity-50"
        >
          月別売掛金 PDF
        </button>
        <button
          type="button"
          disabled={pdfBusy}
          onClick={() => void downloadMonthlyCsv()}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-navy-900 disabled:opacity-50"
        >
          月別売掛金 CSV
        </button>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left">顧客</th>
              <th className="px-4 py-3 text-left">締め日</th>
              <th className="px-4 py-3 text-right">売上</th>
              <th className="px-4 py-3 text-right">税</th>
              <th className="px-4 py-3 text-right">合計</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gunmetal-600">
                  この月の売掛金がありません。
                  <Link href={newHref} className="mx-1 font-medium text-navy-900 underline">
                    売掛金を追加
                  </Link>
                  から登録できます。
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const id = String(r.id);
              if (editingId === id) {
                return (
                  <tr key={id} className="border-b border-slate-100 bg-aqua-50/30">
                    <td className="px-4 py-3 align-top">
                      <select
                        value={eRow.customerId}
                        onChange={(e) => setERow((p) => ({ ...p, customerId: e.target.value }))}
                        className="max-w-[12rem] rounded border px-1 py-1 text-xs"
                      >
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.customer_code} {c.company_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={eRow.closingDay}
                        onChange={(e) => setERow((p) => ({ ...p, closingDay: e.target.value }))}
                        className="w-14 rounded border px-1 py-1 text-xs"
                      />
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <select
                        value={eTaxRateKey}
                        onChange={(e) => setETaxRateKey(e.target.value as LedgerTaxRateKey)}
                        className="mb-1 w-full max-w-[6rem] rounded border px-1 py-1 text-[10px]"
                        aria-label="編集時の消費税率"
                      >
                        <option value="10">10%</option>
                        <option value="8">8%</option>
                        <option value="0">非課税</option>
                      </select>
                      <CurrencyInput
                        value={eRow.salesAmount}
                        onChange={(n) => setERow((p) => ({ ...p, salesAmount: n }))}
                        className="w-full max-w-[6rem] rounded border px-1 py-1 text-xs"
                      />
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <CurrencyInput
                        value={eRow.taxAmount}
                        onChange={(n) => setERow((p) => ({ ...p, taxAmount: n }))}
                        className="w-full max-w-[6rem] rounded border px-1 py-1 text-xs"
                      />
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <CurrencyInput
                        value={eRow.totalAmount}
                        onChange={(n) => setERow((p) => ({ ...p, totalAmount: n }))}
                        className="w-full max-w-[6rem] rounded border px-1 py-1 text-xs"
                      />
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => void saveArRow(id)}
                          className="rounded border bg-white px-2 py-1 text-xs"
                        >
                          保存
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="rounded border px-2 py-1 text-xs">
                          取消
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={id} className="border-b border-slate-100">
                  <td className="px-4 py-3">{String(r.customer_name ?? '')}</td>
                  <td className="px-4 py-3">{String(r.closing_day ?? '')}</td>
                  <td className="px-4 py-3 text-right">{formatJPY(r.sales_amount)}</td>
                  <td className="px-4 py-3 text-right">{formatJPY(r.tax_amount)}</td>
                  <td className="px-4 py-3 text-right">{formatJPY(r.total_amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(id);
                          const salesAmount = Number(r.sales_amount ?? 0);
                          const taxAmt = Number(r.tax_amount ?? 0);
                          let inferred: LedgerTaxRateKey = '10';
                          if (salesAmount > 0 && taxAmt === 0) inferred = '0';
                          else if (
                            salesAmount > 0 &&
                            taxAmt === Math.floor(salesAmount * 0.08) &&
                            taxAmt !== Math.floor(salesAmount * 0.1)
                          )
                            inferred = '8';
                          else if (salesAmount > 0 && taxAmt === Math.floor(salesAmount * 0.1)) inferred = '10';
                          setETaxRateKey(inferred);
                          setERow({
                            customerId: String(r.customer_id ?? ''),
                            closingDay: r.closing_day != null ? String(r.closing_day) : '',
                            salesAmount,
                            taxAmount: taxAmt,
                            totalAmount: Number(r.total_amount ?? 0),
                          });
                        }}
                        className="rounded border px-3 py-1.5 text-xs"
                      >
                        編集
                      </button>
                      {r.pdf_data_url ? (
                        <a className="rounded border px-3 py-1.5 text-xs" href={`/api/ar-ledger/${id}/pdf`} target="_blank" rel="noreferrer">
                          PDF
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm('削除しますか？')) return;
                          const ok = await runSave(() => apiDelete(`/api/ar-ledger/${id}`), load);
                          if (ok) setEditingId((cur) => (cur === id ? null : cur));
                        }}
                        className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-700"
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
