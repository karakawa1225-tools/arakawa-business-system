'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { useStaffProfile } from '@/context/StaffProfileContext';

/** 管理者以外は /admin へ誘導 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile, loading } = useStaffProfile();

  useEffect(() => {
    if (loading) return;
    if (profile && profile.role !== 'admin') {
      router.replace('/admin');
    }
  }, [loading, profile, router]);

  if (loading) {
    return <p className="p-6 text-sm text-gunmetal-600">読み込み中…</p>;
  }
  if (!profile || profile.role !== 'admin') {
    return (
      <Card className="max-w-lg p-6">
        <p className="text-sm text-gunmetal-800">この画面は管理者のみ利用できます。</p>
        <Link href="/admin" className="mt-4 inline-block text-sm font-medium text-navy-900 underline">
          管理者メニューへ
        </Link>
      </Card>
    );
  }
  return <>{children}</>;
}
