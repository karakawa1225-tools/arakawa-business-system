import { useMemo } from 'react';

export function CurrencyInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
}) {
  const text = useMemo(() => {
    const n = Number.isFinite(value) ? value : 0;
    return n === 0 ? '' : String(n);
  }, [value]);

  return (
    <input
      inputMode="numeric"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d-]/g, '');
        const n = raw ? Number(raw) : 0;
        onChange(Number.isFinite(n) ? n : 0);
      }}
      className={className}
    />
  );
}

