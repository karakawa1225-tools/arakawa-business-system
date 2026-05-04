'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { MasterCsvPanel } from '@/components/masters/MasterCsvPanel';
import { api } from '@/lib/api';
import {
  downloadCustomerImportTemplateCsv,
  downloadCustomerMasterDescriptionCsv,
} from '@/lib/masterCsv';

type Customer = {
  id: string;
  customer_code: string;
  company_name: string;
  barcode_code: string | null;
  phone: string | null;
  postal_code: string | null;
};

/** オープンリダイレクト防止: アプリ内の相対パスのみ（searchParams は既にデコード済み） */
function safePickForReturnPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  if (raw.includes('://')) return null;
  if (raw.length > 512) return null;
  return raw;
}

export default function CustomersPage() {
  const sp = useSearchParams();
  const pickFor = safePickForReturnPath(sp.get('pickFor'));
  const [rows, setRows] = useState<Customer[]>([]);
  /** 取得失敗と「DBに0件」を混同しない（従来は失敗時も「顧客がまだありません」と出ていた） */
  const [listLoad, setListLoad] = useState<'loading' | 'ok' | 'error'>('loading');
  const [listError, setListError] = useState('');

  const load = useCallback(() => {
    setListLoad('loading');
    setListError('');
    api<Customer[]>('/api/customers')
      .then((data) => {
        if (!Array.isArray(data)) {
          setListLoad('error');
          setListError('一覧の形式が不正です（配列ではありません）。API の URL やログインを確認してください。');
          return;
        }
        setRows(data);
        setListLoad('ok');
      })
      .catch((e) => {
        console.error('[CustomersPage] /api/customers', e);
        const msg = e instanceof Error ? e.message : String(e);
        setListLoad('error');
        setListError(msg || '一覧を取得できませんでした。');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      {pickFor ? (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <strong>売掛金の新規登録から開いています。</strong>
          戻るには、下の一覧で対象の <strong>顧客コード</strong> をクリックしてください。
        </div>
      ) : null}
      {listLoad === 'error' ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-950" role="alert">
          <p className="font-medium">顧客一覧を取得できませんでした（データが消えたわけではなく、通信または認証の問題の可能性が高いです）。</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-xs">{listError}</p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-3 rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-900 hover:bg-red-50"
          >
            再試行
          </button>
        </div>
      ) : null}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageTitle title="顧客一覧" description="顧客マスタ" />
        <div className="flex max-w-full flex-col gap-3 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/crm/customers/new"
              className="hidden rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 lg:inline-flex"
            >
              顧客登録
            </Link>
            <p className="text-xs leading-snug text-gunmetal-600 lg:hidden">
              手動の新規登録はPC（画面幅1024px以上）のみ。スマホ・タブレットはCSV取り込みをご利用ください。
            </p>
          </div>
          <MasterCsvPanel
            importApiPath="/api/customers/import-csv"
            onImported={load}
            onDownloadGuide={downloadCustomerMasterDescriptionCsv}
            onDownloadTemplate={downloadCustomerImportTemplateCsv}
          />
        </div>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 font-medium text-gunmetal-600">コード</th>
              <th className="px-4 py-3 font-medium text-gunmetal-600">会社名</th>
              <th className="px-4 py-3 font-medium text-gunmetal-600">バーコード用コード</th>
              <th className="px-4 py-3 font-medium text-gunmetal-600">郵便番号</th>
              <th className="px-4 py-3 font-medium text-gunmetal-600">電話</th>
            </tr>
          </thead>
          <tbody>
            {listLoad === 'loading' && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gunmetal-600">
                  読み込み中…
                </td>
              </tr>
            ) : null}
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  {pickFor ? (
                    <>
                      <Link
                        href={`${pickFor.includes('?') ? `${pickFor}&` : `${pickFor}?`}customerId=${encodeURIComponent(c.id)}`}
                        className="font-medium text-navy-800 hover:underline"
                      >
                        {c.customer_code}
                      </Link>
                      <Link
                        href={`/crm/customers/${c.id}`}
                        className="ml-2 text-[11px] text-gunmetal-500 hover:text-navy-800 hover:underline"
                      >
                        詳細
                      </Link>
                    </>
                  ) : (
                    <Link href={`/crm/customers/${c.id}`} className="text-navy-800 hover:underline">
                      {c.customer_code}
                    </Link>
                  )}
                </td>
                <td className="px-4 py-3">{c.company_name}</td>
                <td className="px-4 py-3 text-gunmetal-600">{c.barcode_code ?? '—'}</td>
                <td className="px-4 py-3 text-gunmetal-600">{c.postal_code ?? '—'}</td>
                <td className="px-4 py-3 text-gunmetal-600">{c.phone ?? '—'}</td>
              </tr>
            ))}
            {listLoad === 'ok' && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gunmetal-500">
                  顧客マスタに登録がありません（先に顧客登録または CSV 取り込みを行ってください）
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </>
  );
}
