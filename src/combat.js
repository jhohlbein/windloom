// Spells, enemy projectiles, mana orbs, damage and death.
import * as THREE from 'three';
import { CFG } from './config.js';
import { G, W } from './state.js';
import { scene, addSprite, mats, fireCoreMat, coreMatFor, haloMatFor } from './scene.js';
import { TAU, clamp, lerp } from './util.js';
import { terrainH, groundH } from './terrain.js';
import { emit, burst, C } from './particles.js';
import { sfx } from './audio.js';
import { toast, flashHurt } from './hud.js';
import { carryCap, stageCount } from './progress.js';
import { removeEnemyObj } from './creatures/common.js';
import { mark } from './perf.js';
import { dragonAlert } from './creatures/dragon.js';
import { placePlayerAtCastle } from './player.js';

const tmp = new THREE.Vector3();

/* ---------- mana orbs (only dropped by creatures) ---------- */
const orbGeo = new THREE.IcosahedronGeometry(0.85, 0), orbMat = new THREE.MeshStandardMaterial({ color: 0xffc02a, emissive: 0xb07400, roughness: 0.25, metalness: 0.8, flatShading: true });
export function spawnOrb(pos, val, vel, keep) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(orbGeo, orbMat); g.add(m);
  g.add(addSprite(mats.gold, 5.5));
  g.position.copy(pos); scene.add(g);
  G.orbs.push({ g, m, pos: g.position, vel: vel ? vel.clone() : new THREE.Vector3(), val, age: 0, keep: !!keep, ph: Math.random() * TAU });
}
function removeOrb(i) { scene.remove(G.orbs[i].g); G.orbs.splice(i, 1); }
let fullHint = false; // shown once per full load
export function updateOrbs(dt) {
  const cap = carryCap(), P = G.playerPos, cm = CFG.mana;
  if (G.carried < cap) fullHint = false;
  for (let i = G.orbs.length - 1; i >= 0; i--) {
    const o = G.orbs[i]; o.age += dt;
    o.m.rotation.y += dt * 2; o.m.position.y = Math.sin(o.age * 3 + o.ph) * 0.5;
    const dx = P.x - o.pos.x, dy = P.y - o.pos.y, dz = P.z - o.pos.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const canTake = G.active && G.carried < cap;
    if (canTake && d < cm.magnetRadius) {
      const sp = 22 + (cm.magnetRadius - d) * 3.2; o.pos.x += dx / d * sp * dt; o.pos.y += dy / d * sp * dt; o.pos.z += dz / d * sp * dt; o.vel.set(0, 0, 0);
    } else {
      // orbs never come to rest outside the sandstorm boundary, where the player cannot follow
      const od = Math.hypot(o.pos.x, o.pos.z), OB = CFG.world.boundRadius - 6;
      if (od > OB) { o.pos.x *= OB / od; o.pos.z *= OB / od; o.vel.x = o.vel.z = 0; }
      const gy = groundH(o.pos.x, o.pos.z) + 2.4;
      if (o.pos.y > gy || o.vel.y > 0) {
        o.vel.y -= 22 * dt; o.vel.x *= 0.985; o.vel.z *= 0.985;
        o.pos.addScaledVector(o.vel, dt);
        if (o.pos.y < gy) { o.pos.y = gy; o.vel.set(0, 0, 0); }
      } else if (gy > CFG.world.ceiling) {
        // a mountain above the ceiling is out of reach: the orb rolls downhill until the carpet can get to it
        const e = 3, sx = groundH(o.pos.x + e, o.pos.z) - groundH(o.pos.x - e, o.pos.z), sz = groundH(o.pos.x, o.pos.z + e) - groundH(o.pos.x, o.pos.z - e);
        let ux = -sx, uz = -sz;
        if (Math.hypot(ux, uz) < 0.05) { ux = o.pos.x - W.LX; uz = o.pos.z - W.LZ; } // flat terrace: away from the peak
        const ul = Math.hypot(ux, uz) || 1;
        o.pos.x += ux / ul * 14 * dt; o.pos.z += uz / ul * 14 * dt; o.pos.y = groundH(o.pos.x, o.pos.z) + 2.4;
      }
    }
    if (!canTake && G.active && d < cm.magnetRadius && !fullHint) { fullHint = true; toast('You carry all you can. Bank it in the beam.', 2200, true); }
    if (canTake && d < cm.pickupRadius) {
      G.carried = Math.min(cap, G.carried + o.val);
      burst(o.pos, 6, C.GOLD, 10, 1.4, 0.4); sfx('mana'); removeOrb(i); continue;
    }
    if (!o.keep && o.age > cm.orbLifetimeSeconds) removeOrb(i);
  }
}

/* ---------- enemy projectiles ---------- */
export function addBolt(mat, size, pos, vel, dmg, grav, col, life) {
  const g = addSprite(haloMatFor(mat), size); g.position.copy(pos); scene.add(g);
  // solid core in the projectile's colour, so it does not wash out to white over the bright sea or sky
  const core = new THREE.Sprite(coreMatFor(mat)); core.scale.setScalar(0.55); core.renderOrder = 1; g.add(core);
  G.bolts.push({ g, pos: g.position, vel: vel.clone(), life: life || 4.5, dmg, grav: grav || 0, col, sz: size * 0.38, hitR: size > 10 ? 5.5 : size > 6 ? 4.4 : 3.6 });
}
// Ballistic lob that lands near where the player will be
export function lobAtPlayer(from, mat, size, dmg, col, speedRef) {
  const d = from.distanceTo(G.playerPos), T = clamp(d / speedRef, 0.7, 2.6), g = 30;
  const to = tmp.copy(G.playerPos).addScaledVector(G.playerVel, T * 0.75);
  const v = new THREE.Vector3((to.x - from.x) / T, (to.y - from.y) / T + 0.5 * g * T, (to.z - from.z) / T);
  addBolt(mat, size, from, v, dmg, g, col, T + 1.5);
}
export function updateBolts(dt) {
  for (let i = G.bolts.length - 1; i >= 0; i--) {
    const b = G.bolts[i]; b.life -= dt;
    if (b.grav) b.vel.y -= b.grav * dt;
    b.pos.addScaledVector(b.vel, dt);
    emit(b.pos.x, b.pos.y, b.pos.z, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, b.col, b.sz * 2, 0.4);
    let hit = false;
    if (G.active && b.pos.distanceTo(G.playerPos) < b.hitR) { hurtPlayer(b.dmg); hit = true; burst(b.pos, 14, b.col, 16, 1.8, 0.5); }
    else {
      const th = terrainH(b.pos.x, b.pos.z);
      if (b.pos.y < Math.max(th, 0)) { burst(b.pos, 10, th < 0 ? C.SPRAY : b.col, 12, 1.8, 0.5); hit = true; }
    }
    if (hit || b.life <= 0) { scene.remove(b.g); G.bolts.splice(i, 1); }
  }
}

/* ---------- damage ---------- */
export function damageEnemy(e, dmg, at) {
  e.hp -= dmg; e.flash = 0.14; e.barT = 2.5; e.provoked = true; sfx('hit');
  if (e.kind === 'dragon' && e.hp > 0) dragonAlert(e, G.playerPos, true);
  burst(at || e.pos, 10, C.FIRE, 18, 1.8, 0.5);
  if (e.hp <= 0) killEnemy(e);
}
export function killEnemy(e) {
  const i = G.enemies.indexOf(e); if (i < 0) return;
  G.enemies.splice(i, 1); removeEnemyObj(e); mark('kill ' + e.kind);
  const big = e.kind === 'dragon';
  burst(e.pos, big ? 180 : 60, C.FIRE, big ? 64 : 34, big ? 4.4 : 3, big ? 1.5 : 0.9);
  burst(e.pos, big ? 90 : 30, C.RED, big ? 40 : 22, 2.4, 0.8);
  if (e.kind === 'kraken') burst(e.pos, 40, C.INK, 26, 2.6, 0.9);
  if (e.kind === 'worm') burst(e.pos, 40, C.DUST, 26, 2.8, 1);
  const spread = big ? 16 : 14; // the dragon's hoard lands in a pile, not scattered beyond the magnet's reach
  for (let n = 0; n < e.dropN; n++) {
    const a = Math.random() * TAU, s = 8 + Math.random() * spread;
    spawnOrb(e.pos, e.dropV, new THREE.Vector3(Math.cos(a) * s, 6 + Math.random() * (big ? 18 : 10), Math.sin(a) * s), e.keepDrops);
  }
  G.kills++; G.killsBy[e.kind] = (G.killsBy[e.kind] || 0) + 1; sfx('kill');
  if (big) {
    sfx('roar', 0.8); addRing(e.pos, 150, 1.3, 0xff6a1a);
    G.dragon = null; G.dragonTimer = CFG.spawning.dragon.respawnSeconds;
    G.dragonSlain = true;
    toast('Vharoth falls. Its hoard scatters across the sand.' + (G.level < stageCount() ? (G.timed ? '\nComplete the palace to end the round early.' : '\nComplete the palace to make the Sanctum whole.') : ''), 4200);
  } else toast(e.name + ' slain', 1400, true);
}
export function hurtPlayer(d) {
  if (G.invuln > 0) return;
  G.lastHurt = G.playTime;
  G.hp -= d; G.invuln = CFG.player.invulnerableAfterHitSeconds; sfx('hurt'); flashHurt();
  if (G.tut) G.hp = Math.max(1, G.hp); // the tutorial carpet does not fall
  if (G.hp <= 0) playerDown();
}
function playerDown() {
  toast('Your carpet falls. You wake in the palace.', 3000);
  burst(G.playerPos, 40, C.RED, 30, 2.4, 0.8);
  G.carried = 0; G.hp = G.maxHp; G.invuln = CFG.player.respawnInvulnerableSeconds;
  placePlayerAtCastle();
}

/* ---------- player spells ---------- */
function aimDir() {
  const fb = CFG.spells.fireball; let best = null, bd = fb.aimAssistCone, bdist = 0;
  for (const e of G.enemies) {
    if (!e.targetable()) continue;
    tmp.copy(e.pos).sub(G.playerPos); const d = tmp.length();
    if (d > fb.aimAssistRange || d < 8) continue;
    const dot = tmp.dot(G.fwd) / d;
    if (dot > bd) { bd = dot; best = e; bdist = d; }
  }
  const out = G.fwd.clone();
  if (best) { tmp.copy(best.pos).addScaledVector(best.vel, bdist / fb.speed).sub(G.playerPos).normalize(); out.lerp(tmp, 0.7).normalize(); }
  return out;
}
// Spells near the dragon draw its attention
function makeNoise() {
  if (G.dragon && G.dragon.pos.distanceTo(G.playerPos) < CFG.spells.fireball.noiseRadius) dragonAlert(G.dragon, G.playerPos, false);
}
export function castFire() {
  const fb = CFG.spells.fireball;
  if (G.fireCd > 0 || G.spellExhausted) return;
  // Firing nonstop drains spell mana a little faster than it refills; once empty, wait until it reaches refireAt
  if (G.spellMana < fb.manaCost) { G.spellExhausted = true; toast('Out of spell mana', 1000, true); return; }
  G.spellMana -= fb.manaCost; makeNoise();
  G.fireCd = Math.max(G.fireCd, -0.05) + fb.cooldownSeconds; // keep the overshoot so the rate does not depend on frame rate
  const dir = aimDir();
  const g = addSprite(haloMatFor(mats.fire), 5.5); g.position.copy(G.playerPos).addScaledVector(G.fwd, 3.2); g.position.y -= 0.3; scene.add(g);
  const core = new THREE.Sprite(fireCoreMat); core.scale.setScalar(0.6); core.renderOrder = 1; g.add(core); // scale is relative to the halo
  G.shots.push({ g, pos: g.position, vel: dir.multiplyScalar(fb.speed).add(G.playerVel.clone().multiplyScalar(0.3)), life: fb.lifetimeSeconds, dmg: fb.damage + fb.damagePerStage * (G.level - 1) });
  sfx('fire');
}
export function castNova() {
  const nv = CFG.spells.nova;
  if (G.novaCd > 0) return;
  if (G.spellMana < nv.manaCost) { toast('Nova needs ' + nv.manaCost + ' spell mana', 1400, true); G.novaCd = 0.6; return; }
  G.spellMana -= nv.manaCost; G.novaCd = nv.cooldownSeconds; makeNoise();
  mark('nova');
  if (G.tut) G.tut.novaCast = true;
  addRing(G.playerPos, nv.radius, 0.55, 0x7defff); sfx('nova');
  burst(G.playerPos, 50, C.MANA, 50, 2.4, 0.8);
  G.enemies.slice().forEach(e => { if (e.targetable() && e.pos.distanceTo(G.playerPos) < nv.radius + e.r) damageEnemy(e, nv.damage + nv.damagePerStage * (G.level - 1)); });
  for (let i = G.bolts.length - 1; i >= 0; i--) {
    if (G.bolts[i].pos.distanceTo(G.playerPos) < nv.radius) { burst(G.bolts[i].pos, 6, G.bolts[i].col, 10, 1.4, 0.4); scene.remove(G.bolts[i].g); G.bolts.splice(i, 1); }
  }
}
export function updateShots(dt) {
  for (let i = G.shots.length - 1; i >= 0; i--) {
    const s = G.shots[i]; s.life -= dt;
    s.pos.addScaledVector(s.vel, dt);
    emit(s.pos.x, s.pos.y, s.pos.z, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, C.FIRE, 1.8, 0.35);
    let hit = false;
    for (const e of G.enemies) { if (e.targetable() && e.hitTest(s.pos, 1.4)) { damageEnemy(e, s.dmg, s.pos); hit = true; break; } }
    if (!hit) {
      const th = terrainH(s.pos.x, s.pos.z);
      if (s.pos.y < th) { burst(s.pos, 8, C.DUST, 10, 1.6, 0.4); hit = true; }
      else if (s.pos.y < 0) { burst(s.pos, 10, C.SPRAY, 12, 1.8, 0.5); hit = true; }
    }
    if (hit || s.life <= 0) { scene.remove(s.g); G.shots.splice(i, 1); }
  }
}

/* ---------- expanding shock rings ---------- */
export function addRing(pos, max, dur, color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
  m.position.copy(pos); m.scale.setScalar(2); scene.add(m);
  G.rings.push({ m, t: 0, dur, max });
}
export function updateRings(dt) {
  for (let i = G.rings.length - 1; i >= 0; i--) {
    const r = G.rings[i]; r.t += dt; const f = r.t / r.dur;
    if (f >= 1) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); G.rings.splice(i, 1); continue; }
    r.m.scale.setScalar(lerp(2, r.max, 1 - Math.pow(1 - f, 2))); r.m.material.opacity = 0.4 * (1 - f);
  }
}

export function clearProjectiles() {
  G.bolts.forEach(b => scene.remove(b.g)); G.bolts.length = 0;
  G.shots.forEach(b => scene.remove(b.g)); G.shots.length = 0;
  G.orbs.forEach(o => scene.remove(o.g)); G.orbs.length = 0;
}
