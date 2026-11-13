// Timed rounds: countdown, end conditions, score and the best score per island seed (localStorage).
import { CFG } from './config.js';
import { G, W } from './state.js';

// timed: the standard 4-minute round. Untimed (free flight): no clock, no score, play as long as you like.
export function resetRound(timed) {
  G.timed = timed; G.timeLeft = CFG.round.durationSeconds;
  G.killsBy = {}; G.dragonSlain = false; G.endTimer = -1; G.endReason = ''; G.finished = false;
}
// Complete = palace at its last stage and Vharoth slain
export const roundComplete = () => G.dragonSlain && G.level >= CFG.palace.stageThresholds.length;

// Returns 'time' or 'complete' once the round is over, otherwise ''. The clock runs everywhere, beam included.
// In free flight only 'complete' can happen, once; afterwards you keep flying.
export function updateRound(dt) {
  if (G.endTimer > 0) {
    G.endTimer -= dt;
    if (G.endTimer > 0) return '';
    G.endTimer = -1; G.finished = true; return G.endReason;
  }
  if (G.finished) return '';
  if (G.timed) G.timeLeft = Math.max(0, G.timeLeft - dt);
  if (roundComplete()) { G.endReason = 'complete'; G.endTimer = 2.4; return ''; } // a moment to see the finale
  if (G.timed && G.timeLeft <= 0) { G.finished = true; return (G.endReason = 'time'); }
  return '';
}

export function formatClock(s) {
  const t = Math.ceil(s), m = Math.floor(t / 60), r = t % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

const KIND_LABEL = { skeleton: 'Skeleton archers', wyvern: 'Wyverns', drake: 'Drakes', worm: 'Sandworms', kraken: 'Krakens' };
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

// Best score per seed, and the leaderboard: the best timed rounds in this browser (one entry per island, the
// highest score there; round.leaderboardSize are shown, a few more are kept). Storage can be unavailable (private
// mode, blocked site data), so everything is optional.
const key = seed => 'windloom.best.' + seed;
export function bestFor(seed = W.SEED) {
  try { return JSON.parse(localStorage.getItem(key(seed)) || 'null'); } catch (e) { return null; }
}
const BOARD_KEY = 'windloom.scores', BOARD_KEEP = 20;
const validEntry = e => e && Number.isFinite(e.score) && Number.isFinite(e.seed);
const sortBoard = b => b.sort((a, c) => c.score - a.score || String(a.date).localeCompare(String(c.date)) || a.seed - c.seed).slice(0, BOARD_KEEP);
function readBoard() {
  try { const b = JSON.parse(localStorage.getItem(BOARD_KEY) || 'null'); return Array.isArray(b) ? sortBoard(b.filter(validEntry)) : null; } catch (e) { return null; }
}
function writeBoard(b) { try { localStorage.setItem(BOARD_KEY, JSON.stringify(b)); } catch (e) { /* kept for this visit only */ } }
// The first time: the per-island bests saved by earlier versions become the leaderboard
function migrateBoard() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); if (!k || !k.startsWith('windloom.best.')) continue;
      const seed = parseInt(k.slice('windloom.best.'.length), 10), b = JSON.parse(localStorage.getItem(k) || 'null');
      if (Number.isFinite(seed) && b && Number.isFinite(b.score)) out.push({ seed: seed >>> 0, score: b.score, stage: b.stage || 1, dragon: !!b.dragon, complete: !!b.complete, date: b.date || '' });
    }
  } catch (e) { /* nothing to carry over */ }
  return sortBoard(out);
}
let board = null;
export function leaderboard() {
  if (!board) { board = readBoard(); if (!board) { board = migrateBoard(); writeBoard(board); } }
  return board.slice(0, CFG.round.leaderboardSize || 5);
}
// Saves if better than the best on this island; returns { best, rank }: best = a new best for the island,
// rank = the island's place on the shown leaderboard after this round (0 if not on it)
export function recordScore(total, seed = W.SEED) {
  const old = bestFor(seed);
  if (old && old.score >= total) return { best: false, rank: rankOf(seed) };
  const entry = { seed, score: total, stage: G.level, dragon: G.dragonSlain, complete: G.endReason === 'complete', date: new Date().toISOString().slice(0, 10) };
  try { localStorage.setItem(key(seed), JSON.stringify(entry)); } catch (e) { /* optional */ }
  leaderboard(); // loads (or migrates) the board
  board = sortBoard([...board.filter(e => e.seed !== seed), entry]); writeBoard(board);
  return { best: true, rank: rankOf(seed) };
}
export function rankOf(seed = W.SEED) { const i = leaderboard().findIndex(e => e.seed === seed); return i < 0 ? 0 : i + 1; }
