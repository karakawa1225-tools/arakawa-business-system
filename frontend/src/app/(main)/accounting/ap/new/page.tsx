'use client';

import { useSearchParams } from 'next/navigation';
import { PageTitle } from '@/components/ui/PageTitle';
import { currentYearMonthLocal } from '@/lib/format';
import { ApLedgerNewForm } from '../_components/ApLedgerNewForm';

export default function ApLedgerNewPage() {
  const sp = useSearchParams();
  const listMonth = sp.get('month')?.match(/^\d{4}-\d{2}$/) ? sp.get('month')! : currentYearMonthLocal();

  return (
    <>
      <PageTitle title="買掛金・新規" description="登録後、一覧（該当月）に戻ります。" />
      <ApLedgerNewForm listMonth={listMonth} />
    </>
  );
}
