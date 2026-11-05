// Timed rounds: countdown, end conditions, score and the best score per island seed (localStorage).
import { CFG } from './config.js';
import { G, W } from './state.js';

export function resetRound() {
  G.timeLeft = CFG.round.durationSeconds;
  G.killsBy = {}; G.dragonSlain = false; G.endTimer = -1; G.endReason = '';
}
// Complete = palace at its last stage and Vharoth slain
export const roundComplete = () => G.dragonSlain && G.level >= CFG.palace.stageThresholds.length;

// Returns 'time' or 'complete' once the round is over, otherwise ''. The clock runs everywhere, beam included.
export function updateRound(dt) {
  if (G.endTimer > 0) { G.endTimer -= dt; return G.endTimer <= 0 ? G.endReason : ''; }
  G.timeLeft = Math.max(0, G.timeLeft - dt);
  if (roundComplete()) { G.endReason = 'complete'; G.endTimer = 2.4; return ''; } // a moment to see the finale
  if (G.timeLeft <= 0) return (G.endReason = 'time');
  return '';
}

export function formatClock(s) {
  const t = Math.ceil(s), m = Math.floor(t / 60), r = t % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

const KIND_LABEL = { wyvern: 'Wyverns', drake: 'Drakes', worm: 'Sandworms', kraken: 'Krakens' };
export function scoreRound() {
  const S = CFG.round, lines = [];
  for (const kind of Object.keys(KIND_LABEL)) {
    const n = G.killsBy[kind] || 0, p = S.pointsPerKill[kind] || 0;
    if (n) lines.push([KIND_LABEL[kind] + ' slain × ' + n, n * p]);
  }
  if (G.level > 1) lines.push(['Palace stages raised × ' + (G.level - 1), (G.level - 1) * S.pointsPerStage]);
  if (G.dragonSlain) lines.push(['Vharoth slain', S.dragonSlainBonus]);
  if (G.endReason === 'complete') {
    lines.push(['Round complete', S.completionBonus]);
    const left = Math.floor(G.timeLeft);
    if (left > 0) lines.push(['Time left ' + formatClock(left), left * S.pointsPerSecondLeft]);
  }
  return { lines, total: lines.reduce((a, l) => a + l[1], 0) };
}

// Best score per seed. Storage can be unavailable (private mode, blocked site data), so everything is optional.
const key = seed => 'windloom.best.' + seed;
export function bestFor(seed = W.SEED) {
  try { return JSON.parse(localStorage.getItem(key(seed)) || 'null'); } catch (e) { return null; }
}
// Saves if better; returns true for a new best
export function recordScore(total, seed = W.SEED) {
  const old = bestFor(seed);
  if (old && old.score >= total) return false;
  try {
    localStorage.setItem(key(seed), JSON.stringify({ score: total, stage: G.level, dragon: G.dragonSlain, complete: G.endReason === 'complete', date: new Date().toISOString().slice(0, 10) }));
  } catch (e) { /* optional */ }
  return true;
}
