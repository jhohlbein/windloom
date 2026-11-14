// Sandworm: tunnels under the dunes, rears up, opens a four-jawed maw and spits acid.
import * as THREE from 'three';
import { CFG, hpFor } from '../config.js';
import { G } from '../state.js';
import { scene, addSprite, mats } from '../scene.js';
import { TAU, lerp, smooth, lerpAngle, R } from '../util.js';
import { terrainH, groundH } from '../terrain.js';
import { emit, burst, C } from '../particles.js';
import { sfxAt } from '../audio.js';
import { lobAtPlayer, hurtPlayer } from '../combat.js';
import { baseEnemy, setHp, trackMat } from './common.js';

const WSEG = 14, WSP = 2.3, WTRAIL = Math.ceil(WSEG * WSP / 0.6) + 14;
// Round build: the body is a chain of overlapping balls; the head is a ball open at the front (+z) for the maw
const ballGeo = new THREE.SphereGeometry(1, 14, 10), ringGeo = new THREE.TorusGeometry(1, 0.17, 6, 18);
const HEAD_OPEN = Math.PI * 0.78; // the ball is closed up to this angle from its back
const headGeo = (() => { const g = new THREE.SphereGeometry(1, 18, 14, 0, Math.PI * 2, 0, HEAD_OPEN); g.rotateX(-Math.PI / 2); return g; })();
const throatGeo = (() => { const g = new THREE.SphereGeometry(0.96, 14, 10); return g; })();
const petalGeo = (() => { const g = new THREE.ConeGeometry(0.9, 3.6, 5); g.rotateX(Math.PI / 2); g.translate(0, 0, 1.8); return g; })();
const toothGeo = new THREE.ConeGeometry(0.2, 0.9, 5), mouthGeo = new THREE.CircleGeometry(2.3, 18);
const toothM = new THREE.MeshStandardMaterial({ color: 0xf3ead2, roughness: 0.55 }), mouthM = new THREE.MeshBasicMaterial({ color: 0x2a0606 });
const throatM = new THREE.MeshBasicMaterial({ color: 0x1c0707, side: THREE.BackSide });
const HEAD_R = 2.9, MOUTH_Z = Math.cos(Math.PI - HEAD_OPEN) * HEAD_R, MOUTH_R = Math.sin(Math.PI - HEAD_OPEN) * HEAD_R;
const Y_AX = new THREE.Vector3(0, 1, 0);
const tA = new THREE.Vector3(), tM = new THREE.Vector3();

export function createWorm(pos) {
  const K = CFG.creatures.sandworm, e = baseEnemy('worm', 'Sandworm');
  // warm grey with darker bands: stands out against the sand
  const mA = trackMat(e, new THREE.MeshStandardMaterial({ color: 0x8a8178, roughness: 0.8 }));
  const mB = trackMat(e, new THREE.MeshStandardMaterial({ color: 0x4d4741, roughness: 0.85 }));
  const root = new THREE.Group();
  const head = new THREE.Group(); root.add(head);
  const hc = new THREE.Mesh(headGeo, mA); hc.scale.setScalar(HEAD_R); head.add(hc);
  const throat = new THREE.Mesh(throatGeo, throatM); throat.scale.setScalar(HEAD_R); head.add(throat);
  const rim = new THREE.Mesh(ringGeo, mB); rim.scale.setScalar(MOUTH_R); rim.position.z = MOUTH_Z; head.add(rim);
  const mouth = new THREE.Mesh(mouthGeo, mouthM); mouth.scale.setScalar(0.7); mouth.position.z = MOUTH_Z - 1.2; head.add(mouth);
  const dv = new THREE.Vector3();
  for (const ring of [[MOUTH_R * 0.92, MOUTH_Z - 0.15, 16], [MOUTH_R * 0.55, MOUTH_Z - 0.8, 10]]) {
    for (let i = 0; i < ring[2]; i++) {
      const a = i / ring[2] * TAU, tooth = new THREE.Mesh(toothGeo, toothM);
      tooth.position.set(Math.cos(a) * ring[0], Math.sin(a) * ring[0], ring[1]);
      tooth.quaternion.setFromUnitVectors(Y_AX, dv.set(-Math.cos(a), -Math.sin(a), 0.35).normalize()); head.add(tooth);
    }
  }
  e.glow = addSprite(mats.ember, 4); e.glow.position.z = 0.8; head.add(e.glow);
  e.petals = [];
  for (let pi = 0; pi < 4; pi++) {
    const hinge = new THREE.Group(); hinge.rotation.z = pi * Math.PI / 2 + Math.PI / 4; head.add(hinge);
    const piv = new THREE.Group(); piv.position.set(MOUTH_R, 0, MOUTH_Z); hinge.add(piv);
    const pm = new THREE.Mesh(petalGeo, mA); pm.scale.set(0.5, 1.9, 1.15); piv.add(pm);
    for (let tt = 0; tt < 3; tt++) { const pt = new THREE.Mesh(toothGeo, toothM); pt.position.set(-0.3, (tt - 1) * 0.7, 1.4 + tt * 0.5); pt.rotation.z = Math.PI / 2; pt.scale.setScalar(0.9); piv.add(pt); }
    e.petals.push(piv);
  }
  e.segs = [];
  for (let k = 0; k < WSEG; k++) {
    const r = lerp(2.7, 1.2, k / (WSEG - 1));
    const ball = new THREE.Mesh(ballGeo, mA); ball.scale.setScalar(r * 1.1); root.add(ball);
    const joint = new THREE.Mesh(ballGeo, mB); joint.scale.setScalar(r * 0.95); root.add(joint); // darker ball between two segments
    e.segs.push({ ball, joint, r, p: new THREE.Vector3() });
  }
  scene.add(root);
  Object.assign(e, { K, root, head, pos: head.position, r: K.hitRadius, open: 0 });
  e.anchor = new THREE.Vector3(pos.x, terrainH(pos.x, pos.z) - 10, pos.z);
  e.heading = Math.random() * TAU;
  e.trail = [];
  for (let t = WTRAIL; t >= 0; t--) {
    const px = e.anchor.x - Math.cos(e.heading) * t * 0.6, pz = e.anchor.z - Math.sin(e.heading) * t * 0.6;
    e.trail.push(new THREE.Vector3(px, terrainH(px, pz) - 10, pz));
  }
  e.sway = new THREE.Vector3(); e.st = 'burrow'; e.timer = 3 + Math.random() * 5; e.prog = 0; e.from = 0; e.riseH = 22;
  e.home = new THREE.Vector3(pos.x, 0, pos.z); e.shootCd = 1; e.biteCd = 0;
  setHp(e, hpFor(K, G.level));
  e.dropN = K.drops; e.dropV = K.manaPerDrop;
  e.update = updateWorm;
  e.targetable = () => e.st !== 'burrow' && e.pos.y > groundH(e.pos.x, e.pos.z) - 1; e.showBar = e.targetable;
  e.hitTest = (p, rad) => {
    if (p.distanceTo(e.pos) < e.r + rad) return true;
    for (let k = 0; k < 6; k++) { const s = e.segs[k]; if (p.distanceTo(s.p) < s.r + rad) return true; }
    return false;
  };
  e.barPos = o => { o.copy(e.pos); o.y += 7; return o; };
  // Solid body: pushes the carpet (a sphere of radius pr at P) out of the head and every segment above ground
  e.collide = (P, pr) => {
    pushOut(P, e.pos, HEAD_R + pr);
    for (const s of e.segs) if (s.p.y + s.r > groundH(s.p.x, s.p.z)) pushOut(P, s.p, s.r * 1.1 + pr);
  };
  e.radar = { c: '#e0a457', s: 4 };
  placeWorm(e);
  return e;
}

function pushOut(P, c, R) {
  tA.copy(P).sub(c); const d = tA.length();
  if (d >= R) return;
  if (d < 1e-4) tA.set(0, 1, 0); else tA.multiplyScalar(1 / d);
  P.addScaledVector(tA, R - d);
}
// The body follows the recorded path of the head; sway bends only the front segments
function placeWorm(e) {
  const a = e.anchor, hp = e.head.position; hp.copy(a).add(e.sway);
  let prev = a, acc = 0, k = 0; const tr = e.trail;
  for (let i = tr.length - 1; i >= 0 && k < WSEG; i--) {
    const p = tr[i], d = prev.distanceTo(p);
    while (k < WSEG && acc + d >= (k + 1) * WSP) {
      const t = d > 0 ? ((k + 1) * WSP - acc) / d : 0, sp = e.segs[k].p;
      sp.copy(prev).lerp(p, t); sp.addScaledVector(e.sway, Math.max(0, 1 - (k + 1) / 6)); k++;
    }
    acc += d; prev = p;
  }
  for (; k < WSEG; k++) e.segs[k].p.copy(prev);
  for (let s = 0; s < WSEG; s++) {
    const seg = e.segs[s], A = s === 0 ? hp : e.segs[s - 1].p;
    seg.ball.position.copy(seg.p);
    seg.joint.position.copy(A).add(seg.p).multiplyScalar(0.5);
  }
  if (e.st === 'up') e.head.lookAt(G.playerPos);
  else { tA.copy(hp).sub(e.segs[0].p); if (tA.lengthSq() < 1e-4) tA.set(Math.cos(e.heading), 0, Math.sin(e.heading)); e.head.lookAt(tA.add(hp)); }
  for (const pv of e.petals) pv.rotation.y = -0.35 + e.open * 1.1;
}

function updateWorm(e, dt) {
  const K = e.K, P = G.playerPos, a = e.anchor;
  e.t += dt; e.flash = Math.max(0, e.flash - dt); e.timer -= dt;
  const dx = P.x - a.x, dz = P.z - a.z, hd = Math.hypot(dx, dz);
  if (e.provoked && hd > K.aggroRange * 1.7) e.provoked = false;
  const aggro = G.active && (hd < K.aggroRange || e.provoked);
  let moved = false, wantOpen = 0;
  if (e.st === 'burrow') {
    let tx, tz; const onLand = terrainH(a.x, a.z) > 3;
    if (aggro && onLand) { tx = P.x + G.playerVel.x * 0.8; tz = P.z + G.playerVel.z * 0.8; }
    else { tx = e.home.x + Math.cos(e.t * 0.08) * 60; tz = e.home.z + Math.sin(e.t * 0.08) * 60; }
    e.heading = lerpAngle(e.heading, Math.atan2(tz - a.z, tx - a.x), Math.min(1, dt * 1.2));
    const sp = aggro ? K.burrowSpeed : K.burrowSpeed * 0.45, nx = a.x + Math.cos(e.heading) * sp * dt, nz = a.z + Math.sin(e.heading) * sp * dt;
    if (terrainH(nx, nz) > 3 || !onLand) { a.x = nx; a.z = nz; } else e.heading += dt * 3;
    a.y = lerp(a.y, terrainH(a.x, a.z) - 10, Math.min(1, dt * 4));
    e.vel.set(Math.cos(e.heading) * sp, 0, Math.sin(e.heading) * sp);
    if (Math.random() < 0.75) { const gy = groundH(a.x, a.z); emit(a.x + (R() - 0.5) * 5, gy + 0.6, a.z + (R() - 0.5) * 5, (R() - 0.5) * 4, 3 + R() * 5, (R() - 0.5) * 4, C.DUST, 2.8, 0.9); }
    const close = Math.hypot(tx - a.x, tz - a.z) < 14;
    if (onLand && e.timer <= 0 && (!aggro || close || e.timer < -6)) {
      e.st = 'rise'; e.prog = 0; e.riseH = 20 + Math.random() * 8; e.from = a.y; sfxAt('rumble', a);
    }
    moved = true;
  } else if (e.st === 'rise') {
    e.prog = Math.min(1, e.prog + dt / 1.3); wantOpen = 0.6;
    a.y = lerp(e.from, terrainH(a.x, a.z) + e.riseH, smooth(0, 1, e.prog));
    a.x += Math.cos(e.heading) * 3 * dt; a.z += Math.sin(e.heading) * 3 * dt;
    e.vel.set(0, e.riseH / 1.3, 0);
    if (e.prog < 0.6) { const g0 = groundH(a.x, a.z); for (let s = 0; s < 3; s++) { const an = R() * TAU; emit(a.x + Math.cos(an) * 4, g0 + 0.5, a.z + Math.sin(an) * 4, Math.cos(an) * 8, 6 + R() * 8, Math.sin(an) * 8, C.DUST, 3, 1); } }
    if (e.prog >= 1) { e.st = 'up'; e.timer = K.surfacedSeconds * (1 + Math.random() * 0.6); e.shootCd = 0.8; }
    moved = true;
  } else if (e.st === 'up') {
    wantOpen = 0.55 + 0.35 * Math.max(0, Math.sin(e.t * 3));
    e.sway.set(Math.sin(e.t * 1.3) * 2.4, Math.sin(e.t * 2.1) * 1.0, Math.cos(e.t * 1.1) * 2.4);
    e.vel.set(0, 0, 0);
    if (aggro) e.heading = lerpAngle(e.heading, Math.atan2(dz, dx), Math.min(1, dt * 2));
    if (G.active) {
      e.shootCd -= dt; e.biteCd -= dt;
      const hdist = e.pos.distanceTo(P);
      if (e.shootCd < 0.35) wantOpen = 1;
      if (hdist < K.acidRange && e.shootCd <= 0) {
        e.shootCd = K.acidIntervalSeconds * (1 + Math.random() * 0.35);
        const mouthP = tM.copy(P).sub(e.pos).normalize().multiplyScalar(3.5).add(e.pos);
        lobAtPlayer(mouthP, mats.acid, 6, K.acidDamage, C.ACID, 75); sfxAt('lob', e.pos);
      }
      if (hdist < K.biteRange && e.biteCd <= 0) { e.biteCd = 1.5; hurtPlayer(K.biteDamage); burst(P, 14, C.ACID, 14, 1.8, 0.5); }
    }
    if (e.timer <= 0) { e.st = 'sink'; e.prog = 0; e.from = a.y; }
  } else if (e.st === 'sink') {
    e.prog = Math.min(1, e.prog + dt / 1.6);
    a.x += Math.cos(e.heading) * 14 * dt; a.z += Math.sin(e.heading) * 14 * dt;
    a.y = lerp(e.from, terrainH(a.x, a.z) - 10, smooth(0, 1, e.prog));
    e.vel.set(Math.cos(e.heading) * 14, -10, Math.sin(e.heading) * 14);
    if (e.prog >= 1) { e.st = 'burrow'; e.timer = 3 + Math.random() * 4; }
    moved = true;
  }
  e.open = lerp(e.open, wantOpen, Math.min(1, dt * 6));
  if (e.st !== 'up') e.sway.multiplyScalar(Math.max(0, 1 - dt * 3));
  if (moved) {
    const last = e.trail[e.trail.length - 1];
    if (a.distanceTo(last) > 0.6) { e.trail.push(a.clone()); if (e.trail.length > WTRAIL) e.trail.shift(); }
  }
  e.glow.scale.setScalar(3 + e.open * 2 + Math.sin(e.t * 6) * 0.5);
  placeWorm(e);
}
