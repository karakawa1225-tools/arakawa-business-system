'use client';

import { useRef } from 'react';

const ACCEPT_MIME = new Set(['image/jpeg', 'image/png']);

function isAllowedImageFile(file: File): boolean {
  if (ACCEPT_MIME.has(file.type)) return true;
  return /\.(jpe?g|png)$/i.test(file.name);
}

/**
 * スマホ・タブレットは capture でカメラ起動しやすく、PC はファイル選択。
 * JPEG / PNG のみ Data URL で返す（領収書アップロードと同系）。
 */
export function JpegPngImageField({
  value,
  onChange,
  label,
  description,
  buttonText = 'カメラで撮影 / ファイルから選択（JPEG・PNG）',
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  label: string;
  description?: string;
  buttonText?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gunmetal-600">{label}</label>
      {description ? <p className="text-xs text-gunmetal-500">{description}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const input = e.target;
          const file = input.files?.[0];
          input.value = '';
          if (!file) return;
          if (!isAllowedImageFile(file)) {
            window.alert('JPEG または PNG 形式のファイルを選んでください。');
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const url = String(reader.result ?? '');
            if (!url.startsWith('data:image/jpeg') && !url.startsWith('data:image/png')) {
              window.alert('JPEG または PNG 形式のみ保存できます。');
              return;
            }
            onChange(url);
          };
          reader.readAsDataURL(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-lg border border-aqua-200 bg-white px-3 py-2.5 text-sm text-navy-900 shadow-sm transition hover:bg-aqua-50"
      >
        {buttonText}
      </button>
      {value ? (
        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 sm:flex-row sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="選択した画像のプレビュー" className="max-h-44 max-w-full rounded-md border bg-white object-contain" />
          <button type="button" className="text-xs text-red-700 underline" onClick={() => onChange('')}>
            写真を削除
          </button>
        </div>
      ) : null}
    </div>
  );
}
