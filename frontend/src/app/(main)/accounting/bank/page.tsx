'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api, apiDelete } from '@/lib/api';
import { runSave } from '@/lib/save';
import { formatDateJa, formatJPY } from '@/lib/format';

type Tx = Record<string, unknown>;

export default function BankPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<
    { id: string; name: string; bank_name?: string | null; branch_name?: string | null }[]
  >([]);
  const [accountId, setAccountId] = useState('');
  const [rows, setRows] = useState<Tx[]>([]);

  async function reloadRows() {
    if (!accountId) return;
    const q = new URLSearchParams({ accountId });
    const data = await api<Tx[]>(`/api/bank/transactions?${q}`);
    setRows(data);
  }

  useEffect(() => {
    api<{ id: string; name: string; bank_name?: string | null; branch_name?: string | null }[]>(
      '/api/bank/accounts'
    ).then((a) => {
      setAccounts(a);
      const fromUrl = searchParams.get('accountId');
      const pick = fromUrl && a.some((x) => x.id === fromUrl) ? fromUrl : a[0]?.id ?? '';
      setAccountId(pick);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fromUrl = searchParams.get('accountId');
    if (fromUrl && accounts.some((x) => x.id === fromUrl) && fromUrl !== accountId) {
      setAccountId(fromUrl);
    }
  }, [searchParams, accounts, accountId]);

  useEffect(() => {
    void reloadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  function onAccountChange(next: string) {
    setAccountId(next);
    router.replace(`/accounting/bank?accountId=${encodeURIComponent(next)}`);
  }

  const newHref = accountId
    ? `/accounting/bank/new?accountId=${encodeURIComponent(accountId)}`
    : '/accounting/bank/new';

  return (
    <>
      <PageTitle title="銀行入出金管理" description="口座を選び一覧を表示します。登録・編集は別画面で行い、保存後に戻ります。" />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-gunmetal-600">口座</label>
          <select
            value={accountId}
            onChange={(e) => onAccountChange(e.target.value)}
            className="ml-2 rounded border px-3 py-2 text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.bank_name || a.branch_name ? `（${String(a.bank_name ?? '')} ${String(a.branch_name ?? '')}）` : ''}
              </option>
            ))}
          </select>
        </div>
        {accountId ? (
          <Link href={newHref} className="rounded bg-navy-900 px-4 py-2 text-sm text-white">
            取引を追加
          </Link>
        ) : null}
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left">日付</th>
              <th className="px-4 py-3 text-left">区分</th>
              <th className="px-4 py-3 text-left">摘要</th>
              <th className="px-4 py-3 text-right">金額</th>
              <th className="px-4 py-3 text-right">残高</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gunmetal-600">
                  取引がありません。口座を選び
                  {accountId ? (
                    <>
                      <Link href={newHref} className="mx-1 font-medium text-navy-900 underline">
                        取引を追加
                      </Link>
                    </>
                  ) : null}
                  から登録できます。
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const id = String(r.id);
              return (
                <tr key={id} className="border-b border-slate-100">
                  <td className="px-4 py-3">{formatDateJa(r.tx_date)}</td>
                  <td className="px-4 py-3">{String(r.tx_type)}</td>
                  <td className="px-4 py-3">{String(r.description ?? '')}</td>
                  <td className="px-4 py-3 text-right">{formatJPY(r.amount)}</td>
                  <td className="px-4 py-3 text-right">{r.balance_after != null ? formatJPY(r.balance_after) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/accounting/bank/${id}/edit?accountId=${encodeURIComponent(accountId)}`}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        編集
                      </Link>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm('この取引を削除しますか？')) return;
                          await runSave(() => api(`/api/bank/transactions/${id}`, { method: 'DELETE' }), reloadRows);
                        }}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
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