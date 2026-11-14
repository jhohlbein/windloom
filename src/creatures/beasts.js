// One parametric builder for winged reptiles: wyverns, drakes and the dragon share it.
// Each kind is built once as a template, then cloned with its own (flashable) materials.
// Smooth-shaded (like the riders), so the round bodies read as hide rather than facets.
import * as THREE from 'three';
import { geo, addSprite, glowMat } from '../scene.js';
import { lerp, TAU } from '../util.js';
import { trackMat } from './common.js';

const sph = new THREE.SphereGeometry(1, 20, 14); // finer than the shared low-poly sphere; shared by every beast

// Appearance only. Gameplay numbers are in config/game-config.json.
export const BEASTS = {
  wyvern: { hide: 0x2f6e62, belly: 0xcdb27c, memb: 0x6c2f6f, bone: 0xe8dec4, eye: 0xffb02e, body: [1.0, 0.9, 2.6], neckN: 4, neckR: 0.72, neckStep: 1.0, neckBend: 0.2, headBend: -0.8, headS: 0.78, horns: 'swept', tailN: 10, tailR: 0.6, tailStep: 1.05, tip: 'barb', legs: 2, wing: 1.0, spikes: 5, spikeS: 0.6 },
  drake: { hide: 0x8c3b22, belly: 0xe0a65a, memb: 0x7c2a17, bone: 0xe2cfa4, eye: 0xffe14a, body: [1.8, 1.55, 3.1], neckN: 3, neckR: 1.05, neckStep: 1.05, neckBend: 0.12, headBend: -0.36, headS: 1.05, horns: 'forward', tailN: 6, tailR: 0.95, tailStep: 1.1, tip: 'club', legs: 4, wing: 0.72, spikes: 6, spikeS: 1.3, plates: true },
  dragon: { hide: 0x2b1f38, belly: 0x7d2c1a, bellyEm: 0x3a0c00, memb: 0x5c1729, bone: 0xd9ccb0, eye: 0xff3a1a, body: [1.7, 1.5, 3.8], neckN: 5, neckR: 1.15, neckStep: 1.25, neckBend: 0.17, headBend: -0.75, headS: 1, horns: 'swept', tailN: 9, tailR: 0.95, tailStep: 1.35, tip: 'spade', legs: 4, wing: 1.0, spikes: 7, spikeS: 1 }
};

function triGeo(pts, idx) {
  const g = new THREE.BufferGeometry(), arr = [];
  idx.forEach(i => arr.push(pts[i][0], pts[i][1], pts[i][2]));
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g;
}
function boneBar(a, b, th, mat, parent) { // a wing finger: a tapered rod from a to b
  const A = new THREE.Vector3().fromArray(a), B = new THREE.Vector3().fromArray(b), d = B.clone().sub(A), L = d.length();
  const g = new THREE.CylinderGeometry(th * 0.35, th * 0.5, L, 7); g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()); parent.add(m);
}

function buildBeast(P) {
  const roleMat = role => { const m = new THREE.MeshStandardMaterial(); m.userData.role = role; return m; };
  const hide = roleMat('hide'), belly = roleMat('belly'), memb = roleMat('memb');
  const bone = new THREE.MeshStandardMaterial({ color: P.bone, roughness: 0.55 });
  const eyeGlow = glowMat(P.eye), eyeM = new THREE.MeshBasicMaterial({ color: P.eye });
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const [sx, sy, sz] = P.body;
  const mesh = (gm, mat, parent, px, py, pz, ax, ay, az) => { const m = new THREE.Mesh(gm, mat); m.position.set(px, py, pz); m.scale.set(ax, ay, az); parent.add(m); return m; };
  mesh(sph, hide, g, 0, 0, 0, sx, sy, sz);
  mesh(sph, belly, g, 0, -sy * 0.37, 0, sx * 0.8, sy * 0.7, sz * 0.87);
  const spikeGeo = new THREE.ConeGeometry(0.28, 1.1, 5);
  for (let i = 0; i < P.spikes; i++) {
    const z = lerp(-0.75 * sz, 0.75 * sz, i / (P.spikes - 1)), y = sy * Math.sqrt(Math.max(0, 1 - (z / sz) * (z / sz))) + 0.15 * P.spikeS;
    if (P.plates) { const pl = mesh(geo.octa, bone, g, 0, y + 0.3 * P.spikeS, z, 0.12 * P.spikeS, 0.75 * P.spikeS, 0.6 * P.spikeS); pl.rotation.x = 0.25; }
    else { const sp = mesh(spikeGeo, bone, g, 0, y, z, P.spikeS, P.spikeS, P.spikeS); sp.rotation.x = 0.5; }
  }
  // neck and head
  const neck = new THREE.Group(); neck.position.set(0, sy * 0.33, -sz * 0.87); g.add(neck);
  let p = neck;
  for (let j = 0; j < P.neckN; j++) {
    const s = new THREE.Group(); s.name = 'n' + j; if (j > 0) s.position.z = -P.neckStep; s.rotation.x = P.neckBend; p.add(s);
    const r = P.neckR * (1 - j * 0.08); mesh(sph, hide, s, 0, 0, 0, r, r, r * 1.25);
    if (j % 2 === 0 && !P.plates) { const nk = mesh(spikeGeo, bone, s, 0, r * 0.95, 0, 0.8, 0.8, 0.8); nk.rotation.x = 0.6; }
    p = s;
  }
  const head = new THREE.Group(); head.name = 'head'; head.position.z = -P.neckStep * 1.04; head.rotation.x = P.headBend; head.scale.setScalar(P.headS); p.add(head);
  // skull, brow and snout as rounded forms; the lower jaw hinges at the back of the skull
  mesh(sph, hide, head, 0, 0, -0.9, 0.85, 0.6, 1.25);
  mesh(sph, hide, head, 0, 0.15, -1.3, 0.72, 0.4, 0.9); // brow
  mesh(sph, hide, head, 0, -0.1, -2.7, 0.55, 0.38, 1.1); // snout
  const jaw = new THREE.Group(); jaw.name = 'jaw'; jaw.position.set(0, -0.5, -0.6); head.add(jaw);
  mesh(sph, belly, jaw, 0, 0, -1.5, 0.48, 0.17, 1.6);
  const tg = new THREE.ConeGeometry(0.09, 0.4, 4);
  for (let t = 0; t < 4; t++) for (const sd of [-1, 1]) { const th = new THREE.Mesh(tg, bone); th.position.set(sd * 0.42, -0.5, -2.2 - t * 0.35); th.rotation.x = Math.PI; head.add(th); }
  for (const sd of [-1, 1]) {
    if (P.horns === 'swept') {
      const h = mesh(new THREE.ConeGeometry(0.28, 2.6, 6), bone, head, sd * 0.6, 0.75, -0.2, 1, 1, 1); h.rotation.set(1.05, 0, -sd * 0.28);
      const h2 = mesh(new THREE.ConeGeometry(0.16, 1.2, 5), bone, head, sd * 0.85, 0.1, -0.4, 1, 1, 1); h2.rotation.set(1.3, 0, -sd * 0.9);
    } else {
      const hf = mesh(new THREE.ConeGeometry(0.36, 2.4, 6), bone, head, sd * 0.7, 0.7, -0.6, 1, 1, 1); hf.rotation.set(-0.9, 0, -sd * 0.4);
      for (let f = 0; f < 3; f++) { const fr = mesh(new THREE.ConeGeometry(0.16, 0.9, 4), bone, head, sd * (0.25 + f * 0.3), 0.55, 0.25, 1, 1, 1); fr.rotation.set(1.4, 0, -sd * (0.2 + f * 0.35)); }
    }
    const ey = addSprite(eyeGlow, 1.3); ey.position.set(sd * 0.62, 0.3, -1.75); head.add(ey);
    mesh(sph, eyeM, head, sd * 0.72, 0.3, -1.7, 0.17, 0.17, 0.17);
  }
  if (P.horns === 'forward') { const nh = mesh(new THREE.ConeGeometry(0.22, 1, 5), bone, head, 0, 0.45, -3.2, 1, 1, 1); nh.rotation.x = -0.5; }
  const mouth = new THREE.Object3D(); mouth.name = 'mouth'; mouth.position.set(0, -0.35, -3.9); head.add(mouth);
  // tail
  const tail = new THREE.Group(); tail.position.set(0, 0.1, sz * 0.9); g.add(tail);
  let tp = tail;
  for (let k = 0; k < P.tailN; k++) {
    const ts = new THREE.Group(); ts.name = 't' + k; if (k > 0) ts.position.z = P.tailStep; tp.add(ts);
    const tr = P.tailR * (1 - k / (P.tailN + 2)); mesh(sph, hide, ts, 0, 0, 0, tr, tr * 0.9, tr * 1.4); tp = ts;
  }
  if (P.tip === 'spade') mesh(geo.octa, bone, tp, 0, 0, 1.5, 1.1, 0.18, 1.4);
  else if (P.tip === 'barb') {
    const bb = mesh(new THREE.ConeGeometry(0.35, 1.8, 5), bone, tp, 0, 0, 1.4, 1, 1, 1); bb.rotation.x = Math.PI / 2;
    for (const sd of [-1, 1]) { const sb = mesh(new THREE.ConeGeometry(0.15, 0.9, 4), bone, tp, sd * 0.35, 0, 0.9, 1, 1, 1); sb.rotation.set(Math.PI / 2, 0, sd * 0.9); }
  } else {
    mesh(sph, hide, tp, 0, 0, 1.0, 0.95, 0.95, 0.95);
    for (let c = 0; c < 6; c++) { const ca = c / 6 * TAU, cs = mesh(new THREE.ConeGeometry(0.2, 0.8, 4), bone, tp, Math.cos(ca) * 0.85, Math.sin(ca) * 0.85, 1.0, 1, 1, 1); cs.rotation.z = ca - Math.PI / 2; }
  }
  // legs
  const ls = sy / 1.5, legGeo = new THREE.CylinderGeometry(0.32, 0.45, 2.4, 9), clawGeo = new THREE.ConeGeometry(0.3, 0.9, 5);
  for (const sd of [-1, 1]) {
    const l = mesh(legGeo, hide, g, sd * sx * 0.65, -sy * 0.73, sz * 0.5, ls, ls, ls); l.rotation.x = 1.15;
    const cl = mesh(clawGeo, bone, g, sd * sx * 0.65, -sy * 1.13, sz * 0.79, ls, ls, ls); cl.rotation.x = 2.2;
    if (P.legs === 4) { const fl = mesh(legGeo, hide, g, sd * sx * 0.59, -sy * 0.67, -sz * 0.53, ls * 0.8, ls * 0.8, ls * 0.8); fl.rotation.x = 0.9; }
  }
  // wings: an inner arm panel and an outer finger panel that lags behind it
  const Wf = P.wing, sc = a => [a[0] * Wf, a[1] * Wf, a[2] * Wf];
  const E = sc([7, 0.8, -1.6]), M = sc([7.2, 0, 4.2]), T1 = sc([9.5, -0.6, -1.2]), T2 = sc([8.6, -0.8, 3.4]), T3 = sc([4.4, -0.5, 6.2]), RB = sc([0.4, 0, 5.0]);
  const MM = [M[0] - E[0], M[1] - E[1], M[2] - E[2]];
  const innerG = triGeo([[0, 0, 0], E, M, RB], [0, 1, 2, 0, 2, 3]);
  const outerG = triGeo([[0, 0, 0], T1, T2, T3, MM], [0, 1, 2, 0, 2, 3, 0, 3, 4]);
  for (const side of ['R', 'L']) {
    const mirror = side === 'L';
    const holder = new THREE.Group(); holder.position.set((mirror ? -1 : 1) * sx * 0.76, sy * 0.6, -sz * 0.34); if (mirror) holder.scale.x = -1; g.add(holder);
    const inner = new THREE.Group(); inner.name = 'w' + side + '_in'; holder.add(inner);
    inner.add(new THREE.Mesh(innerG, memb)); boneBar([0, 0, 0], E, 0.38 * Wf, hide, inner);
    const outer = new THREE.Group(); outer.name = 'w' + side + '_out'; outer.position.fromArray(E); inner.add(outer);
    outer.add(new THREE.Mesh(outerG, memb));
    boneBar([0, 0, 0], T1, 0.28 * Wf, hide, outer); boneBar([0, 0, 0], T2, 0.22 * Wf, hide, outer); boneBar([0, 0, 0], T3, 0.2 * Wf, hide, outer);
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 4), bone); claw.position.set(0, 0.45, 0); outer.add(claw);
  }
  return g;
}

const TEMPL = {};
// Returns handles to the animated parts of a fresh copy of the beast
export function instBeast(e, kind) {
  const P = BEASTS[kind];
  if (!TEMPL[kind]) TEMPL[kind] = buildBeast(P);
  const g = TEMPL[kind].clone(true);
  const m = {
    hide: trackMat(e, new THREE.MeshStandardMaterial({ color: P.hide, roughness: 0.6, metalness: 0.08 })),
    belly: trackMat(e, new THREE.MeshStandardMaterial({ color: P.belly, emissive: P.bellyEm || 0, roughness: 0.75 })),
    memb: trackMat(e, new THREE.MeshStandardMaterial({ color: P.memb, roughness: 0.85, side: THREE.DoubleSide }))
  };
  g.traverse(o => { if (o.isMesh && o.material.userData.role) o.material = m[o.material.userData.role]; });
  g.rotation.order = 'YXZ';
  const B = {
    g, wR: { inner: g.getObjectByName('wR_in'), outer: g.getObjectByName('wR_out') }, wL: { inner: g.getObjectByName('wL_in'), outer: g.getObjectByName('wL_out') },
    neck: [], tail: [], head: g.getObjectByName('head'), jaw: g.getObjectByName('jaw'), mouth: g.getObjectByName('mouth'),
    neckBend: P.neckBend, lookY: 0, lookX: 0
  };
  for (let j = 0; j < P.neckN; j++) B.neck.push(g.getObjectByName('n' + j));
  for (let k = 0; k < P.tailN; k++) B.tail.push(g.getObjectByName('t' + k));
  return B;
}
// Wingbeat (phase ph, amplitude amp), idle neck and tail sway, jaw opening (0..1). The neck turns by lookY/lookX
// (yaw/pitch in the beast's frame, spread over its segments), so the head can follow the carpet; the tail trails
// out of a turn by `turn` (the yaw rate), swinging the tip wide.
export function animBeast(B, t, ph, amp, jaw, turn = 0) {
  const f = Math.sin(ph), n = B.neck.length, nt = B.tail.length;
  B.wR.inner.rotation.z = B.wL.inner.rotation.z = 0.12 + f * amp;
  B.wR.outer.rotation.z = B.wL.outer.rotation.z = 0.05 + Math.sin(ph - 0.8) * amp * 0.8;
  for (let j = 0; j < n; j++) { B.neck[j].rotation.y = Math.sin(t * 0.9 + j * 0.4) * 0.05 + B.lookY / n; B.neck[j].rotation.x = B.neckBend + B.lookX / n; }
  for (let k = 0; k < nt; k++) { B.tail[k].rotation.y = Math.sin(t * 1.6 - k * 0.55) * 0.13 + turn * 0.06 * (k + 1) / nt; B.tail[k].rotation.x = -0.03 + Math.sin(t * 1.1 - k * 0.4) * 0.03; }
  B.jaw.rotation.x = -jaw * 0.6;
}
// Eases the neck towards a world point (or back to straight when `to` is null): yaw/pitch in the beast's frame,
// limited so the head never turns further than a neck can
const lk = new THREE.Vector3(), lq = new THREE.Quaternion();
export function lookBeast(B, to, from, dt, rate = 3) {
  let y = 0, x = 0;
  if (to) {
    B.g.getWorldQuaternion(lq); lk.copy(to).sub(from).applyQuaternion(lq.invert());
    y = Math.max(-0.9, Math.min(0.9, Math.atan2(-lk.x, -lk.z))); x = Math.max(-0.5, Math.min(0.6, Math.atan2(lk.y, Math.hypot(lk.x, lk.z))));
  }
  const k = Math.min(1, dt * rate); B.lookY += (y - B.lookY) * k; B.lookX += (x - B.lookX) * k;
}
