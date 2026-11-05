// The player's palace: six build stages from a lone minaret to the Crescent Sanctum.
import * as THREE from 'three';
import { scene, geo, shared, addSprite, mats, disposeTree } from './scene.js';
import { G } from './state.js';
import { TAU } from './util.js';

export const castle = new THREE.Group(); scene.add(castle);
export const palace = { spin: [], beam: null, colliders: [] };
// Collision shapes in palace-local coordinates, all standing on the plinth (y = 0 up to top):
// { cyl: true, x, z, r, top } or { cyl: false, x, z, hx, hz, top }. Rebuilt with every stage.
const col = palace.colliders;
const colCyl = (x, z, r, top) => col.push({ cyl: true, x, z, r, top });
const colBox = (x, z, hx, hz, top) => col.push({ cyl: false, x, z, hx, hz, top });

const plaster = new THREE.MeshStandardMaterial({ color: 0xf4e7d0, roughness: 0.85, flatShading: true });
const plaster2 = new THREE.MeshStandardMaterial({ color: 0xdcc29a, roughness: 0.9, flatShading: true });
const goldM = new THREE.MeshStandardMaterial({ color: 0xe8b44a, roughness: 0.3, metalness: 0.7, emissive: 0x2a1800, flatShading: true });
const tealM = new THREE.MeshStandardMaterial({ color: 0x2db3aa, roughness: 0.35, metalness: 0.25, flatShading: true });
const tileM = new THREE.MeshStandardMaterial({ color: 0x2a64b8, roughness: 0.5, flatShading: true });
const archM = new THREE.MeshBasicMaterial({ color: 0x2a1f3d, side: THREE.DoubleSide });
const lampM = new THREE.MeshBasicMaterial({ color: 0xffd36b });
const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const onionGeo = shared(new THREE.LatheGeometry([[1, 0], [1.16, 0.22], [1.24, 0.5], [1.16, 0.82], [0.95, 1.1], [0.66, 1.4], [0.38, 1.7], [0.18, 1.98], [0.06, 2.22], [0, 2.4]].map(p => new THREE.Vector2(p[0], p[1])), 18));
const archGeo = shared((() => { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(-0.5, 1); s.quadraticCurveTo(-0.5, 1.55, 0, 1.85); s.quadraticCurveTo(0.5, 1.55, 0.5, 1); s.lineTo(0.5, 0); s.lineTo(-0.5, 0); return new THREE.ShapeGeometry(s, 6); })());
const crescentGeo = shared(new THREE.TorusGeometry(1, 0.2, 6, 22, Math.PI * 1.35));
const merlonGeo = shared((() => { const g = new THREE.ConeGeometry(0.62, 1.4, 4); g.rotateY(Math.PI / 4); return g; })());

function clearCastle() {
  while (castle.children.length) { const c = castle.children[0]; castle.remove(c); disposeTree(c); }
  palace.spin = []; col.length = 0;
}
function cm(g, mat, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z);
  m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz); castle.add(m); return m;
}
// Onion dome with a gold finial and crescent; returns the height of its tip
function onion(x, y, z, s, mat) {
  cm(onionGeo, mat, x, y, z, s);
  const ty = y + 2.4 * s;
  cm(geo.cyl, goldM, x, ty + 0.35 * s, z, 0.06 * s, 0.7 * s, 0.06 * s);
  cm(geo.sph, goldM, x, ty + 0.2 * s, z, 0.14 * s);
  const c = cm(crescentGeo, goldM, x, ty + 0.95 * s, z, 0.26 * s); c.rotation.z = -1.175 * Math.PI;
  return ty + 1.25 * s;
}
function minaret(x, z, h, r, dm) {
  let y = 1;
  cm(geo.oct, plaster2, x, y + h * 0.12, z, r * 1.35, h * 0.24, r * 1.35); y += h * 0.24;
  cm(geo.oct, tileM, x, y + 0.2, z, r * 1.4, 0.4, r * 1.4); y += 0.4;
  cm(geo.cyl, plaster, x, y + h * 0.25, z, r, h * 0.5, r); y += h * 0.5;
  cm(geo.cyl, plaster2, x, y + 0.2, z, r * 1.65, 0.4, r * 1.65);
  cm(geo.cyl, tileM, x, y + 0.7, z, r * 1.55, 0.6, r * 1.55); y += 1.1;
  cm(geo.cyl, plaster, x, y + h * 0.09, z, r * 0.72, h * 0.18, r * 0.72); y += h * 0.18;
  cm(geo.cyl, tileM, x, y + 0.15, z, r * 0.8, 0.3, r * 0.8); y += 0.3;
  const tip = onion(x, y, z, r * 0.85, dm);
  colCyl(x, z, r * 1.4, y); colCyl(x, z, r * 0.9, tip - 1); // shaft and balcony, then the dome
  return tip;
}
function kiosk(x, y, z, s, dm) {
  for (let i = 0; i < 4; i++) { const dx = (i & 1 ? 1 : -1) * 0.7 * s, dz = (i & 2 ? 1 : -1) * 0.7 * s; cm(geo.cyl, plaster, x + dx, y + 0.8 * s, z + dz, 0.12 * s, 1.6 * s, 0.12 * s); }
  cm(geo.box, plaster2, x, y + 1.7 * s, z, 1.9 * s, 0.25 * s, 1.9 * s);
  const tip = onion(x, y + 1.82 * s, z, 0.8 * s, dm);
  colBox(x, z, 0.95 * s, 0.95 * s, y + 1.85 * s); colCyl(x, z, 0.9 * s, tip - 0.5 * s);
  return tip;
}
// A row of dark pointed arches on one face of a square block (face 0:+z 1:-z 2:+x 3:-x)
function arcade(cx, cy, cz, half, n, w, h, face, skipMid) {
  for (let i = 0; i < n; i++) {
    if (skipMid && i === Math.floor(n / 2)) continue;
    const off = (i - (n - 1) / 2) * (half * 2 / n), m = new THREE.Mesh(archGeo, archM), o = half + 0.06;
    m.scale.set(w, h / 1.85, 1);
    if (face === 0) m.position.set(cx + off, cy, cz + o);
    else if (face === 1) { m.position.set(cx - off, cy, cz - o); m.rotation.y = Math.PI; }
    else if (face === 2) { m.position.set(cx + o, cy, cz - off); m.rotation.y = Math.PI / 2; }
    else { m.position.set(cx - o, cy, cz + off); m.rotation.y = -Math.PI / 2; }
    castle.add(m);
  }
}

export function buildCastle(L) {
  clearCastle();
  cm(geo.oct, plaster2, 0, 0, 0, 27, 2, 27);
  cm(geo.oct, tileM, 0, 0.6, 0, 27.3, 0.3, 27.3);
  colCyl(0, 0, 27, 1); // plinth
  let top = 0; const merlons = [];
  if (L === 1) {
    top = minaret(0, 0, 32, 2.0, tealM);
    kiosk(9, 1, 7, 2.2, tealM); kiosk(-9, 1, 7, 2.2, tealM);
  } else {
    const H = L >= 4 ? 12 : 9, half = 7;
    cm(geo.box, plaster, 0, 1 + H / 2, 0, half * 2, H, half * 2);
    cm(geo.box, tileM, 0, 1 + H - 0.7, 0, half * 2 + 0.16, 0.5, half * 2 + 0.16);
    for (let f = 0; f < 4; f++) arcade(0, 2, 0, half, 3, 2.4, 5.6, f, false);
    for (let t = -half + 2.2; t <= half - 2.2; t += 1.6) merlons.push([t, 1 + H + 0.7, half - 0.3], [t, 1 + H + 0.7, -half + 0.3], [half - 0.3, 1 + H + 0.7, t], [-half + 0.3, 1 + H + 0.7, t]);
    const dr = L >= 4 ? 6 : 5;
    cm(geo.cyl, plaster, 0, 1 + H + 1.6, 0, dr, 3.2, dr);
    cm(geo.cyl, tileM, 0, 1 + H + 3.0, 0, dr + 0.1, 0.4, dr + 0.1);
    top = onion(0, 1 + H + 3.2, 0, dr * 0.95, L >= 4 ? goldM : tealM);
    colBox(0, 0, half, half, 1 + H + 1.4); colCyl(0, 0, dr, 1 + H + 3.2); // main block with merlons, drum
    colCyl(0, 0, dr * 1.05, 1 + H + 3.2 + dr * 0.95 * 1.2); colCyl(0, 0, dr * 0.5, top - 1); // dome body and tip
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => kiosk(c[0] * (half - 1.2), 1 + H, c[1] * (half - 1.2), 1.1, goldM));
    if (L === 2) top = Math.max(top, minaret(15, -15, 30, 1.7, tealM));
  }
  if (L >= 3) {
    const Wd = 17, wallH = 6, th = 1.4;
    cm(geo.box, plaster, 0, 1 + wallH / 2, Wd, 2 * Wd, wallH, th); cm(geo.box, plaster, 0, 1 + wallH / 2, -Wd, 2 * Wd, wallH, th);
    cm(geo.box, plaster, Wd, 1 + wallH / 2, 0, th, wallH, 2 * Wd); cm(geo.box, plaster, -Wd, 1 + wallH / 2, 0, th, wallH, 2 * Wd);
    cm(geo.box, tileM, 0, 1 + wallH - 0.5, Wd, 2 * Wd, 0.4, th + 0.12); cm(geo.box, tileM, 0, 1 + wallH - 0.5, -Wd, 2 * Wd, 0.4, th + 0.12);
    cm(geo.box, tileM, Wd, 1 + wallH - 0.5, 0, th + 0.12, 0.4, 2 * Wd); cm(geo.box, tileM, -Wd, 1 + wallH - 0.5, 0, th + 0.12, 0.4, 2 * Wd);
    arcade(0, 1.4, 0, Wd + th / 2, 7, 1.6, 3.4, 0, false); arcade(0, 1.4, 0, Wd + th / 2, 7, 1.6, 3.4, 1, false);
    arcade(0, 1.4, 0, Wd + th / 2, 7, 1.6, 3.4, 2, true); arcade(0, 1.4, 0, Wd + th / 2, 7, 1.6, 3.4, 3, false);
    for (let s = -Wd + 2.6; s <= Wd - 2.6; s += 1.7) {
      merlons.push([s, 1 + wallH + 0.7, Wd], [s, 1 + wallH + 0.7, -Wd], [-Wd, 1 + wallH + 0.7, s]);
      if (Math.abs(s) > 4.5) merlons.push([Wd, 1 + wallH + 0.7, s]);
    }
    const wt = 1 + wallH + 1.4; // walls including merlons
    colBox(0, Wd, Wd, th / 2, wt); colBox(0, -Wd, Wd, th / 2, wt); colBox(Wd, 0, th / 2, Wd, wt); colBox(-Wd, 0, th / 2, Wd, wt);
    colBox(Wd, 0, 1.6, 4.1, 12.5); // gatehouse with its dome
    // gatehouse on the east side
    cm(geo.box, plaster2, Wd, 1 + 4.5, 0, 3, 9, 8);
    cm(geo.box, tileM, Wd, 1 + 8.2, 0, 3.15, 0.5, 8.15);
    const gate = new THREE.Mesh(archGeo, archM); gate.scale.set(4.2, 6.2 / 1.85, 1); gate.position.set(Wd + 1.56, 1, 0); gate.rotation.y = Math.PI / 2; castle.add(gate);
    onion(Wd, 10, 0, 1.3, goldM);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => {
      if (L >= 4) top = Math.max(top, minaret(c[0] * Wd, c[1] * Wd, 34, 1.8, goldM));
      else {
        cm(geo.cyl, plaster, c[0] * Wd, 1 + 5, c[1] * Wd, 2.6, 10, 2.6);
        cm(geo.cyl, tileM, c[0] * Wd, 1 + 9.2, c[1] * Wd, 2.7, 0.5, 2.7);
        const tip = onion(c[0] * Wd, 11, c[1] * Wd, 2.0, goldM);
        colCyl(c[0] * Wd, c[1] * Wd, 2.7, 11); colCyl(c[0] * Wd, c[1] * Wd, 2.0, tip - 1);
      }
    });
  }
  if (merlons.length) {
    const im = new THREE.InstancedMesh(merlonGeo, plaster, merlons.length), m4 = new THREE.Matrix4();
    merlons.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(i, m4); });
    im.instanceMatrix.needsUpdate = true; castle.add(im);
  }
  if (L >= 5) {
    const ring = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU, lg = new THREE.Group(); lg.position.set(Math.cos(a) * 22, Math.sin(i * 1.7) * 1.5, Math.sin(a) * 22);
      const lm = new THREE.Mesh(geo.octa, lampM); lm.scale.set(0.8, 1.3, 0.8); lg.add(lm); lg.add(addSprite(mats.gold, 6)); ring.add(lg);
    }
    ring.position.y = top + 5; castle.add(ring); palace.spin.push({ o: ring, s: 0.3 });
    top += 7;
  }
  if (L >= 6) {
    const cg = new THREE.Group();
    const cres = new THREE.Mesh(crescentGeo, goldM); cres.scale.setScalar(8); cres.rotation.z = -1.175 * Math.PI; cg.add(cres);
    const star = new THREE.Mesh(geo.octa, goldM); star.scale.set(1.6, 2.4, 1.6); star.position.set(1.5, 1.5, 0); cg.add(star);
    cg.add(addSprite(mats.gold, 80));
    cg.position.y = top + 16; castle.add(cg); palace.spin.push({ o: cg, s: 0.25 });
    top += 26;
  }
  G.castleTopY = top;
  const br = 1 + L * 0.35;
  palace.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 520, 14, 1, true), beamMat);
  palace.beam.position.y = 260; palace.beam.scale.set(br, 1, br); castle.add(palace.beam);
}

export function updatePalace(dt, now) {
  for (const c of palace.spin) c.o.rotation.y += c.s * dt;
  if (palace.beam) palace.beam.material.opacity = 0.13 + 0.05 * Math.sin(now * 0.002);
}
