import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Next.js の next.config rewrites 経由だと PATCH / PUT / DELETE がバックエンドに届かない環境がある。
 * ここで明示的に fetch プロキシし、全 HTTP メソッドをそのまま転送する。
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** Render コールドスタート等。Hobby は Vercel が最大 10s で打ち切る場合あり */
export const maxDuration = 60;

function normalizeProxyTarget(raw: string): string {
  let b = raw.trim().replace(/\/+$/, '');
  // 誤って .../api まで指定すると /api/api/... となり一覧は通っても一部が 404 になる
  if (b.endsWith('/api')) b = b.slice(0, -4);
  return b;
}

/** リクエストごとに解決（ビルド時固定の取り違えを避ける） */
function backendOrigin(): string {
  return normalizeProxyTarget(
    process.env.BACKEND_PROXY_TARGET ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://127.0.0.1:4000'
  );
}

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
  const BACKEND = backendOrigin();
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

  let res: Response;
  try {
    res = await fetch(dest, {
      method,
      headers: headersOut,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(55_000),
    });
  } catch {
    const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(BACKEND);
    return NextResponse.json(
      {
        error: isLocal
          ? `バックエンドに接続できません（${BACKEND}）。Vercel 本番では環境変数 BACKEND_PROXY_TARGET に Render の https://... を設定し再デプロイしてください。`
          : `バックエンドに接続できません（${BACKEND}）。Render がスリープから起きるまで数十秒かかることがあります。数分後に再試行するか、フロントの NEXT_PUBLIC_API_URL で API に直接アクセスする設定にしてください。`,
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
