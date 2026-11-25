import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import config from '../config/game-config.json' with { type: 'json' };
import { Room } from '../server/room-core.js';
import { targetFor } from '../src/simulation/config.js';

const samples = 600,
  warmup = 100,
  results = [];
for (const scenario of ['starting island', 'all families at stage-six population targets']) {
  const cfg = structuredClone(config);
  if (scenario !== 'starting island')
    for (const rule of Object.values(cfg.spawning)) {
      if (rule && typeof rule === 'object' && 'fromStage' in rule) {
        if ('base' in rule) rule.base = rule.max = targetFor(rule, 6);
        rule.fromStage = 1;
      }
    }
  globalThis.gc?.();
  const before = process.memoryUsage(),
    start = performance.now();
  const room = new Room(
    { seed: 12345, mode: 'competitive', round: 'free', ruleset: 'benchmark' },
    cfg,
    0
  );
  for (let i = 0; i < 8; i++) {
    room.connect({ id: 'p' + i, name: 'Pilot ' + i }, 'c' + i, 0);
    room.receive(
      'p' + i,
      { type: 'input', seq: 1, keys: { Space: true, KeyW: true }, input: {} },
      0
    );
  }
  const constructionMs = performance.now() - start,
    counts = room.games.map((g) => g.G.enemies.length),
    times = [];
  let bytes = 0,
    now = 0;
  for (let i = 0; i < warmup + samples; i++) {
    now += 50;
    const tick = performance.now();
    room.advance(now);
    if (i % 2 === 0) {
      for (const id of room.clients.keys()) {
        const packet = JSON.stringify(room.snapshotFor(id));
        if (i >= warmup) bytes += Buffer.byteLength(packet);
      }
    }
    if (i >= warmup) times.push(performance.now() - tick);
  }
  times.sort((a, b) => a - b);
  const after = process.memoryUsage();
  results.push({
    scenario,
    players: 8,
    worlds: room.games.length,
    initialCreaturesPerWorld: counts,
    constructionMs: +constructionMs.toFixed(2),
    callbacks: samples,
    meanCallbackMs: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(3),
    p95CallbackMs: +times[Math.floor(times.length * 0.95)].toFixed(3),
    maxCallbackMs: +times.at(-1).toFixed(3),
    heapDeltaMiB: +((after.heapUsed - before.heapUsed) / 1048576).toFixed(2),
    processHeapMiB: +(after.heapUsed / 1048576).toFixed(2),
    processRssMiB: +(after.rss / 1048576).toFixed(2),
    averageSnapshotBytes: Math.round(bytes / ((samples / 2) * 8)),
    outgoingKiBPerSecond: Math.round(bytes / (samples / 20) / 1024),
    within50msAtP95: times[Math.floor(times.length * 0.95)] < 50
  });
}
const report = {
  generatedAt: new Date().toISOString(),
  runtime: process.version,
  platform: process.platform,
  method:
    'Local Node: eight real competitive simulations, three 60 Hz steps per 20 Hz callback, all eight snapshots serialized at 10 Hz. Includes no network or Cloudflare scheduling. Memory is Node process usage, not Cloudflare isolate accounting. Stress fixture unlocks creature families at stage one with stage-six population counts; gameplay tuning otherwise unchanged.',
  results
};
await mkdir('.artifacts', { recursive: true });
await writeFile('.artifacts/benchmark.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ artifact: '.artifacts/benchmark.json', results }, null, 2));
if (results.some((r) => !r.within50msAtP95)) process.exitCode = 1;
