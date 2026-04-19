'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { MasterCsvPanel } from '@/components/masters/MasterCsvPanel';
import { api } from '@/lib/api';
import { formatJPY } from '@/lib/format';
import { downloadProductImportTemplateCsv, downloadProductMasterDescriptionCsv } from '@/lib/masterCsv';

type Row = Record<string, unknown>;

export default function ProductsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = useCallback(() => {
    api<Row[]>('/api/products').then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageTitle title="商品一覧" description="在庫管理なし（商社型）" />
        <div className="flex max-w-full flex-col gap-3 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/products/new"
              className="hidden rounded-lg bg-navy-900 px-4 py-2 text-sm text-white lg:inline-flex"
            >
              商品登録
            </Link>
            <p className="text-xs leading-snug text-gunmetal-600 lg:hidden">
              手動の新規登録はPC（画面幅1024px以上）のみ。スマホ・タブレットはCSV取り込みをご利用ください。
            </p>
          </div>
          <MasterCsvPanel
            importApiPath="/api/products/import-csv"
            onImported={load}
            onDownloadGuide={downloadProductMasterDescriptionCsv}
            onDownloadTemplate={downloadProductImportTemplateCsv}
          />
        </div>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left">コード</th>
              <th className="px-4 py-3 text-left">商品名</th>
              <th className="px-4 py-3 text-left">バーコード用コード</th>
              <th className="px-4 py-3 text-left">カテゴリ</th>
              <th className="px-4 py-3 text-right">仕入</th>
              <th className="px-4 py-3 text-right">販売</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b border-slate-100">
                <td className="px-4 py-3">{String(r.product_code)}</td>
                <td className="px-4 py-3">{String(r.name)}</td>
                <td className="px-4 py-3 text-gunmetal-600">{String(r.barcode_code ?? '—')}</td>
                <td className="px-4 py-3">{String(r.category ?? '—')}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.purchase_price != null ? formatJPY(r.purchase_price) : '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.sale_price != null ? formatJPY(r.sale_price) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
