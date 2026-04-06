'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, setToken } from '@/lib/api';
import { GlobalSearch } from './GlobalSearch';

export function Header() {
  const router = useRouter();
  const [name, setName] = useState<string>('');

  useEffect(() => {
    api<{ name: string }>('/api/auth/me')
      .then((u) => setName(u.name))
      .catch(() => setName(''));
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-aqua-300/60 bg-aqua-100/70 px-6 backdrop-blur">
      <GlobalSearch />
      <div className="ml-auto flex shrink-0 items-center gap-4">
        {name && <span className="text-sm text-navy-900/90">{name}</span>}
        <button
          type="button"
          onClick={() => {
            setToken(null);
            router.push('/login');
          }}
          className="rounded-md border border-aqua-300 px-3 py-1.5 text-sm text-navy-900/90 hover:bg-aqua-50"
        >
          ログアウト
        </button>
      </div>
    </header>
  );
}
