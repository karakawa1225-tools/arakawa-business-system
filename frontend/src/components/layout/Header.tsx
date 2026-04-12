'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, setToken } from '@/lib/api';
import { GlobalSearch } from './GlobalSearch';

export function Header({ onMenuOpen }: { onMenuOpen?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState<string>('');

  useEffect(() => {
    api<{ name: string }>('/api/auth/me')
      .then((u) => setName(u.name))
      .catch(() => setName(''));
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-aqua-300/60 bg-aqua-100/70 px-3 backdrop-blur sm:gap-4 sm:px-6">
      {onMenuOpen ? (
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center rounded-md p-2 text-navy-900 hover:bg-aqua-200/60 lg:hidden"
          onClick={onMenuOpen}
          aria-label="メニューを開く"
        >
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      ) : null}
      <GlobalSearch />
      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 sm:gap-4">
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
