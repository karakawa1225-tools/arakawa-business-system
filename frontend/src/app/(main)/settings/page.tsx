'use client';

import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [c, setC] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api<Record<string, unknown> | null>('/api/settings/company').then(setC);
  }, []);

  if (!c) return <p className="p-6">読み込み中…</p>;

  return (
    <>
      <PageTitle title="設定" description="会社情報" />
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
