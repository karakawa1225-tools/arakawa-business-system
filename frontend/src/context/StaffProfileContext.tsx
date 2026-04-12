'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

export type StaffProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
};

type Ctx = {
  profile: StaffProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const StaffProfileContext = createContext<Ctx | undefined>(undefined);

export function StaffProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const p = await api<StaffProfile>('/api/auth/me');
      setProfile(p);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ profile, loading, refresh }), [profile, loading, refresh]);

  return <StaffProfileContext.Provider value={value}>{children}</StaffProfileContext.Provider>;
}

export function useStaffProfile() {
  const c = useContext(StaffProfileContext);
  if (!c) {
    throw new Error('useStaffProfile must be used within StaffProfileProvider');
  }
  return c;
}

export function useIsAdmin() {
  const { profile, loading } = useStaffProfile();
  return { isAdmin: profile?.role === 'admin', loading };
}
