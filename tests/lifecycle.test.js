import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import config from '../config/game-config.json' with { type: 'json' };

let actors;
async function loadActors() {
  const source = (await readFile('server/worker.js', 'utf8')).replace(
    "import { DurableObject } from 'cloudflare:workers';",
    'class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }'
  );
  await mkdir('.artifacts', { recursive: true });
  const outfile = path.resolve('.artifacts/lifecycle-worker.mjs');
  await build({
    stdin: {
      contents: source + '\nexport {Room};',
      resolveDir: path.resolve('server'),
      sourcefile: 'worker.js'
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent'
  });
  const { GameRoom, Room } = await import(pathToFileURL(outfile).href);
  globalThis.WebSocketRequestResponsePair = class {};
  return { GameRoom, Room };
}
test('a rejected peer loses controls and active presence without completing a close handshake', async () => {
  // Exercise the production handler with an uncooperative transport boundary.
  // Real workerd integration tests separately exercise the actual socket API.
  const { GameRoom, Room } = await (actors ??= loadActors());
  const presence = [],
    context = { getWebSockets: () => [], setWebSocketAutoResponse() {} };
  const actor = new GameRoom(context, {
    LIVE: {
      idFromName: () => '',
      get: () => ({ presence: async (_room, ids) => presence.push(ids) })
    }
  });
  actor.room = new Room({ seed: 1, mode: 'coop', round: 'timed', ruleset: 'test' }, config);
  const client = actor.room.connect({ id: 'g', name: 'Guest' }, 'connection');
  actor.room.receive('g', { type: 'input', seq: 1, input: { mouseFire: true } });
  let attachment = { id: 'g', connectionId: 'connection' };
  const sent = [];
  const socket = {
    deserializeAttachment: () => attachment,
    serializeAttachment: (value) => {
      attachment = value;
    },
    send: (data) => sent.push(JSON.parse(data)),
    close() {
      /* Deliberately no close callback. */
    }
  };
  try {
    await actor.webSocketMessage(socket, JSON.stringify({ type: 'score', score: 999999 }));
    assert.equal(client.connected, false);
    assert.equal(client.game.players.get('g').input.mouseFire, false);
    assert.deepEqual(actor.room.activeIds, []);
    assert.deepEqual(presence.at(-1), []);
    assert.equal(sent.at(-1).code, 'BAD_INPUT');
    assert.equal(attachment.blocked, true);
  } finally {
    actor.stopTimer();
  }
});

test('room callbacks advance the clock even when the runtime clock is unchanged between I/O', async () => {
  const { GameRoom, Room } = await (actors ??= loadActors());
  const actor = new GameRoom(
    { getWebSockets: () => [], setWebSocketAutoResponse() {} },
    {
      LIVE: { idFromName: () => '', get: () => ({ presence: async () => {} }) }
    }
  );
  actor.room = new Room({ seed: 1, mode: 'coop', round: 'timed', ruleset: 'test' }, config, 1000);
  actor.room.connect({ id: 'g', name: 'Guest' }, 'connection', 1000);
  actor.lastLease = 1000;
  const original = Date.now;
  Date.now = () => 1000;
  try {
    actor.startTimer();
    assert.notEqual(actor.timer, null);
    for (let i = 0; i < 5; i++) await actor.tick();
    assert.ok(Math.abs(actor.room.shared.G.playTime - 0.25) < 0.001);
    assert.ok(actor.room.shared.G.timeLeft < 239.8);
    actor.room.disconnect('g', 'connection', 1250);
    Date.now = () => 32000;
    await actor.tick();
    assert.equal(actor.room.shared, null);
    assert.equal(actor.timer, null);
  } finally {
    Date.now = original;
    actor.stopTimer();
  }
});
