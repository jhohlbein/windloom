// Loads config/game-config.json into CFG before any game module runs.
// Every tunable number (speeds, hit points, damage, timers, spawn counts) lives in that file.
export const CFG = {};

export async function loadConfig(url = 'config/game-config.json') {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`could not load ${url} (HTTP ${res.status})`);
  Object.assign(CFG, await res.json());
  // Derived: where the sandstorm turns the player back
  CFG.world.boundRadius = CFG.world.worldRadius * CFG.world.boundFraction;
}

// Hit points for a creature at a palace stage: hp + hpBonus * floor(stage / hpBonusEveryStages)
export function hpFor(c, stage) {
  return c.hp + (c.hpBonus || 0) * Math.floor(stage / (c.hpBonusEveryStages || 1));
}

// Population target for a spawn rule: min(base + add * floor(stage / everyStages), max)
export function targetFor(rule, stage) {
  return Math.min(rule.base + rule.add * Math.floor(stage / (rule.everyStages || 1)), rule.max);
}
