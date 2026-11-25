import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../config/game-config.json' with { type: 'json' };
import { createSimulation } from '../src/simulation/runtime.js';

test('headless game generates the existing island and isolates players in separate simulations', () => {
  const a = createSimulation(config, 12345),
    b = createSimulation(config, 12345);
  a.addPlayer('a');
  b.addPlayer('b');
  assert.equal(a.W.CX, b.W.CX);
  assert.equal(a.W.ST, b.W.ST);
  assert.ok(a.G.enemies.length > 0);
  assert.ok(a.G.orbs.length > 0);
  const before = b.players.get('b').playerPos.clone();
  a.setInput('a', { keys: { KeyW: true }, input: {} });
  a.step(1 / 60);
  assert.ok(a.players.get('a').playerPos.distanceTo(before) > 0);
  assert.equal(b.players.get('b').playerPos.distanceTo(before), 0);
});
test('co-op shares deposits and stage growth but retains individual health and carried mana', () => {
  const s = createSimulation(config, 12345);
  s.addPlayer('a');
  s.addPlayer('b');
  const a = s.players.get('a'),
    b = s.players.get('b');
  a.playerPos.set(s.W.CX + 20, s.W.PH + 15, s.W.CZ);
  a.carried = 60;
  b.carried = 10;
  b.hp = 20;
  b.playerPos.set(0, 35, 500);
  for (let i = 0; i < 120; i++) {
    a.playerPos.set(s.W.CX + 20, s.W.PH + 15, s.W.CZ);
    s.step(1 / 60);
  }
  assert.ok(s.G.castleMana > 0);
  assert.equal(b.carried, 10);
  assert.ok(a.banked > 0);
  assert.ok(b.hp < b.maxHp);
  assert.equal(s.G.level, 2);
});
test('a lethal enemy bolt respawns only its victim and clears that carpet’s carried mana', () => {
  const s = createSimulation(config, 12345),
    a = s.addPlayer('a'),
    b = s.addPlayer('b');
  a.playerPos.set(0, 35, 500);
  b.playerPos.set(0, 35, -500);
  a.hp = 1;
  a.invuln = 0;
  a.carried = 20;
  b.invuln = 100;
  const otherHp = b.hp,
    pos = a.playerPos.clone();
  s.G.enemies = [];
  s.G.bolts = [
    {
      g: { position: pos },
      pos,
      vel: pos.clone().set(0, 0, 0),
      life: 1,
      dmg: 10,
      grav: 0,
      col: [1, 0.25, 0.35],
      sz: 2,
      hitR: 5
    }
  ];
  s.step(1 / 60);
  assert.equal(a.hp, a.maxHp);
  assert.equal(a.carried, 0);
  assert.equal(b.hp, otherHp);
  assert.ok(a.invuln > 0);
  assert.ok(a.playerPos.distanceTo(pos) > 50);
});
test('the score retains kill weights, raised stages, dragon, completion and whole-second time bonus', () => {
  const s = createSimulation(config, 12345);
  s.addPlayer('a');
  Object.assign(s.G, {
    level: 6,
    killsBy: { skeleton: 1, wyvern: 2, drake: 1, worm: 1, kraken: 1 },
    dragonSlain: true,
    endReason: 'complete',
    timeLeft: 60.9
  });
  assert.equal(s.score().total, 8 + 20 + 25 + 30 + 40 + 500 + 500 + 1000 + 600);
});
test('timed completion uses the original four-minute clock and score; free flight remains unranked', () => {
  const c = structuredClone(config);
  c.spawning = { ...c.spawning };
  const s = createSimulation(c, 12345);
  s.addPlayer('a');
  s.G.timeLeft = 0.01;
  s.G.killsBy = { wyvern: 2 };
  s.step(1 / 60);
  assert.equal(s.G.finished, true);
  assert.equal(s.score().total, 20);
  const free = createSimulation(c, 12345, { timed: false });
  free.addPlayer('a');
  free.G.timeLeft = 0.01;
  free.step(1 / 60);
  assert.equal(free.G.finished, false);
});
test('an orb is collected once by an eligible co-op player even when the nearest carpet is full', () => {
  const s = createSimulation(config, 12345);
  s.addPlayer('a');
  s.addPlayer('b');
  const o = s.G.orbs[0],
    a = s.players.get('a'),
    b = s.players.get('b');
  s.G.orbs = [o];
  a.playerPos.copy(o.pos);
  b.playerPos.copy(o.pos);
  b.playerPos.x += 1;
  a.carried = config.player.carryBase + config.player.carryPerStage;
  a.invuln = b.invuln = 100;
  const value = o.val;
  s.step(1 / 60);
  assert.equal(b.carried, value);
  assert.equal(s.G.orbs.length, 0);
});
test('completing free flight still allows flying after the celebration', () => {
  const s = createSimulation(config, 12345, { timed: false });
  const p = s.addPlayer('p');
  s.G.finished = true;
  const before = p.playerPos.clone();
  s.setInput('p', { keys: { KeyW: true }, input: {} });
  s.step(1 / 60);
  assert.ok(p.playerPos.distanceTo(before) > 0);
});
test('new co-op creatures spawn at the original safe distance from every carpet', () => {
  const c = structuredClone(config);
  c.spawning.intervalSeconds = 0;
  const s = createSimulation(c, 12345);
  for (let i = 0; i < 8; i++) {
    const p = s.addPlayer('p' + i),
      a = (i * Math.PI) / 4;
    p.playerPos.set(Math.cos(a) * 250, 35, Math.sin(a) * 250);
    p.invuln = 100;
  }
  s.G.orbs = [];
  let checked = 0;
  for (let n = 0; n < 20; n++) {
    s.G.enemies = [];
    s.step(1 / 60);
    for (const e of s.G.enemies) {
      if (e.kind !== 'wyvern') continue;
      checked++;
      for (const p of s.players.values())
        assert.ok(
          Math.hypot(e.pos.x - p.playerPos.x, e.pos.z - p.playerPos.z) >= 159,
          'spawn too close to a co-op player'
        );
    }
  }
  assert.ok(checked > 0);
});
test('identical input replays produce identical outcomes and all creature kinds run headlessly', () => {
  const c = structuredClone(config);
  for (const r of Object.values(c.spawning))
    if (r && typeof r === 'object' && 'fromStage' in r) {
      r.fromStage = 1;
      if ('base' in r) r.base = r.max = 1;
    }
  const a = createSimulation(c, 12345),
    b = createSimulation(c, 12345);
  a.addPlayer('p');
  b.addPlayer('p');
  assert.deepEqual([...new Set(a.G.enemies.map((e) => e.kind))].sort(), [
    'dragon',
    'drake',
    'kraken',
    'skeleton',
    'worm',
    'wyvern'
  ]);
  a.setInput('p', { keys: { KeyW: true, Space: true }, input: { mouseX: 0.3 } });
  b.setInput('p', { keys: { KeyW: true, Space: true }, input: { mouseX: 0.3 } });
  for (let i = 0; i < 180; i++) {
    a.step(1 / 60);
    b.step(1 / 60);
  }
  assert.deepEqual(a.snapshot(), b.snapshot());
  for (const e of a.snapshot().enemies) assert.ok([...e.pos, ...e.rot].every(Number.isFinite));
});
