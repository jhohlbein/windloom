// Shared plumbing for every creature: base object, hit flash, removal.
import * as THREE from 'three';
import { G } from '../state.js';
import { scene } from '../scene.js';
import { lineOfSight } from '../terrain.js';

const FLASH = 0x886655;
export const yes = () => true;

// Register a material so it flashes when the creature is hit and is disposed on death
export function trackMat(e, m) { m.userData.base = m.emissive ? m.emissive.getHex() : 0; e.mats.push(m); return m; }
export function applyFlash(e) {
  const on = e.flash > 0; if (on === e._fl) return; e._fl = on;
  e.mats.forEach(m => { if (m.emissive) m.emissive.setHex(on ? FLASH : m.userData.base); });
}
// Every creature object has: kind, name, pos, vel, r (hit radius), hp/maxHp, update(e,dt),
// targetable(), showBar(), hitTest(point, radius), barPos(out), radar {c, s, edge}, root (Object3D)
export function baseEnemy(kind, name) {
  return { kind, name, mats: [], flash: 0, barT: 0, ghost: 1, hp: 1, maxHp: 1, vel: new THREE.Vector3(), r: 5, t: Math.random() * 10, provoked: false, _fl: false, dropN: 4, dropV: 3, keepDrops: false };
}
export function setHp(e, v) { e.hp = e.maxHp = e.ghost = v; }
export function removeEnemyObj(e) { scene.remove(e.root); e.mats.forEach(m => m.dispose()); }
export function countKind(k) { let n = 0; for (const e of G.enemies) if (e.kind === k) n++; return n; }

// True if the terrain does not hide the creature from the carpet (the aim assist ignores hidden creatures and the
// HUD draws no bar for them). Checked at most every 0.15 s per creature; between checks the last answer is kept.
export function inView(e) {
  if (e.losT === undefined || Math.abs(G.playTime - e.losT) > 0.15) { e.losT = G.playTime; e.los = lineOfSight(G.playerPos, e.pos); }
  return e.los;
}
