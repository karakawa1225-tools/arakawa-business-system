/**
 * Vercel で Root Directory = frontend のとき、`cd .. && npm install` が環境によって失敗する（exit 254 等）のを避ける。
 * モノレポルートをパスで解決してから npm install する。
 *
 * Vercel の Build では NODE_ENV=production が有効になり、npm が devDependencies を落とすと
 * Next / eslint 等が入らず後続で失敗することがあるため、インストール時は include=dev を明示する。
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const scriptsDir = __dirname;
const frontendDir = path.join(scriptsDir, '..');
const monorepoRoot = path.join(frontendDir, '..');
const rootPkg = path.join(monorepoRoot, 'package.json');

if (!fs.existsSync(rootPkg)) {
  console.error(
    '[vercel-install] Monorepo root not found. Expected package.json at:',
    rootPkg
  );
  process.exit(1);
}

console.log('[vercel-install] monorepoRoot=', monorepoRoot);

/** インストールだけ production モードにしない（ワークスペースの dev 依存が必要） */
const installEnv = { ...process.env };
delete installEnv.NODE_ENV;

const result = spawnSync('npm', ['install', '--include=dev'], {
  cwd: monorepoRoot,
  stdio: 'inherit',
  env: installEnv,
  shell: true,
});

if (result.error) {
  console.error('[vercel-install] spawn error:', result.error);
}

process.exit(result.status === null ? 1 : result.status);
