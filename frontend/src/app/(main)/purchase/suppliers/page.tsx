'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { MasterCsvPanel } from '@/components/masters/MasterCsvPanel';
import { api } from '@/lib/api';
import {
  downloadSupplierImportTemplateCsv,
  downloadSupplierMasterDescriptionCsv,
} from '@/lib/masterCsv';

type Row = Record<string, unknown>;

export default function SuppliersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = useCallback(() => {
    api<Row[]>('/api/suppliers').then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageTitle title="仕入先一覧" />
        <div className="flex max-w-full flex-col gap-3 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/purchase/suppliers/new"
              className="hidden rounded-lg bg-navy-900 px-4 py-2 text-sm text-white lg:inline-flex"
            >
              仕入先登録
            </Link>
            <p className="text-xs leading-snug text-gunmetal-600 lg:hidden">
              手動の新規登録はPC（画面幅1024px以上）のみ。スマホ・タブレットはCSV取り込みをご利用ください。
            </p>
          </div>
          <MasterCsvPanel
            importApiPath="/api/suppliers/import-csv"
            onImported={load}
            onDownloadGuide={downloadSupplierMasterDescriptionCsv}
            onDownloadTemplate={downloadSupplierImportTemplateCsv}
          />
        </div>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left">コード</th>
              <th className="px-4 py-3 text-left">仕入先名</th>
              <th className="px-4 py-3 text-left">電話</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b border-slate-100">
                <td className="px-4 py-3">{String(r.supplier_code)}</td>
                <td className="px-4 py-3">{String(r.name)}</td>
                <td className="px-4 py-3">{String(r.phone ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
