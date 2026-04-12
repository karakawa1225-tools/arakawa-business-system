'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { useStaffProfile } from '@/context/StaffProfileContext';

export default function SettingsPage() {
  const [c, setC] = useState<Record<string, unknown> | null>(null);
  const { profile } = useStaffProfile();
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    api<Record<string, unknown> | null>('/api/settings/company').then(setC);
  }, []);

  if (!c) return <p className="p-6">読み込み中…</p>;

  return (
    <>
      <PageTitle title="設定" description="会社情報" />
      {isAdmin ? (
        <Card className="mb-6 max-w-lg border-navy-100 bg-aqua-50/50 p-4 text-sm">
          <p className="font-medium text-navy-900">管理者向け</p>
          <p className="mt-1 text-gunmetal-700">
            ユーザーの追加・運用メモは <strong className="font-medium">管理者メニュー</strong> から行います。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/admin" className="rounded-md bg-navy-900 px-3 py-1.5 text-xs text-white hover:bg-navy-800">
              管理者メニュー
            </Link>
            <Link
              href="/settings/policies"
              className="rounded-md border border-navy-800 px-3 py-1.5 text-xs text-navy-900 hover:bg-white"
            >
              業務・会計の運用メモ
            </Link>
          </div>
        </Card>
      ) : null}
      <Card className="max-w-lg text-sm">
        <p>
          <span className="text-gunmetal-500">会社名:</span> {String(c.name)}
        </p>
        <p className="mt-2">
          <span className="text-gunmetal-500">住所:</span> {String(c.address ?? '—')}
        </p>
        <p className="mt-2">
          <span className="text-gunmetal-500">電話:</span> {String(c.phone ?? '—')}
        </p>
        <p className="mt-2">
          <span className="text-gunmetal-500">標準税率:</span> {String(c.default_tax_rate)}%
        </p>
        <p className="mt-4 text-xs text-gunmetal-500">
          詳細変更は API PATCH /api/setup/company-profile または今後のフォームから行えます。
        </p>
      </Card>
    </>
  );
}
