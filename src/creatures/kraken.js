// Kraken: lurks in deep water, surfaces to lob ink and grab low fliers.
import * as THREE from 'three';
import { CFG, hpFor } from '../config.js';
import { G } from '../state.js';
import { scene, geo, mats } from '../scene.js';
import { TAU, lerp, smooth, lerpAngle, R } from '../util.js';
import { terrainH } from '../terrain.js';
import { emit, burst, C } from '../particles.js';
import { sfx, sfxAt } from '../audio.js';
import { lobAtPlayer, hurtPlayer } from '../combat.js';
import { baseEnemy, setHp, trackMat } from './common.js';

const tentGeos = (() => {
  const L = [1.7, 1.6, 1.5, 1.35, 1.2, 1.05], RR = [0.62, 0.5, 0.4, 0.31, 0.23, 0.15, 0.07], out = [];
  for (let j = 0; j < 6; j++) { const g = new THREE.CylinderGeometry(RR[j + 1], RR[j], L[j], 7); g.rotateX(Math.PI / 2); g.translate(0, 0, L[j] / 2); out.push({ g, L: L[j] }); }
  return out;
})();
const eyeM = new THREE.MeshBasicMaterial({ color: 0xffd36b }), pupM = new THREE.MeshBasicMaterial({ color: 0x120a18 });
const pupGeo = new THREE.BoxGeometry(0.62, 0.14, 0.1), crestGeo = new THREE.ConeGeometry(0.9, 2.2, 6);
const KS = 2.4;
const tmp = new THREE.Vector3();

export function createKraken(pos) {
  const K = CFG.creatures.kraken, e = baseEnemy('kraken', 'Kraken');
  const skin = trackMat(e, new THREE.MeshStandardMaterial({ color: 0x7c2d63, roughness: 0.55, flatShading: true }));
  const skin2 = trackMat(e, new THREE.MeshStandardMaterial({ color: 0xa4467c, roughness: 0.6, flatShading: true }));
  const g = new THREE.Group(); g.position.set(pos.x, 0, pos.z);
  const body = new THREE.Group(); g.add(body);
  const mantle = new THREE.Mesh(geo.sph, skin); mantle.scale.set(2.2, 3, 2.2); mantle.position.y = 2.4; body.add(mantle);
  const crest = new THREE.Mesh(crestGeo, skin2); crest.position.set(0, 5.6, 0.6); crest.rotation.x = 0.35; body.add(crest);
  for (const s of [-1, 1]) {
    const ey = new THREE.Mesh(geo.sph, eyeM); ey.scale.setScalar(0.5); ey.position.set(s * 1.15, 1.7, -1.75); body.add(ey);
    const pu = new THREE.Mesh(pupGeo, pupM); pu.position.set(s * 1.15, 1.7, -2.24); body.add(pu);
  }
  e.tents = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + 0.2, root = new THREE.Group();
    root.position.set(Math.cos(a) * 1.7, 0.5, Math.sin(a) * 1.7); root.rotation.y = Math.PI / 2 - a; body.add(root);
    let parent = root; const segs = [];
    for (let j = 0; j < 6; j++) {
      const sg = new THREE.Group(); if (j > 0) sg.position.z = tentGeos[j - 1].L;
      sg.add(new THREE.Mesh(tentGeos[j].g, j % 2 ? skin2 : skin)); parent.add(sg); parent = sg; segs.push(sg);
    }
    e.tents.push({ segs, ph: Math.random() * TAU });
  }
  g.scale.setScalar(KS); scene.add(g);
  Object.assign(e, { K, root: g, body, pos: new THREE.Vector3(), r: K.hitRadius });
  setHp(e, hpFor(K, G.level));
  e.rise = 0; e.st = 'sub'; e.timer = 1 + Math.random() * 4; e.lift = 0; e.shootCd = 2; e.grabCd = 0;
  e.home = new THREE.Vector3(pos.x, 0, pos.z); e.ang = Math.random() * TAU;
  e.dropN = K.drops; e.dropV = K.manaPerDrop;
  e.update = updateKraken;
  e.targetable = () => e.rise > 0.55; e.showBar = e.targetable;
  e.hitTest = (p, rad) => p.distanceTo(e.pos) < e.r + rad;
  e.barPos = o => { o.copy(e.pos); o.y += 10; return o; };
  e.radar = { c: '#9b7bff', s: 4.4 };
  e.syncPos = () => e.pos.set(g.position.x, (2.4 + e.body.position.y) * KS, g.position.z);
  e.body.position.y = -8; e.syncPos();
  return e;
}

function updateKraken(e, dt) {
  const K = e.K, P = G.playerPos, g = e.root;
  e.t += dt; e.flash = Math.max(0, e.flash - dt); e.timer -= dt; e.grabCd -= dt;
  const dx = P.x - g.position.x, dz = P.z - g.position.z, hd = Math.hypot(dx, dz);
  const dist = Math.hypot(hd, P.y - e.pos.y);
  if (e.provoked && hd > K.aggroRange * 1.6) e.provoked = false;
  const aggro = G.active && (hd < K.aggroRange || e.provoked);
  if (e.st === 'sub') {
    e.rise = Math.max(0, e.rise - dt * 0.8);
    if (e.timer <= 0) {
      if (aggro || Math.random() < 0.35) { e.st = 'surf'; sfxAt('splash', e.pos); }
      else e.timer = 3 + Math.random() * 4;
    }
    if (aggro && Math.random() < dt * 5) emit(g.position.x + (R() - 0.5) * 14, 0.4, g.position.z + (R() - 0.5) * 14, 0, 3 + R() * 3, 0, C.SPRAY, 1.6, 0.8);
  } else if (e.st === 'surf') {
    e.rise = Math.min(1, e.rise + dt * 0.75);
    if (e.rise >= 1) { e.st = 'up'; e.timer = K.surfacedSeconds * (1 + Math.random() * 0.5); }
  } else if (e.st === 'up') {
    if (e.timer <= 0) { e.st = 'dive'; sfxAt('splash', e.pos); }
  } else if (e.st === 'dive') {
    e.rise = Math.max(0, e.rise - dt * 0.7);
    if (e.rise <= 0) { e.st = 'sub'; e.timer = 3 + Math.random() * 3; }
  }
  if (e.st === 'surf' || e.st === 'dive') {
    for (let s = 0; s < 3; s++) { const a = R() * TAU; emit(g.position.x + Math.cos(a) * 9, 0.5, g.position.z + Math.sin(a) * 9, Math.cos(a) * 6, 6 + R() * 8, Math.sin(a) * 6, C.SPRAY, 2.6, 0.9); }
  }
  // drift through the water toward the player, never onto land
  let tx, tz, sp;
  if (aggro) { tx = P.x; tz = P.z; sp = e.st === 'up' ? K.swimSpeed * 0.4 : K.swimSpeed; }
  else { e.ang += dt * 0.05; tx = e.home.x + Math.cos(e.ang) * 60; tz = e.home.z + Math.sin(e.ang) * 60; sp = K.swimSpeed / 3; }
  const mx = tx - g.position.x, mz = tz - g.position.z, ml = Math.hypot(mx, mz), B = CFG.world.boundRadius - 10;
  e.vel.set(0, 0, 0);
  if (ml > 6) {
    const nx = g.position.x + mx / ml * sp * dt, nz = g.position.z + mz / ml * sp * dt;
    if (terrainH(nx, nz) < -4 && nx * nx + nz * nz < B * B) { g.position.x = nx; g.position.z = nz; e.vel.set(mx / ml * sp, 0, mz / ml * sp); }
  }
  e.body.position.y = lerp(-8, 0, smooth(0, 1, e.rise)) + Math.sin(e.t * 1.4) * 0.15 * e.rise;
  g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(-dx, -dz), Math.min(1, dt * 1.5));
  const wantLift = (e.st === 'up' && aggro && hd < 70) ? 1 : (e.rise > 0.5 ? 0.35 : 0);
  e.lift = lerp(e.lift, wantLift, Math.min(1, dt * 2));
  for (const tn of e.tents) {
    tn.segs.forEach((sg, j) => {
      sg.rotation.x = -(0.08 + e.lift * (j === 0 ? 0.9 : 0.22)) + Math.sin(e.t * 2.1 + j * 0.75 + tn.ph) * (0.22 + 0.02 * j) * (1 - e.lift * 0.4);
      sg.rotation.y = Math.sin(e.t * 1.3 + j * 0.5 + tn.ph) * 0.12;
    });
  }
  e.syncPos();
  if (G.active && e.st === 'up') {
    e.shootCd -= dt;
    if (dist < K.inkRange && e.shootCd <= 0) {
      e.shootCd = K.inkIntervalSeconds * (1 + Math.random() * 0.5);
      lobAtPlayer(tmp.copy(e.pos).setY(e.pos.y + 6), mats.ink, 7, K.inkDamage, C.INK, 70);
      sfxAt('lob', e.pos);
    }
    if (hd < K.grabRange && P.y < 26 && e.grabCd <= 0) {
      e.grabCd = K.grabCooldownSeconds; e.lift = 1.3; hurtPlayer(K.grabDamage);
      burst(P, 22, C.SPRAY, 18, 2, 0.6); sfx('splash');
    }
  }
}
