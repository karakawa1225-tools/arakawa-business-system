/**
 * Render 等で `node dist/index.js` が即終了するとき、npm のラッパー行だけでは原因がログに残らないことがある。
 * 先にハンドラを付けてから ESM で index を読み込み、読み込み失敗も必ず stderr に出す。
 */
process.on('uncaughtException', (err) => {
  console.error('[arakawa-backend] uncaughtException');
  console.error(err?.stack ?? err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[arakawa-backend] unhandledRejection');
  console.error(reason instanceof Error ? reason.stack : reason);
  process.exit(1);
});

const entry = new URL('./dist/index.js', import.meta.url);
await import(entry.href).catch((err) => {
  console.error('[arakawa-backend] dist/index.js の読み込みに失敗しました（ビルド漏れ・モジュール解決・実行時例外の可能性）');
  console.error(err?.stack ?? err);
  process.exit(1);
});
