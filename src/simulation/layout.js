import { TAU, clamp, mulberry } from '../util.js';
export function createLayout(CFG, W, terrain) {
  const { calibrateTerrain, rawH, terrainH } = terrain;
  const VARIED = [
    'landCover',
    'lowlandScale',
    'mountainHeight',
    'mountainCover',
    'duneHeight',
    'duneWavelength',
    'greenCover',
    'oasisCount',
    'rockCount',
    'palmMax'
  ];
  const COUNTS = new Set(['oasisCount', 'rockCount', 'palmMax']);
  const strHash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  function poisson(mean, rnd) {
    // Knuth; fine for the small means used here, normal approximation above 30
    if (mean > 30) {
      const u = Math.max(1e-9, rnd()),
        v = rnd();
      return Math.round(mean + Math.sqrt(mean) * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v));
    }
    const L = Math.exp(-mean);
    let k = 0,
      p = 1;
    do {
      k++;
      p *= rnd();
    } while (p > L);
    return k - 1;
  }
  function islandParams(seed) {
    const cw = CFG.world,
      V = cw.variation || {},
      P = {};
    for (const k of VARIED) {
      const mean = cw[k],
        v = V[k],
        rnd = mulberry((seed ^ strHash(k)) >>> 0);
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

  function buildLayout(seed) {
    const cw = CFG.world;
    W.SEED = seed >>> 0;
    W.P = islandParams(W.SEED);
    const r = mulberry(W.SEED);
    for (let i = 0; i < 8; i++) W.OFF[i] = r() * 600;
    W.ISL_ANG = r() * Math.PI;
    W.ISL_EX = r() * 0.22;
    W.DUNE_ANG = r() * Math.PI;
    calibrateTerrain();
    // palms and rocks keep the same density on small and large islands
    W.P.palmMax = Math.round(W.P.palmMax * W.LAND);
    W.P.rockCount = Math.round(W.P.rockCount * W.LAND);
    const rnd = mulberry(W.SEED ^ 0x9e3779b9);

    // oases first, on land
    W.OASES = [];
    W.CX = 1e6;
    W.CZ = 1e6;
    W.PH = 0;
    for (let k = 0, tries = 0; k < W.P.oasisCount && tries < 60; tries++) {
      const a = r() * TAU,
        rr = 110 + r() * 200,
        ox = Math.cos(a) * rr,
        oz = Math.sin(a) * rr;
      if (rawH(ox, oz) < 5) continue;
      if (W.OASES.some((o) => Math.hypot(o.x - ox, o.z - oz) < 150)) continue;
      W.OASES.push({
        x: ox,
        z: oz,
        r: cw.oasisRadiusMin + r() * (cw.oasisRadiusMax - cw.oasisRadiusMin)
      });
      k++;
    }
    // palace site: flat, moderate height (at least palaceCeilingMargin below the ceiling), near the middle, clear of oases
    let best = 1e9,
      bx = 0,
      bz = 0,
      bh = 18;
    const siteMax = Math.min(32, CFG.world.ceiling - CFG.world.palaceCeilingMargin);
    for (let x = -190; x <= 190; x += 12) {
      for (let z = -190; z <= 190; z += 12) {
        const h = rawH(x, z);
        if (h < 6 || h > siteMax) continue;
        if (W.OASES.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 50)) continue;
        const s =
          Math.abs(rawH(x + 14, z) - h) +
          Math.abs(rawH(x, z + 14) - h) +
          Math.abs(rawH(x - 14, z) - h) +
          Math.abs(rawH(x, z - 14) - h);
        const score = s + Math.abs(h - 16) * 0.4 + Math.hypot(x, z) * 0.05;
        if (score < best) {
          best = score;
          bx = x;
          bz = z;
          bh = h;
        }
      }
    }
    W.CX = bx;
    W.CZ = bz;
    W.PH = best < 1e9 ? Math.max(14, bh) : 18;
    // lair: the highest peak well away from the palace
    W.LH = -1e9;
    const LR = cw.lairSearchRadius;
    for (let lx = -LR; lx <= LR; lx += 8) {
      for (let lz = -LR; lz <= LR; lz += 8) {
        if (
          lx * lx + lz * lz > LR * LR ||
          Math.hypot(lx - W.CX, lz - W.CZ) < cw.lairMinDistanceFromPalace
        )
          continue;
        const th = terrainH(lx, lz);
        if (th > W.LH) {
          W.LH = th;
          W.LX = lx;
          W.LZ = lz;
        }
      }
    }
    if (W.LH < 12) W.LH = 12;
    return { r, rnd };
  }

  return { buildLayout, islandParams };
}
