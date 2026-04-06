/**
 * Vercel で Root Directory = frontend のときの install。
 *
 * 親ディレクトリの package.json を必須にすると、Vercel のチェックアウトやパス差で exit 1 になる。
 * cwd を frontend に置き `npm install` する（npm は親の workspaces / package-lock を辿る）。
 *
 * Build 時は NODE_ENV=production になりがちなので dev 依存を明示的に含める。
 */
const path = require('path');
const { spawnSync } = require('child_process');

const frontendDir = path.join(__dirname, '..');

const installEnv = { ...process.env };
delete installEnv.NODE_ENV;

console.log('[vercel-install] cwd=', frontendDir);

const result = spawnSync('npm', ['install', '--include=dev'], {
  cwd: frontendDir,
  stdio: 'inherit',
  env: installEnv,
  shell: true,
});

if (result.error) {
  console.error('[vercel-install] spawn error:', result.error);
}

process.exit(result.status === null ? 1 : result.status);
