'use client';

import Link from 'next/link';

function FlowStep({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="flex min-w-[140px] flex-1 flex-col items-center text-center sm:min-w-[120px]">
      <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-aqua-200 to-aqua-400 text-sm font-bold text-navy-900 shadow-sm">
        {n}
      </div>
      <p className="text-sm font-semibold text-navy-900">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-gunmetal-600">{desc}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="hidden shrink-0 self-center text-2xl font-light text-aqua-400 sm:block" aria-hidden>
      →
    </div>
  );
}

function GuideCard({
  href,
  badge,
  title,
  children,
  accent,
}: {
  href: string;
  badge: string;
  title: string;
  children: React.ReactNode;
  accent: 'aqua' | 'navy' | 'cyan';
}) {
  const bar =
    accent === 'aqua'
      ? 'from-aqua-400 to-aqua-600'
      : accent === 'navy'
        ? 'from-navy-400 to-navy-700'
        : 'from-cyan-400 to-teal-600';
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-aqua-300/80 hover:shadow-md"
    >
      <div className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${bar}`} />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-aqua-700">{badge}</p>
      <h3 className="mt-2 text-base font-semibold text-navy-900 group-hover:text-navy-800">{title}</h3>
      <div className="mt-3 text-sm leading-relaxed text-gunmetal-600">{children}</div>
      <span className="mt-4 inline-flex items-center text-xs font-medium text-navy-700 group-hover:underline">
        画面を開く
        <span className="ml-1 transition group-hover:translate-x-0.5">›</span>
      </span>
    </Link>
  );
}

export default function HomeGuidePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-12 pb-8">
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-slate-900 px-6 py-10 text-white shadow-xl sm:px-10 sm:py-12">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-aqua-300/90">ARAKAWA Business System</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">はじめに・使い方ガイド</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
          このシステムは、商社型の「顧客管理 → 見積・受注 → 請求・入金」に加え、銀行・経費・売掛・買掛などの会計業務をひとつの画面群で進められるように作られています。左のメニューと同じ並びで、何をどの順で使うかを以下にまとめました。
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 shadow-md transition hover:bg-aqua-50"
          >
            売上・入金のグラフを見る
          </Link>
          <Link
            href="/crm/customers"
            className="inline-flex items-center rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/15"
          >
            顧客を登録する
          </Link>
          <Link
            href="/sales/estimates/new"
            className="inline-flex items-center rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/15"
          >
            新しい見積を作る
          </Link>
        </div>
      </section>

      {/* 販売フロー */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-navy-900">販売・請求のおすすめの流れ</h2>
          <p className="mt-1 text-sm text-gunmetal-600">
            左から順に進めると、データがつながりやすくミスが減ります。途中から始めても問題ありません。
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/80 to-white p-6 shadow-card sm:p-8">
          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-center">
            <FlowStep n="1" title="見積" desc="顧客に提示する金額・明細を作成" />
            <FlowArrow />
            <FlowStep n="2" title="受注" desc="受注確定を記録" />
            <FlowArrow />
            <FlowStep n="3" title="請求" desc="請求書を発行" />
            <FlowArrow />
            <FlowStep n="4" title="入金" desc="入金を登録（請求と連動）" />
          </div>
          <p className="mt-6 text-center text-xs text-gunmetal-500 sm:text-left">
            各画面の一覧から「新規」や番号リンクで詳細に入り、編集・削除ができます。
          </p>
        </div>
      </section>

      {/* 会計フロー */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-navy-900">会計まわりの目安</h2>
          <p className="mt-1 text-sm text-gunmetal-600">
            日々の取引の記録と、月次の売掛・買掛の整理に使います。
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card sm:p-8">
          <ul className="grid gap-4 sm:grid-cols-2">
            <li className="flex gap-3 rounded-xl bg-slate-50/90 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aqua-100 text-xs font-bold text-navy-800">
                銀行
              </span>
              <div>
                <p className="font-semibold text-navy-900">銀行入出金</p>
                <p className="mt-1 text-sm text-gunmetal-600">口座ごとの入金・出金。入金登録と連動する場合があります。</p>
              </div>
            </li>
            <li className="flex gap-3 rounded-xl bg-slate-50/90 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aqua-100 text-xs font-bold text-navy-800">
                経費
              </span>
              <div>
                <p className="font-semibold text-navy-900">経費管理</p>
                <p className="mt-1 text-sm text-gunmetal-600">領収書写真の添付や勘定科目・税区分の入力。</p>
              </div>
            </li>
            <li className="flex gap-3 rounded-xl bg-slate-50/90 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aqua-100 text-xs font-bold text-navy-800">
                AR
              </span>
              <div>
                <p className="font-semibold text-navy-900">売掛金</p>
                <p className="mt-1 text-sm text-gunmetal-600">顧客別・月別の売上集計イメージで管理。</p>
              </div>
            </li>
            <li className="flex gap-3 rounded-xl bg-slate-50/90 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aqua-100 text-xs font-bold text-navy-800">
                AP
              </span>
              <div>
                <p className="font-semibold text-navy-900">買掛金</p>
                <p className="mt-1 text-sm text-gunmetal-600">仕入先別の未払い管理。</p>
              </div>
            </li>
            <li className="flex gap-3 rounded-xl bg-slate-50/90 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aqua-100 text-xs font-bold text-navy-800">
                旅
              </span>
              <div>
                <p className="font-semibold text-navy-900">出張旅費</p>
                <p className="mt-1 text-sm text-gunmetal-600">規程のひな型と、精算明細の登録・一覧。</p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* メニュー別カード */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-navy-900">メニュー別ガイド</h2>
        <p className="text-sm text-gunmetal-600">カードをクリックするとその画面に移動します。</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <GuideCard href="/dashboard" badge="メイン" title="Dashboard" accent="navy">
            今日の売上や未入金、請求・入金の月次推移をグラフで確認します。まず全体の数字を把握する場所です。
          </GuideCard>
          <GuideCard href="/crm/customers" badge="CRM" title="顧客管理" accent="aqua">
            取引先の基本情報・締日・支払サイトなどを登録します。見積・請求で「どの顧客か」を選ぶときの土台になります。
          </GuideCard>
          <GuideCard href="/sales/estimates" badge="販売" title="見積管理" accent="aqua">
            見積番号・明細・合計を管理します。新規作成から印刷・送付の前段までを想定しています。
          </GuideCard>
          <GuideCard href="/sales/orders" badge="販売" title="受注管理" accent="aqua">
            受注内容の確認用です。見積から受注に進んだ流れと合わせて使います。
          </GuideCard>
          <GuideCard href="/sales/invoices" badge="販売" title="請求管理" accent="aqua">
            請求書の一覧と新規作成。入金登録とあわせて回収状況を追います。
          </GuideCard>
          <GuideCard href="/sales/payments" badge="販売" title="入金管理" accent="aqua">
            入金の登録・編集。請求との紐づけや銀行残高への反映に注意して操作します。
          </GuideCard>
          <GuideCard href="/products" badge="商品・仕入" title="商品マスタ" accent="cyan">
            商品コード・価格・写真（JPEG/PNG）などを登録します。見積明細で選べるようになります。
          </GuideCard>
          <GuideCard href="/purchase/suppliers" badge="商品・仕入" title="仕入先マスタ" accent="cyan">
            仕入先の一覧と新規登録。買掛や経費の支払先のイメージで使います。
          </GuideCard>
          <GuideCard href="/accounting/bank" badge="会計" title="銀行入出金" accent="navy">
            口座を選び、入出金を追加・修正・削除します。残高はシステム側で再計算されます。
          </GuideCard>
          <GuideCard href="/accounting/expenses" badge="会計" title="経費管理" accent="navy">
            日付・金額・勘定科目・税区分、領収書画像（撮影またはファイル）を登録します。
          </GuideCard>
          <GuideCard href="/accounting/ar" badge="会計" title="売掛金管理" accent="navy">
            月と顧客を選び、売上明細を入力・修正します。PDF の添付にも対応しています。
          </GuideCard>
          <GuideCard href="/accounting/ap" badge="会計" title="買掛金管理" accent="navy">
            仕入先別の買掛を月次で管理します。
          </GuideCard>
          <GuideCard href="/accounting/travel" badge="会計" title="出張旅費" accent="navy">
            出張旅費規程のひな型（印刷可）と、交通費・宿泊費・日当など区分別の精算登録を行います。
          </GuideCard>
          <GuideCard href="/reports" badge="その他" title="レポート" accent="cyan">
            経費精算・銀行入出金・売掛・買掛などの PDF を月指定でダウンロードします。
          </GuideCard>
          <GuideCard href="/masters" badge="その他" title="マスタ管理" accent="cyan">
            ユーザー・勘定科目区分・勘定科目・銀行口座など、共通マスタの保守を行います。
          </GuideCard>
          <GuideCard href="/settings" badge="その他" title="設定" accent="cyan">
            会社情報の確認など。詳細変更は管理者向けの導線を参照してください。
          </GuideCard>
        </div>
      </section>

      {/* 補足 */}
      <section className="rounded-2xl border border-aqua-200/80 bg-aqua-50/40 px-6 py-6 sm:px-8">
        <h2 className="text-base font-bold text-navy-900">はじめての方へ</h2>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-gunmetal-700">
          <li>
            未ログインのときは{' '}
            <Link href="/setup" className="font-medium text-navy-800 underline hover:text-navy-950">
              初回セットアップ
            </Link>
            から会社・ユーザー・初期マスタを登録できます。
          </li>
          <li>ログイン後は常に左メニューから主要画面へ移動できます。このページ（ホーム）はいつでもメニューの「ホーム」から開けます。</li>
          <li>
            顧客向けの閲覧用は{' '}
            <Link href="/portal/login" className="font-medium text-navy-800 underline hover:text-navy-950">
              顧客ポータルログイン
            </Link>
            から別途アクセスします（社内ログインとは別です）。
          </li>
        </ul>
      </section>
    </div>
  );
}
