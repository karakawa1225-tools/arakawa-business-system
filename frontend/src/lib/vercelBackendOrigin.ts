/** Vercel Route Handler から Render 等へ転送するときのオリジン（末尾 /api なし） */
export function normalizeProxyTarget(raw: string): string {
  let b = raw.trim().replace(/\/+$/, '');
  if (b.endsWith('/api')) b = b.slice(0, -4).replace(/\/+$/, '');
  if (/^http:\/\/[^/]+\.onrender\.com/i.test(b)) {
    b = `https://${b.slice('http://'.length)}`;
  }
  return b;
}

export function vercelBackendOrigin(): string {
  return normalizeProxyTarget(
    process.env.BACKEND_PROXY_TARGET ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://127.0.0.1:4000'
  );
}
