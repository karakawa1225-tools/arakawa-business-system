import { redirect } from 'next/navigation';

/** 未ログインは /login で初回セットアップの有無を判定する（従来は /home → AuthGuard → /login で余計な往復があった） */
export default function RootPage() {
  redirect('/login');
}
