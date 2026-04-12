'use client';

import Link from 'next/link';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { useStaffProfile } from '@/context/StaffProfileContext';

const links = [
  { href: '/masters/users', label: 'ユーザー管理', adminOnly: true },
  { href: '/masters/account-divisions', label: '勘定科目区分', adminOnly: false },
  { href: '/masters/accounts', label: '勘定科目', adminOnly: false },
  { href: '/masters/banks', label: '銀行口座', adminOnly: false },
];

export default function MastersPage() {
  const { profile } = useStaffProfile();
  const isAdmin = profile?.role === 'admin';
  const visible = links.filter((l) => !l.adminOnly || isAdmin);

  return (
    <>
      <PageTitle
        title="マスタ管理"
        description="勘定科目などは経理担当も編集できます。ユーザーの追加・変更は管理者のみ「ユーザー管理」から行えます。"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((l) => (
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
