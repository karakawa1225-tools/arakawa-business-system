'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, setCustomerToken } from '@/lib/api';

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const r = await api<{ token: string }>('/api/auth/customer-login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        token: false,
      });
      setCustomerToken(r.token);
      router.push('/portal');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'エラー');
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 p-8 shadow-card">
        <h1 className="text-center text-lg font-semibold text-navy-950">顧客ポータル</h1>
        <p className="mt-1 text-center text-xs text-gunmetal-500">見積・注文・請求・入金の確認</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <input
            type="email"
            required
            placeholder="メール"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <input
            type="password"
            required
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button type="submit" className="w-full rounded-lg bg-navy-900 py-2.5 text-sm text-white">
            ログイン
          </button>
        </form>
        <p className="mt-6 text-center text-xs">
          <Link href="/login" className="text-navy-800 hover:underline">
            社内ログインへ
          </Link>
        </p>
      </div>
    </div>
  );
}
