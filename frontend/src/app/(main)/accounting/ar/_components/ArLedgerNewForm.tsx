'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { runSave } from '@/lib/save';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { taxFromExclusiveNet, ratePercentFromKey, type LedgerTaxRateKey } from '@/lib/taxCalc';

type Customer = { id: string; customer_code: string; company_name: string; closing_day: number | null };

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function ArLedgerNewForm({ listMonth }: { listMonth: string }) {
  const router = useRouter();
  const pdfRef = useRef<HTMLInputElement | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  /** API 失敗と「マスタ0件」を区別する（失敗時は空配列のままになりがち） */
  const [customersLoad, setCustomersLoad] = useState<'loading' | 'ok' | 'error'>('loading');
  const [pdfName, setPdfName] = useState('');
  const [nameQuery, setNameQuery] = useState('');

  const [f, setF] = useState({
    customerId: '',
    closingDay: '' as string,
    taxRateKey: '10' as LedgerTaxRateKey,
    salesAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    pdfDataUrl: '',
  });

  const filteredCustomers = useMemo(() => {
    const raw = nameQuery.trim();
    if (!raw) return customers;
    const q = norm(raw);
    return customers.filter(
      (c) =>
        norm(c.company_name).includes(q) ||
        norm(c.customer_code).includes(q)
    );
  }, [customers, nameQuery]);

  /** 絞り込み0件でもドロップダウンは全件表示（入力ミスで一覧が消えないようにする） */
  const selectCustomers = useMemo(() => {
    if (customers.length === 0) return [];
    return filteredCustomers.length > 0 ? filteredCustomers : customers;
  }, [customers, filteredCustomers]);

  useEffect(() => {
    setF((p) => {
      const r = ratePercentFromKey(p.taxRateKey);
      const tax = taxFromExclusiveNet(p.salesAmount, r);
      return { ...p, taxAmount: tax, totalAmount: p.salesAmount + tax };
    });
  }, [f.salesAmount, f.taxRateKey]);

  useEffect(() => {
    setCustomersLoad('loading');
    api<Customer[]>('/api/customers')
      .then((c) => {
        const list = Array.isArray(c) ? c : [];
        setCustomers(list);
        setCustomersLoad('ok');
        if (list[0]) {
          setF((p) => ({
            ...p,
            customerId: list[0].id,
            closingDay: String(list[0].closing_day ?? ''),
          }));
        }
      })
      .catch((e) => {
        console.error('[ArLedgerNewForm] /api/customers', e);
        setCustomers([]);
        setCustomersLoad('error');
      });
  }, []);

  /** ドロップダウン表示集合に選択中IDが無ければ先頭へ */
  useEffect(() => {
    if (selectCustomers.length === 0) return;
    if (!selectCustomers.some((c) => c.id === f.customerId)) {
      const first = selectCustomers[0];
      setF((p) => ({ ...p, customerId: first.id, closingDay: String(first.closing_day ?? '') }));
    }
  }, [selectCustomers, f.customerId]);

  /** 顧客名（絞り込み）＋締め日から顧客マスタをルックアップ */
  useEffect(() => {
    if (customers.length === 0) return;
    const list = filteredCustomers;
    if (list.length === 0) return;

    const dayStr = f.closingDay.trim();
    const dayNum = dayStr === '' ? null : Number(dayStr);
    const byDay =
      dayNum != null && Number.isFinite(dayNum) && dayNum >= 1 && dayNum <= 31
        ? list.filter((c) => c.closing_day === dayNum)
        : null;

    if (byDay && byDay.length === 1) {
      const c = byDay[0];
      if (f.customerId !== c.id) {
        setF((p) => ({ ...p, customerId: c.id }));
      }
      return;
    }

    if (list.length === 1) {
      const c = list[0];
      if (f.customerId !== c.id) {
        setF((p) => ({ ...p, customerId: c.id, closingDay: String(c.closing_day ?? '') }));
      }
    }
  }, [customers, filteredCustomers, f.closingDay, f.customerId]);

  function onPickCustomer(id: string) {
    const c = customers.find((x) => x.id === id);
    setF((p) => ({
      ...p,
      customerId: id,
      closingDay: c ? String(c.closing_day ?? '') : p.closingDay,
    }));
    setNameQuery('');
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (customersLoad !== 'ok') {
      window.alert('顧客マスタの読み込みが完了していません。再読み込みしてください。');
      return;
    }
    if (!f.customerId) {
      window.alert('顧客を選択してください');
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
        router.push(`/accounting/ar?month=${encodeURIComponent(listMonth)}`);
        router.refresh();
      }
    );
  }

  const backHref = `/accounting/ar?month=${encodeURIComponent(listMonth)}`;

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
          <label className="text-[11px] font-medium text-gunmetal-600">顧客名（顧客マスタ）</label>
          <input
            type="text"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="会社名・顧客コードの一部で絞り込み"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            list="ar-ledger-customer-datalist"
            autoComplete="off"
          />
          <datalist id="ar-ledger-customer-datalist">
            {customers.map((c) => (
              <option key={c.id} value={c.company_name} label={`${c.customer_code} / 締:${c.closing_day ?? '—'}`} />
            ))}
          </datalist>
          <label className="mt-2 block text-[11px] font-medium text-gunmetal-600">顧客を選択</label>
          <select
            required={customersLoad === 'ok' && customers.length > 0}
            disabled={
              customersLoad === 'loading' ||
              customersLoad === 'error' ||
              (customersLoad === 'ok' && customers.length === 0)
            }
            value={
              customersLoad === 'ok' && customers.length > 0 && selectCustomers.some((c) => c.id === f.customerId)
                ? f.customerId
                : ''
            }
            onChange={(e) => onPickCustomer(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-gunmetal-500"
          >
            {customersLoad === 'loading' ? (
              <option value="">顧客マスタを読み込み中…</option>
            ) : customersLoad === 'error' ? (
              <option value="">顧客一覧の取得に失敗しました（API・ネットワークを確認し、ページを再読み込みしてください）</option>
            ) : customers.length === 0 ? (
              <option value="">顧客マスタに登録がありません（先に顧客登録してください）</option>
            ) : (
              selectCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_code} {c.company_name}
                  {c.closing_day != null ? `（締:${c.closing_day}）` : ''}
                </option>
              ))
            )}
          </select>
          {customers.length > 0 && nameQuery.trim() && filteredCustomers.length === 0 ? (
            <p className="mt-1 text-[10px] text-amber-700">
              絞り込みに一致する顧客がありません。下の一覧は全件表示しています。
            </p>
          ) : null}
          <p className="mt-1 text-[10px] text-gunmetal-500">
            一覧は会社名・顧客コードの絞り込みで変わります（締め日では一覧を絞りません）。絞り込み後に締め日まで一致する顧客が1件だけのとき、自動で選びます。
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
