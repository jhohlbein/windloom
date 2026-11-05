// Builds a whole island from a seed: oases, palace site, dragon lair, terrain mesh, palms, rocks.
import * as THREE from 'three';
import { CFG } from './config.js';
import { W } from './state.js';
import { TAU, clamp, smooth, mulberry, vnoise } from './util.js';
import { scene, shared, addSprite, glowMat, disposeTree } from './scene.js';
import { emit, C } from './particles.js';
import { rawH, terrainH, greenAt, SIZE } from './terrain.js';
import { castle } from './palace.js';

const worldGroup = new THREE.Group(); scene.add(worldGroup);
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
const trunkGeo = shared((() => { const g = new THREE.CylinderGeometry(0.28, 0.5, 1, 6); g.translate(0, 0.5, 0); return g; })());
const leafGeo = shared((() => {
  const N = 6, pos = [], idx = [];
  for (let i = 0; i <= N; i++) { const t = i / N, w = 0.22 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + 0.02, y = -0.55 * t * t; pos.push(-w, y, t, 0, y + 0.06, t, w, y, t); }
  for (let j = 0; j < N; j++) { const a = j * 3; idx.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
})());
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 1, flatShading: true });
const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide, flatShading: true });
const rockGeo = shared(new THREE.DodecahedronGeometry(1, 0));
const rockMat = new THREE.MeshStandardMaterial({ color: 0xb5714a, roughness: 1, flatShading: true });
const obsMat = new THREE.MeshStandardMaterial({ color: 0x1d1626, roughness: 0.5, metalness: 0.2, flatShading: true });

function clearWorldGroup() {
  while (worldGroup.children.length) { const c = worldGroup.children[0]; worldGroup.remove(c); disposeTree(c); }
}

/* ---------- per-island landscape settings ---------- */
// The config values are the means. world.variation varies some of them per island; every value is drawn from
// the island's seed (one random stream per setting), so the same seed always gives the same island.
// Kinds: { dist: "poisson", min, max } for counts, { spread } for mean x (1 +- spread), { min, max } for a range.
const VARIED = ['heightScale', 'mountainScale', 'duneHeight', 'duneWavelength', 'greenCover', 'oasisCount', 'rockCount', 'palmMax'];
const COUNTS = new Set(['oasisCount', 'rockCount', 'palmMax']);
const strHash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
function poisson(mean, rnd) { // Knuth; fine for the small means used here, normal approximation above 30
  if (mean > 30) { const u = Math.max(1e-9, rnd()), v = rnd(); return Math.round(mean + Math.sqrt(mean) * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v)); }
  const L = Math.exp(-mean); let k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}
export function islandParams(seed) {
  const cw = CFG.world, V = cw.variation || {}, P = {};
  for (const k of VARIED) {
    const mean = cw[k], v = V[k], rnd = mulberry((seed ^ strHash(k)) >>> 0);
    let x = mean;
    if (v) {
      if (v.dist === 'poisson') x = poisson(mean, rnd);
      else if (v.spread !== undefined) x = mean * (1 + v.spread * (2 * rnd() - 1));
      else if (v.min !== undefined && v.max !== undefined) x = v.min + (v.max - v.min) * rnd();
      if (v.min !== undefined) x = Math.max(v.min, x);
      if (v.max !== undefined) x = Math.min(v.max, x);
    }
    P[k] = COUNTS.has(k) ? Math.max(0, Math.round(x)) : x;
  }
  return P;
}
// A few words for the island's character, from how far its settings are from the means (shown on the title)
export function islandTraits() {
  const cw = CFG.world, P = W.P, out = [];
  const rel = k => P[k] / cw[k];
  const relief = rel('heightScale') * rel('mountainScale');
  if (relief > 1.2) out.push('rugged'); else if (relief < 0.8) out.push('flat');
  if (rel('greenCover') > 1.15) out.push('lush'); else if (rel('greenCover') < 0.85) out.push('arid');
  if (rel('duneHeight') > 1.15) out.push('high dunes'); else if (rel('duneHeight') < 0.85) out.push('low dunes');
  if (P.oasisCount >= cw.oasisCount + 2) out.push('many oases'); else if (P.oasisCount <= 1) out.push(P.oasisCount ? 'one oasis' : 'no oasis');
  return out.slice(0, 3);
}

export function buildWorld(seed) {
  const cw = CFG.world;
  W.SEED = seed >>> 0;
  W.P = islandParams(W.SEED);
  const r = mulberry(W.SEED);
  for (let i = 0; i < 8; i++) W.OFF[i] = r() * 600;
  W.ISL_ANG = r() * Math.PI; W.ISL_EX = r() * 0.22; W.DUNE_ANG = r() * Math.PI;
  const rnd = mulberry(W.SEED ^ 0x9e3779b9);

  // oases first, on land
  W.OASES = []; W.CX = 1e6; W.CZ = 1e6; W.PH = 0;
  for (let k = 0, tries = 0; k < W.P.oasisCount && tries < 60; tries++) {
    const a = r() * TAU, rr = 110 + r() * 200, ox = Math.cos(a) * rr, oz = Math.sin(a) * rr;
    if (rawH(ox, oz) < 5) continue;
    if (W.OASES.some(o => Math.hypot(o.x - ox, o.z - oz) < 150)) continue;
    W.OASES.push({ x: ox, z: oz, r: cw.oasisRadiusMin + r() * (cw.oasisRadiusMax - cw.oasisRadiusMin) }); k++;
  }
  // palace site: flat, moderate height, near the middle, clear of oases
  let best = 1e9, bx = 0, bz = 0, bh = 18;
  for (let x = -190; x <= 190; x += 12) {
    for (let z = -190; z <= 190; z += 12) {
      const h = rawH(x, z);
      if (h < 6 || h > 32) continue;
      if (W.OASES.some(o => Math.hypot(x - o.x, z - o.z) < o.r + 50)) continue;
      const s = Math.abs(rawH(x + 14, z) - h) + Math.abs(rawH(x, z + 14) - h) + Math.abs(rawH(x - 14, z) - h) + Math.abs(rawH(x, z - 14) - h);
      const score = s + Math.abs(h - 16) * 0.4 + Math.hypot(x, z) * 0.05;
      if (score < best) { best = score; bx = x; bz = z; bh = h; }
    }
  }
  W.CX = bx; W.CZ = bz; W.PH = best < 1e9 ? Math.max(14, bh) : 18;
  // lair: the highest peak well away from the palace
  W.LH = -1e9;
  const LR = cw.lairSearchRadius;
  for (let lx = -LR; lx <= LR; lx += 8) {
    for (let lz = -LR; lz <= LR; lz += 8) {
      if (lx * lx + lz * lz > LR * LR || Math.hypot(lx - W.CX, lz - W.CZ) < cw.lairMinDistanceFromPalace) continue;
      const th = terrainH(lx, lz); if (th > W.LH) { W.LH = th; W.LX = lx; W.LZ = lz; }
    }
  }
  if (W.LH < 12) W.LH = 12;
  clearWorldGroup();
  castle.position.set(W.CX, W.PH, W.CZ);

  // terrain mesh with vertex colours
  const cSand = new THREE.Color(0xf3d39a), cSand2 = new THREE.Color(0xe0b574), cWet = new THREE.Color(0xb48e60), cRock = new THREE.Color(0xb8663f), cRock2 = new THREE.Color(0x854531),
    cTop = new THREE.Color(0xdcae7c), cGrass = new THREE.Color(0x7d9a46), cScrub = new THREE.Color(0x9aa457), cBed = new THREE.Color(0x1e6d78), cAsh = new THREE.Color(0x3a3040);
  const out = new THREE.Color();
  function colorAt(h, slope, x, z) {
    if (h < -0.8) out.copy(cBed);
    else if (h < 0.9) out.copy(cWet);
    else {
      out.copy(cSand).lerp(cSand2, clamp(vnoise(x * 0.04 + W.OFF[6], z * 0.04) * 0.9 + (h % 4.2) / 12, 0, 1));
      if (h > 20 && slope < 0.35) out.lerp(cTop, 0.7);
      out.lerp(cRock, smooth(0.85, 1.4, slope));
      out.lerp(cRock2, smooth(1.4, 2.2, slope) * 0.6);
      const gr = greenAt(x, z, h, slope);
      if (gr > 0) out.lerp(vnoise(x * 0.03, z * 0.03) > 0.5 ? cGrass : cScrub, gr * 0.85);
    }
    for (const o of W.OASES) { const od = Math.hypot(x - o.x, z - o.z); if (h > -0.8 && od < o.r * 1.35) out.lerp(cGrass, smooth(o.r * 1.35, o.r * 0.8, od) * 0.9); }
    const cd = Math.hypot(x - W.CX, z - W.CZ); if (cd > 26 && cd < 46) out.lerp(cGrass, smooth(26, 30, cd) * smooth(46, 40, cd) * 0.8);
    const ld = Math.hypot(x - W.LX, z - W.LZ); if (ld < 80) out.lerp(cAsh, smooth(80, 30, ld) * 0.85);
    return out;
  }
  const SEG = cw.terrainSegments;
  const tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); tg.rotateX(-Math.PI / 2);
  const tp = tg.attributes.position, tc = new Float32Array(tp.count * 3);
  for (let vi = 0; vi < tp.count; vi++) {
    const vx = tp.getX(vi), vz = tp.getZ(vi), vh = terrainH(vx, vz);
    tp.setY(vi, vh);
    const sl = (Math.abs(terrainH(vx + 6, vz) - vh) + Math.abs(terrainH(vx, vz + 6) - vh)) / 6;
    const c = colorAt(vh, sl, vx, vz); tc[vi * 3] = c.r; tc[vi * 3 + 1] = c.g; tc[vi * 3 + 2] = c.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
  tg.computeVertexNormals();
  worldGroup.add(new THREE.Mesh(tg, terrainMat));

  // palms: around oases, in the palace garden and along the shore
  const palms = [];
  for (const o of W.OASES) for (let n = 0; n < 24; n++) { const a = rnd() * TAU, d = o.r * (0.5 + rnd() * 0.75), px = o.x + Math.cos(a) * d, pz = o.z + Math.sin(a) * d; if (terrainH(px, pz) > 0.6) palms.push([px, pz]); }
  for (let g = 0; g < 16; g++) { const ga = g / 16 * TAU + rnd() * 0.2, gd = 31 + rnd() * 10; palms.push([W.CX + Math.cos(ga) * gd, W.CZ + Math.sin(ga) * gd]); }
  // palms in the green patches
  for (let pt = 0; pt < 4000 && palms.length < W.P.palmMax * 0.6; pt++) {
    const px = (rnd() - 0.5) * SIZE * 0.95, pz = (rnd() - 0.5) * SIZE * 0.95, ph = terrainH(px, pz);
    const sl = (Math.abs(terrainH(px + 6, pz) - ph) + Math.abs(terrainH(px, pz + 6) - ph)) / 6;
    if (greenAt(px, pz, ph, sl) > 0.6 && Math.hypot(px - W.CX, pz - W.CZ) > 50 && rnd() < 0.35) palms.push([px, pz]);
  }
  for (let pt = 0; pt < 2500 && palms.length < W.P.palmMax; pt++) {
    const px = (rnd() - 0.5) * SIZE * 0.95, pz = (rnd() - 0.5) * SIZE * 0.95, ph = terrainH(px, pz);
    if (ph < 0.8 || ph > 7) continue;
    const wet = terrainH(px + 16, pz) < 0 || terrainH(px - 16, pz) < 0 || terrainH(px, pz + 16) < 0 || terrainH(px, pz - 16) < 0;
    if (wet) palms.push([px, pz]);
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palms.length), leaves = new THREE.InstancedMesh(leafGeo, leafMat, palms.length * 7);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), topV = new THREE.Vector3(), col = new THREE.Color();
  let li = 0;
  palms.forEach((p, i) => {
    const hgt = 7 + rnd() * 6, bh2 = terrainH(p[0], p[1]) - 0.3;
    e4.set((rnd() - 0.5) * 0.35, 0, (rnd() - 0.5) * 0.35); q4.setFromEuler(e4);
    ps.set(p[0], bh2, p[1]); sc.set(1, hgt, 1); m4.compose(ps, q4, sc); trunks.setMatrixAt(i, m4);
    topV.set(0, hgt, 0).applyQuaternion(q4).add(ps);
    const base = rnd() * TAU, fs = 4 + rnd() * 1.6;
    for (let j = 0; j < 7; j++) {
      e4.set(-0.25 - rnd() * 0.2, base + j / 7 * TAU + (rnd() - 0.5) * 0.3, 0, 'YXZ'); q4.setFromEuler(e4);
      sc.set(fs, fs, fs); m4.compose(topV, q4, sc); leaves.setMatrixAt(li, m4);
      col.setHSL(0.24 + rnd() * 0.06, 0.45, 0.28 + rnd() * 0.1); leaves.setColorAt(li, col); li++;
    }
  });
  trunks.instanceMatrix.needsUpdate = true; leaves.instanceMatrix.needsUpdate = true; if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  worldGroup.add(trunks); worldGroup.add(leaves);

  // sandstone boulders
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, W.P.rockCount); let ri = 0;
  for (let rt = 0; rt < 2000 && ri < W.P.rockCount; rt++) {
    const rx = (rnd() - 0.5) * SIZE * 0.9, rz = (rnd() - 0.5) * SIZE * 0.9, rh = terrainH(rx, rz);
    if (rh < 2 || Math.hypot(rx - W.CX, rz - W.CZ) < 50) continue;
    const rsc = 1 + rnd() * 3.5;
    e4.set(rnd() * 3, rnd() * 3, rnd() * 3, 'XYZ'); q4.setFromEuler(e4); ps.set(rx, rh + rsc * 0.2, rz);
    sc.set(rsc * (0.8 + rnd() * 0.6), rsc * (0.5 + rnd() * 0.5), rsc * (0.8 + rnd() * 0.6));
    m4.compose(ps, q4, sc); rocks.setMatrixAt(ri++, m4);
  }
  rocks.count = ri; rocks.instanceMatrix.needsUpdate = true; worldGroup.add(rocks);

  // dragon lair: obsidian spires and a smouldering glow
  for (let i = 0; i < 11; i++) {
    const la = i / 11 * TAU + rnd() * 0.4, lr = 12 + rnd() * 22, ox = W.LX + Math.cos(la) * lr, oz = W.LZ + Math.sin(la) * lr, oh = terrainH(ox, oz), os = 3 + rnd() * 5;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(os * 0.45, os * 3.4, 5), obsMat);
    spire.position.set(ox, oh + os * 1.3, oz); spire.rotation.set((rnd() - 0.5) * 0.5, rnd() * TAU, (rnd() - 0.5) * 0.5); worldGroup.add(spire);
  }
  // a dark red, flickering glow low on the summit (the fire itself is particles, see updateLair)
  lairGlow = addSprite(lairGlowMat, 34); lairGlow.position.set(W.LX, W.LH + 4, W.LZ); worldGroup.add(lairGlow);
}

// The dragon's fire on its peak: flickering deep-red glow, licking flames, and cinders drifting up.
// Kept dark and red so it is not mistaken for the sun.
const lairGlowMat = glowMat(0x8a1606);
let lairGlow = null, lairT = 0, flameAcc = 0;
const rr = () => Math.random() - 0.5;
export function updateLair(dt) {
  if (!lairGlow) return;
  lairT += dt;
  const fl = 0.75 + 0.15 * Math.sin(lairT * 9.1) + 0.1 * Math.sin(lairT * 23.7 + 1.3);
  lairGlow.scale.setScalar(30 * fl); lairGlowMat.opacity = 0.55 + 0.35 * fl;
  flameAcc += dt;
  while (flameAcc > 0.015) {
    flameAcc -= 0.015;
    const x = W.LX + rr() * 12, z = W.LZ + rr() * 12, y = W.LH + 1 + Math.random() * 2;
    emit(x, y, z, rr() * 2, 8 + Math.random() * 9, rr() * 2, Math.random() < 0.5 ? C.FLAME : C.FLAME2, 6 + Math.random() * 4, 0.6 + Math.random() * 0.5);
    if (Math.random() < 0.25) emit(x, y + 3, z, rr() * 4, 10 + Math.random() * 10, rr() * 4, C.CINDER, 2, 2.2);
  }
}
