import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const secret = path.join(root, 'server/.dev.vars.local');
if (!existsSync(secret))
  writeFileSync(secret, 'SESSION_SECRET=' + randomBytes(32).toString('hex') + '\n', {
    mode: 0o600,
    flag: 'wx'
  });
mkdirSync(path.join(root, '.artifacts'), { recursive: true });
const child = spawn(
  process.execPath,
  [
    path.join(root, 'node_modules/wrangler/bin/wrangler.js'),
    'dev',
    '--config',
    'server/wrangler.jsonc',
    '--env',
    'local',
    '--local',
    '--ip',
    '127.0.0.1',
    '--port',
    '8787',
    '--persist-to',
    '.artifacts/local-state'
  ],
  { cwd: root, stdio: 'inherit', windowsHide: true }
);
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
