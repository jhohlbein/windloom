// Skeleton archers roam the open land in small groups and shoot arrows when they see the player. When one
// member spots the player or is hit, the whole group turns to fight. Fragile, present from the first stage.
// Gameplay numbers: config creatures.skeleton (single archer) and spawning.skeletons (groups).
import * as THREE from 'three';
import { CFG, hpFor } from '../config.js';
import { G, W } from '../state.js';
import { scene, addSprite, glowMat } from '../scene.js';
import { TAU, lerp, lerpAngle, wrapA } from '../util.js';
import { groundH, lineOfSight } from '../terrain.js';
import { C } from '../particles.js';
import { sfxAt } from '../audio.js';
import { addBolt } from '../combat.js';
import { baseEnemy, setHp, trackMat } from './common.js';

const boneGeo = new THREE.CylinderGeometry(1, 1, 1, 8), skullGeo = new THREE.SphereGeometry(1, 14, 10), jointGeo = new THREE.SphereGeometry(1, 8, 6);
const ribGeo = new THREE.TorusGeometry(1, 0.12, 4, 10, Math.PI * 1.5);
// Bow, built in the left arm's frame: grip at the origin (the hand), limbs along +-z (up and down when the arm
// points forward), bulging along -y (away from the archer). BOW_R is the arc radius, BOW_A half its angle.
const BOW_R = 0.62, BOW_A = Math.PI * 0.42;
const bowGeo = (() => {
  const g = new THREE.TorusGeometry(BOW_R, 0.035, 4, 14, BOW_A * 2);
  g.rotateZ(-BOW_A); g.translate(-BOW_R, 0, 0); // arc midpoint at the origin
  g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)));
  return g;
})();
const BOW_TIP = [0, -BOW_R * (Math.cos(BOW_A) - 1), BOW_R * Math.sin(BOW_A)]; // upper tip; the lower one has -z
const socketM = new THREE.MeshBasicMaterial({ color: 0x120a10 });
const arrowMat = glowMat(0xf2e3b8);
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

// A bone from a to b (local coordinates), as a thin cylinder
function bone(parent, mat, a, b, r) {
  const m = new THREE.Mesh(boneGeo, mat), d = tmp.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]), l = d.length();
  m.scale.set(r, l, r); m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.quaternion.setFromUnitVectors(tmp2.set(0, 1, 0), d.normalize()); parent.add(m); return m;
}
// A limb pivoting at `at`: a group whose bone hangs down by len and, if `lower` is given, a second group at its
// end (the knee or elbow) with a bone of that length. Rotating a group by +x swings it forward (-z).
function limb(parent, mat, at, len, r, lower) {
  const g = new THREE.Group(); g.position.set(...at); parent.add(g);
  bone(g, mat, [0, 0, 0], [0, -len, 0], r);
  if (!lower) return g;
  const low = new THREE.Group(); low.position.y = -len; g.add(low); bone(low, mat, [0, 0, 0], [0, -lower, 0], r * 0.9);
  const j = new THREE.Mesh(jointGeo, mat); j.scale.setScalar(r * 1.4); low.add(j); // the joint
  g.low = low; return g;
}

// A group: its centre (home) walks between points within roamRadius of where it started; members keep a
// loose formation around the centre. alertT > 0 while the group is fighting.
export function createSkeletonGroup(at) {
  return { home: new THREE.Vector3(at.x, 0, at.z), origin: new THREE.Vector3(at.x, 0, at.z), goal: null, wait: Math.random() * 4, alertT: 0, leader: null };
}
export function createSkeleton(pos, group) {
  const K = CFG.creatures.skeleton, e = baseEnemy('skeleton', 'Skeleton archer');
  const boneM = trackMat(e, new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.7 }));
  const bowM = trackMat(e, new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.8 }));
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.scale.setScalar(K.scale);
  // legs with knees, pelvis, spine, ribs, skull (model faces -z, 1 unit ~ 1 m before scaling)
  e.legL = limb(body, boneM, [-0.18, 0.95, 0], 0.5, 0.06, 0.45); e.legR = limb(body, boneM, [0.18, 0.95, 0], 0.5, 0.06, 0.45);
  bone(body, boneM, [-0.24, 0.98, 0], [0.24, 0.98, 0], 0.08);
  bone(body, boneM, [0, 0.98, 0], [0, 1.75, 0], 0.05);
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(ribGeo, boneM), s = 0.24 - i * 0.025;
    rib.scale.set(s, s * 0.8, s); rib.rotation.set(Math.PI / 2, 0, Math.PI * 0.75); rib.position.set(0, 1.62 - i * 0.12, -0.02); body.add(rib);
  }
  bone(body, boneM, [-0.26, 1.68, 0], [0.26, 1.68, 0], 0.05); // shoulders
  // the head turns on the neck (towards the carpet when it is in sight)
  const head = new THREE.Group(); head.position.set(0, 1.78, 0); body.add(head); e.head = head;
  const skull = new THREE.Mesh(skullGeo, boneM); skull.scale.set(0.17, 0.2, 0.19); skull.position.set(0, 0.17, 0); head.add(skull);
  for (const sx of [-0.065, 0.065]) { const s = new THREE.Mesh(skullGeo, socketM); s.scale.setScalar(0.045); s.position.set(sx, 0.19, -0.16); head.add(s); }
  const eyes = addSprite(glowMat(0xff5a2a), 0.22); eyes.position.set(0, 0.19, -0.2); head.add(eyes);
  // arms: the left holds the bow forward; the right draws the string, bending at the elbow
  e.armL = limb(body, boneM, [-0.27, 1.68, 0], 0.75, 0.05); e.armR = limb(body, boneM, [0.27, 1.68, 0], 0.38, 0.05, 0.36);
  const bow = new THREE.Group(); bow.position.set(0, -0.74, 0); e.armL.add(bow);
  bow.add(new THREE.Mesh(bowGeo, bowM));
  bone(bow, boneM, BOW_TIP, [BOW_TIP[0], BOW_TIP[1], -BOW_TIP[2]], 0.008); // string
  scene.add(root);

  Object.assign(e, { K, root, body, pos: new THREE.Vector3(), r: K.hitRadius });
  e.group = group; if (!group.leader) group.leader = e;
  e.offset = new THREE.Vector3(pos.x - group.home.x, 0, pos.z - group.home.z); // place in the formation
  root.position.set(pos.x, groundH(pos.x, pos.z), pos.z);
  e.heading = Math.random() * TAU;
  e.walk = 0; e.draw = 0; e.stride = 0; e.shootCd = 1 + Math.random() * 2; e.seeCd = Math.random() * 0.4; e.canSee = false;
  setHp(e, hpFor(K, G.level));
  e.dropN = K.drops; e.dropV = K.manaPerDrop;
  e.update = updateSkeleton;
  e.targetable = () => true; e.showBar = () => e.barT > 0 || e.canSee;
  e.hitTest = (p, rad) => p.distanceTo(e.pos) < e.r + rad;
  e.barPos = o => { o.copy(root.position); o.y += 2.4 * K.scale; return o; };
  e.radar = { c: '#efe4c8', s: 3 };
  syncPos(e);
  return e;
}
function syncPos(e) { e.pos.copy(e.root.position); e.pos.y += 1.3 * e.K.scale; } // hit centre: the ribcage

// Moves the group centre; called once per frame by the group's leader (any living member takes over)
function updateGroup(g, K, dt) {
  g.alertT = Math.max(0, g.alertT - dt);
  if (g.alertT > 0) return; // hold position while fighting
  if (!g.goal) {
    g.wait -= dt;
    if (g.wait > 0) return;
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * K.roamRadius;
    const gx = g.origin.x + Math.cos(a) * r, gz = g.origin.z + Math.sin(a) * r, h = groundH(gx, gz);
    const gentle = Math.abs(groundH(gx + 6, gz) - h) + Math.abs(groundH(gx, gz + 6) - h) < 4.5;
    if (h > 1.5 && gentle && Math.hypot(gx - W.CX, gz - W.CZ) > CFG.palace.wardRadius + 15) g.goal = new THREE.Vector3(gx, 0, gz);
    else g.wait = 0.5;
    return;
  }
  const dx = g.goal.x - g.home.x, dz = g.goal.z - g.home.z, d = Math.hypot(dx, dz);
  if (d < 1) { g.goal = null; g.wait = 4 + Math.random() * 6; return; }
  const step = Math.min(d, K.walkSpeed * 0.8 * dt); // a bit slower than the members, so they keep up
  g.home.x += dx / d * step; g.home.z += dz / d * step;
}

function updateSkeleton(e, dt) {
  const K = e.K, R = e.root.position, P = G.playerPos, g = e.group;
  e.t += dt; e.flash = Math.max(0, e.flash - dt);
  if (!g.leader || g.leader.hp <= 0) g.leader = e;
  if (g.leader === e) updateGroup(g, K, dt);
  const dx = P.x - R.x, dz = P.z - R.z, dist = Math.hypot(dx, dz, P.y - e.pos.y);
  e.seeCd -= dt;
  if (e.seeCd <= 0) { e.seeCd = 0.35 + Math.random() * 0.15; e.canSee = G.active && dist < K.sightRange && lineOfSight(e.pos, P); }
  if (G.active && (e.canSee || e.provoked)) { g.alertT = K.groupAlertSeconds; e.provoked = false; } // warn the group
  let moving = false;
  if (G.active && g.alertT > 0 && dist < K.sightRange * 1.5) {
    // face the player and shoot
    e.heading = lerpAngle(e.heading, Math.atan2(-dx, -dz), Math.min(1, dt * 5));
    e.shootCd -= dt;
    e.draw = Math.min(1, e.draw + dt / Math.max(0.3, K.fireIntervalSeconds * 0.5));
    if (e.canSee && e.shootCd <= 0 && dist < K.fireRange) {
      e.shootCd = K.fireIntervalSeconds * (0.8 + Math.random() * 0.4); e.draw = 0;
      const start = tmp.copy(e.pos); start.y += 0.4 * K.scale;
      const T = dist / K.arrowSpeed, g = 9;
      const to = tmp2.copy(P).addScaledVector(G.playerVel, T * 0.7);
      const v = new THREE.Vector3((to.x - start.x) / T, (to.y - start.y) / T + 0.5 * g * T, (to.z - start.z) / T);
      addBolt(arrowMat, 2.6, start, v, K.arrowDamage, g, C.DUST, T + 1);
      sfxAt('bow', e.pos, 260);
    }
  } else {
    // keep its place in the group's formation
    e.draw = Math.max(0, e.draw - dt * 2);
    const gx = g.home.x + e.offset.x - R.x, gz = g.home.z + e.offset.z - R.z, gd = Math.hypot(gx, gz);
    if (gd > 1.2) {
      e.heading = lerpAngle(e.heading, Math.atan2(-gx, -gz), Math.min(1, dt * 4));
      const step = Math.min(gd, K.walkSpeed * (gd > 8 ? 1.5 : 1) * dt);
      R.x += gx / gd * step; R.z += gz / gd * step; moving = true;
    }
  }
  R.y = groundH(R.x, R.z);
  e.root.rotation.y = e.heading;
  // animation: a walk with bending knees and a bob (eased in and out), bow raised while aiming, the draw arm
  // folding at the elbow, the head turned towards the carpet while it is in sight
  e.stride = lerp(e.stride, moving ? 1 : 0, Math.min(1, dt * 6));
  e.walk += dt * 7 * e.stride;
  const sw = Math.sin(e.walk) * 0.5 * e.stride, st = e.stride;
  e.legL.rotation.x = sw; e.legR.rotation.x = -sw;
  e.legL.low.rotation.x = -Math.max(0, Math.sin(e.walk - 1.2)) * 1.1 * st; e.legR.low.rotation.x = -Math.max(0, Math.sin(e.walk + Math.PI - 1.2)) * 1.1 * st;
  e.body.position.y = Math.abs(Math.cos(e.walk)) * 0.07 * K.scale * st; e.body.rotation.x = 0.07 * st; // bob and a slight lean
  const aim = Math.min(1, e.draw * 1.5 + (e.canSee ? 0.4 : 0));
  // +x rotation swings a hanging arm forward (-z); the right upper arm comes forward and its forearm folds back,
  // bringing the hand to the cheek as the draw completes
  e.armL.rotation.x = Math.PI / 2 * aim - sw * 0.4;
  e.armR.rotation.x = Math.PI / 2 * aim * (1 - 0.2 * e.draw) + sw * 0.4;
  e.armR.low.rotation.x = 2.1 * aim * (0.3 + 0.7 * e.draw);
  e.armL.rotation.z = -0.25 * aim; e.armR.rotation.z = 0.45 * aim; // both hands in front of the chest
  const lookY = e.canSee ? Math.max(-1.1, Math.min(1.1, wrapA(Math.atan2(-dx, -dz) - e.heading))) : 0;
  e.head.rotation.y = lerpAngle(e.head.rotation.y, lookY, Math.min(1, dt * 4));
  e.body.rotation.z = Math.sin(e.t * 1.7) * 0.03;
  syncPos(e);
}
