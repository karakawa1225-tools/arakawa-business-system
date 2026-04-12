'use client';

import { AppShell } from '@/components/layout/AppShell';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { StaffProfileProvider } from '@/context/StaffProfileContext';

export function MainLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <StaffProfileProvider>
        <AppShell>{children}</AppShell>
      </StaffProfileProvider>
    </AuthGuard>
  );
}
