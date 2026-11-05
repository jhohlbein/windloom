// Where and how many creatures appear. Counts scale with the palace stage (see config "spawning").
import * as THREE from 'three';
import { CFG, targetFor } from '../config.js';
import { G, W } from '../state.js';
import { TAU } from '../util.js';
import { terrainH, groundH } from '../terrain.js';
import { castShadows } from '../scene.js';
import { applyFlash, countKind, removeEnemyObj } from './common.js';
import { createFlyer } from './flyers.js';
import { createKraken } from './kraken.js';
import { createWorm } from './sandworm.js';
import { createDragon } from './dragon.js';
import { createSkeleton, createSkeletonGroup } from './skeleton.js';
import { spawnOrb } from '../combat.js';

// Every creature casts a shadow
function addEnemy(e) { castShadows(e.root); G.enemies.push(e); return e; }
const far = (x, z, d) => !G.active || Math.hypot(x - G.playerPos.x, z - G.playerPos.z) >= d;

export function spawnFlyer() {
  const S = CFG.spawning.drakes, L = G.level;
  const maxDrakes = S.maxBase + S.maxAdd * Math.floor(L / S.maxEveryStages);
  const kind = (L >= S.fromStage && countKind('drake') < maxDrakes && Math.random() < S.chanceBase + S.chancePerStage * L) ? 'drake' : 'wyvern';
  for (let t = 0; t < 30; t++) {
    const a = Math.random() * TAU, r = 110 + Math.random() * 320, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x - W.CX, z - W.CZ) < 110 || !far(x, z, 160)) continue;
    addEnemy(createFlyer(kind, new THREE.Vector3(x, groundH(x, z) + 30 + Math.random() * 30, z))); return;
  }
}
export function spawnKraken() {
  const B = CFG.world.boundRadius;
  for (let t = 0; t < 80; t++) {
    const a = Math.random() * TAU, r = 300 + Math.random() * (B - 310), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (terrainH(x, z) > -7 || !far(x, z, 150)) continue;
    addEnemy(createKraken(new THREE.Vector3(x, 0, z))); return;
  }
}
export function spawnWorm() {
  for (let t = 0; t < 80; t++) {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 400, x = Math.cos(a) * r, z = Math.sin(a) * r, h = terrainH(x, z);
    if (h < 5 || h > 38) continue;
    if ((Math.abs(terrainH(x + 10, z) - h) + Math.abs(terrainH(x, z + 10) - h)) / 10 > 0.6) continue;
    if (Math.hypot(x - W.CX, z - W.CZ) < 100 || Math.hypot(x - W.LX, z - W.LZ) < 60 || !far(x, z, 140)) continue;
    addEnemy(createWorm(new THREE.Vector3(x, h, z))); return;
  }
}
// Skeleton archers: a group of groupSizeMin..groupSizeMax on open, gentle land away from the palace (outside its
// ward) and the dragon's peak. Number of groups: groupsAtStart + groupsPerStage per palace stage above the first.
const skeletonGroups = () => new Set(G.enemies.filter(e => e.kind === 'skeleton').map(e => e.group)).size;
const skeletonGroupTarget = L => { const S = CFG.spawning.skeletons; return unlocked(S, L) ? S.groupsAtStart + S.groupsPerStage * (L - 1) : 0; };
export function spawnSkeletonGroup() {
  const S = CFG.spawning.skeletons;
  for (let t = 0; t < 80; t++) {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * CFG.world.islandRadius * 0.9, x = Math.cos(a) * r, z = Math.sin(a) * r, h = terrainH(x, z);
    if (h < 2 || h > 40) continue;
    if ((Math.abs(terrainH(x + 6, z) - h) + Math.abs(terrainH(x, z + 6) - h)) / 6 > 0.7) continue;
    if (Math.hypot(x - W.CX, z - W.CZ) < CFG.palace.wardRadius + 20 || Math.hypot(x - W.LX, z - W.LZ) < 60 || !far(x, z, 130)) continue;
    const group = createSkeletonGroup(new THREE.Vector3(x, h, z));
    const n = S.groupSizeMin + Math.floor(Math.random() * (S.groupSizeMax - S.groupSizeMin + 1));
    for (let i = 0; i < n; i++) {
      const oa = i / n * TAU + Math.random() * 0.5, od = 2.5 + Math.random() * 3.5, px = x + Math.cos(oa) * od, pz = z + Math.sin(oa) * od;
      addEnemy(createSkeleton(new THREE.Vector3(px, groundH(px, pz), pz), group));
    }
    return;
  }
}
// There is only ever one Vharoth
export function spawnDragon() { if (G.dragon || countKind('dragon')) return; G.dragon = addEnemy(createDragon()); }

// A creature group (spawning.krakens, sandworms, drakes, dragon) is active from its fromStage on
export const unlocked = (rule, stage = G.level) => stage >= (rule.fromStage || 1);

export function populate() {
  const S = CFG.spawning;
  for (let i = 0; i < S.flyersAtStart; i++) spawnFlyer();
  for (let i = 0; i < skeletonGroupTarget(G.level); i++) spawnSkeletonGroup();
  if (unlocked(S.krakens)) spawnKraken();
  if (unlocked(S.sandworms)) spawnWorm();
  if (unlocked(S.dragon)) spawnDragon();
  scatterMana();
}
// Starting mana: small clusters of orbs lying on land, away from the palace. They never expire.
function scatterMana() {
  const M = CFG.mana, R = CFG.world.islandRadius;
  for (let c = 0, tries = 0; c < M.startClusters && tries < 400; tries++) {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * R * 0.9, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (terrainH(x, z) < 2 || Math.hypot(x - W.CX, z - W.CZ) < 80) continue;
    for (let n = 0; n < M.startOrbsPerCluster; n++) {
      const ox = x + (Math.random() - 0.5) * 12, oz = z + (Math.random() - 0.5) * 12;
      spawnOrb(new THREE.Vector3(ox, groundH(ox, oz) + 2.4, oz), M.startOrbValue, null, true);
    }
    c++;
  }
}
// Called every spawning.intervalSeconds: add one creature to the group that is furthest below its target
// (as a fraction), so a newly unlocked group fills up quickly instead of waiting for the flyers
export function spawnTick() {
  const S = CFG.spawning, L = G.level;
  const groups = [
    { n: countKind('wyvern') + countKind('drake'), target: targetFor(S.flyers, L), spawn: spawnFlyer },
    { n: countKind('worm'), target: unlocked(S.sandworms) ? targetFor(S.sandworms, L) : 0, spawn: spawnWorm },
    { n: countKind('kraken'), target: unlocked(S.krakens) ? targetFor(S.krakens, L) : 0, spawn: spawnKraken },
    { n: skeletonGroups(), target: skeletonGroupTarget(L), spawn: spawnSkeletonGroup }
  ].filter(g => g.n < g.target);
  if (!groups.length) return;
  groups.sort((a, b) => a.n / a.target - b.n / b.target);
  groups[0].spawn();
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
