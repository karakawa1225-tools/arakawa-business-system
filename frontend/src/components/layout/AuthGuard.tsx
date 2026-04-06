'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/api';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace('/login');
      return;
    }
    setOk(true);
  }, [router, pathname]);

  if (!ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gunmetal-600">
        読み込み中…
      </div>
    );
  }
  return <>{children}</>;
}
