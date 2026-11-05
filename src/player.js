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
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.55, 1.3, 8), new THREE.MeshStandardMaterial({ color: 0x2b2f7a, roughness: 0.9 })); robe.position.set(0, 0.78, 0.5); player.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd9b28f, roughness: 0.9 })); head.position.set(0, 1.6, 0.5); player.add(head);
  const turban = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf4e7d0, roughness: 0.8 })); turban.scale.set(1, 0.75, 1); turban.position.set(0, 1.88, 0.5); player.add(turban);
  const aura = addSprite(mats.mana, 7); aura.position.set(0, 0.3, 0); player.add(aura);
}

export function placePlayerAtCastle() {
  G.playerPos.set(W.CX, W.PH + G.castleTopY + 30, W.CZ);
  G.yaw = Math.atan2(W.CX, W.CZ); G.pitch = 0; G.roll = 0; G.speed = CFG.player.baseSpeed; G.strafe = 0; G.steerX = G.steerY = 0; camSmoothed = false;
}

export function updatePlayer(dt) {
  const cp = CFG.player, I = G.input, keys = G.keys, P = G.playerPos;
  const kx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  const ky = (keys.ArrowUp ? 0.7 : 0) - (keys.ArrowDown ? 0.7 : 0);
  const sx = clamp(I.mouseX + I.touchX + kx, -1, 1), sy = clamp(I.mouseY + I.touchY + ky, -1, 1);
  G.steerX = lerp(G.steerX, sx, Math.min(1, dt * 8)); G.steerY = lerp(G.steerY, sy, Math.min(1, dt * 8));
  G.yaw -= G.steerX * cp.turnRate * dt;
  G.pitch = lerp(G.pitch, G.steerY * cp.pitchMax, Math.min(1, dt * 3));
  const boost = keys.KeyW || keys.ShiftLeft || keys.ShiftRight || I.touchBoost, back = keys.KeyS || I.touchBack;
  const want = back ? -cp.baseSpeed * cp.reverseMultiplier : boost ? cp.baseSpeed * cp.surgeMultiplier : cp.baseSpeed;
  G.speed = lerp(G.speed, want, Math.min(1, dt * (back ? 1.6 : 2)));
  const st = ((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0)) * cp.strafeSpeed;
  G.strafe = lerp(G.strafe, st, Math.min(1, dt * 4));
  G.roll = lerp(G.roll, -G.steerX * 0.6 - G.strafe / cp.strafeSpeed * 0.35, Math.min(1, dt * 4));
  const cpi = Math.cos(G.pitch);
  G.fwd.set(-Math.sin(G.yaw) * cpi, Math.sin(G.pitch), -Math.cos(G.yaw) * cpi);
  G.rightV.set(Math.cos(G.yaw), 0, -Math.sin(G.yaw));
  G.playerVel.copy(G.fwd).multiplyScalar(G.speed).addScaledVector(G.rightV, G.strafe);
  P.addScaledVector(G.playerVel, dt);
  const gy = groundH(P.x, P.z) + 2.6;
  let skim = P.y - gy;
  if (skim < 0) { P.y = gy; skim = 0; }
  if (P.y > CFG.world.ceiling) P.y = CFG.world.ceiling;
  const r = Math.hypot(P.x, P.z), B = CFG.world.boundRadius;
  if (r > B) {
    P.x *= B / r; P.z *= B / r;
    if (G.wallToast <= 0) { toast('A sandstorm turns you back', 1800); G.wallToast = 4; }
  }
  player.position.copy(P); player.rotation.set(G.pitch, G.yaw, G.roll);
  if (skim < 7 && Math.random() < 0.8) {
    const wet = terrainH(P.x, P.z) < 0.5;
    emit(P.x + (Math.random() - 0.5) * 2, gy - 2.4, P.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 6 - G.playerVel.x * 0.1, 3 + Math.random() * 4, (Math.random() - 0.5) * 6 - G.playerVel.z * 0.1, wet ? C.SPRAY : C.DUST, 2.2, 0.7);
  }
  const tail = G.speed >= 0 ? -2.4 : 2.4;
  emit(P.x + G.fwd.x * tail, P.y + G.fwd.y * tail - 0.2, P.z + G.fwd.z * tail, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, C.MANA, 1.2, 0.6);
  if (G.playTime - G.lastHurt > cp.regenDelaySeconds && G.hp < G.maxHp) G.hp = Math.min(G.maxHp, G.hp + cp.regenPerSecond * dt);
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
  const want = tA.copy(P).addScaledVector(G.fwd, -13); want.y += 4.4;
  const gy = groundH(want.x, want.z) + 3; if (want.y < gy) want.y = gy;
  const look = tB.copy(P).addScaledVector(G.fwd, 26);
  if (!camSmoothed) { camera.position.copy(want); camLook.copy(look); camSmoothed = true; }
  const k = 1 - Math.exp(-dt * 7);
  camera.position.lerp(want, k); camLook.lerp(look, k);
  camera.lookAt(camLook);
  const base = CFG.player.baseSpeed;
  const fov = 72 + clamp((G.speed - base) / (base * 0.85), 0, 1) * 9;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 3)); camera.updateProjectionMatrix(); }
}
