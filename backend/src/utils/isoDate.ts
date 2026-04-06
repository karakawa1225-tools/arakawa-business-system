/** YYYY-MM-DD（グレゴリオ暦で実在する日付）のみ許可 */
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function ymdValid(y: number, mo: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function parseIsoDateStrict(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const ja = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (ja) {
    const y = Number(ja[1]);
    const mo = Number(ja[2]);
    const d = Number(ja[3]);
    if (!ymdValid(y, mo, d)) return null;
    return `${ja[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const m = trimmed.match(ISO_DATE_RE);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!ymdValid(y, mo, d)) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function badDateMessage(fieldLabel = '日付'): string {
  return `${fieldLabel}は「2026年04月01日」または YYYY-MM-DD 形式の実在する年月日で入力してください`;
}
