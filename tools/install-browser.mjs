import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(
  process.execPath,
  [path.join(root, 'node_modules/@playwright/test/cli.js'), 'install', 'chromium'],
  {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(root, '.artifacts/browsers') }
  }
);
process.exitCode = result.status ?? 1;
