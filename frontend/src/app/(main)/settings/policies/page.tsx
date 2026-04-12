'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminGate } from '@/components/admin/AdminGate';
import { Card } from '@/components/ui/Card';
import { PageTitle } from '@/components/ui/PageTitle';
import { api } from '@/lib/api';

export default function CompanyPoliciesPage() {
  const [operationsPolicy, setOperationsPolicy] = useState('');
  const [accountingPolicy, setAccountingPolicy] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const c = await api<Record<string, unknown>>('/api/settings/company');
        if (cancelled) return;
        setOperationsPolicy(String(c.operations_policy ?? ''));
        setAccountingPolicy(String(c.accounting_policy ?? ''));
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : '読み込みに失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api('/api/settings/company-policies', {
        method: 'PATCH',
        body: JSON.stringify({
          operationsPolicy,
          accountingPolicy,
        }),
      });
      window.alert('保存しました');
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '保存に失敗しました');
    }
  }

  return (
    <AdminGate>
      <PageTitle
        title="業務・会計の運用メモ"
        description="管理者が営業・購買などの運用ルールと、経理・会計の処理方針を記載します。全スタッフが参照する前提の社内ルール用です（将来、画面ごとの権限と組み合わせて拡張できます）。"
      />
      {loading ? (
        <p className="text-sm text-gunmetal-600">読み込み中…</p>
      ) : (
        <form onSubmit={(e) => void save(e)} className="space-y-6">
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <Card className="max-w-3xl space-y-4 p-6">
            <div>
              <label className="text-sm font-medium text-navy-900">業務運用（営業・受発注など）</label>
              <p className="mt-1 text-xs text-gunmetal-600">
                見積の承認フロー、納期の目安、顧客対応の注意事項など、現場で共有したい内容を自由記述してください。
              </p>
              <textarea
                value={operationsPolicy}
                onChange={(e) => setOperationsPolicy(e.target.value)}
                rows={12}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="例: 見積は〇日以内に回答、受注後の変更は…"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-navy-900">会計・経理処理</label>
              <p className="mt-1 text-xs text-gunmetal-600">
                締め日、計上基準、経費精算のルール、インボイス運用など、経理担当者が全員に周知したい内容を記載してください。
              </p>
              <textarea
                value={accountingPolicy}
                onChange={(e) => setAccountingPolicy(e.target.value)}
                rows={12}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="例: 経費は月末締め翌月〇日までに申請、売上計上は出荷基準…"
              />
            </div>
            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
              <button type="submit" className="rounded-lg bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800">
                保存
              </button>
              <Link href="/admin" className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
                管理者メニューへ
              </Link>
            </div>
          </Card>
        </form>
      )}
    </AdminGate>
  );
}
