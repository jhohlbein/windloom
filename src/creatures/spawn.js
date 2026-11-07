// Where and how many creatures appear. Every creature type has its own rule in config "spawning"
// (fromStage, base, add, max; see targetFor in config.js). Skeletons count in groups, the dragon is unique.
import * as THREE from 'three';
import { CFG, targetFor } from '../config.js';
import { G, W } from '../state.js';
import { TAU } from '../util.js';
import { terrainH, groundH } from '../terrain.js';
import { castShadows } from '../scene.js';
import { applyFlash, countKind, removeEnemyObj } from './common.js';
import { mark } from '../perf.js';
import { createFlyer } from './flyers.js';
import { createKraken } from './kraken.js';
import { createWorm } from './sandworm.js';
import { createDragon } from './dragon.js';
import { createSkeleton, createSkeletonGroup } from './skeleton.js';
import { spawnOrb } from '../combat.js';

// Every creature casts a shadow
function addEnemy(e) { castShadows(e.root); G.enemies.push(e); return e; }
const far = (x, z, d) => !G.active || Math.hypot(x - G.playerPos.x, z - G.playerPos.z) >= d;

// Flyers patrol 30-60 m above the ground, but no more than about 12 m over the ceiling (and at least 15 m above the
// ground), so that over the lowlands they stay within reach of the carpet
const flyY = g => Math.max(g + 15, Math.min(g + 30 + Math.random() * 30, CFG.world.ceiling + Math.random() * 12));
export function spawnFlyer(kind) {
  for (let t = 0; t < 30; t++) {
    const a = Math.random() * TAU, r = 110 + Math.random() * 320, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x - W.CX, z - W.CZ) < 110 || !far(x, z, 160)) continue;
    addEnemy(createFlyer(kind, new THREE.Vector3(x, flyY(groundH(x, z)), z))); return;
  }
}
// A flyer at a distance between rMin and rMax from (cx, cz) (the tutorial places its wyverns around the palace)
export function spawnFlyerNear(kind, cx, cz, rMin, rMax) {
  const a = Math.random() * TAU, r = rMin + Math.random() * (rMax - rMin), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
  return addEnemy(createFlyer(kind, new THREE.Vector3(x, flyY(groundH(x, z)), z)));
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
// ward) and the dragon's peak. Their rule counts groups, not archers; a group counts while one member lives.
const skeletonGroups = () => new Set(G.enemies.filter(e => e.kind === 'skeleton').map(e => e.group)).size;
// near: optional { x, z, rMin, rMax } to place the group at that distance from a point (the tutorial's archers)
export function spawnSkeletonGroup(near) {
  const S = CFG.spawning.skeletons;
  for (let t = 0; t < (near ? 400 : 80); t++) {
    let x, z;
    if (near) { const a = Math.random() * TAU, r = near.rMin + Math.random() * (near.rMax - near.rMin); x = near.x + Math.cos(a) * r; z = near.z + Math.sin(a) * r; }
    else { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * CFG.world.islandRadius * 0.9; x = Math.cos(a) * r; z = Math.sin(a) * r; }
    const h = terrainH(x, z);
    if (h < 2 || h > Math.min(40, CFG.world.ceiling - 4)) continue; // on ground the carpet can reach
    if ((Math.abs(terrainH(x + 6, z) - h) + Math.abs(terrainH(x, z + 6) - h)) / 6 > 0.7) continue;
    if (Math.hypot(x - W.CX, z - W.CZ) < CFG.palace.wardRadius + 20 || Math.hypot(x - W.LX, z - W.LZ) < 60 || (!near && !far(x, z, 130))) continue;
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

// A spawn rule is active from its fromStage on
export const unlocked = (rule, stage = G.level) => stage >= (rule.fromStage || 1);

// One entry per creature type: how many are alive (groups for skeletons) and how to add one
const POPULATIONS = [
  { rule: 'wyverns', count: () => countKind('wyvern'), spawn: () => spawnFlyer('wyvern') },
  { rule: 'drakes', count: () => countKind('drake'), spawn: () => spawnFlyer('drake') },
  { rule: 'skeletons', count: skeletonGroups, spawn: spawnSkeletonGroup },
  { rule: 'sandworms', count: () => countKind('worm'), spawn: spawnWorm },
  { rule: 'krakens', count: () => countKind('kraken'), spawn: spawnKraken }
];

// Target for a population on this island: rules with perLand scale with the island's land (W.LAND = its
// landCover / the mean), so small islands are not crowded with land creatures; at least one once unlocked
function target(rule, stage) {
  const t = targetFor(rule, stage);
  return t && rule.perLand ? Math.max(1, Math.round(t * W.LAND)) : t;
}
// A new game starts with every population at its target for the current stage
export function populate() {
  const S = CFG.spawning;
  for (const p of POPULATIONS) for (let i = target(S[p.rule], G.level); i > 0; i--) p.spawn();
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
// Called every spawning.intervalSeconds: add one creature to the population that is furthest below its target
// (as a fraction), so a newly unlocked type fills up quickly instead of waiting behind the others
// rules: optional list of rule names to limit spawning to (the tutorial's practice uses wyverns and skeletons)
export function spawnTick(rules) {
  const S = CFG.spawning, L = G.level;
  const short = POPULATIONS.filter(p => !rules || rules.includes(p.rule)).map(p => ({ p, n: p.count(), target: target(S[p.rule], L) })).filter(g => g.n < g.target);
  if (!short.length) return;
  short.sort((a, b) => a.n / a.target - b.n / b.target);
  short[0].p.spawn(); mark('spawn ' + short[0].p.rule);
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
