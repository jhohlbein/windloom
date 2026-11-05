// Loads config/game-config.json into CFG before any game module runs.
// Every tunable number (speeds, hit points, damage, timers, spawn counts) lives in that file.
// Top-level await: every module that imports this one waits until the file is loaded, so all game code can be
// imported statically (a hard reload then refreshes every module; dynamic imports were kept from the cache).
export const CFG = {};

// Any error while starting (config, a module, the 3D library) is shown on the start screen
export function showStartError(err) {
  const text = document.getElementById('ovText'), isle = document.getElementById('isle');
  if (isle) isle.textContent = 'Could not start';
  if (text) {
    text.textContent = 'Windloom could not start: ' + (err && err.message || err) + '. ' +
      (location.protocol === 'file:'
        ? 'Browsers block modules and config files opened straight from disk. Start a local web server in the project folder (see README) and open http://localhost:8000.'
        : 'Check your connection (the 3D library loads from a CDN) and reload the page.');
  }
}
window.addEventListener('error', e => { if (!window.windloom) showStartError(e.error || e.message); });

const CONFIG_URL = 'config/game-config.json';
try {
  const res = await fetch(CONFIG_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`could not load ${CONFIG_URL} (HTTP ${res.status})`);
  Object.assign(CFG, await res.json());
  // Derived: where the sandstorm turns the player back
  CFG.world.boundRadius = CFG.world.worldRadius * CFG.world.boundFraction;
} catch (err) {
  console.error(err); showStartError(err);
  throw err;
}

// Hit points for a creature at a palace stage: hp + hpBonus * floor(stage / hpBonusEveryStages)
export function hpFor(c, stage) {
  return c.hp + (c.hpBonus || 0) * Math.floor(stage / (c.hpBonusEveryStages || 1));
}

// Population target for a spawn rule: min(base + add * floor(stage / everyStages), max)
export function targetFor(rule, stage) {
  return Math.min(rule.base + rule.add * Math.floor(stage / (rule.everyStages || 1)), rule.max);
}
