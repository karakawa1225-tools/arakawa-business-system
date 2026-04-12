import Link from 'next/link';
import { Card } from '@/components/ui/Card';

export function PcOnlyRegisterShell({
  listHref,
  resourceLabel,
  children,
}: {
  listHref: string;
  /** 例: 「顧客」「仕入先」「商品」 */
  resourceLabel: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="lg:hidden">
        <Card className="max-w-xl border-amber-200 bg-amber-50/95">
          <p className="text-sm font-medium text-amber-950">
            この画面の手動入力は、パソコンなど<strong className="font-semibold">画面幅が広い環境（1024px以上）</strong>
            に限定しています。
          </p>
          <p className="mt-3 text-sm leading-relaxed text-amber-950/90">
            {resourceLabel}
            の登録は、一覧の「項目説明CSV」「取込テンプレCSV」に沿ってファイルを作成し、
            <strong className="font-medium"> CSV取り込み</strong>をご利用ください。
          </p>
          <Link href={listHref} className="mt-4 inline-block text-sm font-medium text-navy-900 underline">
            一覧へ戻る
          </Link>
        </Card>
      </div>
      <div className="hidden lg:block">{children}</div>
    </>
  );
}
