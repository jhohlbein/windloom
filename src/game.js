// Game flow: title / play / pause / won screens, new islands, and the main loop.
import { CFG } from './config.js';
import { VERSION } from './version.js';
import { G, W } from './state.js';
import { renderer, scene, camera, updateSky, resizeRenderer } from './scene.js';
import { R } from './util.js';
import { isleName } from './terrain.js';
import { buildWorld } from './world.js';
import { updatePalace } from './palace.js';
import { emit, C, updateParticles, resizeParticles } from './particles.js';
import { audioInit, toggleMute } from './audio.js';
import { hud, toast, updateToast, updateHud, drawRadar, drawBars, resizeFx, stageLabel } from './hud.js';
import { applyLevel, updateDeposit, stageCount } from './progress.js';
import { updateShots, updateBolts, updateOrbs, updateRings, clearProjectiles } from './combat.js';
import { populate, spawnTick, spawnDragon, updateEnemies, clearCreatures } from './creatures/spawn.js';
import { updatePlayer, updateCamera, placePlayerAtCastle } from './player.js';
import { bindControls, releaseInput } from './controls.js';

const $ = id => document.getElementById(id);
const overlay = $('overlay'), goBtn = $('go'), rerollBtn = $('reroll'), ovTitle = $('ovTitle'), ovText = $('ovText'),
  ovStats = $('stats'), ovIsle = $('isle'), ovCtl = $('ovCtl'), ovBeasts = $('ovBeasts'), ovLede = ovText.textContent;
$('ver').textContent = 'Version ' + VERSION;
const isleLabel = () => 'Isle of ' + isleName(W.SEED) + ' · seed ' + W.SEED;

function showOverlay(mode) {
  G.mode = mode; G.active = false;
  overlay.hidden = false; hud.hidden = (mode === 'title');
  ovStats.hidden = true; ovIsle.textContent = isleLabel();
  ovCtl.hidden = ovBeasts.hidden = (mode === 'won');
  if (mode === 'title') { ovTitle.textContent = 'Windloom'; ovText.textContent = ovLede; goBtn.textContent = 'Take flight'; rerollBtn.textContent = 'New island'; }
  else if (mode === 'pause') { ovTitle.textContent = 'Paused'; ovText.textContent = 'The creatures will wait. Your palace stands at ' + stageLabel(G.level) + ' of ' + stageCount() + ' stages.'; goBtn.textContent = 'Resume'; rerollBtn.textContent = 'New game on a new island'; }
  else if (mode === 'won') {
    ovTitle.textContent = 'The Sanctum is whole';
    ovText.textContent = 'Every stage of the palace stands, and its crescent can be seen from the far shore. You can keep flying as long as you like.';
    const m = Math.floor(G.playTime / 60), s = Math.floor(G.playTime % 60);
    ovStats.textContent = 'Creatures slain ' + G.kills + '  ·  Time aloft ' + m + ':' + (s < 10 ? '0' : '') + s; ovStats.hidden = false;
    goBtn.textContent = 'Keep flying'; rerollBtn.textContent = 'New game on a new island';
  }
  releaseInput();
}
function rememberSeed() { try { history.replaceState(null, '', '#s' + W.SEED); } catch (err) { /* optional */ } }
function newIsland(seed) {
  clearCreatures(); clearProjectiles();
  buildWorld(seed === undefined ? Math.floor(R() * 1e9) : seed);
  G.level = 0; applyLevel(1, false);
  populate(); rememberSeed();
  ovIsle.textContent = isleLabel();
}
function startGame() {
  Object.assign(G, { carried: 0, castleMana: 0, level: 1, maxHp: CFG.player.maxHp, hp: CFG.player.maxHp, kills: 0, playTime: 0, lastHurt: -99, won: false, winTimer: -1, dragonSeen: false, dragonTimer: 0 });
  G.invuln = 2;
  clearCreatures(); clearProjectiles();
  applyLevel(1, false); placePlayerAtCastle();
  G.active = true; populate();
  releaseInput(); overlay.hidden = true; hud.hidden = false; G.mode = 'play';
  toast('Hunt the creatures. Gather their gold. Carry it home to the beam.', 3600);
}
function resume() { releaseInput(); overlay.hidden = true; hud.hidden = false; G.mode = 'play'; G.active = true; }
function togglePause() {
  if (G.mode === 'play') showOverlay('pause');
  else if (G.mode === 'pause') { audioInit(); resume(); }
}

goBtn.addEventListener('click', () => {
  audioInit();
  if (G.mode === 'title') startGame();
  else if (G.mode === 'pause') resume();
  else if (G.mode === 'won') { G.won = true; resume(); }
});
rerollBtn.addEventListener('click', () => {
  audioInit();
  const wasTitle = G.mode === 'title';
  newIsland();
  if (!wasTitle) startGame();
});
bindControls({
  onPause: togglePause,
  onMute: () => { const m = toggleMute(); if (G.active) toast(m ? 'Sound off' : 'Sound on', 900); },
  onBlur: () => { releaseInput(); if (G.mode === 'play') showOverlay('pause'); }
});

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  resizeRenderer(w, h); resizeParticles(h); resizeFx();
}
window.addEventListener('resize', resize); resize();

let last = performance.now(), hudTimer = 0, lairEmber = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000)); last = now;
  if (G.mode === 'play' || G.mode === 'title') {
    if (G.mode === 'play') { G.playTime += dt; updatePlayer(dt); }
    updateEnemies(dt);
    updateShots(dt); updateBolts(dt); updateOrbs(dt); updateRings(dt);
    if (G.mode === 'play') {
      updateDeposit(dt);
      G.spawnTimer -= dt;
      if (G.spawnTimer <= 0) { G.spawnTimer = CFG.spawning.intervalSeconds; spawnTick(); }
      if (!G.dragon) { G.dragonTimer -= dt; if (G.dragonTimer <= 0) { spawnDragon(); toast('Vharoth returns to its peak', 2600); } }
      if (G.winTimer > 0) { G.winTimer -= dt; if (G.winTimer <= 0) { G.winTimer = -1; showOverlay('won'); } }
    }
    lairEmber -= dt;
    while (lairEmber < 0) { lairEmber += 0.06; emit(W.LX + (R() - 0.5) * 18, W.LH + 3, W.LZ + (R() - 0.5) * 18, (R() - 0.5) * 3, 8 + R() * 10, (R() - 0.5) * 3, C.EMBER, 3, 2.4); }
    updatePalace(dt, now);
    updateParticles(dt);
  }
  updateCamera(dt, G.mode === 'title');
  updateSky(dt);
  updateToast(dt);
  hudTimer -= dt;
  if (G.mode === 'play' && hudTimer <= 0) { hudTimer = 0.05; updateHud(); drawRadar(); }
  renderer.render(scene, camera);
  drawBars();
}

// Boot: a seed in the address (#s12345) replays that island, otherwise a random one
const hashSeed = /^#s(\d{1,10})$/.exec(location.hash || '');
newIsland(hashSeed ? parseInt(hashSeed[1], 10) : undefined);
showOverlay('title');
goBtn.disabled = false; rerollBtn.disabled = false;
requestAnimationFrame(frame);

// Handy in the browser console while tuning
window.windloom = { G, W, CFG, version: VERSION };
