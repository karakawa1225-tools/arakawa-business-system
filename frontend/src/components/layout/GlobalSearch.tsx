'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export type SearchHit = {
  kind: string;
  id: string;
  title: string;
  subtitle: string | null;
  meta?: Record<string, string>;
};

const KIND_ORDER = [
  'customer',
  'supplier',
  'product',
  'estimate',
  'sales_order',
  'invoice',
  'payment',
  'expense',
  'bank_transaction',
  'travel_claim',
  'payroll_entry',
  'ar_ledger',
  'ap_ledger',
  'user',
] as const;

const KIND_LABEL_JA: Record<string, string> = {
  customer: '顧客',
  supplier: '仕入先',
  product: '商品',
  estimate: '見積',
  sales_order: '受注',
  invoice: '請求',
  payment: '入金',
  expense: '経費',
  bank_transaction: '銀行取引',
  travel_claim: '出張旅費',
  payroll_entry: '給与',
  ar_ledger: '売掛金（月次）',
  ap_ledger: '買掛金（月次）',
  user: 'ユーザ',
};

function hitHref(hit: SearchHit): string {
  const m = hit.meta ?? {};
  switch (hit.kind) {
    case 'customer':
      return `/crm/customers/${hit.id}`;
    case 'supplier':
      return `/purchase/suppliers`;
    case 'product':
      return `/products`;
    case 'estimate':
      return `/sales/estimates/${hit.id}`;
    case 'sales_order':
      return `/sales/orders/${hit.id}`;
    case 'invoice':
      return `/sales/invoices`;
    case 'payment':
      return `/sales/payments/${hit.id}`;
    case 'expense':
      return `/accounting/expenses/${hit.id}/edit?month=${encodeURIComponent(m.month ?? '')}`;
    case 'bank_transaction':
      return `/accounting/bank/${hit.id}/edit?accountId=${encodeURIComponent(m.accountId ?? '')}`;
    case 'travel_claim':
      return `/accounting/travel/${hit.id}`;
    case 'payroll_entry':
      return `/accounting/payroll/${hit.id}/edit?month=${encodeURIComponent(m.month ?? '')}`;
    case 'ar_ledger':
      return `/accounting/ar?month=${encodeURIComponent(m.month ?? '')}`;
    case 'ap_ledger':
      return `/accounting/ap?month=${encodeURIComponent(m.month ?? '')}`;
    case 'user':
      return `/masters/users/${hit.id}/edit`;
    default:
      return '/home';
  }
}

export function GlobalSearch() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (term: string) => {
    const t = term.trim();
    if (t.length < 2) {
      setHits([]);
      setHint(t.length > 0 ? 'あと1文字入力してください' : null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setHint(null);
    try {
      const data = await api<{ hits: SearchHit[]; hint?: string }>(
        `/api/search?q=${encodeURIComponent(t)}`
      );
      setHits(data.hits ?? []);
      if ((data.hits?.length ?? 0) === 0) {
        setHint('該当するデータがありません');
      }
    } catch {
      setHits([]);
      setHint('検索に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!open) return;
    debounceRef.current = setTimeout(() => {
      void runSearch(q);
    }, 320);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, open, runSearch]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    label: KIND_LABEL_JA[kind] ?? kind,
    items: hits.filter((h) => h.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <div ref={wrapRef} className="relative min-w-0 max-w-md flex-1">
      <label htmlFor="global-search" className="sr-only">
        全体検索
      </label>
      <input
        id="global-search"
        type="search"
        autoComplete="off"
        placeholder="全体検索（顧客・取引・経費など）"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        className="w-full rounded-md border border-aqua-400/80 bg-white/90 px-3 py-2 text-sm text-navy-900 placeholder:text-gunmetal-500 focus:border-aqua-600 focus:outline-none focus:ring-1 focus:ring-aqua-500"
      />
      {open && (q.trim().length > 0 || loading || hint) ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[min(70vh,28rem)] overflow-auto rounded-md border border-slate-200 bg-white py-2 shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-xs text-gunmetal-600">検索中…</p>
          ) : grouped.length === 0 && hint ? (
            <p className="px-3 py-2 text-xs text-gunmetal-600">{hint}</p>
          ) : (
            grouped.map((g) => (
              <div key={g.kind} className="mb-2 last:mb-0">
                <p className="sticky top-0 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-aqua-800">
                  {g.label}
                </p>
                <ul className="divide-y divide-slate-100">
                  {g.items.map((hit) => (
                    <li key={`${hit.kind}-${hit.id}`}>
                      <Link
                        href={hitHref(hit)}
                        onClick={() => {
                          setOpen(false);
                          setQ('');
                          setHits([]);
                        }}
                        className="block px-3 py-2 text-sm hover:bg-aqua-50/80"
                      >
                        <span className="font-medium text-navy-900">{hit.title}</span>
                        {hit.subtitle ? (
                          <span className="mt-0.5 block text-xs text-gunmetal-600">{hit.subtitle}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
