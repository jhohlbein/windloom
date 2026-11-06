// Game flow: title / play / pause / results screens, new islands, and the main loop.
import * as THREE from 'three';
import { CFG } from './config.js';
import { VERSION } from './version.js';
import { G, W } from './state.js';
import { renderer, scene, camera, updateSky, resizeRenderer, setDaylight, setShadows, updateShadows } from './scene.js';
import { R } from './util.js';
import { isleName } from './terrain.js';
import { buildWorld, updateLair, islandTraits } from './world.js';
import { updatePalace } from './palace.js';
import { updateParticles, resizeParticles } from './particles.js';
import { audioInit, toggleMute, updateAudio } from './audio.js';
import { hud, toast, clearToasts, updateToast, updateHud, drawRadar, drawBars, resizeFx, stageLabel } from './hud.js';
import { applyLevel, updateDeposit, stageCount, upgradeHint } from './progress.js';
import { updateShots, updateBolts, updateOrbs, updateRings, clearProjectiles } from './combat.js';
import { populate, spawnTick, spawnDragon, updateEnemies, clearCreatures, unlocked } from './creatures/spawn.js';
import { updatePlayer, updateCamera, placePlayerAtCastle, setRider } from './player.js';
import { bindControls, releaseInput, lockPointer, unlockPointer, toggleFullscreen, isFullscreen, requestTilt, recentreTilt, tiltAvailable, enterFullscreen, fullscreenAvailable, runningInstalled } from './controls.js';
import { resetRound, updateRound, scoreRound, bestFor, recordScore } from './round.js';
import { settings, saveSetting } from './settings.js';

const $ = id => document.getElementById(id);
const overlay = $('overlay'), goBtn = $('go'), timedBtn = $('goTimed'), freeBtn = $('goFree'), rerollBtn = $('reroll'), ovTitle = $('ovTitle'), ovText = $('ovText'),
  ovStats = $('stats'), ovIsle = $('isle'), ovCtl = $('ovCtl'), ovBeasts = $('ovBeasts'), ovLede = ovText.textContent;
$('ver').textContent = 'Version ' + VERSION;
const isleLabel = () => { const b = bestFor(), tr = islandTraits(); return 'Isle of ' + isleName(W.SEED) + (tr.length ? ' · ' + tr.join(', ') : '') + ' · seed ' + W.SEED + (b ? ' · best ' + b.score : ''); };

function showOverlay(mode) {
  G.mode = mode; G.active = false; unlockPointer();
  overlay.hidden = false; hud.hidden = (mode === 'title');
  ovStats.hidden = true; ovIsle.textContent = isleLabel();
  ovCtl.hidden = ovBeasts.hidden = (mode === 'results');
  settingsPanel.hidden = true; settingsBtn.setAttribute('aria-expanded', 'false'); // Settings: on every screen, closed at first
  if (mode === 'title') { ovTitle.textContent = 'Windloom'; ovText.textContent = ovLede; }
  else if (mode === 'pause') { ovTitle.textContent = 'Paused'; ovText.textContent = 'The creatures will wait. Your palace stands at ' + stageLabel(G.level) + ' of ' + stageCount() + ' stages.'; }
  else if (mode === 'results' && !G.timed) {
    // free flight: the Sanctum is whole; no score, keep flying if you like
    const m = Math.floor(G.playTime / 60), s = Math.floor(G.playTime % 60);
    ovTitle.textContent = 'The Sanctum is whole';
    ovText.textContent = 'Vharoth is slain and every stage of the palace stands. You can keep flying as long as you like.';
    ovStats.textContent = 'Creatures slain ' + G.kills + '\nTime aloft ' + m + ':' + (s < 10 ? '0' : '') + s; ovStats.hidden = false;
  }
  else if (mode === 'results') {
    const done = G.endReason === 'complete', sc = scoreRound(), prev = bestFor(), isBest = recordScore(sc.total);
    ovTitle.textContent = done ? 'The Sanctum is whole' : 'Time is up';
    ovText.textContent = done
      ? 'Vharoth is slain and every stage of the palace stands, with time to spare.'
      : 'Your palace stands at ' + stageLabel(G.level) + ' of ' + stageCount() + ' stages' + (G.dragonSlain ? ', and Vharoth is slain.' : '.');
    const rows = [...sc.lines, ['Score', sc.total]], w = Math.max(...rows.map(r => r[0].length)) + 2;
    ovStats.textContent = rows.map(r => r[0].padEnd(w, ' ') + String(r[1]).padStart(5, ' ')).join('\n') + '\n\n' + (isBest ? (prev ? 'New best on this island (was ' + prev.score + ')' : 'First score on this island') : 'Best on this island ' + prev.score);
    ovStats.hidden = false; ovIsle.textContent = isleLabel();
  }
  // The same choices on every screen: the main button (start a timed round, resume, or keep flying), a timed
  // round and a free flight on this island, and a new island (which comes back here, to the start screen)
  const timedLabel = 'Timed round · ' + Math.round(CFG.round.durationSeconds / 60) + ' min';
  const main = mode === 'pause' ? 'Resume' : mode === 'results' && !G.timed ? 'Keep flying' : null;
  goBtn.hidden = !main; goBtn.textContent = main || '';
  timedBtn.textContent = mode === 'pause' ? 'Restart: timed round' : mode === 'results' && G.timed ? 'Timed round again' : timedLabel;
  freeBtn.textContent = mode === 'pause' ? 'Restart: free flight' : 'Free flight';
  timedBtn.className = main ? 'go alt' : 'go'; freeBtn.className = 'go alt';
  rerollBtn.textContent = 'New island';
  releaseInput();
}
// The address keeps the island's seed as #s<seed>; any query string (e.g. ?seed=) is dropped so it cannot go stale
function rememberSeed() { try { history.replaceState(null, '', location.pathname + '#s' + W.SEED); } catch (err) { /* optional */ } }
// Accepts #s123, #123, #seed=123, ?seed=123, ?s=123 and ?123. Seeds are 32-bit; larger numbers wrap around.
function seedFromUrl() {
  const h = /^#(?:s(?:eed)?=?)?(\d{1,10})$/i.exec(location.hash || '');
  if (h) return parseInt(h[1], 10) >>> 0;
  const q = new URLSearchParams(location.search), v = q.get('seed') || q.get('s') || (/^\?(\d{1,10})$/.exec(location.search) || [])[1];
  return v && /^\d{1,10}$/.test(v) ? parseInt(v, 10) >>> 0 : undefined;
}
function newIsland(seed) {
  clearCreatures(); clearProjectiles();
  buildWorld(seed === undefined ? Math.floor(R() * 1e9) : seed);
  G.level = 0; applyLevel(1, false);
  populate(); rememberSeed();
  ovIsle.textContent = isleLabel();
}
function startGame(timed = G.timed) {
  Object.assign(G, { carried: 0, castleMana: 0, level: 1, maxHp: CFG.player.maxHp, hp: CFG.player.maxHp, kills: 0, playTime: 0, lastHurt: -99, dragonSeen: false, dragonTimer: 0 });
  G.invuln = 2; resetRound(timed); G.upgradeHint = 0;
  G.spellMana = CFG.spells.mana.max; G.spellExhausted = false;
  clearCreatures(); clearProjectiles();
  applyLevel(1, false); placePlayerAtCastle();
  G.active = true; populate();
  releaseInput(); recentreTilt(); overlay.hidden = true; hud.hidden = false; G.mode = 'play'; lockPointer();
  clearToasts();
  toast('Hunt the creatures. Gather their gold. Carry it home to the beam.\n' +
    (timed ? 'You have ' + Math.round(CFG.round.durationSeconds / 60) + ' minutes.' : 'Free flight: no clock, take your time.'), 4200);
}
// Resuming and starting come from a click or key press, which browsers require before locking the pointer
function resume() { releaseInput(); recentreTilt(); overlay.hidden = true; hud.hidden = false; G.mode = 'play'; G.active = true; lockPointer(); }
let pausedAt = 0;
function pause() { if (G.mode === 'play') { pausedAt = performance.now(); showOverlay('pause'); } }
function togglePause() {
  if (G.mode === 'play') pause();
  // Esc both releases the pointer lock (which pauses) and arrives as a key press; don't resume right away
  else if (G.mode === 'pause' && performance.now() - pausedAt > 250) { audioInit(); resume(); }
}

// Every button that starts or resumes flight is a tap: the moment browsers allow full screen and iOS allows
// asking for tilt permission. On phones and tablets the game goes full screen here (Settings can switch it off).
const tiltStart = () => {
  if (settings.autoFullscreen && tiltAvailable()) enterFullscreen();
  requestTilt(settings.tilt);
};
goBtn.addEventListener('click', () => { audioInit(); tiltStart(); if (G.mode === 'pause' || G.mode === 'results') resume(); });
timedBtn.addEventListener('click', () => { audioInit(); tiltStart(); if (G.mode !== 'play') startGame(true); });
freeBtn.addEventListener('click', () => { audioInit(); tiltStart(); if (G.mode !== 'play') startGame(false); });
// A new island always goes to its start screen, where you choose timed or free
rerollBtn.addEventListener('click', () => { audioInit(); newIsland(); showOverlay('title'); });
bindControls({
  onPause: togglePause,
  onMute: () => { const m = toggleMute(); if (G.active) toast(m ? 'Sound off' : 'Sound on', 900, true); },
  onBlur: () => { releaseInput(); pause(); },
  onLockLost: pause
});
// Settings (start screen): choices are saved in this browser and applied at once
const settingsBtn = $('settingsBtn'), settingsPanel = $('settingsPanel');
settingsBtn.addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsBtn.setAttribute('aria-expanded', String(!settingsPanel.hidden));
  if (!settingsPanel.hidden) settingsPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
for (const r of document.querySelectorAll('input[name="rider"]')) {
  r.checked = r.value === settings.rider;
  r.addEventListener('change', () => { if (r.checked) { saveSetting('rider', r.value); setRider(r.value); } });
}
setRider(settings.rider);
const shadowBox = $('optShadows');
shadowBox.checked = settings.shadows; setShadows(settings.shadows);
shadowBox.addEventListener('change', () => { saveSetting('shadows', shadowBox.checked); setShadows(shadowBox.checked); });
const tiltBox = $('optTilt'), tiltRow = $('tiltRow');
tiltRow.hidden = !tiltAvailable(); tiltBox.checked = settings.tilt;
const fsAutoBox = $('optAutoFs'), fsAutoRow = $('autoFsRow');
fsAutoRow.hidden = !fullscreenAvailable(); fsAutoBox.checked = settings.autoFullscreen;
$('installHint').hidden = fullscreenAvailable() || runningInstalled(); // iPhone: only the Home Screen gives full screen
fsAutoBox.addEventListener('change', () => { saveSetting('autoFullscreen', fsAutoBox.checked); });
tiltBox.addEventListener('change', () => { saveSetting('tilt', tiltBox.checked); requestTilt(tiltBox.checked); });
const fsBtn = $('fullscreen');
fsBtn.addEventListener('click', () => { toggleFullscreen(); });
const fsLabel = () => { fsBtn.textContent = isFullscreen() ? 'Leave full screen' : 'Full screen'; };
document.addEventListener('fullscreenchange', fsLabel); document.addEventListener('webkitfullscreenchange', fsLabel); window.addEventListener('resize', fsLabel);
if (!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) fsBtn.hidden = true;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  resizeRenderer(w, h); resizeParticles(h); resizeFx();
}
window.addEventListener('resize', resize); resize();

let last = performance.now(), hudTimer = 0;
const shadowTitle = new THREE.Vector3();
// FPS counter: frames counted over half a second, plus the slowest frame in that window
const elFps = $('fps');
let fpsFrames = 0, fpsStart = last, fpsWorst = 0;
function countFps(now, frameMs) {
  fpsFrames++; fpsWorst = Math.max(fpsWorst, frameMs);
  if (now - fpsStart >= 500) {
    elFps.textContent = Math.round(fpsFrames * 1000 / (now - fpsStart)) + ' fps · max ' + Math.round(fpsWorst) + ' ms';
    fpsFrames = 0; fpsStart = now; fpsWorst = 0;
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  countFps(now, now - last);
  const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000)); last = now;
  if (G.mode === 'play' || G.mode === 'title') {
    if (G.mode === 'play') { G.playTime += dt; updatePlayer(dt); }
    updateEnemies(dt);
    updateShots(dt); updateBolts(dt); updateOrbs(dt); updateRings(dt);
    if (G.mode === 'play') {
      updateDeposit(dt); upgradeHint();
      G.spawnTimer -= dt;
      if (G.spawnTimer <= 0) { G.spawnTimer = CFG.spawning.intervalSeconds; spawnTick(); }
      // The dragon appears once its stage is reached (announced by the palace) and returns after spawning.dragon.respawnSeconds when slain
      if (!G.dragon && unlocked(CFG.spawning.dragon)) {
        const returning = G.dragonTimer > 0;
        G.dragonTimer -= dt;
        if (G.dragonTimer <= 0) { spawnDragon(); if (returning) toast('Vharoth returns to its peak', 2600); }
      }
      if (updateRound(dt)) showOverlay('results');
    }
    updateLair(dt);
    updatePalace(dt, now);
    updateParticles(dt);
  }
  updateCamera(dt, G.mode === 'title');
  updateSky(dt);
  setDaylight(G.mode === 'title' ? CFG.sky.titlePhase
    : G.timed ? 1 - G.timeLeft / CFG.round.durationSeconds : G.playTime / (CFG.sky.freeFlightDayMinutes * 60), dt);
  updateShadows(G.mode === 'title' ? shadowTitle.set(W.CX, W.PH, W.CZ) : G.playerPos);
  updateToast(dt);
  updateAudio(dt);
  hudTimer -= dt;
  if (G.mode === 'play' && hudTimer <= 0) { hudTimer = 0.05; updateHud(); drawRadar(); }
  renderer.render(scene, camera);
  drawBars();
}

// Boot: a seed in the address (#s12345) replays that island, otherwise a random one
newIsland(seedFromUrl());
// Editing the seed in the address bar of an open page does not reload it; build the new island here
window.addEventListener('hashchange', () => {
  const s = seedFromUrl();
  if (s === undefined || s === W.SEED) { rememberSeed(); return; }
  newIsland(s); showOverlay('title');
});
showOverlay('title');
goBtn.disabled = timedBtn.disabled = freeBtn.disabled = rerollBtn.disabled = false;
requestAnimationFrame(frame);

// Handy in the browser console while tuning
window.windloom = { G, W, CFG, version: VERSION };
