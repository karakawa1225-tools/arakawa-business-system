'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { PageTitle } from '@/components/ui/PageTitle';
import { currentYearMonthLocal } from '@/lib/format';
import { PayrollEntryForm } from '../../_components/PayrollEntryForm';

export default function PayrollEditPage() {
  const params = useParams();
  const sp = useSearchParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const month = sp.get('month')?.match(/^\d{4}-\d{2}$/) ? sp.get('month')! : currentYearMonthLocal();

  return (
    <>
      <PageTitle title="給与・編集" description="登録内容を修正します。保存後、一覧に戻ります。" />
      {id ? <PayrollEntryForm month={month} entryId={id} /> : <p className="text-sm text-gunmetal-600">ID が不正です。</p>}
    </>
  );
}
