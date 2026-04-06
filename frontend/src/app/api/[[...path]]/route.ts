import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Next.js の next.config rewrites 経由だと PATCH / PUT / DELETE がバックエンドに届かない環境がある。
 * ここで明示的に fetch プロキシし、全 HTTP メソッドをそのまま転送する。
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeProxyTarget(raw: string): string {
  let b = raw.trim().replace(/\/+$/, '');
  // 誤って .../api まで指定すると /api/api/... となり一覧は通っても一部が 404 になる
  if (b.endsWith('/api')) b = b.slice(0, -4);
  return b;
}

const BACKEND =
  normalizeProxyTarget(
    process.env.BACKEND_PROXY_TARGET ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://127.0.0.1:4000'
  );

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
    });
  } catch {
    return NextResponse.json(
      {
        error: `バックエンドに接続できません（${BACKEND}）。API サーバー（通常ポート 4000）が起動しているか確認してください。`,
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
