'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';

type ImportResponse = { ok?: boolean; created: number; errors: { line: number; message: string }[] };

type Props = {
  /** POST /api/.../import-csv */
  importApiPath: string;
  onImported: () => void;
  onDownloadGuide: () => void;
  onDownloadTemplate: () => void;
};

export function MasterCsvPanel({ importApiPath, onImported, onDownloadGuide, onDownloadTemplate }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const data = await api<ImportResponse>(importApiPath, {
        method: 'POST',
        body: JSON.stringify({ csvText: text }),
      });
      let msg = `${data.created} 件を登録しました。`;
      if (data.errors?.length) {
        msg += `\n\nスキップした行:\n${data.errors.map((er) => `行${er.line}: ${er.message}`).join('\n')}`;
      }
      window.alert(msg);
      onImported();
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'CSVの取り込みに失敗しました');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onDownloadGuide}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900 hover:bg-slate-50"
      >
        項目説明CSV
      </button>
      <button
        type="button"
        onClick={onDownloadTemplate}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900 hover:bg-slate-50"
      >
        取込テンプレCSV
      </button>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void onPickFile(e)} />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className="rounded-lg border border-navy-900 bg-white px-3 py-2 text-sm font-medium text-navy-900 hover:bg-aqua-50 disabled:opacity-50"
      >
        {busy ? '取り込み中…' : 'CSV取り込み'}
      </button>
    </div>
  );
}
