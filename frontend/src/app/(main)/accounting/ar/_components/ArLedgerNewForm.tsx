'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { runSave } from '@/lib/save';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { taxFromExclusiveNet, ratePercentFromKey, type LedgerTaxRateKey } from '@/lib/taxCalc';

type Customer = { id: string; customer_code: string; company_name: string; closing_day: number | null };

export function ArLedgerNewForm({ listMonth }: { listMonth: string }) {
  const router = useRouter();
  const pdfRef = useRef<HTMLInputElement | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
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

  useEffect(() => {
    api<Customer[]>('/api/customers').then((c) => {
      setCustomers(c);
      if (c[0]) setF((p) => ({ ...p, customerId: c[0].id, closingDay: String(c[0].closing_day ?? '') }));
    });
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
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
      <form onSubmit={add} className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          required
          value={f.customerId}
          onChange={(e) => {
            const id = e.target.value;
            const c = customers.find((x) => x.id === id);
            setF((p) => ({ ...p, customerId: id, closingDay: String(c?.closing_day ?? '') }));
          }}
          className="rounded border px-3 py-2 text-sm sm:col-span-2"
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.customer_code} {c.company_name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={31}
          placeholder="締め日 1–31（任意）"
          value={f.closingDay}
          onChange={(e) => setF((p) => ({ ...p, closingDay: e.target.value }))}
          className="rounded border px-3 py-2 text-sm"
        />
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
