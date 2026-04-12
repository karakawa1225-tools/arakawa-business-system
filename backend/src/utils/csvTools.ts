import { parse } from 'csv-parse/sync';

/** UTF-8 BOM を除去 */
export function stripBom(s: string): string {
  if (s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

export function parseCsvToRecords(csvText: string): Record<string, string>[] {
  const text = stripBom(csvText).trim();
  if (!text) return [];
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];
  return records.map((row) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      next[k.replace(/^\uFEFF/, '')] = v;
    }
    return next;
  });
}

const canonHeader = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '');

/** 1行分のセル取得（英語キー・日本語ヘッダーの別名に対応） */
export function pickCell(row: Record<string, string>, ...aliases: string[]): string {
  const t = (v: unknown) => (v == null ? '' : String(v).trim());
  for (const a of aliases) {
    if (row[a] !== undefined && t(row[a]) !== '') return t(row[a]);
  }
  const want = new Set(aliases.map(canonHeader));
  for (const [k, v] of Object.entries(row)) {
    if (want.has(canonHeader(k)) && t(v) !== '') return t(v);
  }
  return '';
}
