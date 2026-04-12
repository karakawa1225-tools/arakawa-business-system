'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMobileNav();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeMobileNav]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    function onChange() {
      if (mq.matches) setMobileNavOpen(false);
    }
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (mobileNavOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [mobileNavOpen]);

  return (
    <div className="min-h-screen bg-slate-50/80">
      <Sidebar mobileOpen={mobileNavOpen} onClose={closeMobileNav} />
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default bg-navy-900/40 lg:hidden"
          aria-label="メニューを閉じる"
          onClick={closeMobileNav}
        />
      ) : null}
      <div className="lg:pl-60">
        <Header onMenuOpen={openMobileNav} />
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
