'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api, apiDelete } from '@/lib/api';
import { runSave } from '@/lib/save';

type Division = { id: string; division_code: string; division_name: string; account_type: string };

const TYPE_LABEL: Record<string, string> = {
  asset: '資産',
  liability: '負債',
  equity: '純資産',
  revenue: '収益',
  expense: '費用',
};

function onlyDigits3(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 3);
}

export default function AccountsMasterPage() {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [barcodeCode, setBarcodeCode] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editBarcodeCode, setEditBarcodeCode] = useState('');
  const [editDivisionId, setEditDivisionId] = useState('');
  const [importBusy, setImportBusy] = useState(false);

  async function loadDivisions() {
    const d = await api<Division[]>('/api/masters/account-divisions');
    setDivisions(d);
    setDivisionId((prev) => prev || d[0]?.id || '');
  }

  async function load() {
    const data = await api<Record<string, unknown>[]>('/api/masters/accounts');
    setRows(data);
  }

  useEffect(() => {
    void loadDivisions();
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const c = onlyDigits3(code);
    if (c.length !== 3) {
      window.alert('勘定科目コードは半角数字3桁で入力してください。');
      return;
    }
    if (!divisionId) {
      window.alert('先に「勘定科目区分マスタ」で区分を登録してください。');
      return;
    }
    const ok = await runSave(
      () =>
        api('/api/masters/accounts', {
          method: 'POST',
          body: JSON.stringify({ name, code: c, divisionId, barcodeCode: barcodeCode.trim() || null }),
        }),
      async () => {
        await load();
      }
    );
    if (!ok) return;
    setName('');
    setCode('');
    setBarcodeCode('');
  }

  function startEdit(r: Record<string, unknown>) {
    setEditingId(String(r.id));
    setEditCode(onlyDigits3(String(r.code ?? '')));
    setEditName(String(r.name ?? ''));
    setEditBarcodeCode(String(r.barcode_code ?? ''));
    setEditDivisionId(String(r.division_id ?? ''));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditCode('');
    setEditBarcodeCode('');
    setEditDivisionId('');
  }

  async function saveEdit() {
    if (!editingId) return;
    const id = editingId;
    const c = onlyDigits3(editCode);
    if (c.length !== 3) {
      window.alert('勘定科目コードは半角数字3桁で入力してください。');
      return;
    }
    await runSave(
      () =>
        api(`/api/masters/accounts/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            code: c,
            name: editName,
            divisionId: editDivisionId,
            barcodeCode: editBarcodeCode.trim() || null,
          }),
        }),
      async () => {
        cancelEdit();
        await load();
      }
    );
  }

  async function remove(id: string) {
    if (!window.confirm('この勘定科目を削除しますか？')) return;
    const ok = await runSave(() => apiDelete(`/api/masters/accounts/${id}`), load);
    if (ok && editingId === id) cancelEdit();
  }

  async function importYayoiCatalog() {
    if (importBusy) return;
    if (
      !window.confirm(
        '弥生式の勘定科目一覧（3桁コード）に基づき、区分（Y01〜）と科目を追加します。\n' +
          '既に同じコードの科目がある場合はスキップします。続けますか？'
      )
    ) {
      return;
    }
    setImportBusy(true);
    try {
      const res = await api<{
        divisionsInserted: number;
        divisionsExisting: number;
        accountsInserted: number;
        accountsSkipped: number;
      }>('/api/masters/accounts/import-yayoi-catalog', { method: 'POST', body: '{}' });
      await loadDivisions();
      await load();
      window.alert(
        `取り込み完了。\n` +
          `区分: 新規 ${res.divisionsInserted} / 既存 ${res.divisionsExisting}\n` +
          `科目: 新規 ${res.accountsInserted} / 既存コードでスキップ ${res.accountsSkipped}`
      );
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '取り込みに失敗しました');
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <>
      <PageTitle
        title="勘定科目マスタ"
        description="勘定科目コード（半角3桁）・勘定科目名・区分を登録します。"
      />
      <p className="mb-4 text-sm text-gunmetal-600">
        手動で追加する場合は
        <Link href="/masters/account-divisions" className="text-navy-800 underline">
          勘定科目区分マスタ
        </Link>
        で区分を登録してください。下の「一覧を取り込み」では区分（Y01〜）も自動で足りない分だけ追加します。
      </p>
      <Card className="mb-4 max-w-2xl text-sm text-gunmetal-700">
        <p className="font-medium text-navy-900">弥生式・勘定科目一覧から一括取り込み</p>
        <p className="mt-1 text-xs">
          添付の「勘定科目一覧」相当の3桁コード・科目名・集計用区分（現金預金／売上高／販管費など）をシステムに登録します。
        </p>
        <button
          type="button"
          disabled={importBusy}
          onClick={() => void importYayoiCatalog()}
          className="mt-3 rounded-lg border border-navy-800 bg-white px-4 py-2 text-sm text-navy-900 disabled:opacity-50"
        >
          {importBusy ? '取り込み中…' : '弥生式・勘定科目一覧を取り込み'}
        </button>
      </Card>
      <Card className="mb-6 max-w-2xl">
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="text-xs text-gunmetal-600">勘定科目コード（半角数字3桁）</label>
            <input
              required
              inputMode="numeric"
              autoComplete="off"
              placeholder="例: 101"
              value={code}
              onChange={(e) => setCode(onlyDigits3(e.target.value))}
              className="mt-1 w-full rounded border px-3 py-2 text-sm tracking-widest"
              maxLength={3}
            />
          </div>
          <div>
            <label className="text-xs text-gunmetal-600">勘定科目名</label>
            <input
              required
              placeholder="名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-gunmetal-600">バーコード用コード（任意）</label>
            <input
              placeholder="バーコードスキャナ用の識別子"
              value={barcodeCode}
              onChange={(e) => setBarcodeCode(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-gunmetal-600">勘定科目区分</label>
            <select
              value={divisionId}
              onChange={(e) => setDivisionId(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              disabled={divisions.length === 0}
            >
              {divisions.length === 0 ? (
                <option value="">区分が未登録です</option>
              ) : (
                divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.division_code} — {d.division_name}（{TYPE_LABEL[d.account_type] ?? d.account_type}）
                  </option>
                ))
              )}
            </select>
          </div>
          <button type="submit" className="rounded bg-navy-900 px-4 py-2 text-sm text-white sm:col-span-2">
            追加
          </button>
        </form>
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left">コード</th>
              <th className="px-4 py-3 text-left">勘定科目名</th>
              <th className="px-4 py-3 text-left">バーコード用コード</th>
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
                        inputMode="numeric"
                        value={editCode}
                        onChange={(e) => setEditCode(onlyDigits3(e.target.value))}
                        className="w-20 rounded border px-2 py-1 text-sm tracking-widest"
                        maxLength={3}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full min-w-[8rem] rounded border px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={editBarcodeCode}
                        onChange={(e) => setEditBarcodeCode(e.target.value)}
                        className="w-full min-w-[6rem] rounded border px-2 py-1 text-sm"
                        placeholder="バーコード"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={editDivisionId}
                        onChange={(e) => setEditDivisionId(e.target.value)}
                        className="max-w-full rounded border px-2 py-1 text-sm"
                      >
                        {divisions.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.division_code} — {d.division_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gunmetal-500">
                      {TYPE_LABEL[String(r.account_type ?? '')] ?? '—'}
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
                    <td className="px-4 py-3 font-mono">{String(r.code ?? '—')}</td>
                    <td className="px-4 py-3">{String(r.name)}</td>
                    <td className="px-4 py-3 text-gunmetal-600">{String(r.barcode_code ?? '—')}</td>
                    <td className="px-4 py-3">
                      {String(r.division_code ?? '')} {String(r.division_name ?? '')}
                    </td>
                    <td className="px-4 py-3">{TYPE_LABEL[String(r.account_type ?? '')] ?? String(r.account_type)}</td>
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
