// The rider on the carpet: model, flight model and chase camera.
import * as THREE from 'three';
import { CFG } from './config.js';
import { G, W } from './state.js';
import { scene, camera, addSprite, mats } from './scene.js';
import { clamp, lerp } from './util.js';
import { terrainH, groundH } from './terrain.js';
import { emit, C } from './particles.js';
import { toast } from './hud.js';
import { castFire, castNova } from './combat.js';

const player = new THREE.Group(); player.rotation.order = 'YXZ'; scene.add(player);

/* ---------- riders (chosen in Settings); both sit at the back of the carpet, facing -z ---------- */
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
const skin = mat(0xd9b28f, { roughness: 0.9 });
function part(geo, material, x, y, z, parent) { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; }
const riders = { sultan: new THREE.Group(), princess: new THREE.Group() };
{
  // Turbaned rider: dark blue robe and a cream turban
  const R = riders.sultan;
  part(new THREE.CylinderGeometry(0.12, 0.55, 1.3, 8), mat(0x2b2f7a, { roughness: 0.9 }), 0, 0.78, 0.5, R);
  part(new THREE.SphereGeometry(0.3, 10, 8), skin, 0, 1.6, 0.5, R);
  part(new THREE.SphereGeometry(0.42, 10, 8), mat(0xf4e7d0, { roughness: 0.8 }), 0, 1.88, 0.5, R).scale.set(1, 0.75, 1);
}
{
  // Veiled princess: teal gown with a gold sash, lavender head scarf down the back, sheer face veil, gold circlet
  const P = riders.princess, gold = mat(0xe8b44a, { roughness: 0.3, metalness: 0.7 });
  part(new THREE.CylinderGeometry(0.11, 0.6, 1.3, 10), mat(0x1f7a80), 0, 0.78, 0.5, P);
  part(new THREE.TorusGeometry(0.27, 0.045, 6, 16), gold, 0, 1.05, 0.5, P).rotation.x = Math.PI / 2;
  part(new THREE.SphereGeometry(0.28, 12, 10), skin, 0, 1.6, 0.5, P);
  // head scarf: a hood over the crown and a long fall of cloth down the back
  const scarf = mat(0xb48ad0, { side: THREE.DoubleSide });
  // (sphere/cylinder angles: -z, the face, is at phi = 1.5*PI; the back half of a cylinder starts at theta = -PI/2)
  part(new THREE.SphereGeometry(0.34, 14, 8, Math.PI * 1.78, Math.PI * 1.44, 0, Math.PI * 0.6), scarf, 0, 1.62, 0.53, P);
  const fall = part(new THREE.CylinderGeometry(0.3, 0.5, 1.2, 12, 1, true, Math.PI * 1.5, Math.PI), scarf, 0, 1.08, 0.6, P);
  fall.rotation.x = -0.15; // hangs back a little, as if in the wind
  // sheer veil over the lower face (front is -z)
  const veil = part(new THREE.SphereGeometry(0.3, 12, 8, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.5, Math.PI * 0.35),
    mat(0xf6e6ee, { transparent: true, opacity: 0.7, side: THREE.DoubleSide }), 0, 1.6, 0.5, P);
  veil.rotation.y = Math.PI; // the segment is built facing +z; turn it to the face
  // gold circlet with a small gem on the forehead
  part(new THREE.TorusGeometry(0.3, 0.025, 6, 20), gold, 0, 1.76, 0.5, P).rotation.x = Math.PI / 2;
  part(new THREE.OctahedronGeometry(0.06, 0), mat(0x5fe0d6, { emissive: 0x1f6b66 }), 0, 1.78, 0.2, P);
}
export function setRider(kind) { for (const k in riders) riders[k].visible = k === kind; }
setRider('sultan');
{
  const c = document.createElement('canvas'); c.width = 128; c.height = 192; const g = c.getContext('2d');
  g.fillStyle = '#7a1f2b'; g.fillRect(0, 0, 128, 192);
  g.strokeStyle = '#ffcf63'; g.lineWidth = 7; g.strokeRect(5, 5, 118, 182);
  g.strokeStyle = '#5fe0d6'; g.lineWidth = 2; g.strokeRect(17, 17, 94, 158);
  for (let k = 0; k < 3; k++) {
    const cy = 48 + k * 48; g.fillStyle = k === 1 ? '#5fe0d6' : '#ff8a3d';
    g.beginPath(); g.moveTo(64, cy - 19); g.lineTo(84, cy); g.lineTo(64, cy + 19); g.lineTo(44, cy); g.closePath(); g.fill();
  }
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 5), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.9 }));
  player.add(carpet);
  const fm = new THREE.MeshBasicMaterial({ color: 0xffcf63 });
  for (const z of [-2.6, 2.6]) { const f = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 0.4), fm); f.position.z = z; player.add(f); }
  player.add(riders.sultan, riders.princess);
  const aura = addSprite(mats.mana, 7); aura.position.set(0, 0.3, 0); player.add(aura);
}

export function placePlayerAtCastle() {
  G.playerPos.set(W.CX, W.PH + G.castleTopY + 30, W.CZ);
  G.yaw = Math.atan2(W.CX, W.CZ); G.pitch = 0; G.roll = 0; G.speed = CFG.player.baseSpeed; G.strafe = 0; G.steerX = G.steerY = 0; camSmoothed = false;
}

// Lowest height the carpet's centre may have here: the centre keeps groundClearance above the ground, and each
// corner of the (tilted) carpet keeps cornerClearance above the ground beneath that corner.
const CORNERS = [[-1.7, 2.5], [1.7, 2.5], [-1.7, -2.5], [1.7, -2.5]].map(([x, z]) => new THREE.Vector3(x, 0, z));
const cEuler = new THREE.Euler(0, 0, 0, 'YXZ'), cTmp = new THREE.Vector3();
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

export function updatePlayer(dt) {
  const cp = CFG.player, I = G.input, keys = G.keys, P = G.playerPos;
  const kx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  const ky = (keys.ArrowUp ? 0.7 : 0) - (keys.ArrowDown ? 0.7 : 0);
  const sx = clamp(I.mouseX + I.touchX + kx, -1, 1), sy = clamp(I.mouseY + I.touchY + ky, -1, 1);
  const RS = cp.response; // how quickly steering, pitch, speed, strafe and roll follow the controls (per second)
  G.steerX = lerp(G.steerX, sx, Math.min(1, dt * RS.steer)); G.steerY = lerp(G.steerY, sy, Math.min(1, dt * RS.steer));
  G.yaw -= G.steerX * cp.turnRate * dt;
  G.pitch = lerp(G.pitch, G.steerY * cp.pitchMax, Math.min(1, dt * RS.pitch));
  const boost = keys.KeyW || keys.ShiftLeft || keys.ShiftRight || I.touchBoost, back = keys.KeyS || I.touchBack;
  G.surging = boost && !back;
  const want = back ? -cp.baseSpeed * cp.reverseMultiplier : boost ? cp.baseSpeed * cp.surgeMultiplier : cp.baseSpeed;
  G.speed = lerp(G.speed, want, Math.min(1, dt * RS.speed));
  const st = ((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0)) * cp.strafeSpeed;
  G.strafe = lerp(G.strafe, st, Math.min(1, dt * RS.strafe));
  G.roll = lerp(G.roll, -G.steerX * 0.6 - G.strafe / cp.strafeSpeed * 0.35, Math.min(1, dt * RS.roll));
  const cpi = Math.cos(G.pitch);
  G.fwd.set(-Math.sin(G.yaw) * cpi, Math.sin(G.pitch), -Math.cos(G.yaw) * cpi);
  G.rightV.set(Math.cos(G.yaw), 0, -Math.sin(G.yaw));
  G.playerVel.copy(G.fwd).multiplyScalar(G.speed).addScaledVector(G.rightV, G.strafe);
  P.addScaledVector(G.playerVel, dt);
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
