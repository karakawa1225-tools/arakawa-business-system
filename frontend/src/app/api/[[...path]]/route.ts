import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { vercelBackendOrigin } from '@/lib/vercelBackendOrigin';

/**
 * Next.js の next.config rewrites 経由だと PATCH / PUT / DELETE がバックエンドに届かない環境がある。
 * ここで明示的に fetch プロキシし、全 HTTP メソッドをそのまま転送する。
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** Render コールドスタート等。Pro では maxDuration に合わせて長めの転送が可能。 */
export const maxDuration = 60;

/** fetch が再計算するヘッやプロキシで壊れやすいものを除外 */
const SKIP_REQUEST_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

function forwardRequestHeaders(incoming: Headers): Headers {
  const out = new Headers();
  incoming.forEach((value, key) => {
    if (!SKIP_REQUEST_HEADERS.has(key.toLowerCase())) {
      out.append(key, value);
    }
  });
  return out;
}

function forwardResponseHeaders(incoming: Headers): Headers {
  const out = new Headers();
  incoming.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return;
    out.append(key, value);
  });
  return out;
}

async function proxy(req: NextRequest): Promise<NextResponse> {
  const BACKEND = vercelBackendOrigin();
  const dest = `${BACKEND}${req.nextUrl.pathname}${req.nextUrl.search}`;
  const method = req.method.toUpperCase();
  const withBody = !['GET', 'HEAD'].includes(method);

  let body: BodyInit | undefined;
  if (withBody) {
    const buf = await req.arrayBuffer();
    body = buf.byteLength > 0 ? buf : undefined;
  }

  const headersOut = forwardRequestHeaders(req.headers);
  if (withBody && body === undefined) {
    headersOut.delete('content-type');
  }

  /** 既定 55s。Vercel Hobby で「Failed to fetch」だけになる場合は BACKEND_FETCH_TIMEOUT_MS=9000 等で短くし先に 502 JSON を返す（PDF 等の長処理は Pro 推奨）。 */
  const rawMs = process.env.BACKEND_FETCH_TIMEOUT_MS;
  const backendFetchMs =
    rawMs != null && String(rawMs).trim() !== ''
      ? Math.min(120_000, Math.max(3000, Number(rawMs) || 55_000))
      : 55_000;

  let res: Response;
  try {
    res = await fetch(dest, {
      method,
      headers: headersOut,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(backendFetchMs),
    });
  } catch {
    const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(BACKEND);
    const timeoutHint =
      !isLocal && backendFetchMs < 55_000
        ? `（転送タイムアウト ${Math.round(backendFetchMs / 1000)} 秒）`
        : '';
    return NextResponse.json(
      {
        error: isLocal
          ? `バックエンドに接続できません（${BACKEND}）。Vercel 本番では環境変数 BACKEND_PROXY_TARGET に Render の https://... を設定し再デプロイしてください。`
          : `バックエンドに接続できません（${BACKEND}）${timeoutHint}。Render がスリープから起きるまで数十秒かかることがあります。別タブで /health を開いて起こし、1〜2分後に再試行するか、Render の常時起動・Vercel Pro を検討してください。`,
      },
      { status: 502 }
    );
  }

  const resHeaders = forwardResponseHeaders(res.headers);
  if (res.body) {
    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
    });
  }

  return new NextResponse(null, {
    status: res.status,
    statusText: res.statusText,
    headers: resHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;
