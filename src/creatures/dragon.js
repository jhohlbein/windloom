// Vharoth, the ash wyrm: roosts on the highest peak, hunts by sight, searches, gives up.
import * as THREE from 'three';
import { CFG, hpFor } from '../config.js';
import { G, W } from '../state.js';
import { scene, mats } from '../scene.js';
import { clamp, lerp, wrapA, R } from '../util.js';
import { groundH, lineOfSight, inWard } from '../terrain.js';
import { emit, burst, C } from '../particles.js';
import { sfx, sfxAt } from '../audio.js';
import { toast } from '../hud.js';
import { addBolt, hurtPlayer } from '../combat.js';
import { baseEnemy, setHp, yes } from './common.js';
import { instBeast, animBeast, lookBeast } from './beasts.js';

export function createDragon() {
  const K = CFG.creatures.dragon, e = baseEnemy('dragon', 'Vharoth');
  const B = instBeast(e, 'dragon'), g = B.g;
  g.scale.setScalar(K.scale);
  g.position.set(W.LX + 95, W.LH + 70, W.LZ); scene.add(g);
  Object.assign(e, { K, B, root: g, pos: g.position, r: K.hitRadius, head: B.head, neck: B.neck, mouth: B.mouth });
  setHp(e, hpFor(K, G.level));
  e.vel.set(0, 0, -30); e.lastYaw = 0;
  Object.assign(e, { st: 'roost', ang: 0, flapPh: 0, breathT: 0, breathAcc: 0, volleyCd: 4, passT: 0, jawOpen: 0, bank: 0, contactCd: 0, lastFlap: 0, lostT: 99, seeCd: 0, canSee: false, searchT: 0 });
  for (const k of ['_t', '_d', '_v', '_m', '_b', '_s', '_h', 'passTarget', 'lastSeen']) e[k] = new THREE.Vector3();
  e.dropN = K.drops; e.dropV = K.manaPerDrop; e.keepDrops = true;
  e.update = updateDragon; e.targetable = yes; e.showBar = yes;
  e.hitTest = (pt, rad) => {
    if (pt.distanceTo(e.pos) < e.r - 1 + rad) return true;
    e.head.getWorldPosition(e._h); if (pt.distanceTo(e._h) < 6 + rad) return true;
    e.neck[2].getWorldPosition(e._h); if (pt.distanceTo(e._h) < 5 + rad) return true;
    return false;
  };
  e.barPos = o => { o.copy(e.pos); o.y += 20; return o; };
  e.radar = { c: '#ff2e4d', s: 7, edge: true };
  return e;
}
function breathe(e) {
  const K = e.K, P = G.playerPos;
  e.mouth.getWorldPosition(e._m);
  const dir = e._b.copy(P).addScaledVector(G.playerVel, 0.35).sub(e._m).normalize();
  dir.x += (R() - 0.5) * 0.12; dir.y += (R() - 0.5) * 0.12; dir.z += (R() - 0.5) * 0.12; dir.normalize();
  for (let i = 0; i < 4; i++) emit(e._m.x, e._m.y, e._m.z, dir.x * 70 + (R() - 0.5) * 20, dir.y * 70 + (R() - 0.5) * 20, dir.z * 70 + (R() - 0.5) * 20, C.EMBER, 4, 0.7);
  addBolt(mats.fire, 7, e._m, dir.multiplyScalar(105).add(e.vel), K.breathDamage, 0, C.EMBER, 1.3);
  sfxAt('breath', e._m, 400);
}
function volley(e) {
  const K = e.K, P = G.playerPos;
  e.mouth.getWorldPosition(e._m);
  const d = e._m.distanceTo(P);
  for (let i = -1; i <= 1; i++) {
    const aim = e._b.copy(P).addScaledVector(G.playerVel, d / 110 * 0.8).sub(e._m).normalize();
    aim.add(e._s.set(-aim.z, 0, aim.x).normalize().multiplyScalar(i * 0.09)).normalize();
    addBolt(mats.ember, 14, e._m, aim.multiplyScalar(110), K.volleyDamage, 0, C.EMBER, 5);
  }
  e.jawOpen = 1; sfxAt('boom', e._m, 500);
}
// direct = it saw or was hit by the player; otherwise it heard something there
export function dragonAlert(e, pos, direct) {
  e.lastSeen.copy(pos);
  if (direct) {
    if (e.st === 'roost' || e.st === 'search') { e.st = 'hunt'; e.lostT = 0; sfx('roar', 0.7); toast('Vharoth turns on you', 2000); G.dragonSeen = true; }
  } else if (e.st === 'roost') { e.st = 'search'; e.searchT = e.K.searchSeconds * 0.9; e.lostT = 0; toast('Vharoth heard you', 2000); }
  else if (e.st === 'search') e.searchT = Math.max(e.searchT, e.K.searchSeconds * 0.6);
}
function updateDragon(e, dt) {
  const K = e.K, P = G.playerPos, ward = CFG.palace.wardRadius;
  e.t += dt; e.flash = Math.max(0, e.flash - dt); e.contactCd -= dt; e.volleyCd -= dt;
  const dist = e.pos.distanceTo(P);
  // perception: range depends on mood; terrain blocks sight; low flying near its peak keeps you hidden longer
  e.seeCd -= dt;
  if (e.seeCd <= 0) {
    e.seeCd = 0.2;
    const skim = P.y - groundH(P.x, P.z);
    const range = e.st === 'roost' ? (skim < K.lowFlyingHeight ? K.roostSightRangeLowFlying : K.roostSightRange) : e.st === 'search' ? K.searchSightRange : K.huntSightRange;
    e.head.getWorldPosition(e._h);
    e.canSee = G.active && dist < range && !inWard(P) && lineOfSight(e._h, P);
  }
  if (e.canSee) { e.lastSeen.copy(P); e.lostT = 0; } else e.lostT += dt;
  const target = e._t; let sp = K.roostSpeed, turn = 1.0;
  if (!G.active && e.st !== 'roost') e.st = 'roost';
  if (e.st === 'roost') {
    e.ang += dt * 0.22;
    target.set(W.LX + Math.cos(e.ang) * 95, W.LH + 70 + Math.sin(e.t * 0.3) * 12, W.LZ + Math.sin(e.ang) * 95);
    if (e.canSee) {
      e.st = 'hunt'; sfx('roar', clamp(1.2 - dist / 700, 0.35, 1));
      toast(G.dragonSeen ? 'Vharoth has spotted you again' : 'Vharoth has seen you', 2600); G.dragonSeen = true;
    }
  } else if (e.st === 'search') {
    e.searchT -= dt; e.ang += dt * 0.45;
    target.set(e.lastSeen.x + Math.cos(e.ang) * 70, e.lastSeen.y + 45, e.lastSeen.z + Math.sin(e.ang) * 70);
    sp = K.roostSpeed * 1.33;
    if (e.canSee) { e.st = 'hunt'; sfx('roar', 0.6); toast('Vharoth found you', 2000); }
    else if (e.searchT <= 0) { e.st = 'roost'; toast('Vharoth gives up and returns to its peak', 2600); }
  } else if (e.st !== 'pass' && e.lostT > K.loseSightSeconds) {
    e.st = 'search'; e.searchT = K.searchSeconds; e.ang = Math.atan2(e.pos.z - e.lastSeen.z, e.pos.x - e.lastSeen.x);
    toast(inWard(P) ? 'Vharoth will not cross the beam' : 'Vharoth lost sight of you', 2200);
  } else if (e.st === 'hunt') {
    target.set(e.lastSeen.x + Math.sin(e.t * 0.4) * 60, e.lastSeen.y + 28, e.lastSeen.z + Math.cos(e.t * 0.4) * 60);
    sp = K.huntSpeed; turn = 1.1;
    if (e.canSee) {
      const facing = e._d.copy(P).sub(e.pos).normalize().dot(e._v.copy(e.vel).normalize());
      if (dist < K.breathRange && facing > 0.55) { e.st = 'breath'; e.breathT = K.breathSeconds; }
      else if (dist > K.breathRange + 20 && dist < 420 && facing > 0.4 && e.volleyCd <= 0) { e.volleyCd = K.volleyIntervalSeconds; volley(e); }
    }
  } else if (e.st === 'breath') {
    target.copy(e.lastSeen).addScaledVector(G.playerVel, e.canSee ? 0.5 : 0); sp = K.huntSpeed * 0.67; turn = 1.6;
    e.breathT -= dt;
    if (e.canSee) { e.breathAcc += dt; while (e.breathAcc > 0.07) { e.breathAcc -= 0.07; breathe(e); } }
    if (e.breathT <= 0 || dist < 22 || e.lostT > 0.6) {
      e.st = 'pass'; e.passT = 2.8;
      e.passTarget.copy(e.pos).addScaledVector(e._v.copy(e.vel).normalize(), 220); e.passTarget.y += 50;
    }
  } else if (e.st === 'pass') {
    target.copy(e.passTarget); sp = K.huntSpeed * 1.1; turn = 0.9; e.passT -= dt;
    if (e.passT <= 0) e.st = 'hunt';
  }
  // the palace beam is a ward the dragon will not cross
  const wx = target.x - W.CX, wz = target.z - W.CZ, wd = Math.hypot(wx, wz) || 1;
  if (wd < ward + 30) { target.x = W.CX + wx / wd * (ward + 30); target.z = W.CZ + wz / wd * (ward + 30); }
  // stay inside the sandstorm boundary, so the hoard always falls where the player can reach it
  const B = CFG.world.boundRadius - 30, td = Math.hypot(target.x, target.z);
  if (td > B) { target.x *= B / td; target.z *= B / td; }
  const minY = groundH(target.x, target.z) + 30; if (target.y < minY) target.y = minY;
  const dir = e._d.copy(target).sub(e.pos); dir.multiplyScalar(1 / (dir.length() || 1));
  const cur = e.vel.length() || 1;
  const vd = e._v.copy(e.vel).multiplyScalar(1 / cur);
  vd.lerp(dir, Math.min(1, dt * turn)).normalize();
  e.vel.copy(vd).multiplyScalar(lerp(cur, sp, Math.min(1, dt * 0.8)));
  e.pos.addScaledVector(e.vel, dt);
  const floor = groundH(e.pos.x, e.pos.z) + 14;
  if (e.pos.y < floor) { e.pos.y = floor; if (e.vel.y < 0) e.vel.y = 0; }
  if (e.pos.y > 380) e.pos.y = 380;
  const px = e.pos.x - W.CX, pz = e.pos.z - W.CZ, pd = Math.hypot(px, pz) || 1;
  if (pd < ward) { e.pos.x = W.CX + px / pd * ward; e.pos.z = W.CZ + pz / pd * ward; }
  const ed = Math.hypot(e.pos.x, e.pos.z), EB = CFG.world.boundRadius - 10;
  if (ed > EB) { e.pos.x *= EB / ed; e.pos.z *= EB / ed; }
  const yawT = Math.atan2(-e.vel.x, -e.vel.z), dy = wrapA(yawT - e.lastYaw); e.lastYaw = yawT;
  const yawRate = dt > 0 ? dy / dt : 0;
  e.bank = lerp(e.bank, clamp(yawRate * 1.4, -0.75, 0.75), Math.min(1, dt * 2));
  e.root.rotation.set(Math.asin(clamp(e.vel.y / (e.vel.length() || 1), -1, 1)) * 0.8, yawT, e.bank);
  const rate = e.st === 'roost' ? 1.7 : (e.vel.y > 4 ? 3.2 : 2.3), amp = e.st === 'breath' ? 0.25 : 0.55;
  e.flapPh += dt * rate;
  const cyc = Math.floor(e.flapPh / (Math.PI * 2)); if (cyc !== e.lastFlap) { e.lastFlap = cyc; sfxAt('flap', e.pos, 300); }
  e.jawOpen = lerp(e.jawOpen, e.st === 'breath' ? 1 : 0.08, Math.min(1, dt * (e.st === 'breath' ? 8 : 2)));
  lookBeast(e.B, e.canSee && e.st !== 'pass' ? P : null, e.pos, dt, 2.5); // the head follows the carpet while it is in sight
  animBeast(e.B, e.t, e.flapPh, amp, e.jawOpen, yawRate);
  if (e.st !== 'roost' && Math.random() < 0.35) { e.mouth.getWorldPosition(e._m); emit(e._m.x, e._m.y, e._m.z, (R() - 0.5) * 4, 2 + R() * 3, (R() - 0.5) * 4, C.EMBER, 2.4, 1.1); }
  if (G.active && e.contactCd <= 0 && e.hitTest(P, 2.5)) { e.contactCd = 1.2; hurtPlayer(K.contactDamage); burst(P, 20, C.EMBER, 20, 2, 0.6); }
}
