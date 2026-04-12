'use client';

import Link from 'next/link';
import { AdminGate } from '@/components/admin/AdminGate';
import { Card } from '@/components/ui/Card';
import { PageTitle } from '@/components/ui/PageTitle';

const cards = [
  {
    href: '/masters/users',
    title: 'ユーザー管理',
    desc: 'ログインアカウントの追加・権限変更・無効化。新規ユーザはここからのみ登録できます。',
  },
  {
    href: '/settings/policies',
    title: '業務・会計の運用メモ',
    desc: '営業向けの取り決めと、経理・会計処理のルールを社内共有するためのメモ欄です。',
  },
  {
    href: '/settings',
    title: '会社情報・設定',
    desc: '会社名・住所・標準税率などの確認（詳細編集は今後拡張予定）。',
  },
  {
    href: '/masters',
    title: 'マスタ管理（勘定科目など）',
    desc: '勘定科目区分・勘定科目・銀行口座などのマスタへ進みます。',
  },
] as const;

export default function AdminHomePage() {
  return (
    <AdminGate>
      <PageTitle
        title="管理者メニュー"
        description="ユーザーの追加・運用ルールの記載は管理者のみが行えます。初回セットアップで作成した管理者アカウントでログインしてください。"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="h-full transition hover:border-navy-300 hover:shadow-md">
              <p className="font-semibold text-navy-900">{c.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-gunmetal-600">{c.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </AdminGate>
  );
}
