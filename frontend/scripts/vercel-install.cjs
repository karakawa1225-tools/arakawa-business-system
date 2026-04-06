/**
 * Vercel で Root Directory = frontend のとき、`cd .. && npm install` が環境によって失敗する（exit 254 等）のを避ける。
 * モノレポルートをパスで解決してから npm install する。
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

const result = spawnSync('npm', ['install'], {
  cwd: monorepoRoot,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

process.exit(result.status === null ? 1 : result.status);
