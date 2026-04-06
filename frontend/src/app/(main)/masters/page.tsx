'use client';

import Link from 'next/link';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';

const links = [
  { href: '/masters/users', label: 'ユーザー管理' },
  { href: '/masters/account-divisions', label: '勘定科目区分' },
  { href: '/masters/accounts', label: '勘定科目' },
  { href: '/masters/banks', label: '銀行口座' },
];

export default function MastersPage() {
  return (
    <>
      <PageTitle title="マスタ管理" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="transition hover:border-navy-200 hover:shadow-md">
              <span className="font-medium text-navy-900">{l.label}</span>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
