import type { Response } from 'express';

/** PostgreSQL / 各種ライブラリのエラーから表示用テキストを取り出す */
export function extractErrorDetail(e: unknown): string {
  if (e instanceof Error && e.message.trim()) return e.message.trim();
  if (typeof e === 'string' && e.trim()) return e.trim();
  const o = e as Record<string, unknown> | null;
  if (o && typeof o === 'object') {
    const parts: string[] = [];
    if (typeof o.message === 'string' && o.message.trim()) parts.push(o.message.trim());
    if (typeof o.code === 'string') parts.push(`[${o.code}]`);
    if (typeof o.detail === 'string' && o.detail.trim()) parts.push(o.detail.trim());
    if (typeof o.hint === 'string' && o.hint.trim()) parts.push(`hint: ${o.hint.trim()}`);
    if (parts.length) return parts.join(' ');
  }
  const s = String(e);
  if (s && s !== '[object Object]') return s;
  return '不明なエラー。APIのターミナルにログが出ていないか確認してください。';
}

/**
 * ローカル開発では常に詳細を返す（「サーバーエラー」だけで止まらないようにする）。
 * 本番で伏せる場合のみ MASK_API_ERRORS=1
 */
export function sendServerError(res: Response, e: unknown): void {
  console.error('[API Error]', e);
  if (res.headersSent) return;
  const mask = process.env.MASK_API_ERRORS === '1';
  const detail = extractErrorDetail(e);
  if (mask) {
    const code = (e as { code?: unknown }).code;
    const hint = (e as { hint?: unknown }).hint;
    // MASK_API_ERRORS が有効でも、原因調査できるよう debug を付けて返す
    res.status(500).json({
      error: 'サーバーエラー',
      debug: {
        code: typeof code === 'string' ? code : undefined,
        hint: typeof hint === 'string' ? hint : undefined,
        detail,
      },
    });
    return;
  }
  res.status(500).json({ error: detail });
}
