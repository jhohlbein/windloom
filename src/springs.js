// Two springs of fire on every island: an ember spring (red flames) that mends the carpet rider, and an azure
// spring (blue flames) that restores spell mana, both while the carpet hovers within reach of the flames.
// Positions come from the island's seed (buildSprings is called from buildWorld); numbers from config "springs".
import * as THREE from 'three';
import { CFG } from './config.js';
import { G, W } from './state.js';
import { scene, addSprite, glowMat, disposeTree } from './scene.js';
import { TAU } from './util.js';
import { terrainH } from './terrain.js';
import { emit, C } from './particles.js';
import { toast } from './hud.js';

// Appearance per kind; gameplay numbers are in the config
const KINDS = {
  health: { name: 'ember spring', glow: 0xd0202e, pool: 0xb8202c, poolEm: 0x70081a, flame: [C.CRIMSON, C.CRIMSON2], spark: C.CRIMSON, radar: '#e0343c', told: 'An ember spring: its flames mend you while you hover in them' },
  mana: { name: 'azure spring', glow: 0x3f8cff, pool: 0x6fb6ff, poolEm: 0x123c9c, flame: [C.AZURE, C.AZURE2], spark: C.MANA, radar: '#62a6ff', told: 'An azure spring: its flames restore your spells while you hover in them' }
};
const group = new THREE.Group(); scene.add(group);
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5b4b43, roughness: 1 });
const basinGeo = new THREE.TorusGeometry(4, 0.9, 8, 22), poolGeo = new THREE.CircleGeometry(3.7, 22);
const rr = () => Math.random() - 0.5;

// One spring of each kind on land: gentle ground the carpet can reach, away from the palace, the lair, the oases
// and each other. rnd is the island's seeded random, so a seed always gives the same springs.
export function buildSprings(rnd) {
  while (group.children.length) { const c = group.children[0]; group.remove(c); disposeTree(c); }
  W.SPRINGS = [];
  const S = CFG.springs, hMax = Math.min(30, CFG.world.ceiling - 6);
  for (const kind of ['health', 'mana']) {
    let best = null, bestScore = 1e9;
    // the distances are relaxed step by step on islands with little land, so there is always a spring of each kind
    for (const relax of [1, 0.6, 0.3, 0]) {
      for (let t = 0; t < 400 && !(best && bestScore < 1); t++) {
        const a = rnd() * TAU, d = 60 + rnd() * 360, x = Math.cos(a) * d, z = Math.sin(a) * d, h = terrainH(x, z);
        if (h < 4 || h > hMax) continue;
        if (Math.hypot(x - W.CX, z - W.CZ) < S.minPalaceDistance * relax || Math.hypot(x - W.LX, z - W.LZ) < S.minLairDistance * relax) continue;
        if (W.OASES.some(o => Math.hypot(x - o.x, z - o.z) < o.r + 20 * relax) || W.SPRINGS.some(s => Math.hypot(x - s.x, z - s.z) < S.minSpringDistance * relax)) continue;
        const slope = (Math.abs(terrainH(x + 6, z) - h) + Math.abs(terrainH(x, z + 6) - h)) / 6; // the basin should sit on level ground
        if (slope < bestScore) { bestScore = slope; best = { x, z, y: h }; }
      }
      if (best) break;
    }
    if (!best) continue;
    const s = { kind, x: best.x, z: best.z, y: best.y, told: false, t: rnd() * 10, acc: 0 }, L = KINDS[kind];
    const basin = new THREE.Mesh(basinGeo, stoneMat); basin.rotation.x = Math.PI / 2; basin.position.set(s.x, s.y + 0.5, s.z); basin.castShadow = basin.receiveShadow = true; group.add(basin);
    const pool = new THREE.Mesh(poolGeo, new THREE.MeshStandardMaterial({ color: L.pool, emissive: L.poolEm, roughness: 0.4 })); pool.rotation.x = -Math.PI / 2; pool.position.set(s.x, s.y + 0.6, s.z); group.add(pool);
    s.glowMat = glowMat(L.glow); s.glow = addSprite(s.glowMat, 18); s.glow.position.set(s.x, s.y + 5, s.z); group.add(s.glow);
    W.SPRINGS.push(s);
  }
}

// Flames and glow every frame; the carpet within radius (and not far above the flames) is mended or recharged
export function updateSprings(dt) {
  const S = CFG.springs, P = G.playerPos; G.atSpring = null;
  for (const s of W.SPRINGS) {
    const L = KINDS[s.kind]; s.t += dt;
    const fl = 0.8 + 0.12 * Math.sin(s.t * 8.3) + 0.08 * Math.sin(s.t * 21.1 + 2);
    s.glow.scale.setScalar(16 * fl); s.glowMat.opacity = 0.5 + 0.35 * fl;
    s.acc += dt;
    while (s.acc > 0.03) {
      s.acc -= 0.03;
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 3, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
      // tall flames (about 12 m), so the well can be seen from afar, and sparks rising well above them
      emit(x, s.y + 0.8, z, rr() * 1.5, 9 + Math.random() * 7, rr() * 1.5, L.flame[Math.random() < 0.5 ? 0 : 1], 3.5 + Math.random() * 3, 0.8 + Math.random() * 0.5);
      if (Math.random() < 0.25) emit(x, s.y + 6, z, rr() * 3, 10 + Math.random() * 10, rr() * 3, L.spark, 1.6, 2.0);
    }
    if (!G.active) continue;
    const near = Math.hypot(P.x - s.x, P.z - s.z) < S.radius && P.y - s.y < S.height;
    if (!near) continue;
    if (s.kind === 'health') { if (G.hp < G.maxHp) G.hp = Math.min(G.maxHp, G.hp + S.healPerSecond * dt); }
    else G.spellMana = Math.min(CFG.spells.mana.max, G.spellMana + S.manaPerSecond * dt);
    G.atSpring = s.kind;
    if (!s.told) { s.told = true; toast(L.told, 3200); }
    // the flames reach up and wreathe the carpet
    if (Math.random() < 0.6) emit(P.x + rr() * 4, P.y - 0.5 + rr(), P.z + rr() * 4, rr() * 2, 2.5 + Math.random() * 2, rr() * 2, L.flame[1], 1.8, 0.5);
  }
}
