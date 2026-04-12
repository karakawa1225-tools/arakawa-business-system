'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { PcOnlyRegisterShell } from '@/components/masters/PcOnlyRegisterShell';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { JpegPngImageField } from '@/components/ui/JpegPngImageField';
import { api } from '@/lib/api';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="border-b border-slate-200 pb-2 text-sm font-semibold text-navy-900">{children}</h2>;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-gunmetal-600">{label}</label>
      {hint ? <p className="text-[11px] text-gunmetal-500">{hint}</p> : null}
      {children}
    </div>
  );
}

export default function NewProductPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [productCode, setProductCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [manufacturerPartNo, setManufacturerPartNo] = useState('');
  const [truscoOrderCode, setTruscoOrderCode] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [specText, setSpecText] = useState('');

  useEffect(() => {
    api<{ id: string; name: string }[]>('/api/suppliers').then(setSuppliers);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = productCode.trim();
    const nm = name.trim();
    if (!code || !nm) {
      window.alert('商品コードと商品名は必須です。');
      return;
    }
    try {
      await api('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          productCode: code,
          name: nm,
          category: category.trim() || null,
          manufacturer: manufacturer.trim() || null,
          manufacturerPartNo: manufacturerPartNo.trim() || null,
          truscoOrderCode: truscoOrderCode.trim() || null,
          supplierId: supplierId || null,
          purchasePrice: purchasePrice > 0 ? purchasePrice : null,
          salePrice: salePrice > 0 ? salePrice : null,
          photoUrl: photoDataUrl || null,
          specText: specText.trim() || null,
        }),
      });
      router.push('/products');
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : '登録に失敗しました');
    }
  }

  return (
    <>
      <PageTitle
        title="商品登録"
        description="必須項目を入力し、写真は撮影またはファイルから追加できます。"
      />
      <PcOnlyRegisterShell listHref="/products" resourceLabel="商品">
        <Card className="max-w-3xl">
          <form onSubmit={submit} className="space-y-8">
          <section className="space-y-4">
            <SectionTitle>基本情報</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="商品コード" hint="社内・販売で使うコード（重複不可）">
                <input
                  required
                  autoComplete="off"
                  placeholder="例: PRD-001"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-navy-600 focus:ring-2"
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                />
              </Field>
              <Field label="商品名" hint="一覧・見積などに表示されます">
                <input
                  required
                  placeholder="例: ○○ボルト M10"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-navy-600 focus:ring-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="カテゴリ" hint="任意（検索・整理用）">
                <input
                  placeholder="例: ねじ・ボルト"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-navy-600 focus:ring-2"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </Field>
              <Field label="メーカー">
                <input
                  placeholder="例: メーカー名"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-navy-600 focus:ring-2"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                />
              </Field>
              <Field label="メーカー品番">
                <input
                  placeholder="型番・品番"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-navy-600 focus:ring-2"
                  value={manufacturerPartNo}
                  onChange={(e) => setManufacturerPartNo(e.target.value)}
                />
              </Field>
              <Field label="トラスコ発注コード" hint="使用する場合のみ">
                <input
                  placeholder="発注用コード"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-navy-600 focus:ring-2"
                  value={truscoOrderCode}
                  onChange={(e) => setTruscoOrderCode(e.target.value)}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <SectionTitle>仕入先・価格</SectionTitle>
            <Field label="主仕入先" hint="任意。仕入先マスタに登録済みの業者から選びます">
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-navy-600 focus:ring-2"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">指定なし</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="仕入価格（税抜）" hint="0 のときは未設定として保存">
                <CurrencyInput
                  value={purchasePrice}
                  onChange={setPurchasePrice}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-right outline-none ring-navy-600 focus:ring-2"
                />
              </Field>
              <Field label="販売価格（税抜）" hint="0 のときは未設定として保存">
                <CurrencyInput
                  value={salePrice}
                  onChange={setSalePrice}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-right outline-none ring-navy-600 focus:ring-2"
                />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <SectionTitle>商品写真</SectionTitle>
            <JpegPngImageField
              label="画像"
              description="スマートフォン・タブレットではカメラ、PC ではファイル選択になります。JPEG ・ PNG のみ保存されます（データは商品データと一緒に保存されます）。"
              value={photoDataUrl}
              onChange={setPhotoDataUrl}
            />
          </section>

          <section className="space-y-4">
            <SectionTitle>仕様・備考</SectionTitle>
            <Field label="仕様・サイズ・材質・用途など" hint="自由記述。見積・社内確認用">
              <textarea
                placeholder="例: 全長 25mm、ステンレス、10個入り…"
                className="min-h-[120px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-navy-600 focus:ring-2"
                rows={5}
                value={specText}
                onChange={(e) => setSpecText(e.target.value)}
              />
            </Field>
          </section>

          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-6">
            <Link href="/products" className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-navy-900 hover:bg-slate-50">
              一覧に戻る
            </Link>
            <button type="submit" className="rounded-lg bg-navy-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-800">
              保存する
            </button>
          </div>
          </form>
        </Card>
      </PcOnlyRegisterShell>
    </>
  );
}
