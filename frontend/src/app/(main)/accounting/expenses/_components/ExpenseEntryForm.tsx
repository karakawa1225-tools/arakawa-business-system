'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { runSave } from '@/lib/save';
import { normalizeToYmd, todayYmdLocal } from '@/lib/format';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DateInput } from '@/components/ui/DateInput';

type Account = { id: string; name: string; account_type?: string };
type TaxDivision = {
  id?: string;
  code: string;
  label: string;
  tax_rate: number;
  requires_invoice_no: boolean;
};

const fallbackTaxDivisions: TaxDivision[] = [
  { code: 'T10', label: '消費税10%', tax_rate: 10, requires_invoice_no: true },
  { code: 'T8', label: '消費税8%', tax_rate: 8, requires_invoice_no: true },
  { code: 'EXEMPT', label: '非課税', tax_rate: 0, requires_invoice_no: false },
  { code: 'OUT', label: '課税対象外', tax_rate: 0, requires_invoice_no: false },
];

function monthFromYmd(ymd: string, fallback: string): string {
  const y = ymd.slice(0, 10);
  if (y.length >= 7) return y.slice(0, 7);
  return fallback;
}

export function ExpenseEntryForm({
  expenseId,
  listMonth,
}: {
  expenseId?: string;
  /** 一覧に戻る際の月（新規のデフォルト日付にも使用） */
  listMonth: string;
}) {
  const router = useRouter();
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [taxDivisions, setTaxDivisions] = useState<TaxDivision[]>(fallbackTaxDivisions);
  const [receiptFileName, setReceiptFileName] = useState('');
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyPreview, setCopyPreview] = useState<null | { expenseDate: string; taxDivisionCode: string | null }>(
    null
  );
  const [loading, setLoading] = useState(!!expenseId);
  const [f, setF] = useState({
    expenseDate: listMonth.match(/^\d{4}-\d{2}$/) ? `${listMonth}-15` : todayYmdLocal(),
    paymentDestination: '',
    chartAccountId: '',
    amount: 0,
    taxDivisionId: 'T10',
    taxRate: 10,
    supplierInvoiceNo: '',
    description: '',
    receiptImageUrl: '',
  });

  useEffect(() => {
    api<Account[]>('/api/masters/accounts').then((a) => {
      setAccounts(a);
      const exp = a.find((x) => String(x.name).includes('旅費')) ?? a[0];
      setF((prev) => ({ ...prev, chartAccountId: prev.chartAccountId || exp?.id || '' }));
    });
    api<TaxDivision[]>('/api/masters/tax-divisions')
      .then((t) => {
        if (t && t.length > 0) {
          setTaxDivisions(t.map((x) => ({ ...x, tax_rate: Number((x as { tax_rate: unknown }).tax_rate) })));
        }
      })
      .catch(() => setTaxDivisions(fallbackTaxDivisions));
  }, []);

  useEffect(() => {
    if (!expenseId) {
      setLoading(false);
      setF((prev) => ({
        ...prev,
        expenseDate: prev.expenseDate.slice(0, 7) === listMonth ? prev.expenseDate : `${listMonth}-15`,
      }));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await api<Record<string, unknown>>(`/api/expenses/${expenseId}`);
        if (cancelled) return;
        const code =
          (r.tax_division_code as string | undefined) ??
          (Number(r.tax_rate) === 10 ? 'T10' : Number(r.tax_rate) === 8 ? 'T8' : 'EXEMPT');
        setF({
          expenseDate: normalizeToYmd(r.expense_date) || String(r.expense_date ?? ''),
          paymentDestination: String(r.payment_destination ?? ''),
          chartAccountId: String(r.chart_account_id ?? ''),
          amount: Number(r.amount ?? 0),
          taxDivisionId: code,
          taxRate: Number(r.tax_rate ?? 10),
          supplierInvoiceNo: String(r.supplier_invoice_no ?? ''),
          description: String(r.description ?? ''),
          receiptImageUrl: '',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expenseId, listMonth]);

  const backMonth = monthFromYmd(f.expenseDate, listMonth);
  const listHref = `/accounting/expenses?month=${encodeURIComponent(backMonth)}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.expenseDate) {
      window.alert('日付をカレンダーで選択してください。');
      return;
    }
    const td = taxDivisions.find((x) => x.code === f.taxDivisionId);
    if (!expenseId && td?.requires_invoice_no && !f.supplierInvoiceNo.trim()) {
      window.alert('インボイス番号を入力してください。');
      return;
    }
    if (expenseId) {
      const etd = taxDivisions.find((x) => x.code === f.taxDivisionId);
      if (etd?.requires_invoice_no && !f.supplierInvoiceNo.trim()) {
        window.alert('インボイス番号を入力してください。');
        return;
      }
    }

    if (expenseId) {
      await runSave(
        () =>
          api(`/api/expenses/${expenseId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              expenseDate: f.expenseDate,
              chartAccountId: f.chartAccountId,
              amount: f.amount,
              taxRate: f.taxRate,
              taxDivisionId: f.taxDivisionId || null,
              supplierInvoiceNo: f.supplierInvoiceNo || null,
              paymentDestination: f.paymentDestination || null,
              description: f.description || null,
            }),
          }),
        async () => {
          router.push(listHref);
          router.refresh();
        }
      );
    } else {
      await runSave(
        () =>
          api('/api/expenses', {
            method: 'POST',
            body: JSON.stringify({
              expenseDate: f.expenseDate,
              chartAccountId: f.chartAccountId,
              amount: f.amount,
              taxRate: f.taxRate,
              taxDivisionId: f.taxDivisionId || null,
              supplierInvoiceNo: f.supplierInvoiceNo || null,
              paymentDestination: f.paymentDestination || null,
              description: f.description,
              receiptImageUrl: f.receiptImageUrl || null,
            }),
          }),
        async () => {
          router.push(listHref);
          router.refresh();
        }
      );
    }
  }

  async function copyFromPast(e: React.MouseEvent) {
    e.preventDefault();
    if (!f.paymentDestination.trim()) {
      window.alert('支払先を入力してください。');
      return;
    }
    setCopyLoading(true);
    setCopyPreview(null);
    try {
      const data = await api<{
        found: boolean;
        expenseDate?: string;
        chartAccountId?: string;
        taxDivisionCode?: string | null;
        supplierInvoiceNo?: string | null;
        description?: string | null;
      }>(`/api/expenses/history?paymentDestination=${encodeURIComponent(f.paymentDestination)}`);
      if (!data.found || !data.expenseDate) {
        window.alert('この支払先の過去データがありません。');
        return;
      }
      const td = taxDivisions.find((x) => x.code === data.taxDivisionCode) ?? null;
      const requiresInvoice = data.taxDivisionCode === 'T10' || data.taxDivisionCode === 'T8';
      const nextTaxRate = td
        ? Number(td.tax_rate)
        : data.taxDivisionCode === 'T10'
          ? 10
          : data.taxDivisionCode === 'T8'
            ? 8
            : 0;
      setF((prev) => ({
        ...prev,
        chartAccountId: data.chartAccountId ?? prev.chartAccountId,
        taxDivisionId: (data.taxDivisionCode ?? prev.taxDivisionId) as string,
        taxRate: nextTaxRate,
        supplierInvoiceNo: requiresInvoice ? String(data.supplierInvoiceNo ?? '') : '',
        description: String(data.description ?? ''),
      }));
      setCopyPreview({ expenseDate: data.expenseDate, taxDivisionCode: data.taxDivisionCode ?? null });
    } finally {
      setCopyLoading(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gunmetal-600">読み込み中…</p>;
  }

  return (
    <Card className="max-w-xl">
      <div className="mb-4">
        <Link href={listHref} className="text-sm text-navy-900 underline">
          ← 一覧へ
        </Link>
      </div>
      <h2 className="text-sm font-medium">{expenseId ? '経費の編集' : '経費入力'}</h2>
      <form onSubmit={(e) => void submit(e)} className="mt-3 space-y-2">
        <DateInput
          value={f.expenseDate}
          onChange={(v) => setF({ ...f, expenseDate: v })}
          required
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <div className="space-y-1">
          <label className="text-xs text-gunmetal-600">支払先</label>
          <div className="flex gap-2">
            <input
              placeholder="支払先（取引先名）"
              value={f.paymentDestination}
              onChange={(e) => setF({ ...f, paymentDestination: e.target.value })}
              className="w-full flex-1 rounded border px-3 py-2 text-sm"
            />
            {!expenseId ? (
              <button
                type="button"
                onClick={copyFromPast}
                disabled={copyLoading}
                className="rounded border px-3 py-2 text-sm text-navy-900 hover:bg-aqua-50 disabled:opacity-50"
              >
                {copyLoading ? 'コピー中…' : '過去からコピー'}
              </button>
            ) : null}
          </div>
          {copyPreview ? (
            <div className="text-xs text-gunmetal-600">
              コピー元: {copyPreview.expenseDate}（税区分: {copyPreview.taxDivisionCode ?? '—'}）
            </div>
          ) : null}
        </div>
        <select
          required
          value={f.chartAccountId}
          onChange={(e) => setF({ ...f, chartAccountId: e.target.value })}
          className="w-full rounded border px-3 py-2 text-sm"
        >
          <option value="">勘定科目</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <CurrencyInput
          placeholder="金額"
          value={f.amount}
          onChange={(n) => setF({ ...f, amount: n })}
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <select
          required
          value={f.taxDivisionId}
          onChange={(e) => {
            const code = e.target.value;
            const td = taxDivisions.find((x) => x.code === code);
            setF((prev) => ({
              ...prev,
              taxDivisionId: code,
              taxRate: td ? Number(td.tax_rate) : prev.taxRate,
              supplierInvoiceNo: td?.requires_invoice_no ? prev.supplierInvoiceNo : '',
            }));
          }}
          className="w-full rounded border px-3 py-2 text-sm"
        >
          {taxDivisions.map((td) => (
            <option key={td.code} value={td.code}>
              {td.label}
            </option>
          ))}
        </select>
        <input
          placeholder="摘要"
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
          className="w-full rounded border px-3 py-2 text-sm"
        />
        {(() => {
          const td = taxDivisions.find((x) => x.code === f.taxDivisionId);
          if (!td?.requires_invoice_no) return null;
          return (
            <div className="space-y-1">
              <label className="text-xs text-gunmetal-600">インボイス番号</label>
              <input
                required
                placeholder="TXXXXXXXXXXXX"
                value={f.supplierInvoiceNo}
                onChange={(e) => setF({ ...f, supplierInvoiceNo: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          );
        })()}
        {!expenseId ? (
          <div className="space-y-1">
            <label className="text-xs text-gunmetal-600">領収書</label>
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setReceiptFileName(file.name);
                const reader = new FileReader();
                reader.onload = () => {
                  setF((prev) => ({ ...prev, receiptImageUrl: String(reader.result ?? '') }));
                };
                reader.readAsDataURL(file);
              }}
            />
            <button
              type="button"
              onClick={() => receiptInputRef.current?.click()}
              className="w-full rounded border px-3 py-2 text-sm text-navy-900 hover:bg-aqua-50"
            >
              撮影 / フォルダから選択
            </button>
            {receiptFileName ? <div className="text-xs text-gunmetal-600">{receiptFileName}</div> : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-2">
          <button type="submit" className="rounded bg-navy-900 px-4 py-2 text-sm text-white">
            {expenseId ? '保存' : '登録'}
          </button>
          <Link href={listHref} className="rounded border px-4 py-2 text-sm">
            キャンセル
          </Link>
        </div>
      </form>
    </Card>
  );
}
