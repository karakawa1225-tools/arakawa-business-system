import { NextResponse } from 'next/server';
import { vercelBackendOrigin } from '@/lib/vercelBackendOrigin';

/**
 * ブラウザ → Vercel → バックエンド の経路だけを確認する（Render の /health を直開きしたときとは別）。
 * ログインが Failed to fetch のときの切り分け用。
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  const BACKEND = vercelBackendOrigin();
  const healthUrl = `${BACKEND}/health`;
  const started = Date.now();
  try {
    const res = await fetch(healthUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000),
    });
    const text = await res.text();
    const latencyMs = Date.now() - started;
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { _note: '本文が JSON ではありません', snippet: text.slice(0, 400) };
    }
    return NextResponse.json({
      ok: res.ok,
      httpStatus: res.status,
      latencyMs,
      healthUrl,
      note: 'この URL は Vercel 上のサーバーからバックエンドへ GET した結果です。Render の /health を直に開けるのにここが失敗する場合は Vercel の BACKEND_PROXY_TARGET が誤っていることが多いです。',
      body: parsed,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        httpStatus: 502,
        latencyMs: Date.now() - started,
        healthUrl,
        error: e instanceof Error ? e.message : String(e),
        hint:
          'Vercel の Production に BACKEND_PROXY_TARGET（https://…onrender.com、末尾に /api なし）を設定してください。Render を直開きできるのにここだけ失敗するのは転送先の取り違えが典型です。',
      },
      { status: 502 }
    );
  }
}
