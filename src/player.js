// The rider on the carpet: model, flight model and chase camera.
import * as THREE from 'three';
import { CFG } from './config.js';
import { settings } from './settings.js';
import { G, W } from './state.js';
import { scene, camera, castShadows, addSprite, glowMat, glowTex } from './scene.js';
import { clamp, lerp } from './util.js';
import { terrainH, groundH } from './terrain.js';
import { emit, C } from './particles.js';
import { toast } from './hud.js';
import { sfx } from './audio.js';
import { castFire, castNova } from './combat.js';
import { castle, palace } from './palace.js';

const player = new THREE.Group(); player.rotation.order = 'YXZ'; scene.add(player);

/* ---------- riders (chosen in Settings); both sit at the back of the carpet, facing -z ---------- */
// Everything visible hangs under `rig`, which bobs and sways on its own; `player` carries the flight transform.
const rig = new THREE.Group(); player.add(rig);
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
const skin = mat(0xd9b28f, { roughness: 0.9 }), gold = mat(0xe8b44a, { roughness: 0.3, metalness: 0.7 });
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
// A limb: a group pivoting at `at`, with a bone of length len hanging down (-y) and, if `lower` is given, a second
// group at its end with a bone of that length (the elbow or knee). Rotating a group by +x swings it forward (-z).
function limb(parent, material, at, len, r, lower, lowerMat = material) {
  const g = new THREE.Group(); g.position.set(...at); parent.add(g);
  const bone = (par, l, rr, m) => { const geo = new THREE.CylinderGeometry(rr * 0.8, rr, l, 7); geo.translate(0, -l / 2, 0); return part(geo, m, 0, 0, 0, par); };
  bone(g, len, r, material);
  if (!lower) return { up: g, low: null };
  const low = new THREE.Group(); low.position.y = -len; g.add(low); bone(low, lower, r * 0.85, lowerMat);
  return { up: g, low };
}
// Seated arms, with hands (and a glow in the right palm for casting), and crossed legs with pointed slippers.
// Shoulders at y = sh; the knees come forward of the robe so the figure reads as sitting cross-legged.
function seatedBody(R, sleeve, trouser, slipper, sh, cuff) {
  const hand = new THREE.SphereGeometry(0.075, 8, 6), U = {};
  for (const sd of [-1, 1]) {
    const arm = limb(R, sleeve, [sd * 0.3, sh, 0.48], 0.42, 0.085, 0.4, sleeve);
    if (cuff) part(new THREE.TorusGeometry(0.085, 0.022, 5, 10), cuff, 0, -0.36, 0, arm.low).rotation.x = Math.PI / 2;
    const h = part(hand, skin, 0, -0.43, 0, arm.low);
    arm.up.rotation.set(0.55, 0, sd * 0.18); arm.low.rotation.x = 1.0; // forearms forward, hands near the knees
    if (sd > 0) { U.armR = arm; U.palm = addSprite(glowMat(0xffa040), 0.001); U.palm.position.y = -0.08; h.add(U.palm); } else U.armL = arm;
    if (trouser) {
      const leg = limb(R, trouser, [sd * 0.2, 0.42, 0.42], 0.44, 0.11, 0.4, trouser);
      leg.up.rotation.set(1.3, 0, sd * 0.5); leg.low.rotation.set(0, 0, -sd * 1.9); // thighs forward and a little out, shins crossed in front
      part(new THREE.ConeGeometry(0.07, 0.26, 6), slipper, 0, -0.42, -0.04, leg.low).rotation.set(-Math.PI / 2, 0, 0);
    } else part(new THREE.ConeGeometry(0.07, 0.26, 6), slipper, sd * 0.16, 0.17, 0.0, R).rotation.set(-Math.PI / 2, 0, -sd * 0.25); // slippers peeking out of the gown
  }
  return U;
}
const riders = { sultan: new THREE.Group(), princess: new THREE.Group() };
{
  // Turbaned prince: deep blue robe with an ember vest and gold sash, a cream turban with a wrapped band, a teal
  // plume and a jewel; the turban's loose end streams behind
  const R = riders.sultan, cloth = mat(0xf4e7d0, { roughness: 0.8, side: THREE.DoubleSide }), robe = mat(0x2b2f7a, { roughness: 0.9 }), trouser = mat(0x3d4fb0, { roughness: 0.9 });
  part(new THREE.CylinderGeometry(0.12, 0.42, 1.3, 10), robe, 0, 0.78, 0.5, R);
  part(new THREE.CylinderGeometry(0.26, 0.34, 0.42, 10, 1, true), mat(0xc8582a, { roughness: 0.8, side: THREE.DoubleSide }), 0, 1.12, 0.5, R); // vest
  part(new THREE.TorusGeometry(0.33, 0.045, 6, 16), gold, 0, 0.9, 0.5, R).rotation.x = Math.PI / 2; // sash
  const head = new THREE.Group(); head.position.set(0, 1.6, 0.5); R.add(head);
  part(new THREE.SphereGeometry(0.3, 10, 8), skin, 0, 0, 0, head);
  part(new THREE.ConeGeometry(0.1, 0.22, 6), mat(0x2a1a14), 0, -0.3, -0.16, head).rotation.x = 0.35; // beard
  part(new THREE.SphereGeometry(0.42, 10, 8), cloth, 0, 0.28, 0, head).scale.set(1, 0.75, 1);
  part(new THREE.TorusGeometry(0.4, 0.05, 6, 18), cloth, 0, 0.3, 0, head).rotation.x = Math.PI / 2; // wrapped band
  part(new THREE.SphereGeometry(0.07, 8, 6), mat(0x5fe0d6, { emissive: 0x1f6b66 }), 0, 0.3, -0.41, head); // jewel
  part(new THREE.ConeGeometry(0.035, 0.4, 5), mat(0x5fe0d6, { roughness: 0.6 }), 0, 0.68, -0.26, head).rotation.x = 0.5; // plume, swept back
  R.userData = { head, ...seatedBody(R, robe, trouser, gold, 1.3, null), tails: [{ j: streamer(head, cloth, [0.12, 0.18, 0.34], 0.2, 6, 0.24), droop: 0.55, phase: 0 }] };
}
{
  // Veiled princess: teal gown with a gold sash and cuffs, lavender head scarf down the back, sheer face veil,
  // gold circlet; slippers peek out of the gown
  const P = riders.princess, gown = mat(0x1f7a80);
  part(new THREE.CylinderGeometry(0.11, 0.6, 1.3, 10), gown, 0, 0.78, 0.5, P);
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
  P.userData = { head, fallPivot, veil, ...seatedBody(P, gown, null, gold, 1.3, gold), tails: [
    { j: streamer(head, scarf, [-0.12, 0.05, 0.3], 0.16, 5, 0.26), droop: 0.7, phase: 0 },
    { j: streamer(head, scarf, [0.13, 0.0, 0.3], 0.14, 5, 0.24), droop: 0.75, phase: 1.7 },
    { j: streamer(P, sash, [0.18, 1.05, 0.78], 0.09, 5, 0.2, 0.9), droop: 0.9, phase: 3.1 }
  ] };
}
export function setRider(kind) { for (const k in riders) riders[k].visible = k === kind; }
setRider('sultan');
/* ---------- the carpet ---------- */
// A subdivided slab whose vertices ripple every frame (see animateRig), with a woven medallion design painted
// once onto a canvas: maroon field, gold border with ink lozenges, teal guard stripes, corner spandrels and a
// lobed central medallion with an eight-pointed star. Tassels hang from the front and back edges.
const carpetGeo = new THREE.BoxGeometry(3.4, 0.14, 5, 8, 1, 14), carpetBase = carpetGeo.attributes.position.array.slice();
const fringes = [], TASSELS = 12;
let tassels = null;
function carpetTexture() {
  const Wd = 256, Hd = 384, c = document.createElement('canvas'); c.width = Wd; c.height = Hd; const g = c.getContext('2d');
  const MAROON = '#7a1f2b', GOLD = '#ffcf63', TEAL = '#5fe0d6', EMBER = '#ff8a3d', INK = '#140f22', WINE = '#5e1521';
  g.fillStyle = MAROON; g.fillRect(0, 0, Wd, Hd);
  // the weave: faint horizontal threads and a scatter of slightly lighter and darker knots
  g.fillStyle = 'rgba(20,15,34,.10)'; for (let y = 0; y < Hd; y += 3) g.fillRect(0, y, Wd, 1);
  for (let i = 0; i < 2600; i++) { g.fillStyle = i & 1 ? 'rgba(255,207,99,.07)' : 'rgba(20,15,34,.12)'; g.fillRect(Math.random() * Wd, Math.random() * Hd, 2, 2); }
  const star = (x, y, r, fill, stroke) => { // eight-pointed star
    g.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 - Math.PI / 2, rr = i & 1 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke(); }
  };
  const lozenge = (x, y, w, h, fill) => { g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + w, y); g.lineTo(x, y + h); g.lineTo(x - w, y); g.closePath(); g.fillStyle = fill; g.fill(); };
  // border: a gold band with a row of ink lozenges, inside it a teal guard stripe and a thin gold line
  g.strokeStyle = GOLD; g.lineWidth = 16; g.strokeRect(10, 10, Wd - 20, Hd - 20);
  g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(2.5, 2.5, Wd - 5, Hd - 5); g.strokeRect(18.5, 18.5, Wd - 37, Hd - 37);
  for (let x = 24; x < Wd - 12; x += 16) { lozenge(x, 10, 5, 4, INK); lozenge(x, Hd - 10, 5, 4, INK); }
  for (let y = 24; y < Hd - 12; y += 16) { lozenge(10, y, 4, 5, INK); lozenge(Wd - 10, y, 4, 5, INK); }
  g.strokeStyle = TEAL; g.lineWidth = 3; g.strokeRect(24, 24, Wd - 48, Hd - 48);
  g.strokeStyle = GOLD; g.lineWidth = 1; g.strokeRect(31.5, 31.5, Wd - 63, Hd - 63);
  // corner spandrels: quarter-lobes in wine with a gold edge
  for (const [cx, cy] of [[32, 32], [Wd - 32, 32], [32, Hd - 32], [Wd - 32, Hd - 32]]) {
    g.beginPath(); g.moveTo(cx, cy);
    const sx = cx < Wd / 2 ? 1 : -1, sy = cy < Hd / 2 ? 1 : -1;
    g.lineTo(cx + sx * 62, cy); g.quadraticCurveTo(cx + sx * 50, cy + sy * 20, cx + sx * 44, cy + sy * 44); g.quadraticCurveTo(cx + sx * 20, cy + sy * 50, cx, cy + sy * 62); g.closePath();
    g.fillStyle = WINE; g.fill(); g.strokeStyle = GOLD; g.lineWidth = 2; g.stroke();
    star(cx + sx * 26, cy + sy * 26, 9, TEAL, null);
  }
  // central medallion: a lobed disc on a diamond, with an eight-pointed star and a pendant above and below
  const mx = Wd / 2, my = Hd / 2;
  lozenge(mx, my, 70, 118, WINE); g.strokeStyle = GOLD; g.lineWidth = 2; g.stroke();
  g.beginPath(); for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, r = 52 + 6 * Math.cos(a * 12); g.lineTo(mx + Math.cos(a) * r, my + Math.sin(a) * r); }
  g.closePath(); g.fillStyle = TEAL; g.fill(); g.strokeStyle = GOLD; g.lineWidth = 2.5; g.stroke();
  g.beginPath(); g.arc(mx, my, 38, 0, Math.PI * 2); g.fillStyle = MAROON; g.fill(); g.strokeStyle = GOLD; g.lineWidth = 1.5; g.stroke();
  star(mx, my, 30, GOLD, INK); star(mx, my, 12, EMBER, null);
  for (const dy of [-100, 100]) { lozenge(mx, my + dy, 12, 16, GOLD); lozenge(mx, my + dy, 6, 9, TEAL); }
  // small stars in the field between the medallion and the spandrels
  for (const [x, y] of [[70, 110], [Wd - 70, 110], [70, Hd - 110], [Wd - 70, Hd - 110]]) star(x, y, 8, GOLD, null);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
{
  const carpet = new THREE.Mesh(carpetGeo, new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 0.92 }));
  rig.add(carpet);
  // knotted end bands, and tassels hanging from them (one instanced mesh; placed every frame by animateRig)
  const fm = new THREE.MeshStandardMaterial({ color: 0xffcf63, roughness: 0.6 });
  for (const z of [-2.55, 2.55]) { const f = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.22), fm); f.position.z = z; rig.add(f); fringes.push(f); }
  const tg = new THREE.CylinderGeometry(0.014, 0.028, 0.3, 5); tg.translate(0, -0.15, 0);
  tassels = new THREE.InstancedMesh(tg, fm, TASSELS * 2); rig.add(tassels);
  // a soft golden lift under the carpet (the magic that carries it), brighter at speed
  rig.add(riders.sultan, riders.princess);
}
const lift = addSprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb21f, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.2 }), 6);
lift.position.y = -0.9; rig.add(lift);
castShadows(player); // after every part is attached (it only marks what is already in the tree)

// Visual motion only (no effect on flight or collision): the carpet ripples like cloth from front to back,
// more at speed and towards the trailing edge; the whole rig bobs; riders lean with speed and turns, and
// their loose cloth (turban end, scarf, sash) flutters and streams back. Casting a fireball throws the right
// hand forward with a glow in the palm; a nova spreads both arms.
let animT = 0;
const tM = new THREE.Matrix4(), tP = new THREE.Vector3(), tQ = new THREE.Quaternion(), tS = new THREE.Vector3(1, 1, 1), tE = new THREE.Euler();
function carpetWave(x, z, amp) {
  const back = (z + 2.5) / 5; // 0 at the front edge, 1 at the back
  return amp * Math.sin(z * 1.25 - animT * (5 + 4 * amp)) * (0.25 + 0.75 * back)
    + amp * 0.35 * (x / 1.7) * (x / 1.7) * Math.sin(animT * 3.3 + z * 0.8); // the side edges curl a little
}
function animateRig(dt) {
  animT += dt;
  const t = animT, s = clamp(Math.abs(G.speed) / CFG.player.baseSpeed, 0, 1);
  const amp = 0.05 + 0.04 * s; // only a little more ripple at speed
  const pos = carpetGeo.attributes.position, a = pos.array;
  for (let i = 0; i < a.length; i += 3) a[i + 1] = carpetBase[i + 1] + carpetWave(carpetBase[i], carpetBase[i + 2], amp);
  pos.needsUpdate = true; carpetGeo.computeVertexNormals();
  for (const f of fringes) f.position.y = carpetWave(0, Math.sign(f.position.z) * 2.5, amp);
  // tassels: hang from the end bands, blown back (+z) with speed, swinging a little
  const stream = G.speed < 0 ? 0 : s, back = G.speed < 0 ? 1 : 0;
  for (let k = 0; k < TASSELS * 2; k++) {
    const z = k < TASSELS ? -2.5 : 2.5, x = -1.5 + 3 * ((k % TASSELS) / (TASSELS - 1));
    tP.set(x, carpetWave(x, z, amp) - 0.04, Math.sign(z) * 2.58);
    tE.set(-(0.35 + 1.0 * stream) + (0.35 + 0.9 * s) * back + Math.sin(t * 6.5 + x * 2.1 + z) * 0.12 * (0.5 + s), 0, Math.sin(t * 5.2 + k) * 0.08);
    tQ.setFromEuler(tE); tM.compose(tP, tQ, tS); tassels.setMatrixAt(k, tM);
  }
  tassels.instanceMatrix.needsUpdate = true;
  lift.material.opacity = 0.12 + 0.18 * s + 0.04 * Math.sin(t * 9); lift.scale.setScalar(5 + 2 * s);
  rig.position.y = Math.sin(t * 1.7) * 0.12;
  rig.rotation.x = Math.sin(t * 1.1 + 1) * 0.025; rig.rotation.z = Math.sin(t * 1.3) * 0.03;
  G.castFx = Math.max(0, G.castFx - dt * 3.5); G.novaFx = Math.max(0, G.novaFx - dt * 1.4);
  const cast = Math.min(1, G.castFx * 1.6), nova = Math.min(1, G.novaFx * 2.5);
  for (const k in riders) {
    const R = riders[k], U = R.userData; if (!R.visible) continue;
    R.position.y = carpetWave(0, 0.5, amp);
    R.rotation.x = lerp(R.rotation.x, -0.1 * s + (G.speed < 0 ? 0.12 : 0), Math.min(1, dt * 4));  // lean into speed
    R.rotation.z = lerp(R.rotation.z, -G.steerX * 0.14, Math.min(1, dt * 5));                  // and into turns
    U.head.rotation.y = lerp(U.head.rotation.y, -G.steerX * 0.35, Math.min(1, dt * 4));         // look into the turn
    U.head.rotation.x = Math.sin(t * 1.9) * 0.04;
    // arms: at rest the hands lie near the knees; the right arm throws forward to cast, both rise for a nova
    const sway = Math.sin(t * 1.9) * 0.04, kA = Math.min(1, dt * 14);
    const upR = lerp(lerp(0.55 + sway, 1.45, cast), 1.25, nova), lowR = lerp(lerp(1.0, 0.15, cast), 0.3, nova);
    const upL = lerp(0.55 - sway, 1.25, nova), lowL = lerp(1.0, 0.3, nova);
    U.armR.up.rotation.x = lerp(U.armR.up.rotation.x, upR, kA); U.armR.low.rotation.x = lerp(U.armR.low.rotation.x, lowR, kA);
    U.armL.up.rotation.x = lerp(U.armL.up.rotation.x, upL, kA); U.armL.low.rotation.x = lerp(U.armL.low.rotation.x, lowL, kA);
    U.armR.up.rotation.z = lerp(U.armR.up.rotation.z, 0.18 + 0.7 * nova - 0.25 * cast, kA); U.armL.up.rotation.z = lerp(U.armL.up.rotation.z, -0.18 - 0.7 * nova, kA);
    const glow = Math.max(cast * 1.4, nova * 1.0); U.palm.scale.set(0.001 + glow, 0.001 + glow, 1);
    const fl = 0.1 + 0.08 * s; // trailing cloth lifts with speed and flutters faster
    for (const tl of U.tails) tl.j.forEach((j, i) => {
      j.rotation.x = (i ? 0.12 : tl.droop) * (1 - 0.85 * stream) + Math.sin(t * (6 + 2.5 * s) - i * 1.1 + tl.phase) * fl * (0.4 + i * 0.15);
      j.rotation.y = Math.sin(t * (4.5 + 1.5 * s) - i * 0.9 + tl.phase) * 0.07 * (0.6 + 0.4 * s);
    });
    if (U.fallPivot) U.fallPivot.rotation.x = -0.15 - 0.45 * stream + Math.sin(t * (5 + 2 * s)) * 0.035 * (0.6 + 0.4 * s);
    if (U.veil) U.veil.rotation.x = Math.sin(t * (7 + 2 * s)) * 0.02 * (0.5 + 0.5 * s);
  }
}

// Start (and after a fall): just below the ceiling on the far side of the palace from the island's centre, inside the
// beam's reach and facing across the palace and its beam towards the island (the palace is taller than the ceiling)
export function placePlayerAtCastle() {
  const d = Math.hypot(W.CX, W.CZ), ux = d > 1 ? W.CX / d : 0, uz = d > 1 ? W.CZ / d : 1, back = 27;
  G.yaw = Math.atan2(ux, uz);
  G.playerPos.set(W.CX + ux * back, Math.min(CFG.world.ceiling - 3, W.PH + G.castleTopY + 30), W.CZ + uz * back); G.pitch = 0; G.bodyPitch = 0; G.keyPitch = 0; G.roll = 0; G.speed = 0; G.strafe = 0; G.steerX = G.steerY = 0; camSmoothed = false;
}

// Lowest height the carpet's centre may have here: the centre keeps groundClearance above the ground, and each
// corner of the (tilted) carpet keeps cornerClearance above the ground beneath that corner.
const CORNERS = [[-1.7, 2.5], [1.7, 2.5], [-1.7, -2.5], [1.7, -2.5]].map(([x, z]) => new THREE.Vector3(x, 0, z));
const cEuler = new THREE.Euler(0, 0, 0, 'YXZ'), cTmp = new THREE.Vector3();
function groundFloor(P) {
  const cp = CFG.player;
  let floor = groundH(P.x, P.z) + cp.groundClearance;
  cEuler.set(G.bodyPitch, G.yaw, G.roll);
  for (const c of CORNERS) {
    cTmp.copy(c).applyEuler(cEuler);
    floor = Math.max(floor, groundH(P.x + cTmp.x, P.z + cTmp.z) + cp.cornerClearance - cTmp.y);
  }
  return floor;
}

// Palace and creature collision. The carpet is treated as a sphere of radius PR. Coming from above, it rides on roofs and
// domes; from the side, it is pushed out of walls and towers and slides along them.
const PR = 2.6;
const cPrev = new THREE.Vector3();
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

// Height mode 'hold': the height to fly at, hoverHeight above the highest surface (ground, or a palace roof or
// tower) under the carpet and along its path for lookAheadSeconds, so it starts to rise before a slope; never above
// the ceiling (taller ground is a wall, see below)
function surfaceTop(x, z) {
  let h = groundH(x, z);
  const cx = castle.position.x, cy = castle.position.y, cz = castle.position.z;
  for (const c of palace.colliders) {
    const lx = x - cx - c.x, lz = z - cz - c.z;
    const inside = c.cyl ? Math.hypot(lx, lz) < c.r + PR : Math.abs(lx) < c.hx + PR && Math.abs(lz) < c.hz + PR;
    if (inside) h = Math.max(h, cy + c.top);
  }
  return h;
}
function holdTarget(P) {
  const A = CFG.player.altitude, v = G.playerVel, hs = Math.hypot(v.x, v.z);
  let top = surfaceTop(P.x, P.z);
  if (hs > 1) {
    const L = Math.max(8, hs * A.lookAheadSeconds), ux = v.x / hs, uz = v.z / hs;
    for (let i = 1; i <= 6; i++) top = Math.max(top, surfaceTop(P.x + ux * L * i / 6, P.z + uz * L * i / 6));
  }
  return Math.min(CFG.world.ceiling, top + A.hoverHeight);
}

let throttleHeld = false;
export function updatePlayer(dt) {
  const cp = CFG.player, I = G.input, keys = G.keys, P = G.playerPos;
  const CK = CFG.controls.keys, hold = cp.altitude.mode === 'hold';
  // Arrow keys, finely: a turn builds up while ← or → is held (a tap is a small correction, held it reaches a full
  // turn after turnRampSeconds). In 'hold' mode ↑ ↓ move the nose gradually; let go and it eases back to level with
  // the time constant levelTimeConstant (0 leaves it where it is). In 'free' mode they climb and dive while held.
  const kx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), kyHeld = ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * (settings.invertKeys ? -1 : 1);
  if (!kx || kx !== G.keyTurnDir) G.keyTurn = kx ? CK.turnStart : 0;
  else G.keyTurn = Math.min(1, G.keyTurn + dt * (1 - CK.turnStart) / CK.turnRampSeconds);
  G.keyTurnDir = kx;
  if (!hold) G.keyPitch = 0;
  else if (kyHeld) G.keyPitch = clamp(G.keyPitch + kyHeld * dt / CK.pitchSeconds, -1, 1);
  else if (CK.levelTimeConstant > 0) G.keyPitch *= Math.exp(-dt / CK.levelTimeConstant);
  const ky = hold ? G.keyPitch : kyHeld * 0.7;
  // Touch drag and tilt: a softer response near the centre (exponent controls.expo) for fine adjustments
  const ex = v => Math.sign(v) * Math.pow(Math.abs(v), CFG.controls.expo);
  const sx = clamp(I.mouseX + ex(I.touchX) + ex(I.tiltX) + kx * G.keyTurn, -1, 1), sy = clamp(I.mouseY * (settings.invertMouse ? -1 : 1) + ex(I.touchY) + ex(I.tiltY) + ky, -1, 1);
  const RS = cp.response; // how quickly steering, pitch, speed, strafe and roll follow the controls (per second)
  G.steerX = lerp(G.steerX, sx, Math.min(1, dt * RS.steer)); G.steerY = lerp(G.steerY, sy, Math.min(1, dt * RS.steer));
  G.yaw -= G.steerX * cp.turnRate * dt;
  G.pitch = lerp(G.pitch, G.steerY * (G.steerY > 0 ? cp.pitchMaxUp : cp.pitchMaxDown), Math.min(1, dt * RS.pitch)); // the nose points further up than down
  // Throttle: W (or the pad's up arrow) speeds the carpet up to baseSpeed; let go and it keeps its speed, but never drops
  // below minSpeed (0: it can rest). S (or the pad's down arrow) brakes, then flies backwards; let go and it comes back to minSpeed.
  const T = cp.throttle, fwd = !!(keys.KeyW || I.touchBoost), back = keys.KeyS || I.touchBack;
  if (fwd && !throttleHeld && G.speed < cp.baseSpeed * 0.6) sfx('whoosh', 0.9); // the throttle engaging from a glide
  throttleHeld = fwd;
  const want = back ? -cp.baseSpeed * cp.reverseMultiplier : fwd ? cp.baseSpeed : Math.max(G.speed, T.minSpeed);
  const rate = want > G.speed && G.speed >= 0 ? T.acceleration : T.brakeDeceleration;
  G.speed = G.speed < want ? Math.min(want, G.speed + rate * dt) : Math.max(want, G.speed - rate * dt);
  const st = ((keys.KeyD || I.touchRight ? 1 : 0) - (keys.KeyA || I.touchLeft ? 1 : 0)) * cp.strafeSpeed;
  G.strafe = lerp(G.strafe, st, Math.min(1, dt * RS.strafe));
  G.roll = lerp(G.roll, -G.steerX * 0.6 - G.strafe / cp.strafeSpeed * 0.35, Math.min(1, dt * RS.roll));
  const cpi = Math.cos(G.pitch);
  G.fwd.set(-Math.sin(G.yaw) * cpi, Math.sin(G.pitch), -Math.cos(G.yaw) * cpi);
  G.rightV.set(Math.cos(G.yaw), 0, -Math.sin(G.yaw));
  // Height: in 'hold' mode the carpet flies level and keeps hoverHeight above the ground by itself, and up/down only
  // turn the view and aim (G.fwd); in 'free' mode the carpet flies where it points, so up/down climb and dive
  if (hold) G.playerVel.set(-Math.sin(G.yaw) * G.speed, 0, -Math.cos(G.yaw) * G.speed).addScaledVector(G.rightV, G.strafe);
  else G.playerVel.copy(G.fwd).multiplyScalar(G.speed).addScaledVector(G.rightV, G.strafe);
  const prevX = P.x, prevY = P.y, prevZ = P.z;
  P.addScaledVector(G.playerVel, dt);
  if (hold) {
    const A = cp.altitude, vy = clamp((holdTarget(P) - P.y) * A.response, -A.sinkRate, A.climbRate);
    P.y += vy * dt; G.playerVel.y = vy;
  }
  G.bodyPitch = G.pitch; // the nose shows where you aim (in 'free' mode also where you fly)
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
  player.position.copy(P); player.rotation.set(G.bodyPitch, G.yaw, G.roll);
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

const camLook = new THREE.Vector3(), tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3();
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
  // In 'hold' mode the camera stays nearly level behind the carpet and follows the nose only by pitchFollow, so
  // up/down tip the nose to aim rather than swing the view; in 'free' mode it looks where the carpet flies
  const cp = CFG.player.altitude.mode === 'hold' ? G.pitch * K.pitchFollow : G.pitch, cc = Math.cos(cp);
  const dir = tC.set(-Math.sin(G.yaw) * cc, Math.sin(cp), -Math.cos(G.yaw) * cc);
  const want = tA.copy(P).addScaledVector(dir, -K.distance); want.y += K.height;
  const gy = groundH(want.x, want.z) + 3; if (want.y < gy) want.y = gy;
  const look = tB.copy(P).addScaledVector(dir, K.lookAhead); look.y += K.lookHeight;
  if (!camSmoothed) { camera.position.copy(want); camLook.copy(look); camSmoothed = true; }
  const k = 1 - Math.exp(-dt * K.follow);
  camera.position.lerp(want, k); camLook.lerp(look, k);
  camera.lookAt(camLook);
  const base = CFG.player.baseSpeed;
  const fov = K.fov + clamp(G.speed / base, 0, 1) * K.fovSpeedExtra; // a little wider at speed
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 3)); camera.updateProjectionMatrix(); }
}
