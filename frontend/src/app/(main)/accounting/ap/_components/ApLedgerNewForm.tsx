'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { runSave } from '@/lib/save';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { taxFromExclusiveNet, ratePercentFromKey, type LedgerTaxRateKey } from '@/lib/taxCalc';

type Supplier = { id: string; supplier_code: string; name: string };

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function ApLedgerNewForm({ listMonth }: { listMonth: string }) {
  const router = useRouter();
  const pdfRef = useRef<HTMLInputElement | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pdfName, setPdfName] = useState('');
  const [nameQuery, setNameQuery] = useState('');

  const [f, setF] = useState({
    supplierId: '',
    closingDay: '' as string,
    taxRateKey: '10' as LedgerTaxRateKey,
    amount: 0,
    taxAmount: 0,
    totalAmount: 0,
    pdfDataUrl: '',
  });

  const filteredSuppliers = useMemo(() => {
    const q = norm(nameQuery);
    if (!q) return suppliers;
    return suppliers.filter(
      (s) => norm(s.name).includes(q) || norm(s.supplier_code).includes(q)
    );
  }, [suppliers, nameQuery]);

  useEffect(() => {
    setF((p) => {
      const r = ratePercentFromKey(p.taxRateKey);
      const tax = taxFromExclusiveNet(p.amount, r);
      return { ...p, taxAmount: tax, totalAmount: p.amount + tax };
    });
  }, [f.amount, f.taxRateKey]);

  useEffect(() => {
    api<Supplier[]>('/api/suppliers').then((s) => {
      setSuppliers(s);
      if (s[0]) {
        setF((p) => ({ ...p, supplierId: s[0].id }));
        setNameQuery(s[0].name);
      }
    });
  }, []);

  /** 絞り込み後に、選択中IDが一覧外なら先頭へ */
  useEffect(() => {
    if (filteredSuppliers.length === 0) return;
    if (!filteredSuppliers.some((s) => s.id === f.supplierId)) {
      const first = filteredSuppliers[0];
      setF((p) => ({ ...p, supplierId: first.id }));
    }
  }, [filteredSuppliers, f.supplierId]);

  /** 仕入先名の絞り込みで仕入先マスタをルックアップ（1件に絞れたら自動選択） */
  useEffect(() => {
    if (suppliers.length === 0) return;
    const list = filteredSuppliers;
    if (list.length !== 1) return;
    const s = list[0];
    if (f.supplierId !== s.id) {
      setF((p) => ({ ...p, supplierId: s.id }));
      setNameQuery(s.name);
    }
  }, [suppliers, filteredSuppliers, f.supplierId]);

  function onPickSupplier(id: string) {
    const s = suppliers.find((x) => x.id === id);
    setF((p) => ({ ...p, supplierId: id }));
    if (s) setNameQuery(s.name);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await runSave(
      () =>
        api('/api/ap-ledger', {
          method: 'POST',
          body: JSON.stringify({
            supplierId: f.supplierId,
            month: listMonth,
            closingDay: f.closingDay ? Number(f.closingDay) : null,
            amount: f.amount,
            taxAmount: f.taxAmount,
            totalAmount: f.totalAmount || f.amount + f.taxAmount,
            pdfDataUrl: f.pdfDataUrl || null,
          }),
        }),
      async () => {
        router.push(`/accounting/ap?month=${encodeURIComponent(listMonth)}`);
        router.refresh();
      }
    );
  }

  const backHref = `/accounting/ap?month=${encodeURIComponent(listMonth)}`;

  return (
    <Card className="max-w-xl">
      <div className="mb-4">
        <Link href={backHref} className="text-sm text-navy-900 underline">
          ← 買掛金一覧へ
        </Link>
      </div>
      <h2 className="text-sm font-medium">新規登録（対象月: {listMonth}）</h2>
      <form onSubmit={add} className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-[11px] font-medium text-gunmetal-600">仕入先名（仕入先マスタ）</label>
          <input
            type="text"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="仕入先名・仕入先コードの一部で絞り込み"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            list="ap-ledger-supplier-datalist"
            autoComplete="off"
          />
          <datalist id="ap-ledger-supplier-datalist">
            {suppliers.map((s) => (
              <option key={s.id} value={s.name} label={s.supplier_code} />
            ))}
          </datalist>
          <label className="mt-2 block text-[11px] font-medium text-gunmetal-600">仕入先を選択</label>
          <select
            required
            value={f.supplierId}
            onChange={(e) => onPickSupplier(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {filteredSuppliers.length === 0 ? (
              <option value="">該当する仕入先がありません</option>
            ) : (
              filteredSuppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.supplier_code} {s.name}
                </option>
              ))
            )}
          </select>
          <p className="mt-1 text-[10px] text-gunmetal-500">
            絞り込み結果が1件のとき、自動で選びます（締め日は仕入先マスタにないため、手入力です）。
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
          <label className="text-xs text-gunmetal-600">消費税率（仕入は税抜。税額・合計は切り捨てで自動計算）</label>
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
          <div className="text-[11px] text-gunmetal-600">仕入金額（税抜）</div>
          <div className="text-[11px] text-gunmetal-600">消費税額</div>
          <div className="text-[11px] text-gunmetal-600">合計</div>
          <CurrencyInput
            value={f.amount}
            onChange={(n) => setF((p) => ({ ...p, amount: n }))}
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
