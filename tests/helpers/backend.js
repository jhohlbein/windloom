import { build } from 'esbuild';
import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from 'miniflare';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
export async function startBackend({ port = 0, maxRooms = 16, configOverride } = {}) {
  await mkdir('.artifacts', { recursive: true });
  const outfile = path.resolve(
    '.artifacts/worker-tests-' + process.pid + '-' + crypto.randomUUID() + '.mjs'
  );
  await build({
    entryPoints: ['server/worker.js'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    external: ['cloudflare:workers'],
    outfile,
    logLevel: 'silent',
    plugins: configOverride
      ? [
          {
            name: 'fixture-config',
            setup(builder) {
              builder.onLoad({ filter: /[\\/]config[\\/]game-config\.json$/ }, () => ({
                contents: JSON.stringify(configOverride),
                loader: 'json'
              }));
            }
          }
        ]
      : []
  });
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'windloom-test',
      scriptPath: outfile,
      modules: true,
      compatibilityDate: '2026-11-18',
      host: '127.0.0.1',
      port,
      log: new Log(LogLevel.ERROR),
      bindings: {
        SESSION_SECRET: 'local-test-secret-'.repeat(4),
        ALLOWED_ORIGINS: 'http://127.0.0.1:8000,http://localhost:8000',
        MAX_ACTIVE_ROOMS: String(maxRooms)
      },
      durableObjects: {
        ROOMS: { className: 'GameRoom', useSQLite: true },
        LIVE: { className: 'LiveBoard', useSQLite: true }
      }
    })
  );
  const url = await mf.ready;
  return { mf, url };
}
