'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageTitle } from '@/components/ui/PageTitle';
import { TravelClaimForm } from '../_components/TravelClaimForm';

export default function EditTravelClaimPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  return (
    <>
      <div className="mb-4">
        <Link href="/accounting/travel" className="text-sm text-navy-900 underline">
          ← 出張旅費一覧へ
        </Link>
      </div>
      <PageTitle title="出張旅費・精算の編集" description="明細を修正して保存します。保存後、一覧に戻ります。" />
      {id ? <TravelClaimForm claimId={id} /> : <p className="text-sm text-gunmetal-600">ID が不正です。</p>}
    </>
  );
}
