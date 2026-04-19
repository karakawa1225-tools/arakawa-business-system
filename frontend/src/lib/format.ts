export function toNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const s = v.replace(/[,￥¥\s]/g, '');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** 会計表示（通貨記号 ￥ ＋ 3 桁区切り、円は小数なし） */
export function formatJPY(v: unknown): string {
  const n = toNumber(v);
  if (n == null) return '—';
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(n);
}

function isValidYmd(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** API・DBは YYYY-MM-DD。ISO文字列の先頭や Date から年月日だけ取り出す */
export function normalizeToYmd(input: unknown): string {
  if (input == null || input === '') return '';
  if (input instanceof Date && !isNaN(input.getTime())) {
    const y = input.getUTCFullYear();
    const mo = String(input.getUTCMonth() + 1).padStart(2, '0');
    const d = String(input.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  const s = String(input).trim();
  if (!s) return '';
  const head = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (head) return head[1];
  return '';
}

/** 「2026年04月01日」「2026/4/1」「YYYY-MM-DD」等 → YYYY-MM-DD。不正なら null */
export function parseFlexibleDateToYmd(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!isValidYmd(y, mo, d)) return null;
    return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  m = t.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!isValidYmd(y, mo, d)) return null;
    return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const n = normalizeToYmd(t);
  return n || null;
}

/** 画面表示用: 2026年04月01日 */
export function formatDateJa(value: unknown): string {
  const ymd = normalizeToYmd(value);
  if (!ymd) return '';
  const [y, mo, d] = ymd.split('-');
  return `${y}年${mo}月${d}日`;
}

/** 集計月表示: 2026年04月 */
export function formatYearMonthJa(ym: string): string {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split('-');
  return `${y}年${m}月`;
}

/** 「2026年4月」→ YYYY-MM */
export function parseYearMonthJa(input: string): string | null {
  const t = input.trim();
  const m = t.match(/^(\d{4})年(\d{1,2})月$/);
  if (!m) return null;
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  return `${m[1]}-${String(mo).padStart(2, '0')}`;
}

/** ブラウザローカル日付の YYYY-MM-DD（今日の初期値など） */
export function todayYmdLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function currentYearMonthLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
