// Seeded height function for the island. Pure maths: same seed, same island.
import { CFG } from './config.js';
import { W } from './state.js';
import { fbm, smooth, lerp, clamp, mulberry } from './util.js';

// The island shape was designed for a nominal radius of 1800 * 0.43 = 774 m; islandRadius rescales it.
const WS = CFG.world.islandRadius / (1800 * 0.43), HS = CFG.world.heightScale;
export const SIZE = Math.round(2 * CFG.world.worldRadius);

function terrace(h) { const s = CFG.world.terraceStep, f = h / s, i = Math.floor(f); return (i + smooth(0.55, 0.95, f - i)) * s; }

// Height before the palace plateau is flattened in
export function rawH(x, z) {
  const wx = x, wz = z, OFF = W.OFF;
  x /= WS; z /= WS;
  const ca = Math.cos(W.ISL_ANG), sa = Math.sin(W.ISL_ANG);
  const u = (x * ca + z * sa) * (1 + W.ISL_EX), v = (-x * sa + z * ca) * (1 - W.ISL_EX);
  const coast = 1 + (fbm(x * 0.0022 + OFF[4], z * 0.0022 + OFF[5]) - 0.5) * 0.55;
  const d = Math.sqrt(u * u + v * v) / (1800 * 0.43) * coast;
  const m = Math.max(0, 1 - d * d);
  const n = fbm(x * 0.0030 + OFF[0], z * 0.0030 + OFF[1]);
  const r = 1 - Math.abs(fbm(x * 0.0065 + OFF[2], z * 0.0065 + OFF[3]) * 2 - 1);
  const mount = terrace(Math.pow(r, 3.2) * Math.max(0, n - 0.42) * 520 * CFG.world.mountainScale);
  const base = (n - 0.40) * 140;
  let h = (base + mount) * m * HS - (1 - m) * 28;
  if (h > 0.5 && h < 34) {
    // sin has period 2*PI, so a crest every duneWavelength metres (x, z are unscaled here, hence * WS)
    const freq = Math.PI * WS / CFG.world.duneWavelength;
    const dd = (x * Math.cos(W.DUNE_ANG) + z * Math.sin(W.DUNE_ANG)) * freq + fbm(x * 0.004 + OFF[6], z * 0.004 + OFF[7]) * 5;
    const field = 0.35 + 1.3 * fbm(x * 0.0025 + OFF[7], z * 0.0025 + OFF[6]); // dune fields come and go
    h += Math.pow(1 - Math.abs(Math.sin(dd)), 2.2) * CFG.world.duneHeight * field * smooth(0.5, 5, h) * smooth(34, 18, h);
  }
  for (const o of W.OASES) {
    const od = Math.hypot(wx - o.x, wz - o.z);
    if (od < o.r) h = lerp(h, -5, smooth(o.r, o.r * 0.35, od));
  }
  return h;
}
export function terrainH(x, z) {
  const h = rawH(x, z);
  const t = smooth(CFG.world.palaceFlattenOuter, CFG.world.palaceFlattenInner, Math.hypot(x - W.CX, z - W.CZ));
  return h + (W.PH - h) * t;
}
// 0..1: how green the ground is here (grass and scrub patches on low, gentle land). Used for colour and palms.
export function greenAt(x, z, h, slope) {
  if (h < 1.2 || h > 28 || slope > 1.1) return 0;
  const g = fbm(x * 0.0045 / WS + W.OFF[2], z * 0.0045 / WS + W.OFF[3]);
  const t0 = 0.33 + (0.5 - CFG.world.greenCover) * 0.35; // this fbm has its median near 0.35, 90% below ~0.51
  return smooth(t0, t0 + 0.06, g) * smooth(28, 18, h) * smooth(1.2, 3, h) * smooth(1.1, 0.7, slope);
}
export function groundH(x, z) { return Math.max(terrainH(x, z), 0); }

// True if nothing in the terrain blocks the straight line from a to b
export function lineOfSight(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const n = clamp(Math.ceil(d / 14), 4, 30);
  for (let i = 1; i < n; i++) { const t = i / n; if (terrainH(a.x + dx * t, a.z + dz * t) > a.y + dy * t - 1) return false; }
  return true;
}
export function inWard(p) { return Math.hypot(p.x - W.CX, p.z - W.CZ) < CFG.palace.wardRadius; }

const NA = ['Zah', 'Nur', 'Qam', 'Sar', 'Mir', 'Dah', 'Kal', 'Ram', 'Sul', 'Tar', 'Bah', 'Fal', 'Jan', 'Lay', 'Haz', 'Rub'];
const NB = ['ira', 'ab', 'un', 'esh', 'ad', 'ul', 'im', 'ar', 'an', 'ez', 'iya', 'ah'];
export function isleName(seed) { const r = mulberry(seed + 7); return NA[Math.floor(r() * NA.length)] + NB[Math.floor(r() * NB.length)]; }
