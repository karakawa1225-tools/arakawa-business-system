'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { runSave } from '@/lib/save';

export default function TravelRegulationPage() {
  const [companyName, setCompanyName] = useState('');
  const [supplement, setSupplement] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [co, reg] = await Promise.all([
          api<Record<string, unknown> | null>('/api/settings/company'),
          api<{ supplementText: string }>('/api/travel-expenses/regulation'),
        ]);
        if (cancelled) return;
        setCompanyName(co?.name ? String(co.name) : '（会社名未設定）');
        setSupplement(reg.supplementText ?? '');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveSupplement() {
    await runSave(
      () => api('/api/travel-expenses/regulation', { method: 'PATCH', body: JSON.stringify({ supplementText: supplement }) }),
      async () => {}
    );
  }

  return (
    <>
      <PageTitle
        title="出張旅費規程（ひな型）"
        description="一般的な中小企業向けの条項例です。実際の運用に合わせて文言を調整し、下の「会社別の追加条項」に貴社ルールを追記・保存できます。"
      />

      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Link href="/accounting/travel" className="rounded border border-navy-900 px-4 py-2 text-sm text-navy-900">
          精算一覧へ
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded bg-navy-900 px-4 py-2 text-sm text-white"
        >
          印刷
        </button>
      </div>

      {!loaded ? (
        <p className="text-sm text-gunmetal-600">読み込み中…</p>
      ) : (
        <div className="space-y-6">
          <Card className="regulation-print max-w-3xl space-y-6 text-sm leading-relaxed text-gunmetal-800">
            <header className="border-b border-slate-200 pb-4 text-center">
              <p className="text-xs text-gunmetal-600">社内規程（ひな型）</p>
              <h2 className="mt-1 text-lg font-bold text-navy-900">出張旅費規程</h2>
              <p className="mt-2 text-sm">{companyName}</p>
            </header>

            <section>
              <h3 className="font-semibold text-navy-900">第1条（目的）</h3>
              <p className="mt-2">
                本規程は、従業員の業務上の出張に伴う旅費の負担範囲、精算方法および承認手続を定め、適正かつ公平な旅費支給を図ることを目的とする。
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-navy-900">第2条（適用範囲）</h3>
              <p className="mt-2">
                本規程は、会社が認めた業務上の出張（国内・海外を含む。ただし会社が別途定める場合を除く）に適用する。私用旅行を伴う場合は、会社が認めた区間・日数に限り適用する。
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-navy-900">第3条（交通費）</h3>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>鉄道・航空機・バス・船舶等は、業務上必要かつ経済的な通常の経路・座席等による実費を原則とする。</li>
                <li>新幹線・特急等の利用は、事前に上司の承認を得るものとする（緊急時は事後速やかに報告）。</li>
                <li>タクシーは、公共交通機関の利用が著しく困難な場合等に限り、理由を明記のうえ実費とする。</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-navy-900">第4条（宿泊費）</h3>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>宿泊が必要な出張については、領収書（または会社が認める電子証憑）を添付し、実費を精算する。</li>
                <li>1泊あたりの上限額、宿泊先の選定基準等は、会社が別途定める場合がある。</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-navy-900">第5条（日当）</h3>
              <p className="mt-2">
                会社所定の日当を、出張日数に応じて支給する。日当の額・国内・海外の区分は、会社の就業規則・諸規程または人事通知に従う。
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-navy-900">第6条（食事代）</h3>
              <p className="mt-2">
                接待交際費等として処理すべきものを除き、出張中の食事に要した費用は、領収書等に基づき実費精算又は日当との調整として会社が定める方法による。
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-navy-900">第7条（その他）</h3>
              <p className="mt-2">
                会議参加費、手荷物料金、旅情保険料等、業務遂行に直接必要な費用は、事前承認又は事後承認のうえ、実費を精算することができる。
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-navy-900">第8条（精算手続）</h3>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>出張終了後、会社所定の期限内に精算書を提出し、領収書等を添付する。</li>
                <li>提出遅延・証憑不備がある場合、支払が遅延することがある。</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-navy-900">第9条（承認）</h3>
              <p className="mt-2 mb-3">
                出張の実施および旅費の支給は、所属長の承認を要する。高額・長期・海外出張等については、会社が定める承認権限に従う。
              </p>
              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b px-3 py-2 text-left font-medium">区分</th>
                      <th className="border-b px-3 py-2 text-left font-medium">承認者（例）</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border-b px-3 py-2">国内日帰り・短期</td>
                      <td className="border-b px-3 py-2">所属長</td>
                    </tr>
                    <tr>
                      <td className="border-b px-3 py-2">国内宿泊・中額以上</td>
                      <td className="border-b px-3 py-2">所属長 → 部門長（会社が定める場合）</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2">海外・長期</td>
                      <td className="px-3 py-2">部門長 → 代表者等（会社が定める場合）</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {supplement.trim() ? (
              <section className="rounded-lg border border-aqua-200 bg-aqua-50/40 p-4">
                <h3 className="font-semibold text-navy-900">付則（会社登録の追加条項）</h3>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{supplement}</pre>
              </section>
            ) : null}
          </Card>

          <Card className="max-w-3xl print:hidden">
            <h3 className="text-sm font-medium text-navy-900">会社別の追加条項（保存）</h3>
            <p className="mt-1 text-xs text-gunmetal-600">
              上限金額・日当単価・承認フローなど、貴社固有のルールをここに書いて保存すると、上のひな型とあわせて参照できます（印刷時も反映されます）。
            </p>
            <textarea
              rows={8}
              value={supplement}
              onChange={(e) => setSupplement(e.target.value)}
              className="mt-3 w-full rounded border px-3 py-2 text-sm"
              placeholder="例：国内宿泊 1 泊上限 12,000 円（税サ込）／日当 国内 1,500 円…"
            />
            <button
              type="button"
              onClick={() => void saveSupplement()}
              className="mt-3 rounded bg-navy-900 px-4 py-2 text-sm text-white"
            >
              追加条項を保存
            </button>
          </Card>
        </div>
      )}
    </>
  );
}
