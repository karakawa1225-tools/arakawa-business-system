/**
 * Vercel 等の CI では npm workspaces でも `next` が PATH に乗らないことがある。
 * require.resolve でインストール済みの next を必ず解決してから build する。
 */
const path = require('path');
const { spawnSync } = require('child_process');

const frontendRoot = path.join(__dirname, '..');
const nextPkg = require.resolve('next/package.json', { paths: [frontendRoot] });
const nextBin = path.join(path.dirname(nextPkg), 'dist', 'bin', 'next');

const result = spawnSync(process.execPath, [nextBin, 'build'], {
  stdio: 'inherit',
  cwd: frontendRoot,
  env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
