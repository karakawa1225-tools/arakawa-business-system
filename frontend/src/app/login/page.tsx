'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, setToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const r = await api<{ token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        token: false,
      });
      setToken(r.token);
      router.push('/home');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'エラー');
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 p-8 shadow-card">
        <h1 className="text-center text-lg font-semibold text-navy-950">社内ログイン</h1>
        <p className="mt-1 text-center text-xs text-gunmetal-500">ARAKAWA Business System</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600">メール</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-navy-600 focus:ring-2"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">パスワード</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-navy-600 focus:ring-2"
            />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-navy-900 py-2.5 text-sm font-medium text-white hover:bg-navy-800"
          >
            ログイン
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-gunmetal-500">
          <Link href="/setup" className="text-navy-800 hover:underline">
            初回セットアップ
          </Link>
          {' · '}
          <Link href="/portal/login" className="hover:underline">
            顧客ポータル
          </Link>
        </p>
      </div>
    </div>
  );
}
