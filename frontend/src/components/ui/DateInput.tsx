'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDateJa, normalizeToYmd, parseFlexibleDateToYmd } from '@/lib/format';
import { CalendarPickerIcon } from '@/components/ui/CalendarPickerIcon';

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidCalendar(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export type DateInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> & {
  value: string;
  onChange: (isoYmd: string) => void;
};

/**
 * 表示・手入力は「2026年04月01日」形式。内部値・APIは YYYY-MM-DD。
 * カレンダーで選択可能。
 */
export function DateInput({ value, onChange, className, disabled, required, ...rest }: DateInputProps) {
  const hiddenRef = useRef<HTMLInputElement>(null);
  const ymd = normalizeToYmd(value);
  const [draft, setDraft] = useState(() => (ymd ? formatDateJa(ymd) : ''));

  useEffect(() => {
    const n = normalizeToYmd(value);
    setDraft(n ? formatDateJa(n) : '');
  }, [value]);

  const onPickerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (v === '') {
        onChange('');
        setDraft('');
        return;
      }
      const m = v.match(ISO);
      if (!m) return;
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if (!isValidCalendar(y, mo, d)) return;
      onChange(v);
      setDraft(formatDateJa(v));
    },
    [onChange]
  );

  const onBlur = useCallback(() => {
    if (!draft.trim()) {
      onChange('');
      setDraft('');
      return;
    }
    const parsed = parseFlexibleDateToYmd(draft);
    if (parsed) {
      onChange(parsed);
      setDraft(formatDateJa(parsed));
    } else {
      setDraft(ymd ? formatDateJa(ymd) : '');
    }
  }, [draft, onChange, ymd]);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ''}`}>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={onBlur}
        placeholder="2026年04月01日"
        disabled={disabled}
        required={required}
        className="min-w-[11rem] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
        inputMode="numeric"
        autoComplete="off"
        {...rest}
      />
      <input
        ref={hiddenRef}
        type="date"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        value={ymd && ISO.test(ymd) ? ymd : ''}
        onChange={onPickerChange}
        disabled={disabled}
      />
      <button
        type="button"
        disabled={disabled}
        title="日付をカレンダーで選択"
        aria-label="日付をカレンダーで選択"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-navy-950/30 bg-navy-900 text-white shadow-sm transition-[background-color,box-shadow,transform] hover:bg-navy-800 hover:shadow-md active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40"
        onClick={() => {
          const el = hiddenRef.current;
          if (!el) return;
          try {
            el.showPicker();
          } catch {
            el.click();
          }
        }}
      >
        <CalendarPickerIcon className="h-[1.125rem] w-[1.125rem]" />
      </button>
    </div>
  );
}
