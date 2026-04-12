'use client';

import { useCallback, useEffect, useState } from 'react';
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
      {/*
        iOS Safari は sr-only + programmatic click() で date ピッカーが開かないことがあるため、
        ネイティブ input をボタン表示域に重ねて直接タップで開く。
      */}
      <div
        title="日付をカレンダーで選択"
        className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-navy-950/30 bg-navy-900 text-white shadow-sm transition-[background-color,box-shadow,transform] sm:h-9 sm:w-9 ${
          disabled
            ? 'pointer-events-none opacity-40'
            : 'hover:bg-navy-800 hover:shadow-md active:scale-[0.97] focus-within:ring-2 focus-within:ring-navy-400 focus-within:ring-offset-2'
        }`}
      >
        <input
          type="date"
          className="absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          value={ymd && ISO.test(ymd) ? ymd : ''}
          onChange={onPickerChange}
          disabled={disabled}
          aria-label="日付をカレンダーで選択"
        />
        <span className="pointer-events-none flex items-center justify-center">
          <CalendarPickerIcon className="h-[1.125rem] w-[1.125rem]" />
        </span>
      </div>
    </div>
  );
}
