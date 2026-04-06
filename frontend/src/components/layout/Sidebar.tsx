'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = { href: string; label: string };

const groups: { title: string; items: Item[] }[] = [
  {
    title: 'メイン',
    items: [
      { href: '/home', label: 'ホーム（使い方）' },
      { href: '/dashboard', label: 'Dashboard' },
    ],
  },
  {
    title: 'CRM',
    items: [{ href: '/crm/customers', label: '顧客管理' }],
  },
  {
    title: '販売管理',
    items: [
      { href: '/sales/estimates', label: '見積管理' },
      { href: '/sales/orders', label: '受注管理' },
      { href: '/sales/invoices', label: '請求管理' },
      { href: '/sales/payments', label: '入金管理' },
    ],
  },
  {
    title: '商品・仕入',
    items: [
      { href: '/products', label: '商品マスタ' },
      { href: '/purchase/suppliers', label: '仕入先マスタ' },
    ],
  },
  {
    title: '会計',
    items: [
      { href: '/accounting/bank', label: '銀行入出金' },
      { href: '/accounting/payroll', label: '給与管理' },
      { href: '/accounting/expenses', label: '経費管理' },
      { href: '/accounting/ar', label: '売掛金管理' },
      { href: '/accounting/ap', label: '買掛金管理' },
      { href: '/accounting/travel', label: '出張旅費' },
    ],
  },
  {
    title: 'その他',
    items: [
      { href: '/reports', label: 'レポート' },
      { href: '/masters', label: 'マスタ管理' },
      { href: '/settings', label: '設定' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-aqua-300 bg-aqua-50/90 backdrop-blur">
      <div className="flex h-14 items-center border-b border-aqua-300 px-4">
        <Link href="/home" className="text-sm font-semibold tracking-tight text-navy-900">
          ARAKAWA <span className="font-normal text-gunmetal-600">Business</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {groups.map((g) => (
          <div key={g.title} className="mb-6">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-aqua-700">
              {g.title}
            </p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                        active
                          ? 'bg-aqua-100 font-medium text-navy-900'
                          : 'text-navy-800/80 hover:bg-aqua-50 hover:text-navy-900'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-aqua-300 p-3">
        <Link
          href="/portal/login"
          className="block text-xs text-navy-800/80 hover:text-navy-900"
        >
          顧客ポータルログイン →
        </Link>
      </div>
    </aside>
  );
}
