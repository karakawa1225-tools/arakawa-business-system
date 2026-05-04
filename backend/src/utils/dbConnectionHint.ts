/**
 * Supabase / pooler 由来の接続エラーから、DATABASE_URL の見直しヒントを返す。
 * 返せない場合は undefined。
 */
export function hintForDatabaseConnectError(message: string): string | undefined {
  const m = message.toLowerCase();

  if (m.includes('tenant') && m.includes('not found')) {
    return (
      'Supabase の「Connection pooler」と「Direct connection」の取り違えが多いです。' +
      'Dashboard → Project Settings → Database で表示される URI をそのままコピーし、' +
      'Transaction pooler ならポート 6543・ユーザー postgres.[project_ref]、' +
      'Direct なら db.[ref].supabase.co・ユーザー postgres、' +
      'と公式の組み合わせに揃えてください。' +
      '古いプロジェクト参照や手入力ミスでも同様のメッセージになります。'
    );
  }

  if (m.includes('enotfound')) {
    return (
      'ホスト名の DNS 解決に失敗しています（ENOTFOUND）。' +
      'DATABASE_URL のホストを Supabase 画面の接続文字列から一字一句コピーし直してください。' +
      'プロジェクトを移した・一時停止した場合はホストが変わっていることがあります。'
    );
  }

  if (m.includes('password authentication failed')) {
    return 'DB パスワードが一致していません。Supabase でパスワードをリセットし、DATABASE_URL を更新してください。';
  }

  return undefined;
}
