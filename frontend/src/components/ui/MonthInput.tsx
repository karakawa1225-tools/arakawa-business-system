'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  const monthRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(formatYearMonthJa(value));
  }, [value]);

  const openMonthPicker = useCallback(() => {
    const el = monthRef.current;
    if (!el || disabled) return;
    const anyEl = el as HTMLInputElement & { showPicker?: () => void };
    if (typeof anyEl.showPicker === 'function') {
      try {
        anyEl.showPicker();
        return;
      } catch {
        /* 一部ブラウザはコンテキストによって拒否 */
      }
    }
    el.focus();
    el.click();
  }, [disabled]);

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

  const monthValue = YM.test(value) ? value : '';

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
      {/* type=month は視覚的に隠し、ボタンから showPicker / click で開く（買掛一覧などでタップが効かない端末向け） */}
      <input
        ref={monthRef}
        type="month"
        min="2000-01"
        max="2100-12"
        tabIndex={-1}
        value={monthValue}
        onChange={onPickerChange}
        disabled={disabled}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 -z-10 h-px w-px opacity-0"
      />
      <button
        type="button"
        title="年月をカレンダーで選択"
        disabled={disabled}
        onClick={() => openMonthPicker()}
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-navy-950/30 bg-navy-900 text-white shadow-sm transition-[background-color,box-shadow,transform] sm:h-9 sm:w-9 ${
          disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-navy-800 hover:shadow-md active:scale-[0.97]'
        }`}
        aria-label="年月をカレンダーで選択"
      >
        <CalendarPickerIcon className="h-[1.125rem] w-[1.125rem]" />
      </button>
    </div>
  );
}
