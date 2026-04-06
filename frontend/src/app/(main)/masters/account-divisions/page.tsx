'use client';

import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api, apiDelete } from '@/lib/api';
import { runSave } from '@/lib/save';

const ACCOUNT_TYPES = [
  { value: 'asset', label: '資産' },
  { value: 'liability', label: '負債' },
  { value: 'equity', label: '純資産' },
  { value: 'revenue', label: '収益' },
  { value: 'expense', label: '費用' },
] as const;

type Row = Record<string, unknown>;

export default function AccountDivisionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [divisionCode, setDivisionCode] = useState('');
  const [divisionName, setDivisionName] = useState('');
  const [accountType, setAccountType] = useState<string>('expense');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<string>('expense');

  async function load() {
    const data = await api<Row[]>('/api/masters/account-divisions');
    setRows(data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const dc = divisionCode.trim();
    const dn = divisionName.trim();
    if (!dc || !dn) {
      window.alert('区分コードと区分を入力してください。');
      return;
    }
    const ok = await runSave(
      () =>
        api('/api/masters/account-divisions', {
          method: 'POST',
          body: JSON.stringify({
            divisionCode: dc,
            divisionName: dn,
            accountType,
          }),
        }),
      load
    );
    if (!ok) return;
    setDivisionCode('');
    setDivisionName('');
  }

  function startEdit(r: Row) {
    setEditingId(String(r.id));
    setEditCode(String(r.division_code ?? ''));
    setEditName(String(r.division_name ?? ''));
    setEditType(String(r.account_type ?? 'expense'));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditCode('');
    setEditName('');
    setEditType('expense');
  }

  async function saveEdit() {
    if (!editingId) return;
    const eid = editingId;
    const dc = editCode.trim();
    const dn = editName.trim();
    if (!dc || !dn) {
      window.alert('区分コードと区分を入力してください。');
      return;
    }
    await runSave(
      () =>
        api(`/api/masters/account-divisions/${eid}`, {
          method: 'PATCH',
          body: JSON.stringify({
            divisionCode: dc,
            divisionName: dn,
            accountType: editType,
          }),
        }),
      async () => {
        cancelEdit();
        await load();
      }
    );
  }

  async function remove(id: string) {
    if (!window.confirm('この区分を削除しますか？（勘定科目で使われている場合は削除できません）')) return;
    const ok = await runSave(() => apiDelete(`/api/masters/account-divisions/${id}`), load);
    if (ok && editingId === id) cancelEdit();
  }

  function typeLabel(v: string) {
    return ACCOUNT_TYPES.find((t) => t.value === v)?.label ?? v;
  }

  return (
    <>
      <PageTitle
        title="勘定科目区分マスタ"
        description="区分コード・区分名を登録します。財務区分は帳票・集計用です。"
      />
      <Card className="mb-6 max-w-2xl">
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-2">
          <input
            required
            placeholder="区分コード"
            value={divisionCode}
            onChange={(e) => setDivisionCode(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="区分（名称）"
            value={divisionName}
            onChange={(e) => setDivisionName(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          />
          <select
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
            className="rounded border px-3 py-2 text-sm sm:col-span-2"
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                財務区分: {t.label}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-navy-900 px-4 py-2 text-sm text-white sm:col-span-2">
            追加
          </button>
        </form>
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left">区分コード</th>
              <th className="px-4 py-3 text-left">区分</th>
              <th className="px-4 py-3 text-left">財務区分</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b border-slate-100">
                {editingId === String(r.id) ? (
                  <>
                    <td className="px-4 py-3">
                      <input
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                        className="w-full max-w-[10rem] rounded border px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded border px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        className="rounded border px-2 py-1 text-sm"
                      >
                        {ACCOUNT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => void saveEdit()} className="rounded bg-navy-900 px-3 py-1.5 text-xs text-white">
                          保存
                        </button>
                        <button type="button" onClick={cancelEdit} className="rounded border px-3 py-1.5 text-xs">
                          キャンセル
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">{String(r.division_code ?? '')}</td>
                    <td className="px-4 py-3">{String(r.division_name ?? '')}</td>
                    <td className="px-4 py-3">{typeLabel(String(r.account_type ?? ''))}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
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
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
