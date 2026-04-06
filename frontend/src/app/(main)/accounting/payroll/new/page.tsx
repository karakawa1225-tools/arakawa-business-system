'use client';

import { useSearchParams } from 'next/navigation';
import { PageTitle } from '@/components/ui/PageTitle';
import { currentYearMonthLocal } from '@/lib/format';
import { PayrollEntryForm } from '../_components/PayrollEntryForm';

export default function PayrollNewPage() {
  const sp = useSearchParams();
  const month = sp.get('month')?.match(/^\d{4}-\d{2}$/) ? sp.get('month')! : currentYearMonthLocal();
  const initialUserId = sp.get('userId');

  return (
    <>
      <PageTitle title="給与・新規登録" description="対象月の給与を1名分登録します。保存後、一覧に戻ります。" />
      <PayrollEntryForm month={month} initialUserId={initialUserId} />
    </>
  );
}
