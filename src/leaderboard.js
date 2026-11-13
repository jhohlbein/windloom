// Leaderboard on the start screen: the best timed rounds in this browser with their islands. Picking an island
// asks once, then starts a timed round there (the click is also the tap browsers need for sound and full screen).
import { CFG } from './config.js';
import { W } from './state.js';
import { isleName } from './terrain.js';
import { leaderboard, formatClock } from './round.js';

const $ = id => document.getElementById(id);
const el = $('board'), list = $('boardList'), empty = $('boardEmpty'), confirmBox = $('boardConfirm'), confirmText = $('boardConfirmText'),
  flyBtn = $('boardFly'), cancelBtn = $('boardCancel'), title = $('boardTitle');
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
let picked = null, onFly = null;

title.textContent = 'Best ' + Math.round(CFG.round.durationSeconds / 60) + '-minute rounds';
empty.textContent = 'No timed round finished yet. Your ' + (CFG.round.leaderboardSize || 5) + ' best scores will be kept here with their islands; pick one to try to beat it.';

function meta(e) {
  const parts = ['Stage ' + (NUMERALS[(e.stage || 1) - 1] || e.stage)];
  if (e.complete) parts.push('Sanctum whole'); else if (e.dragon) parts.push('Vharoth slain');
  if (e.date) parts.push(e.date);
  return parts.join(' · ');
}
// Shows the board (hidden when `show` is false); the current island's row is marked
export function renderLeaderboard(show) {
  el.hidden = !show; if (!show) return;
  cancel();
  const rows = leaderboard();
  list.replaceChildren(...rows.map((e, i) => {
    const li = document.createElement('li'); li.className = e.seed === W.SEED ? 'here' : '';
    const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = String(i + 1);
    const score = document.createElement('span'); score.className = 'score'; score.textContent = String(e.score);
    const seed = document.createElement('button'); seed.type = 'button'; seed.className = 'seed'; seed.dataset.seed = String(e.seed);
    seed.textContent = 'Isle of ' + isleName(e.seed) + ' · seed ' + e.seed;
    seed.title = 'Fly this island and try to beat ' + e.score + ' points';
    const m = document.createElement('span'); m.className = 'meta'; m.textContent = meta(e);
    li.append(rank, score, seed, m); return li;
  }));
  empty.hidden = rows.length > 0; list.hidden = !rows.length;
}
function cancel() { picked = null; confirmBox.hidden = true; for (const b of list.querySelectorAll('.seed')) b.classList.remove('picked'); }
function ask(e) {
  picked = e; confirmBox.hidden = false;
  for (const b of list.querySelectorAll('.seed')) b.classList.toggle('picked', Number(b.dataset.seed) === e.seed);
  confirmText.textContent = 'Fly to the Isle of ' + isleName(e.seed) + ' (seed ' + e.seed + ') and try to beat ' + e.score + ' points? A timed round of ' +
    formatClock(CFG.round.durationSeconds) + ' starts at once.';
  confirmBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); flyBtn.focus();
}
// fly(seed) starts the timed round on that island
export function bindLeaderboard(fly) {
  onFly = fly;
  list.addEventListener('click', ev => {
    const b = ev.target.closest('.seed'); if (!b) return;
    const seed = Number(b.dataset.seed), e = leaderboard().find(x => x.seed === seed);
    if (!e) return;
    if (picked && picked.seed === seed) cancel(); else ask(e);
  });
  cancelBtn.addEventListener('click', cancel);
  flyBtn.addEventListener('click', () => { const e = picked; cancel(); if (e && onFly) onFly(e.seed); });
}
