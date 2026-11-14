// Wyverns and drakes: patrol, spot the player by sight, circle and shoot.
import * as THREE from 'three';
import { CFG, hpFor } from '../config.js';
import { G } from '../state.js';
import { scene, mats } from '../scene.js';
import { clamp, lerp, wrapA, TAU } from '../util.js';
import { groundH, lineOfSight } from '../terrain.js';
import { C } from '../particles.js';
import { addBolt } from '../combat.js';
import { baseEnemy, setHp, yes } from './common.js';
import { instBeast, animBeast, lookBeast } from './beasts.js';

// Look and feel per kind; numbers come from CFG.creatures[kind]
const LOOK = {
  wyvern: { name: 'Wyvern', amp: 0.6, boltMat: mats.bolt, boltCol: C.RED, radar: '#ff4d6d', rs: 3.4 },
  drake: { name: 'Drake', amp: 0.5, boltMat: mats.fire, boltCol: C.FIRE, radar: '#ff8a3d', rs: 5 }
};
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();

export function createFlyer(kind, pos) {
  const K = CFG.creatures[kind], L = LOOK[kind], e = baseEnemy(kind, L.name);
  const B = instBeast(e, kind), g = B.g;
  g.scale.setScalar(K.scale); g.position.copy(pos); scene.add(g);
  Object.assign(e, { K, L, B, root: g, pos: g.position, r: K.hitRadius });
  setHp(e, hpFor(K, G.level));
  e.vel.set((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10);
  e.state = 'patrol'; e.home = new THREE.Vector3(pos.x, 0, pos.z); e.homeY = pos.y; e.ang = Math.random() * TAU;
  e.shootCd = 1.5 + Math.random() * 2; e.circ = (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.3);
  e.dropN = K.drops; e.dropV = K.manaPerDrop; e.seeCd = Math.random() * 0.3; e.canSee = false; e.lostT = 99; e.ph = Math.random() * TAU; e.jawOpen = 0;
  e.lastYaw = Math.atan2(-e.vel.x, -e.vel.z); e.bank = 0; e.yawRate = 0;
  e.update = updateFlyer; e.targetable = yes; e.showBar = yes;
  e.hitTest = (p, rad) => p.distanceTo(e.pos) < e.r + rad;
  e.barPos = o => { o.copy(e.pos); o.y += e.r + 2.5; return o; };
  e.radar = { c: L.radar, s: L.rs };
  return e;
}

function updateFlyer(e, dt) {
  e.t += dt; e.flash = Math.max(0, e.flash - dt);
  const K = e.K, P = G.playerPos;
  const toX = P.x - e.pos.x, toY = P.y - e.pos.y, toZ = P.z - e.pos.z;
  const dist = Math.sqrt(toX * toX + toY * toY + toZ * toZ);
  e.seeCd -= dt;
  if (e.seeCd <= 0) { e.seeCd = 0.3 + Math.random() * 0.1; e.canSee = G.active && dist < K.sightRange * 1.7 && lineOfSight(e.pos, P); }
  if (e.canSee) e.lostT = 0; else e.lostT += dt;
  if (e.provoked && (dist > K.sightRange * 2 || e.lostT > K.giveUpSeconds * 2)) e.provoked = false;
  if (G.active && ((dist < K.sightRange && e.canSee) || e.provoked)) e.state = 'chase';
  else if (e.state === 'chase' && (!G.active || e.lostT > K.giveUpSeconds)) e.state = 'patrol';
  const target = tmp2;
  if (e.state === 'chase') {
    e.ang += dt * e.circ;
    target.set(P.x + Math.cos(e.ang) * 50, P.y + 8 + Math.sin(e.t * 0.7) * 6, P.z + Math.sin(e.ang) * 50);
  } else {
    e.ang += dt * 0.18;
    target.set(e.home.x + Math.cos(e.ang) * 60, e.homeY + Math.sin(e.t * 0.4) * 8, e.home.z + Math.sin(e.ang) * 60);
  }
  const minY = groundH(e.pos.x, e.pos.z) + 13;
  if (target.y < minY) target.y = minY;
  const dir = target.sub(e.pos), dl = dir.length() || 1;
  dir.multiplyScalar(1 / dl);
  const sp = e.state === 'chase' ? K.chaseSpeed : K.patrolSpeed, k = Math.min(1, dt * 1.5);
  e.vel.x += (dir.x * sp - e.vel.x) * k; e.vel.y += (dir.y * sp - e.vel.y) * k; e.vel.z += (dir.z * sp - e.vel.z) * k;
  e.pos.addScaledVector(e.vel, dt);
  if (e.pos.y < minY - 5) e.pos.y = minY - 5;
  const vs = e.vel.length() || 1;
  // banks into turns (from the yaw rate), beats harder when climbing and glides into a dive, and looks at the
  // carpet while chasing it
  const yaw = Math.atan2(-e.vel.x, -e.vel.z), yawRate = dt > 0 ? wrapA(yaw - e.lastYaw) / dt : 0; e.lastYaw = yaw;
  e.yawRate = lerp(e.yawRate, yawRate, Math.min(1, dt * 3));
  e.bank = lerp(e.bank, clamp(e.yawRate * 1.3, -0.7, 0.7), Math.min(1, dt * 2.5));
  e.root.rotation.y = yaw;
  e.root.rotation.x = Math.asin(clamp(e.vel.y / vs, -1, 1)) * 0.8;
  e.root.rotation.z = e.bank + Math.sin(e.t * 1.3) * 0.04;
  const climb = clamp(e.vel.y / 8, -1, 1);
  e.ph += dt * K.wingbeat * (0.85 + 0.15 * climb);
  e.jawOpen = Math.max(0, e.jawOpen - dt * 2.5);
  lookBeast(e.B, e.state === 'chase' && e.canSee ? P : null, e.pos, dt);
  animBeast(e.B, e.t, e.ph, e.L.amp * (0.75 + 0.25 * climb), e.jawOpen, e.yawRate);
  e.shootCd -= dt;
  if (G.active && e.state === 'chase' && e.canSee && dist < K.fireRange && e.shootCd <= 0) {
    const facing = (e.vel.x * toX + e.vel.y * toY + e.vel.z * toZ) / (vs * dist);
    if (facing > 0.2) {
      e.shootCd = K.fireIntervalSeconds * (0.8 + Math.random() * 0.5);
      const start = e.B.mouth.getWorldPosition(tmp3);
      const aim = tmp.copy(P).addScaledVector(G.playerVel, dist / K.boltSpeed * 0.65).sub(start).normalize();
      addBolt(e.L.boltMat, K.boltSize, start, aim.multiplyScalar(K.boltSpeed), K.boltDamage, 0, e.L.boltCol, 4.5);
      e.jawOpen = 1;
    } else e.shootCd = 0.4;
  }
}
