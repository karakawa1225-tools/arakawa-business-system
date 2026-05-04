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
  const [submitting, setSubmitting] = useState(false);

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
    return /failed to fetch|network request failed|load failed|502|504|接続できません|タイムアウト|aborted|abort/i.test(msg);
  }

  /** ブラウザが短文だけ返すときでも、Render スリープ + Vercel Hobby の時間切れを説明する */
  function expandBareNetworkError(msg: string): string {
    const s = msg.trim();
    const bare =
      /^failed to fetch$/i.test(s) ||
      /^typeerror:\s*failed to fetch$/i.test(s) ||
      /^load failed$/i.test(s);
    const alreadyVerbose = /APIに接続|バックエンド|Vercel|BACKEND_PROXY|プロキシ|Render|応答がありません/i.test(s);
    if (!bare && alreadyVerbose) return msg;
    if (!bare && /failed to fetch/i.test(s)) return msg;
    if (!bare) return msg;
    return [
      'サーバーへ接続できませんでした（Failed to fetch）。よくある原因は次のとおりです。',
      '',
      '・Render がスリープから起きるまでに時間がかかり、Vercel 側のプロキシ（サーバー関数）が先に時間切れになる。無料枠では数秒〜10秒程度で打ち切られることがあります。',
      '  → 別タブで API の /health を開いて起こしてから、1〜2 分待って再度ログインしてください。',
      '',
      '・Vercel の Production に BACKEND_PROXY_TARGET（https://…onrender.com、末尾に /api なし）が入っていない、または誤り。',
      '',
      `（詳細: ${msg}）`,
    ].join('\n');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setSubmitting(true);
    try {
      const body = JSON.stringify({ email, password });
      const attempt = () =>
        api<{ token: string }>('/api/auth/login', {
          method: 'POST',
          body,
          token: false,
        });
      /** Render コールドスタート対策: 失敗後に長めの間隔で最大 4 回 */
      const waitMsAfterFail = [3000, 8000, 15000];
      let lastMsg = 'エラー';
      for (let i = 0; i <= waitMsAfterFail.length; i++) {
        try {
          const r = await attempt();
          setToken(r.token);
          router.push('/home');
          return;
        } catch (err: unknown) {
          lastMsg = err instanceof Error ? err.message : 'エラー';
          const retry = i < waitMsAfterFail.length && isRetryableLoginFailure(lastMsg);
          if (!retry) {
            setErr(expandBareNetworkError(lastMsg));
            return;
          }
          await new Promise((r) => setTimeout(r, waitMsAfterFail[i]));
        }
      }
      setErr(expandBareNetworkError(lastMsg));
    } finally {
      setSubmitting(false);
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
            disabled={submitting}
            className="w-full rounded-lg bg-navy-900 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60"
          >
            {submitting ? '接続中…（再試行する場合があります）' : 'ログイン'}
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
