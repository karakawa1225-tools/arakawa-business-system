'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatYearMonthJa, parseYearMonthJa } from '@/lib/format';
import { CalendarPickerIcon } from '@/components/ui/CalendarPickerIcon';

const YM = /^\d{4}-\d{2}$/;

export type MonthInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> & {
  value: string;
  onChange: (yearMonth: string) => void;
};

/** 表示は「2026年04月」形式。内部値は YYYY-MM */
export function MonthInput({ value, onChange, className, disabled, ...rest }: MonthInputProps) {
  const [draft, setDraft] = useState(() => formatYearMonthJa(value));

  useEffect(() => {
    setDraft(formatYearMonthJa(value));
  }, [value]);

  const onPickerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (v === '') return;
      if (!YM.test(v)) return;
      const [y, m] = v.split('-').map(Number);
      if (m < 1 || m > 12) return;
      onChange(v);
      setDraft(formatYearMonthJa(v));
    },
    [onChange]
  );

  const onBlur = useCallback(() => {
    const parsed = parseYearMonthJa(draft);
    if (parsed) {
      onChange(parsed);
      setDraft(formatYearMonthJa(parsed));
    } else if (YM.test(value)) {
      setDraft(formatYearMonthJa(value));
    }
  }, [draft, onChange, value]);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ''}`}>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={onBlur}
        placeholder="2026年04月"
        disabled={disabled}
        className="min-w-[8rem] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
        inputMode="numeric"
        autoComplete="off"
        {...rest}
      />
      {/*
        iOS Safari は sr-only + programmatic click() で month ピッカーが開かないことがあるため、
        ネイティブ input をボタン表示域に重ねて直接タップで開く。
      */}
      <div
        title="年月をカレンダーで選択"
        className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-navy-950/30 bg-navy-900 text-white shadow-sm transition-[background-color,box-shadow,transform] sm:h-9 sm:w-9 ${
          disabled
            ? 'pointer-events-none opacity-40'
            : 'hover:bg-navy-800 hover:shadow-md active:scale-[0.97] focus-within:ring-2 focus-within:ring-navy-400 focus-within:ring-offset-2'
        }`}
      >
        <input
          type="month"
          className="absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          value={YM.test(value) ? value : ''}
          onChange={onPickerChange}
          disabled={disabled}
          aria-label="年月をカレンダーで選択"
        />
        <span className="pointer-events-none flex items-center justify-center">
          <CalendarPickerIcon className="h-[1.125rem] w-[1.125rem]" />
        </span>
      </div>
    </div>
  );
}
