'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { runSave } from '@/lib/save';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { taxFromExclusiveNet, ratePercentFromKey, type LedgerTaxRateKey } from '@/lib/taxCalc';

type Customer = { id: string; customer_code: string; company_name: string; closing_day: number | null };

function formatApiCatch(e: unknown): string {
  if (e instanceof Error && e.message.trim()) return e.message.trim();
  if (typeof e === 'string' && e.trim()) return e.trim();
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m.trim();
  }
  try {
    const j = JSON.stringify(e);
    if (j && j !== '{}') return j.slice(0, 600);
  } catch {
    /* ignore */
  }
  return 'エラー詳細を取得できませんでした。F12 → Network で /api/customers/（ID）の応答を確認してください。';
}

function mapCustomerRow(row: {
  id: string;
  customer_code?: string;
  company_name?: string;
  closing_day?: unknown;
}): Customer {
  const rawCd = row.closing_day;
  const closingNum =
    rawCd != null && rawCd !== '' && Number.isFinite(Number(rawCd)) ? Number(rawCd) : null;
  return {
    id: String(row.id),
    customer_code: String(row.customer_code ?? ''),
    company_name: String(row.company_name ?? ''),
    closing_day: closingNum != null && closingNum >= 1 && closingNum <= 31 ? closingNum : null,
  };
}

export function ArLedgerNewForm({
  listMonth,
  initialCustomerId = null,
}: {
  listMonth: string;
  /** 顧客一覧から戻るときの ?customerId=（GET /api/customers/:id のみ） */
  initialCustomerId?: string | null;
}) {
  const router = useRouter();
  const pdfRef = useRef<HTMLInputElement | null>(null);
  const [picked, setPicked] = useState<Customer | null>(null);
  const [pickLoad, setPickLoad] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [pickError, setPickError] = useState('');
  const [pdfName, setPdfName] = useState('');

  const [f, setF] = useState({
    customerId: '',
    closingDay: '' as string,
    taxRateKey: '10' as LedgerTaxRateKey,
    salesAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    pdfDataUrl: '',
  });

  useEffect(() => {
    setF((p) => {
      const r = ratePercentFromKey(p.taxRateKey);
      const tax = taxFromExclusiveNet(p.salesAmount, r);
      return { ...p, taxAmount: tax, totalAmount: p.salesAmount + tax };
    });
  }, [f.salesAmount, f.taxRateKey]);

  const fetchPicked = useCallback(async (id: string) => {
    setPickLoad('loading');
    setPickError('');
    try {
      const row = await api<{
        id: string;
        customer_code?: string;
        company_name?: string;
        closing_day?: unknown;
      }>(`/api/customers/${encodeURIComponent(id)}`);
      const mapped = mapCustomerRow(row);
      setPicked(mapped);
      setF((p) => ({
        ...p,
        customerId: mapped.id,
        closingDay: String(mapped.closing_day ?? ''),
      }));
      setPickLoad('ok');
    } catch (e) {
      console.error('[ArLedgerNewForm] GET /api/customers/:id', e);
      setPicked(null);
      setF((p) => ({ ...p, customerId: '', closingDay: '' }));
      setPickLoad('error');
      setPickError(formatApiCatch(e).slice(0, 800));
    }
  }, []);

  useEffect(() => {
    const id = initialCustomerId?.trim();
    if (!id) {
      setPickLoad('idle');
      return;
    }
    void fetchPicked(id);
  }, [initialCustomerId, fetchPicked]);

  function clearCustomer() {
    setPicked(null);
    setPickLoad('idle');
    setPickError('');
    setF((p) => ({ ...p, customerId: '', closingDay: '' }));
    router.replace(`/accounting/ar/new?month=${encodeURIComponent(listMonth)}`);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.customerId || !picked) {
      window.alert(
        '「顧客一覧を別タブで開く」から一覧を開き、対象の顧客コードをクリックしてこの画面に戻ってください。'
      );
      return;
    }
    if (pickLoad === 'error') {
      window.alert('顧客の取得に失敗しています。下の「再試行」またはログイン・API接続を確認してください。');
      return;
    }
    await runSave(
      () =>
        api('/api/ar-ledger', {
          method: 'POST',
          body: JSON.stringify({
            customerId: f.customerId,
            month: listMonth,
            closingDay: f.closingDay ? Number(f.closingDay) : null,
            salesAmount: f.salesAmount,
            taxAmount: f.taxAmount,
            totalAmount: f.totalAmount || f.salesAmount + f.taxAmount,
            pdfDataUrl: f.pdfDataUrl || null,
          }),
        }),
      async () => {
        router.push(
          `/accounting/ar?month=${encodeURIComponent(listMonth)}&saved=1`
        );
        router.refresh();
      }
    );
  }

  const backHref = `/accounting/ar?month=${encodeURIComponent(listMonth)}`;
  const pickForHref = `/crm/customers?pickFor=${encodeURIComponent(`/accounting/ar/new?month=${listMonth}`)}`;

  return (
    <Card className="max-w-xl">
      <div className="mb-4">
        <Link href={backHref} className="text-sm text-navy-900 underline">
          ← 売掛金一覧へ
        </Link>
      </div>
      <h2 className="text-sm font-medium">新規登録（対象月: {listMonth}）</h2>
      <form onSubmit={add} className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <label className="text-[11px] font-medium text-gunmetal-600">顧客（顧客マスタ）</label>
            <Link
              href={pickForHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium text-navy-800 underline decoration-slate-300 underline-offset-2 hover:decoration-navy-800"
            >
              顧客一覧を別タブで開く
            </Link>
          </div>

          {initialCustomerId && pickLoad === 'loading' ? (
            <p className="mt-2 text-sm text-gunmetal-600">顧客を読み込み中です…</p>
          ) : null}

          {pickLoad === 'error' ? (
            <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-950" role="alert">
              <p className="whitespace-pre-wrap font-medium leading-snug">{pickError}</p>
              {initialCustomerId ? (
                <button
                  type="button"
                  onClick={() => void fetchPicked(initialCustomerId)}
                  className="mt-2 rounded border border-red-300 bg-white px-3 py-1.5 text-[11px] font-medium text-red-900 hover:bg-red-50"
                >
                  再試行
                </button>
              ) : null}
            </div>
          ) : null}

          {picked && pickLoad === 'ok' ? (
            <div className="mt-3 rounded border border-slate-200 bg-slate-50/90 px-3 py-3 text-sm">
              <div className="grid gap-1">
                <div>
                  <span className="text-[11px] text-gunmetal-600">顧客コード</span>
                  <div className="font-medium text-navy-900">{picked.customer_code}</div>
                </div>
                <div>
                  <span className="text-[11px] text-gunmetal-600">会社名</span>
                  <div className="font-medium text-navy-900">{picked.company_name}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={clearCustomer}
                className="mt-3 text-[11px] font-medium text-navy-800 underline"
              >
                別の顧客を選ぶ
              </button>
            </div>
          ) : null}

          {!initialCustomerId && pickLoad === 'idle' && !picked ? (
            <p className="mt-2 text-sm leading-relaxed text-gunmetal-700">
              右上の「顧客一覧を別タブで開く」を押し、一覧で対象の{' '}
              <strong>顧客コード</strong> をクリックしてこの画面に戻ると、ここに会社名が表示されます（この画面では顧客の
              <strong>一括取得は行いません</strong>）。
            </p>
          ) : null}

          <p className="mt-2 text-[10px] text-gunmetal-500">
            締め日は下の欄で必要に応じて変更できます（マスタの締め日を初期表示しています）。
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="text-[11px] font-medium text-gunmetal-600">締め日</label>
          <input
            type="number"
            min={1}
            max={31}
            placeholder="1–31（任意）"
            value={f.closingDay}
            onChange={(e) => setF((p) => ({ ...p, closingDay: e.target.value }))}
            className="mt-1 w-full max-w-[12rem] rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-gunmetal-600">消費税率（売上は税抜。税額・合計は切り捨てで自動計算）</label>
          <select
            value={f.taxRateKey}
            onChange={(e) => setF((p) => ({ ...p, taxRateKey: e.target.value as LedgerTaxRateKey }))}
            className="mt-1 w-full max-w-xs rounded border px-3 py-2 text-sm"
          >
            <option value="10">10%</option>
            <option value="8">8%（軽減税率）</option>
            <option value="0">非課税</option>
          </select>
        </div>
        <div className="sm:col-span-2 grid gap-1 sm:grid-cols-3">
          <div className="text-[11px] text-gunmetal-600">売上金額（税抜）</div>
          <div className="text-[11px] text-gunmetal-600">消費税額</div>
          <div className="text-[11px] text-gunmetal-600">合計</div>
          <CurrencyInput
            value={f.salesAmount}
            onChange={(n) => setF((p) => ({ ...p, salesAmount: n }))}
            className="rounded border px-3 py-2 text-sm"
          />
          <CurrencyInput
            value={f.taxAmount}
            onChange={(n) => setF((p) => ({ ...p, taxAmount: n }))}
            className="rounded border px-3 py-2 text-sm"
          />
          <CurrencyInput
            value={f.totalAmount}
            onChange={(n) => setF((p) => ({ ...p, totalAmount: n }))}
            className="rounded border px-3 py-2 text-sm"
          />
        </div>

        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setPdfName(file.name);
            const reader = new FileReader();
            reader.onload = () => setF((p) => ({ ...p, pdfDataUrl: String(reader.result ?? '') }));
            reader.readAsDataURL(file);
          }}
        />
        <button type="button" onClick={() => pdfRef.current?.click()} className="rounded border px-3 py-2 text-sm sm:col-span-2">
          PDF添付（任意）
        </button>
        {pdfName ? <div className="text-xs text-gunmetal-600 sm:col-span-2">{pdfName}</div> : null}

        <button type="submit" className="rounded bg-navy-900 px-4 py-2 text-sm text-white sm:col-span-2">
          登録して一覧へ
        </button>
      </form>
    </Card>
  );
}
