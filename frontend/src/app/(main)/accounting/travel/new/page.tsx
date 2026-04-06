'use client';

import Link from 'next/link';
import { PageTitle } from '@/components/ui/PageTitle';
import { TravelClaimForm } from '../_components/TravelClaimForm';

export default function NewTravelClaimPage() {
  return (
    <>
      <div className="mb-4">
        <Link href="/accounting/travel" className="text-sm text-navy-900 underline">
          ← 出張旅費一覧へ
        </Link>
      </div>
      <PageTitle title="出張旅費・新規精算" description="交通費・宿泊費・日当など、区分ごとに明細を入力します。保存後、一覧に戻ります。" />
      <TravelClaimForm />
    </>
  );
}
