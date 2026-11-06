// The rider on the carpet: model, flight model and chase camera.
import * as THREE from 'three';
import { CFG } from './config.js';
import { G, W } from './state.js';
import { scene, camera, castShadows } from './scene.js';
import { clamp, lerp } from './util.js';
import { terrainH, groundH } from './terrain.js';
import { emit, C } from './particles.js';
import { toast } from './hud.js';
import { castFire, castNova } from './combat.js';
import { castle, palace } from './palace.js';

const player = new THREE.Group(); player.rotation.order = 'YXZ'; scene.add(player);

/* ---------- riders (chosen in Settings); both sit at the back of the carpet, facing -z ---------- */
// Everything visible hangs under `rig`, which bobs and sways on its own; `player` carries the flight transform.
const rig = new THREE.Group(); player.add(rig);
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
const skin = mat(0xd9b28f, { roughness: 0.9 });
function part(geo, material, x, y, z, parent) { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; }
// A strip of cloth that trails backwards (+z) from `at`: a chain of hinged segments, animated by flutter()
function streamer(parent, material, at, width, segs, len, taper = 0.75) {
  const joints = []; let p = parent, w = width;
  for (let i = 0; i < segs; i++) {
    const j = new THREE.Group(); if (i === 0) j.position.set(...at); else j.position.z = len;
    const g = new THREE.BoxGeometry(w, 0.025, len); g.translate(0, 0, len / 2);
    j.add(new THREE.Mesh(g, material)); p.add(j); joints.push(j); p = j; w *= taper;
  }
  return joints;
}
const riders = { sultan: new THREE.Group(), princess: new THREE.Group() };
{
  // Turbaned rider: dark blue robe and a cream turban whose loose end streams behind
  const R = riders.sultan, cloth = mat(0xf4e7d0, { roughness: 0.8, side: THREE.DoubleSide });
  part(new THREE.CylinderGeometry(0.12, 0.55, 1.3, 8), mat(0x2b2f7a, { roughness: 0.9 }), 0, 0.78, 0.5, R);
  const head = new THREE.Group(); head.position.set(0, 1.6, 0.5); R.add(head);
  part(new THREE.SphereGeometry(0.3, 10, 8), skin, 0, 0, 0, head);
  part(new THREE.SphereGeometry(0.42, 10, 8), cloth, 0, 0.28, 0, head).scale.set(1, 0.75, 1);
  part(new THREE.SphereGeometry(0.07, 8, 6), mat(0x5fe0d6, { emissive: 0x1f6b66 }), 0, 0.3, -0.41, head); // jewel
  R.userData = { head, tails: [{ j: streamer(head, cloth, [0.12, 0.18, 0.34], 0.2, 6, 0.24), droop: 0.55, phase: 0 }] };
}
{
  // Veiled princess: teal gown with a gold sash, lavender head scarf down the back, sheer face veil, gold circlet
  const P = riders.princess, gold = mat(0xe8b44a, { roughness: 0.3, metalness: 0.7 });
  part(new THREE.CylinderGeometry(0.11, 0.6, 1.3, 10), mat(0x1f7a80), 0, 0.78, 0.5, P);
  part(new THREE.TorusGeometry(0.27, 0.045, 6, 16), gold, 0, 1.05, 0.5, P).rotation.x = Math.PI / 2;
  const head = new THREE.Group(); head.position.set(0, 1.6, 0.5); P.add(head);
  part(new THREE.SphereGeometry(0.28, 12, 10), skin, 0, 0, 0, head);
  // head scarf: a hood over the crown and a long fall of cloth down the back, hinged at the crown so it can lift
  const scarf = mat(0xb48ad0, { side: THREE.DoubleSide });
  // (sphere/cylinder angles: -z, the face, is at phi = 1.5*PI; the back half of a cylinder starts at theta = -PI/2)
  part(new THREE.SphereGeometry(0.34, 14, 8, Math.PI * 1.78, Math.PI * 1.44, 0, Math.PI * 0.6), scarf, 0, 0.02, 0.03, head);
  const fallPivot = new THREE.Group(); fallPivot.position.set(0, 1.68, 0.6); P.add(fallPivot);
  part(new THREE.CylinderGeometry(0.3, 0.5, 1.2, 12, 1, true, Math.PI * 1.5, Math.PI), scarf, 0, -0.6, 0, fallPivot);
  // sheer veil over the lower face (front is -z)
  const veil = part(new THREE.SphereGeometry(0.3, 12, 8, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.5, Math.PI * 0.35),
    mat(0xf6e6ee, { transparent: true, opacity: 0.7, side: THREE.DoubleSide }), 0, 0, 0, head);
  veil.rotation.y = Math.PI; // the segment is built facing +z; turn it to the face
  // gold circlet with a small gem on the forehead
  part(new THREE.TorusGeometry(0.3, 0.025, 6, 20), gold, 0, 0.16, 0, head).rotation.x = Math.PI / 2;
  part(new THREE.OctahedronGeometry(0.06, 0), mat(0x5fe0d6, { emissive: 0x1f6b66 }), 0, 0.18, -0.3, head);
  // two scarf ends from the back of the head and a sash ribbon from the waist, all streaming behind
  const sash = mat(0xe8b44a, { roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide });
  P.userData = { head, fallPivot, veil, tails: [
    { j: streamer(head, scarf, [-0.12, 0.05, 0.3], 0.16, 5, 0.26), droop: 0.7, phase: 0 },
    { j: streamer(head, scarf, [0.13, 0.0, 0.3], 0.14, 5, 0.24), droop: 0.75, phase: 1.7 },
    { j: streamer(P, sash, [0.18, 1.05, 0.78], 0.09, 5, 0.2, 0.9), droop: 0.9, phase: 3.1 }
  ] };
}
export function setRider(kind) { for (const k in riders) riders[k].visible = k === kind; }
setRider('sultan');
// The carpet is a subdivided slab whose vertices ripple every frame (see animateRig)
const carpetGeo = new THREE.BoxGeometry(3.4, 0.14, 5, 8, 1, 14), carpetBase = carpetGeo.attributes.position.array.slice();
const fringes = [];
{
  const c = document.createElement('canvas'); c.width = 128; c.height = 192; const g = c.getContext('2d');
  g.fillStyle = '#7a1f2b'; g.fillRect(0, 0, 128, 192);
  g.strokeStyle = '#ffcf63'; g.lineWidth = 7; g.strokeRect(5, 5, 118, 182);
  g.strokeStyle = '#5fe0d6'; g.lineWidth = 2; g.strokeRect(17, 17, 94, 158);
  for (let k = 0; k < 3; k++) {
    const cy = 48 + k * 48; g.fillStyle = k === 1 ? '#5fe0d6' : '#ff8a3d';
    g.beginPath(); g.moveTo(64, cy - 19); g.lineTo(84, cy); g.lineTo(64, cy + 19); g.lineTo(44, cy); g.closePath(); g.fill();
  }
  const carpet = new THREE.Mesh(carpetGeo, new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.9 }));
  rig.add(carpet);
  const fm = new THREE.MeshStandardMaterial({ color: 0xffcf63, roughness: 0.6 });
  for (const z of [-2.6, 2.6]) { const f = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 0.4), fm); f.position.z = z; rig.add(f); fringes.push(f); }
  rig.add(riders.sultan, riders.princess);
}
castShadows(player); // after every part is attached (it only marks what is already in the tree)

// Visual motion only (no effect on flight or collision): the carpet ripples like cloth from front to back,
// more at speed and towards the trailing edge; the whole rig bobs; riders lean with speed and turns, and
// their loose cloth (turban end, scarf, sash) flutters and streams back.
let animT = 0;
function carpetWave(x, z, amp) {
  const back = (z + 2.5) / 5; // 0 at the front edge, 1 at the back
  return amp * Math.sin(z * 1.25 - animT * (5 + 4 * amp)) * (0.25 + 0.75 * back)
    + amp * 0.35 * (x / 1.7) * (x / 1.7) * Math.sin(animT * 3.3 + z * 0.8); // the side edges curl a little
}
function animateRig(dt) {
  animT += dt;
  const t = animT, s = clamp(Math.abs(G.speed) / (CFG.player.baseSpeed * CFG.player.surgeMultiplier), 0, 1);
  const amp = 0.05 + 0.04 * s; // only a little more ripple at speed, none extra for a surge
  const pos = carpetGeo.attributes.position, a = pos.array;
  for (let i = 0; i < a.length; i += 3) a[i + 1] = carpetBase[i + 1] + carpetWave(carpetBase[i], carpetBase[i + 2], amp);
  pos.needsUpdate = true; carpetGeo.computeVertexNormals();
  for (const f of fringes) f.position.y = carpetWave(0, Math.sign(f.position.z) * 2.5, amp);
  rig.position.y = Math.sin(t * 1.7) * 0.12;
  rig.rotation.x = Math.sin(t * 1.1 + 1) * 0.025; rig.rotation.z = Math.sin(t * 1.3) * 0.03;
  for (const k in riders) {
    const R = riders[k], U = R.userData; if (!R.visible) continue;
    R.position.y = carpetWave(0, 0.5, amp);
    R.rotation.x = lerp(R.rotation.x, -0.1 * s + (G.speed < 0 ? 0.12 : 0), Math.min(1, dt * 4));  // lean into speed
    R.rotation.z = lerp(R.rotation.z, -G.steerX * 0.14, Math.min(1, dt * 5));                  // and into turns
    U.head.rotation.y = lerp(U.head.rotation.y, -G.steerX * 0.35, Math.min(1, dt * 4));         // look into the turn
    U.head.rotation.x = Math.sin(t * 1.9) * 0.04;
    const stream = G.speed < 0 ? 0 : s, fl = 0.1 + 0.08 * s; // trailing cloth lifts with speed and flutters faster
    for (const tl of U.tails) tl.j.forEach((j, i) => {
      j.rotation.x = (i ? 0.12 : tl.droop) * (1 - 0.85 * stream) + Math.sin(t * (6 + 2.5 * s) - i * 1.1 + tl.phase) * fl * (0.4 + i * 0.15);
      j.rotation.y = Math.sin(t * (4.5 + 1.5 * s) - i * 0.9 + tl.phase) * 0.07 * (0.6 + 0.4 * s);
    });
    if (U.fallPivot) U.fallPivot.rotation.x = -0.15 - 0.45 * stream + Math.sin(t * (5 + 2 * s)) * 0.035 * (0.6 + 0.4 * s);
    if (U.veil) U.veil.rotation.x = Math.sin(t * (7 + 2 * s)) * 0.02 * (0.5 + 0.5 * s);
  }
}

export function placePlayerAtCastle() {
  G.playerPos.set(W.CX, W.PH + G.castleTopY + 30, W.CZ);
  G.yaw = Math.atan2(W.CX, W.CZ); G.pitch = 0; G.roll = 0; G.speed = CFG.player.baseSpeed; G.strafe = 0; G.steerX = G.steerY = 0; camSmoothed = false;
}

// Lowest height the carpet's centre may have here: the centre keeps groundClearance above the ground, and each
// corner of the (tilted) carpet keeps cornerClearance above the ground beneath that corner.
const CORNERS = [[-1.7, 2.5], [1.7, 2.5], [-1.7, -2.5], [1.7, -2.5]].map(([x, z]) => new THREE.Vector3(x, 0, z));
const cEuler = new THREE.Euler(0, 0, 0, 'YXZ'), cTmp = new THREE.Vector3();
const cPrev = new THREE.Vector3();
function groundFloor(P) {
  const cp = CFG.player;
  let floor = groundH(P.x, P.z) + cp.groundClearance;
  cEuler.set(G.pitch, G.yaw, G.roll);
  for (const c of CORNERS) {
    cTmp.copy(c).applyEuler(cEuler);
    floor = Math.max(floor, groundH(P.x + cTmp.x, P.z + cTmp.z) + cp.cornerClearance - cTmp.y);
  }
  return floor;
}

// Palace and creature collision. The carpet is treated as a sphere of radius PR. Coming from above, it rides on roofs and
// domes; from the side, it is pushed out of walls and towers and slides along them.
const PR = 2.6;
function collidePalace(P, prevY) {
  const cx = castle.position.x, cy = castle.position.y, cz = castle.position.z, clear = CFG.player.groundClearance;
  for (let pass = 0; pass < 2; pass++) { // two passes settle corners where shapes meet
    for (const c of palace.colliders) {
      const top = cy + c.top + clear;
      if (P.y >= top) continue;
      const lx = P.x - cx - c.x, lz = P.z - cz - c.z;
      let nx, nz, depth;
      if (c.cyl) {
        const d = Math.hypot(lx, lz); depth = c.r + PR - d; if (depth <= 0) continue;
        nx = d > 1e-4 ? lx / d : 1; nz = d > 1e-4 ? lz / d : 0;
      } else {
        const qx = clamp(lx, -c.hx, c.hx), qz = clamp(lz, -c.hz, c.hz), dx = lx - qx, dz = lz - qz, d = Math.hypot(dx, dz);
        if (d > 1e-4) { depth = PR - d; if (depth <= 0) continue; nx = dx / d; nz = dz / d; }
        else { // centre inside the box: leave by the nearest face
          const ex = c.hx - Math.abs(lx), ez = c.hz - Math.abs(lz);
          if (ex < ez) { nx = Math.sign(lx) || 1; nz = 0; depth = ex + PR; } else { nx = 0; nz = Math.sign(lz) || 1; depth = ez + PR; }
        }
      }
      if (prevY >= top - 1.5) P.y = top; // was above it (or nearly): settle on top
      else { P.x += nx * depth; P.z += nz * depth; } // hit it from the side: slide along it
    }
  }
}

export function updatePlayer(dt) {
  const cp = CFG.player, I = G.input, keys = G.keys, P = G.playerPos;
  const kx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  const ky = (keys.ArrowUp ? 0.7 : 0) - (keys.ArrowDown ? 0.7 : 0);
  const sx = clamp(I.mouseX + I.touchX + I.tiltX + kx, -1, 1), sy = clamp(I.mouseY + I.touchY + I.tiltY + ky, -1, 1);
  const RS = cp.response; // how quickly steering, pitch, speed, strafe and roll follow the controls (per second)
  G.steerX = lerp(G.steerX, sx, Math.min(1, dt * RS.steer)); G.steerY = lerp(G.steerY, sy, Math.min(1, dt * RS.steer));
  G.yaw -= G.steerX * cp.turnRate * dt;
  G.pitch = lerp(G.pitch, G.steerY * cp.pitchMax, Math.min(1, dt * RS.pitch));
  // Surge comes in bursts: pressing W (or Surge) gives surgeSeconds of surge speed; held down, it repeats every
  // surgeCooldownSeconds. Between bursts the carpet eases back to cruising speed, the normal way to fly.
  const boost = keys.KeyW || keys.ShiftLeft || keys.ShiftRight || I.touchBoost, back = keys.KeyS || I.touchBack;
  G.surgeT = Math.max(0, (G.surgeT || 0) - dt); G.surgeCd = Math.max(0, (G.surgeCd || 0) - dt);
  if (boost && !back && G.surgeCd <= 0) { G.surgeT = cp.surgeSeconds; G.surgeCd = cp.surgeCooldownSeconds; }
  if (back) G.surgeT = 0;
  G.surging = G.surgeT > 0;
  const want = back ? -cp.baseSpeed * cp.reverseMultiplier : G.surging ? cp.baseSpeed * cp.surgeMultiplier : cp.baseSpeed;
  G.speed = lerp(G.speed, want, Math.min(1, dt * RS.speed));
  const st = ((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0)) * cp.strafeSpeed;
  G.strafe = lerp(G.strafe, st, Math.min(1, dt * RS.strafe));
  G.roll = lerp(G.roll, -G.steerX * 0.6 - G.strafe / cp.strafeSpeed * 0.35, Math.min(1, dt * RS.roll));
  const cpi = Math.cos(G.pitch);
  G.fwd.set(-Math.sin(G.yaw) * cpi, Math.sin(G.pitch), -Math.cos(G.yaw) * cpi);
  G.rightV.set(Math.cos(G.yaw), 0, -Math.sin(G.yaw));
  G.playerVel.copy(G.fwd).multiplyScalar(G.speed).addScaledVector(G.rightV, G.strafe);
  const prevX = P.x, prevY = P.y, prevZ = P.z;
  P.addScaledVector(G.playerVel, dt);
  collidePalace(P, prevY);
  for (const e of G.enemies) if (e.collide) e.collide(P, PR); // solid creatures (sandworms)
  // Mountains taller than the ceiling are walls: where the ground would rise above the ceiling, the move is
  // undone along that axis, so the carpet slides along the slope instead of climbing it. (If it somehow is
  // already above such ground, it may still move anywhere that is not higher.)
  const wall = Math.max(CFG.world.ceiling, groundFloor(cPrev.set(prevX, prevY, prevZ)));
  if (groundFloor(P) > wall) {
    const nx = P.x, nz = P.z;
    P.x = prevX;
    if (groundFloor(P) > wall) { P.x = nx; P.z = prevZ; if (groundFloor(P) > wall) P.x = prevX; }
  }
  const gy = groundFloor(P);
  let skim = P.y - gy;
  if (skim < 0) { P.y = gy; skim = 0; }
  const top = Math.max(CFG.world.ceiling, gy); // never push the carpet into a peak taller than the ceiling
  if (P.y > top) P.y = top;
  const r = Math.hypot(P.x, P.z), B = CFG.world.boundRadius;
  if (r > B) {
    P.x *= B / r; P.z *= B / r;
    if (G.wallToast <= 0) { toast('A sandstorm turns you back', 1800, true); G.wallToast = 4; }
  }
  player.position.copy(P); player.rotation.set(G.pitch, G.yaw, G.roll);
  animateRig(dt);
  if (skim < 7 && Math.random() < 0.8) {
    const wet = terrainH(P.x, P.z) < 0.5;
    emit(P.x + (Math.random() - 0.5) * 2, groundH(P.x, P.z) + 0.2, P.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 6 - G.playerVel.x * 0.1, 3 + Math.random() * 4, (Math.random() - 0.5) * 6 - G.playerVel.z * 0.1, wet ? C.SPRAY : C.DUST, 2.2, 0.7);
  }
  const tail = G.speed >= 0 ? -2.4 : 2.4;
  emit(P.x + G.fwd.x * tail, P.y + G.fwd.y * tail - 0.2, P.z + G.fwd.z * tail, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, C.MANA, 1.2, 0.6);
  if (G.playTime - G.lastHurt > cp.regenDelaySeconds && G.hp < G.maxHp) G.hp = Math.min(G.maxHp, G.hp + cp.regenPerSecond * dt);
  const SM = CFG.spells.mana;
  G.spellMana = Math.min(SM.max, G.spellMana + SM.regenPerSecond * dt);
  if (G.spellExhausted && G.spellMana >= SM.refireAt) G.spellExhausted = false;
  G.fireCd -= dt; G.novaCd -= dt; G.invuln = Math.max(0, G.invuln - dt); G.wallToast -= dt;
  if (I.mouseFire || I.touchFire || keys.Space) castFire();
  if (I.novaReq) { I.novaReq = false; castNova(); }
  player.visible = G.invuln <= 0 || Math.floor(G.invuln * 14) % 2 === 0;
}

const camLook = new THREE.Vector3(), tA = new THREE.Vector3(), tB = new THREE.Vector3();
let camSmoothed = false, titleY = 60;
export function updateCamera(dt, title) {
  if (title) {
    const t = performance.now() * 0.00012;
    const tcx = W.CX + Math.cos(t) * 105, tcz = W.CZ + Math.sin(t) * 105;
    titleY = Math.max(lerp(titleY, groundH(tcx, tcz) + 22, 0.05), W.PH + 46 + Math.sin(t * 1.7) * 8);
    camera.position.set(tcx, titleY, tcz);
    camera.lookAt(W.CX, W.PH + 24, W.CZ); camera.fov = 64; camera.updateProjectionMatrix(); camSmoothed = false; return;
  }
  const P = G.playerPos;
  const K = CFG.camera;
  const want = tA.copy(P).addScaledVector(G.fwd, -K.distance); want.y += K.height;
  const gy = groundH(want.x, want.z) + 3; if (want.y < gy) want.y = gy;
  const look = tB.copy(P).addScaledVector(G.fwd, K.lookAhead); look.y += K.lookHeight;
  if (!camSmoothed) { camera.position.copy(want); camLook.copy(look); camSmoothed = true; }
  const k = 1 - Math.exp(-dt * K.follow);
  camera.position.lerp(want, k); camLook.lerp(look, k);
  camera.lookAt(camLook);
  const base = CFG.player.baseSpeed;
  const fov = K.fov + clamp((G.speed - base) / (base * 0.85), 0, 1) * K.fovSurgeExtra;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 3)); camera.updateProjectionMatrix(); }
}
