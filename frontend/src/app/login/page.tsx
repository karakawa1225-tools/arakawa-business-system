'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, getToken, setToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (getToken()) {
      router.replace('/home');
      return;
    }
    let cancelled = false;
    api<{ setupCompleted: boolean }>('/api/setup/status', { token: false })
      .then((s) => {
        if (cancelled) return;
        if (!s.setupCompleted) {
          router.replace('/setup');
        }
      })
      .catch(() => {
        /* API 不通時はログイン画面のまま（手動で /setup へ） */
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  function isRetryableLoginFailure(msg: string): boolean {
    return /failed to fetch|network request failed|load failed|502|504|接続できません|タイムアウト/i.test(msg);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const body = JSON.stringify({ email, password });
    const attempt = () =>
      api<{ token: string }>('/api/auth/login', {
        method: 'POST',
        body,
        token: false,
      });
    try {
      const r = await attempt();
      setToken(r.token);
      router.push('/home');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'エラー';
      if (isRetryableLoginFailure(msg)) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const r2 = await attempt();
          setToken(r2.token);
          router.push('/home');
          return;
        } catch (e2: unknown) {
          setErr(e2 instanceof Error ? e2.message : 'エラー');
          return;
        }
      }
      setErr(msg);
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
          {err && (
            <p className="whitespace-pre-wrap break-words text-sm text-red-600" role="alert">
              {err}
            </p>
          )}
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
