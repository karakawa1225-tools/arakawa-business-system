/**
 * ブラウザ: 既定は相対パス `/api/...`（フロントと同一オリジン）。
 * ページが localhost で API が 127.0.0.1 だと別オリジンになり、環境によって POST/PATCH/DELETE だけ失敗することがある。
 * `app/api/[[...path]]/route.ts` が全メソッドをバックエンドへ転送する。
 *
 * ブラウザ（本番ホスト）: 既定は同一オリジンのみ（Vercel → Render はサーバー側 fetch で CORS にならない）。
 * `NEXT_PUBLIC_API_URL` だけ設定してブラウザから Render へ直叩きすると、CORS / Failed to fetch で一覧取得が落ちやすい。
 * 意図的にブラウザ直結する場合のみ `NEXT_PUBLIC_API_DIRECT=1` と併用する。
 * 直アクセスがネットワーク失敗のときは、同一オリジン `/api/...` へ一度だけフォールバックする（DIRECT=1 時）。
 *
 * サーバー側: BACKEND_PROXY_TARGET → NEXT_PUBLIC_API_URL → http://127.0.0.1:4000
 */
function normalizeApiOrigin(raw: string): string {
  let b = raw.trim().replace(/\/+$/, '');
  // 誤って .../api まで指定すると fetch が /api/api/... になり 404 になりやすい（プロキシ route と同じ扱い）
  if (b.endsWith('/api')) b = b.slice(0, -4).replace(/\/+$/, '');
  return b;
}

/**
 * 本番ブラウザ向け API オリジン。
 * - スキーム省略（example.onrender.com）→ https を付与
 * - HTTPS ページから http:// の API はミックスコンテンツでブロックされる → https に昇格
 */
function normalizeBrowserPublicApiOrigin(raw: string): string {
  let b = normalizeApiOrigin(raw.trim());
  if (!b) return b;
  if (!/^https?:\/\//i.test(b)) {
    b = `https://${b}`;
  }
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    /^http:\/\//i.test(b)
  ) {
    b = `https://${b.slice('http://'.length)}`;
  }
  return b;
}

function isBrowserLocalHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

function networkErrorHint(url: string, net: unknown): string {
  if (!isBrowserLocalHost() && net instanceof Error && /failed to fetch/i.test(net.message)) {
    // https:// も startsWith('http') になるため、ミックスコンテンツは http:// のみ判定する
    if (url.startsWith('http://')) {
      return (
        ' HTTPS のページから http:// の API はブロックされます。NEXT_PUBLIC_API_URL を https://（例: https://arakawa-business-system.onrender.com）で始め、末尾に /api を付けず再デプロイしてください。'
      );
    }
    if (url.startsWith('https://')) {
      return (
        ' Render のスリープ・CORS・一時的なネットワーク障害の可能性があります。数分後に再試行するか、Vercel で NEXT_PUBLIC_API_URL を未設定にして同一オリジンの /api プロキシのみ使う方法もあります。'
      );
    }
    return (
      ' Vercel の環境変数 BACKEND_PROXY_TARGET / NEXT_PUBLIC_API_URL に Render のオリジン（https://...、末尾に /api なし）を設定し、再デプロイしてください。'
    );
  }
  return '';
}

/** ブラウザがネットワーク層で失敗したとき（CORS・DNS・接続リセット等。本文が無い） */
function isLikelyBrowserNetworkFailure(net: unknown): boolean {
  return net instanceof Error && /failed to fetch|networkerror|load failed/i.test(net.message);
}

export const apiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const pub =
      typeof process.env.NEXT_PUBLIC_API_URL === 'string' && process.env.NEXT_PUBLIC_API_URL.trim();
    const direct =
      typeof process.env.NEXT_PUBLIC_API_DIRECT === 'string' &&
      /^(1|true|yes)$/i.test(process.env.NEXT_PUBLIC_API_DIRECT.trim());
    if (!isBrowserLocalHost() && pub && direct) {
      return normalizeBrowserPublicApiOrigin(pub);
    }
    return '';
  }
  const fromEnv =
    (typeof process.env.BACKEND_PROXY_TARGET === 'string' && process.env.BACKEND_PROXY_TARGET.trim()) ||
    (typeof process.env.NEXT_PUBLIC_API_URL === 'string' && process.env.NEXT_PUBLIC_API_URL.trim());
  if (fromEnv) return normalizeApiOrigin(fromEnv);
  return 'http://127.0.0.1:4000';
};

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('abs_token');
}

export function setToken(t: string | null) {
  if (typeof window === 'undefined') return;
  if (t) localStorage.setItem('abs_token', t);
  else localStorage.removeItem('abs_token');
}

export function getCustomerToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('abs_customer_token');
}

export function setCustomerToken(t: string | null) {
  if (typeof window === 'undefined') return;
  if (t) localStorage.setItem('abs_customer_token', t);
  else localStorage.removeItem('abs_customer_token');
}

/** Express のデフォルト HTML など、JSON 以外の本文を短い説明にする */
function briefHttpBodyMessage(status: number, rawText: string): string | null {
  const t = rawText.trim();
  if (!t) return null;
  if (t.includes('<!DOCTYPE') || /<html[\s>]/i.test(t)) {
    const pre = t.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (pre?.[1]) {
      const line = pre[1].trim().replace(/\s+/g, ' ');
      return `HTTP ${status}: ${line}`;
    }
    return `HTTP ${status}: API が JSON ではなく HTML を返しました。バックエンド（通常ポート 4000）を起動し、プロジェクト直下で npm run dev または npm run dev:3001 を実行して API を含めて立ち上げ直してください。`;
  }
  return null;
}

export async function api<T>(
  path: string,
  opts: RequestInit & { token?: string | null | false } = {}
): Promise<T> {
  const token =
    opts.token === false || opts.token === null ? null : (opts.token ?? getToken());
  const method = (opts.method || 'GET').toUpperCase();

  /** api 専用の token と fetch に渡せないフィールドを除き、headers は下で一本化する */
  const { token: _t, headers: incomingHeaders, ...fetchInit } = opts;
  const headers: Record<string, string> = {
    ...(incomingHeaders as Record<string, string> | undefined),
  };
  // GET/HEAD に Content-Type を付けると「非単純リクエスト」になり CORS の OPTIONS が必須になる。
  // /health はタブ直叩きで通るが、fetch だけ失敗する原因になりやすい。
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const primaryBase = apiBaseUrl();
  const buildUrl = (base: string) => `${base}${path}`;
  const requestInit: RequestInit = {
    ...fetchInit,
    method,
    headers,
  };

  let res: Response;
  let url = buildUrl(primaryBase);
  try {
    res = await fetch(url, requestInit);
  } catch (net) {
    const sameOriginFallback =
      typeof window !== 'undefined' &&
      !isBrowserLocalHost() &&
      primaryBase !== '' &&
      path.startsWith('/api/') &&
      isLikelyBrowserNetworkFailure(net);

    if (sameOriginFallback) {
      const fallbackUrl = buildUrl('');
      try {
        res = await fetch(fallbackUrl, requestInit);
        url = fallbackUrl;
      } catch (net2) {
        const localHint = isBrowserLocalHost()
          ? ' ターミナルでバックエンドが起動しているか確認してください。'
          : '';
        throw new Error(
          `APIに接続できません（直アクセス ${buildUrl(primaryBase)} と同一オリジン ${fallbackUrl} の両方で失敗）。${localHint}` +
            (net2 instanceof Error ? ` (${net2.message})` : '') +
            networkErrorHint(buildUrl(primaryBase), net2)
        );
      }
    } else {
      const localHint = isBrowserLocalHost()
        ? ' ターミナルでバックエンドが起動しているか確認してください。'
        : '';
      throw new Error(
        `APIに接続できません（${url}）。${localHint}` +
          (net instanceof Error ? ` (${net.message})` : '') +
          networkErrorHint(url, net)
      );
    }
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text?.slice(0, 200) || res.statusText };
  }
  if (!res.ok) {
    const d = data as { error?: string; hint?: string; debug?: { detail?: string; code?: string } };
    let bodyErr = d?.error?.trim();
    const hint = d?.hint?.trim();
    const dbg = d?.debug?.detail?.trim();
    const brief = briefHttpBodyMessage(res.status, text);
    if (brief && (!bodyErr || bodyErr.startsWith('<') || bodyErr.includes('<!DOCTYPE'))) {
      bodyErr = brief;
    }
    const stale404Hint =
      res.status === 404 &&
      (String(bodyErr).includes('Cannot GET') ||
        String(text).includes('Cannot GET /api/'));
    const extra404 =
      stale404Hint && !hint
        ? '\nポート4000のプロセスがこのシステムの最新バックエンドでない可能性が高いです。http://127.0.0.1:4000/health を開き "capabilities" があるか確認し、該当PIDを終了してから npm run dev:3001 をやり直してください。'
        : '';

    const err =
      bodyErr ||
      (res.status === 500 && !bodyErr
        ? `HTTP 500（本文なし）。API側ターミナルの赤いログを確認してください。`
        : res.statusText);
    let msg = hint ? `${err}\n${hint}` : `${err}${extra404}`;
    if (dbg) msg = `${msg}\n${dbg}`;
    throw new Error(msg);
  }
  return data as T;
}

/** DELETE リソース削除（パスは `/api/.../:id` のまま） */
export async function apiDelete<T = unknown>(path: string): Promise<T> {
  return api<T>(path, { method: 'DELETE' });
}

const DEFAULT_API_BLOB_MS = 180_000;

export async function apiBlob(
  path: string,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<Blob> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_API_BLOB_MS;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  const primaryBase = apiBaseUrl();
  const blobInit: RequestInit = { headers, signal: controller.signal };
  let res: Response;
  try {
    res = await fetch(`${primaryBase}${path}`, blobInit);
  } catch (net) {
    if (net instanceof DOMException && net.name === 'AbortError') {
      clearTimeout(t);
      throw new Error(
        `ファイルのダウンロードがタイムアウトしました（${Math.round(timeoutMs / 1000)} 秒）。` +
          'サーバーの負荷が高いか、開発サーバーを再起動してみてください。'
      );
    }
    const sameOriginFallback =
      typeof window !== 'undefined' &&
      !isBrowserLocalHost() &&
      primaryBase !== '' &&
      path.startsWith('/api/') &&
      isLikelyBrowserNetworkFailure(net);
    if (sameOriginFallback) {
      try {
        res = await fetch(`${''}${path}`, blobInit);
      } catch (net2) {
        clearTimeout(t);
        throw net2 instanceof Error ? net2 : new Error(String(net2));
      }
    } else {
      clearTimeout(t);
      throw net instanceof Error ? net : new Error(String(net));
    }
  }
  clearTimeout(t);
  if (!res.ok) {
    const text = await res.text();
    let jsonErr: string | null = null;
    try {
      const data = text ? JSON.parse(text) : null;
      jsonErr = (data as { error?: string } | null)?.error?.trim() || null;
    } catch {
      /* 本文が JSON でない */
    }
    if (jsonErr) throw new Error(jsonErr);
    const brief = briefHttpBodyMessage(res.status, text);
    throw new Error(
      brief ||
        (text ? `ダウンロードに失敗しました (${res.status}): ${text.slice(0, 200)}` : `ダウンロードに失敗しました (${res.status})`)
    );
  }
  return res.blob();
}
