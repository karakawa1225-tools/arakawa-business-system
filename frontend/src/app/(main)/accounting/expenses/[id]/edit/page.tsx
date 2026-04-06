'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { PageTitle } from '@/components/ui/PageTitle';
import { currentYearMonthLocal } from '@/lib/format';
import { ExpenseEntryForm } from '../../_components/ExpenseEntryForm';

export default function ExpensesEditPage() {
  const params = useParams();
  const sp = useSearchParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const listMonth = sp.get('month')?.match(/^\d{4}-\d{2}$/) ? sp.get('month')! : currentYearMonthLocal();

  return (
    <>
      <PageTitle title="経費・編集" description="保存後、一覧に戻ります。" />
      {id ? <ExpenseEntryForm expenseId={id} listMonth={listMonth} /> : <p className="text-sm text-gunmetal-600">ID が不正です。</p>}
    </>
  );
}
