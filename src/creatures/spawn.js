// Where and how many creatures appear. Counts scale with the palace stage (see config "spawning").
import * as THREE from 'three';
import { CFG, targetFor } from '../config.js';
import { G, W } from '../state.js';
import { TAU } from '../util.js';
import { terrainH, groundH } from '../terrain.js';
import { applyFlash, countKind, removeEnemyObj } from './common.js';
import { createFlyer } from './flyers.js';
import { createKraken } from './kraken.js';
import { createWorm } from './sandworm.js';
import { createDragon } from './dragon.js';

const far = (x, z, d) => !G.active || Math.hypot(x - G.playerPos.x, z - G.playerPos.z) >= d;

export function spawnFlyer() {
  const S = CFG.spawning.drakes, L = G.level;
  const maxDrakes = S.maxBase + S.maxAdd * Math.floor(L / S.maxEveryStages);
  const kind = (L >= S.fromStage && countKind('drake') < maxDrakes && Math.random() < S.chanceBase + S.chancePerStage * L) ? 'drake' : 'wyvern';
  for (let t = 0; t < 30; t++) {
    const a = Math.random() * TAU, r = 110 + Math.random() * 320, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x - W.CX, z - W.CZ) < 110 || !far(x, z, 160)) continue;
    G.enemies.push(createFlyer(kind, new THREE.Vector3(x, groundH(x, z) + 30 + Math.random() * 30, z))); return;
  }
}
export function spawnKraken() {
  const B = CFG.world.boundRadius;
  for (let t = 0; t < 80; t++) {
    const a = Math.random() * TAU, r = 300 + Math.random() * (B - 310), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (terrainH(x, z) > -7 || !far(x, z, 150)) continue;
    G.enemies.push(createKraken(new THREE.Vector3(x, 0, z))); return;
  }
}
export function spawnWorm() {
  for (let t = 0; t < 80; t++) {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 400, x = Math.cos(a) * r, z = Math.sin(a) * r, h = terrainH(x, z);
    if (h < 5 || h > 38) continue;
    if ((Math.abs(terrainH(x + 10, z) - h) + Math.abs(terrainH(x, z + 10) - h)) / 10 > 0.6) continue;
    if (Math.hypot(x - W.CX, z - W.CZ) < 100 || Math.hypot(x - W.LX, z - W.LZ) < 60 || !far(x, z, 140)) continue;
    G.enemies.push(createWorm(new THREE.Vector3(x, h, z))); return;
  }
}
export function spawnDragon() { G.dragon = createDragon(); G.enemies.push(G.dragon); }

export function populate() {
  for (let i = 0; i < CFG.spawning.flyersAtStart; i++) spawnFlyer();
  spawnKraken(); spawnWorm(); spawnDragon();
}
// Called every spawning.intervalSeconds: top up whichever group is below its target
export function spawnTick() {
  const S = CFG.spawning, L = G.level;
  if (countKind('wyvern') + countKind('drake') < targetFor(S.flyers, L)) { spawnFlyer(); return; }
  if (countKind('kraken') < targetFor(S.krakens, L)) { spawnKraken(); return; }
  if (countKind('worm') < targetFor(S.sandworms, L)) { spawnWorm(); }
}
export function updateEnemies(dt) {
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    e.update(e, dt);
    e.barT = Math.max(0, e.barT - dt);
    e.ghost = e.ghost > e.hp ? Math.max(e.hp, e.ghost - e.maxHp * 0.5 * dt) : e.hp;
    applyFlash(e);
  }
}
export function clearCreatures() { G.enemies.forEach(removeEnemyObj); G.enemies.length = 0; G.dragon = null; }
