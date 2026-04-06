'use client';

import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api, apiDelete } from '@/lib/api';
import { runSave } from '@/lib/save';

export default function BanksMasterPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [f, setF] = useState({ name: '', bankName: '', branchName: '', accountNumber: '', holderName: '', openingBalance: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: '', bankName: '', branchName: '', accountNumber: '', holderName: '' });

  async function load() {
    const data = await api<Record<string, unknown>[]>('/api/masters/bank-accounts');
    setRows(data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const ok = await runSave(
      () =>
        api('/api/masters/bank-accounts', {
          method: 'POST',
          body: JSON.stringify({
            name: f.name,
            bankName: f.bankName,
            branchName: f.branchName,
            accountNumber: f.accountNumber,
            holderName: f.holderName,
            openingBalance: f.openingBalance,
          }),
        }),
      load
    );
    if (!ok) return;
    setF({ name: '', bankName: '', branchName: '', accountNumber: '', holderName: '', openingBalance: 0 });
  }

  function startEdit(r: Record<string, unknown>) {
    setEditingId(String(r.id));
    setEdit({
      name: String(r.name ?? ''),
      bankName: String(r.bank_name ?? ''),
      branchName: String(r.branch_name ?? ''),
      accountNumber: String(r.account_number ?? ''),
      holderName: String(r.holder_name ?? ''),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEdit({ name: '', bankName: '', branchName: '', accountNumber: '', holderName: '' });
  }

  async function saveEdit() {
    if (!editingId) return;
    const eid = editingId;
    await runSave(
      () =>
        api(`/api/masters/bank-accounts/${eid}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: edit.name,
            bankName: edit.bankName || null,
            branchName: edit.branchName || null,
            accountNumber: edit.accountNumber || null,
            holderName: edit.holderName || null,
          }),
        }),
      async () => {
        cancelEdit();
        await load();
      }
    );
  }

  async function remove(id: string) {
    if (!window.confirm('この銀行口座を削除しますか？')) return;
    const ok = await runSave(() => apiDelete(`/api/masters/bank-accounts/${id}`), load);
    if (ok && editingId === id) cancelEdit();
  }

  return (
    <>
      <PageTitle title="銀行口座マスタ" />
      <Card className="mb-6 max-w-xl">
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-2">
          <input required placeholder="表示名" className="rounded border px-3 py-2 text-sm sm:col-span-2" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input placeholder="銀行名" className="rounded border px-3 py-2 text-sm" value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} />
          <input placeholder="支店" className="rounded border px-3 py-2 text-sm" value={f.branchName} onChange={(e) => setF({ ...f, branchName: e.target.value })} />
          <input placeholder="口座番号" className="rounded border px-3 py-2 text-sm" value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value })} />
          <input placeholder="名義" className="rounded border px-3 py-2 text-sm" value={f.holderName} onChange={(e) => setF({ ...f, holderName: e.target.value })} />
          <input type="number" placeholder="初期残高" className="rounded border px-3 py-2 text-sm sm:col-span-2" value={f.openingBalance} onChange={(e) => setF({ ...f, openingBalance: Number(e.target.value) })} />
          <button type="submit" className="rounded bg-navy-900 px-4 py-2 text-sm text-white sm:col-span-2">
            追加
          </button>
        </form>
      </Card>
      <Card>
        <ul className="divide-y text-sm">
          {rows.map((r) => (
            <li key={String(r.id)} className="py-2">
              {editingId === String(r.id) ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    required
                    placeholder="表示名"
                    className="rounded border px-3 py-2 text-sm sm:col-span-2"
                    value={edit.name}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  />
                  <input
                    placeholder="銀行名"
                    className="rounded border px-3 py-2 text-sm"
                    value={edit.bankName}
                    onChange={(e) => setEdit({ ...edit, bankName: e.target.value })}
                  />
                  <input
                    placeholder="支店"
                    className="rounded border px-3 py-2 text-sm"
                    value={edit.branchName}
                    onChange={(e) => setEdit({ ...edit, branchName: e.target.value })}
                  />
                  <input
                    placeholder="口座番号"
                    className="rounded border px-3 py-2 text-sm"
                    value={edit.accountNumber}
                    onChange={(e) => setEdit({ ...edit, accountNumber: e.target.value })}
                  />
                  <input
                    placeholder="名義"
                    className="rounded border px-3 py-2 text-sm"
                    value={edit.holderName}
                    onChange={(e) => setEdit({ ...edit, holderName: e.target.value })}
                  />
                  <div className="flex gap-2 sm:col-span-2">
                    <button type="button" onClick={saveEdit} className="rounded bg-navy-900 px-3 py-1.5 text-sm text-white">
                      保存
                    </button>
                    <button type="button" onClick={cancelEdit} className="rounded border px-3 py-1.5 text-sm">
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    {String(r.name)} — {String(r.bank_name ?? '')} {String(r.branch_name ?? '')}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEdit(r)} className="rounded border px-3 py-1.5 text-xs">
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(String(r.id))}
                      className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-700"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
