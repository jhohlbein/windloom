// Synthesised audio (Web Audio only, no sound files): effects, wind, and generated background music.
// Space: a generated reverb (config audio.reverb) that every bus feeds a little into, and creature sounds panned
// left or right of the carpet's heading (audio.stereoWidth).
import * as THREE from 'three';
import { CFG } from './config.js';
import { G } from './state.js';
import { camera } from './scene.js';
import { clamp, lerp } from './util.js';

let ac = null, muted = false, noiseBuf = null;
let master, sfxBus, musicBus, sfxOut = null; // sfxOut: where the effect being played goes (a panner, or the bus)
const lastSfx = {};

export function audioInit() {
  if (ac) { if (ac.state === 'suspended' && ac.resume) ac.resume(); return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; return; }
  if (ac.state === 'suspended' && ac.resume) ac.resume();
  const A = CFG.audio;
  master = ac.createGain(); master.gain.value = A.masterVolume; master.connect(ac.destination);
  sfxBus = ac.createGain(); sfxBus.gain.value = A.sfxVolume; sfxBus.connect(master);
  musicBus = ac.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
  // two seconds of white noise, reused by every noise-based sound
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startReverb(); startWind(); startMusic();
}
/* ---------- reverb: a short, warm space from a generated impulse (decaying noise), fed by a send ---------- */
let reverbSend = null;
function startReverb() {
  const wet = CFG.audio.reverb ?? 0;
  if (!(wet > 0) || !ac.createConvolver) return;
  try {
    const secs = 1.7, n = Math.floor(ac.sampleRate * secs), buf = ac.createBuffer(2, n, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.8); }
    const conv = ac.createConvolver(); conv.buffer = buf; conv.normalize = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000; lp.Q.value = 0.5; // dusty, not a cathedral
    reverbSend = ac.createGain(); reverbSend.gain.value = wet;
    reverbSend.connect(conv); conv.connect(lp); lp.connect(master);
    sfxBus.connect(reverbSend); musicBus.connect(reverbSend);
  } catch (e) { reverbSend = null; /* audio is optional */ }
}
export function toggleMute() {
  muted = !muted;
  if (ac) master.gain.setTargetAtTime(muted ? 0 : CFG.audio.masterVolume, ac.currentTime, 0.05);
  return muted;
}

/* ---------- building blocks ---------- */
function tone(f0, f1, dur, type, vol, out = sfxOut || sfxBus, t = ac && ac.currentTime) {
  if (!ac || muted || vol <= 0.002) return;
  try {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.03);
  } catch (e) { /* audio is optional */ }
}
// Band-passed noise whose centre frequency sweeps f0 -> f1: shooshes, whooshes, drum slaps
function noise(f0, f1, dur, q, vol, attack = 0.01, out = sfxOut || sfxBus, t = ac && ac.currentTime) {
  if (!ac || muted || vol <= 0.002) return;
  try {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.playbackRate.value = 0.9 + Math.random() * 0.2;
    f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  } catch (e) { /* audio is optional */ }
}
function throttle(name, ms) { const n = performance.now(); if (n - (lastSfx[name] || 0) < ms) return false; lastSfx[name] = n; return true; }

// pan: -1 (left) to 1 (right), 0 in the middle; see sfxAt
export function sfx(name, v = 1, pan = 0) {
  if (!ac) return;
  const j = 0.88 + Math.random() * 0.24; // pitch jitter so repeats are not identical
  sfxOut = null;
  if (pan && ac.createStereoPanner) { try { const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(sfxBus); sfxOut = p; } catch (e) { sfxOut = null; } }
  try { play(name, v, j); } finally { sfxOut = null; }
}
function play(name, v, j) {
  switch (name) {
    case 'fire': noise(3200 * j, 650 * j, 0.32, 1.4, 0.32 * v, 0.012); tone(210 * j, 90, 0.18, 'sine', 0.06 * v); break;
    case 'hit': tone(240, 70, 0.14, 'square', 0.08 * v); noise(1800, 400, 0.12, 1, 0.12 * v); break;
    case 'kill': tone(200, 40, 0.45, 'sawtooth', 0.12 * v); tone(90, 30, 0.5, 'square', 0.1 * v); break;
    // tonal pickups use notes of the music's key (D, F#, A) instead of random pitches
    case 'mana': if (throttle(name, 70)) { const f = [1174.66, 1479.98, 1760][Math.floor(Math.random() * 3)]; tone(f, f * 1.003, 0.16, 'sine', 0.06 * v); tone(f * 2, f * 2.003, 0.25, 'sine', 0.02 * v); } break;
    case 'nova': tone(70, 520, 0.55, 'sawtooth', 0.12 * v); noise(300, 4000, 0.6, 0.8, 0.3 * v, 0.05); break;
    case 'hurt': tone(150, 45, 0.3, 'square', 0.14 * v); break;
    case 'level': [293.66, 369.99, 440, 587.33].forEach((f, i) => setTimeout(() => tone(f, f * 1.01, 0.5, 'triangle', 0.12 * v), i * 120)); break;
    case 'deposit': if (throttle(name, 90)) tone(587.33, 587.33 * 1.003, 0.1, 'triangle', 0.05 * v); break;
    case 'splash': if (throttle(name, 200)) noise(1200, 250, 0.6, 0.7, 0.25 * v, 0.02); break;
    case 'rumble': if (throttle(name, 300)) tone(55, 32, 0.9, 'square', 0.1 * v); break;
    case 'lob': tone(380, 180, 0.2, 'triangle', 0.07 * v); break;
    case 'breath': if (throttle(name, 110)) noise(900, 300, 0.25, 0.6, 0.2 * v, 0.03); break;
    case 'boom': tone(140, 38, 0.6, 'square', 0.13 * v); noise(600, 80, 0.7, 0.6, 0.25 * v); break;
    case 'flap': if (throttle(name, 250)) noise(500, 180, 0.3, 0.9, 0.18 * v, 0.06); break;
    case 'roar': tone(115, 42, 1.5, 'sawtooth', 0.22 * v); tone(72, 30, 1.7, 'square', 0.14 * v); tone(170, 60, 1.0, 'sawtooth', 0.08 * v); break;
    case 'bow': noise(2600, 900, 0.18, 2, 0.18 * v, 0.004); tone(196, 147, 0.12, 'triangle', 0.05 * v); break;
    // whoosh (the throttle engaging from a slow glide): a short airy swish (a high sweep falling fast) over a soft low push
    case 'whoosh': { const w = v * CFG.audio.windVolume / 0.18;
      noise(2600 * j, 700, 0.42, 1.1, 0.3 * w, 0.05); noise(260, 120, 0.5, 0.7, 0.22 * w, 0.08); break; }
  }
}
// Positional sound: louder the closer it is to the player (or camera on the title screen), and panned to the
// side it is on, relative to the carpet's heading (the camera's on the title screen)
const camRight = new THREE.Vector3();
export function sfxAt(name, pos, range = 320) {
  const from = G.active ? G.playerPos : camera.position, d = pos.distanceTo(from);
  const v = clamp(1 - d / range, 0, 1);
  if (v <= 0.05) return;
  let pan = 0; const width = CFG.audio.stereoWidth ?? 0;
  if (width > 0) {
    const dx = pos.x - from.x, dz = pos.z - from.z, l = Math.hypot(dx, dz);
    const r = G.active ? G.rightV : camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    if (l > 1) pan = clamp((dx * r.x + dz * r.z) / l * width, -1, 1);
  }
  sfx(name, v, pan);
}

/* ---------- wind: a constant rush that follows the carpet's speed ---------- */
let windGain, windFilter;
function startWind() {
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  // low-passed (not band-passed) noise: a steady band-pass hiss in the 1-2 kHz range sounds like running water
  windFilter = ac.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.Q.value = 0.4; windFilter.frequency.value = 300;
  windGain = ac.createGain(); windGain.gain.value = 0;
  s.connect(windFilter); windFilter.connect(windGain); windGain.connect(sfxBus); s.start();
}

/* ---------- music: maqam Hijaz on D, drone + darbuka + ney, more intense in danger ---------- */
// Semitones from D4. Hijaz: D Eb F# G A Bb C D (with A3 and C4 below, Eb5 and F#5 above)
const SCALE = [-5, -2, 0, 1, 4, 5, 7, 8, 10, 12, 13, 16];
const ROOT_I = 2, FIFTH_I = 6;
const hz = st => 293.66 * Math.pow(2, st / 12);
// Maqsum in sixteenths: D = dum (low), T = tek (high), k = ka (soft fill, only in danger)
const MAQSUM = 'D.T...T.D...T...', FILL = '.k.k.k.k.k.k.kkk';
let step = 0, nextT = 0, intensity = 0, mel = { i: ROOT_I, left: 0, rest: 4, phrase: 0 };
let droneGain, droneFilter;

function startMusic() {
  droneFilter = ac.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 500; droneFilter.Q.value = 0.7;
  droneGain = ac.createGain(); droneGain.gain.value = 0.05;
  droneFilter.connect(droneGain); droneGain.connect(musicBus);
  // soft, in-tune drone: D2, D3 and A3
  for (const [f, type, vol] of [[hz(-24), 'sine', 0.9], [hz(-12), 'triangle', 0.5], [hz(-5), 'triangle', 0.25]]) {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = f;
    const g = ac.createGain(); g.gain.value = vol; o.connect(g); g.connect(droneFilter); o.start();
  }
  startNey();
  nextT = ac.currentTime + 0.1;
}
function dum(t, v) { tone(110, 52, 0.35, 'sine', 0.5 * v, musicBus, t); noise(240, 120, 0.12, 1.2, 0.12 * v, 0.003, musicBus, t); }
function tek(t, v) { noise(5200, 3600, 0.07, 2.5, 0.22 * v, 0.002, musicBus, t); }
// Ney: one continuous breathy voice that glides from note to note (legato) and breathes per phrase
let neyO, neyO2, neyGain, neyVib;
function startNey() {
  neyO = ac.createOscillator(); neyO.type = 'sine'; neyO.frequency.value = hz(0);
  neyO2 = ac.createOscillator(); neyO2.type = 'triangle'; neyO2.frequency.value = hz(12);
  const lfo = ac.createOscillator(); lfo.frequency.value = 4.6;
  neyVib = ac.createGain(); neyVib.gain.value = 2; lfo.connect(neyVib); neyVib.connect(neyO.frequency);
  neyGain = ac.createGain(); neyGain.gain.value = 0;
  const g2 = ac.createGain(); g2.gain.value = 0.15; neyO2.connect(g2); g2.connect(neyGain);
  neyO.connect(neyGain); neyGain.connect(musicBus);
  [neyO, neyO2, lfo].forEach(x => x.start());
}
function neyNote(t, f, v, first) {
  const glide = first ? 0.01 : CFG.audio.melodyGlideSeconds / 3; // time constant: ~3x reaches the note
  neyO.frequency.setTargetAtTime(f, t, glide); neyO2.frequency.setTargetAtTime(f * 2, t, glide);
  neyVib.gain.setTargetAtTime(f * 0.006, t, 0.3);
  neyGain.gain.setTargetAtTime(0.15 * v, t, first ? 0.12 : 0.2);
  if (first) noise(f * 3, f * 2.5, 0.35, 3, 0.04 * v, 0.08, musicBus, t);
}
function neyBreathOut(t) { neyGain.gain.setTargetAtTime(0, t, 0.35); }
// Qanun-like pluck: two slightly detuned triangles through a closing low-pass, bright and quick to fade
function qanun(t, f, v) {
  try {
    const g = ac.createGain(), fl = ac.createBiquadFilter();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.085 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    fl.type = 'lowpass'; fl.Q.value = 0.8; fl.frequency.setValueAtTime(4200, t); fl.frequency.exponentialRampToValueAtTime(900, t + 0.5);
    for (const det of [0.997, 1.003]) { const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f * det; o.connect(fl); o.start(t); o.stop(t + 0.75); }
    fl.connect(g); g.connect(musicBus);
  } catch (e) { /* audio is optional */ }
}
// Oud-like pluck: bright saw through a closing low-pass
function oud(t, f, v) {
  try {
    const o = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.Q.value = 2;
    fl.frequency.setValueAtTime(1800, t); fl.frequency.exponentialRampToValueAtTime(300, t + 0.25);
    g.gain.setValueAtTime(0.12 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(fl); fl.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.4);
  } catch (e) { /* audio is optional */ }
}
// Melody: a walk on the scale in phrases that come to rest on D or A.
// Stable notes (D, F#, A) may be held; the others (Eb, G, Bb, C) are short passing notes that resolve by step.
const STABLE = new Set([0, 2, 4, 6, 9, 11]);
const RESOLVE = { 1: 2, 3: 2, 5: 4, 7: 6, 8: 9, 10: 9 }; // C->D, Eb->D, G->F#, Bb->A, C->D, Eb->D
// Note lengths in sixteenths: held notes are long, passing notes a full beat; mostly single steps.
function melodyStep(t, sixteenth) {
  if (mel.left > 0) { mel.left--; if (mel.left === 0 && mel.rest > 0) neyBreathOut(t); return; }
  if (mel.rest > 0) { mel.rest--; return; }
  const first = mel.phrase === 0;
  if (first) mel.oct = intensity > 0.6 ? 12 : 0; // octave only changes between phrases
  else if (!STABLE.has(mel.i)) mel.i = RESOLVE[mel.i];
  else {
    const r = Math.random(), mv = r < 0.42 ? 1 : r < 0.84 ? -1 : r < 0.92 ? 2 : -2;
    mel.i = clamp(mel.i + mv, 0, SCALE.length - 1);
  }
  mel.phrase++;
  let len = STABLE.has(mel.i) ? [4, 6, 8, 8, 12][Math.floor(Math.random() * 5)] : 4;
  if (mel.phrase >= 5 + Math.floor(Math.random() * 3)) {
    mel.i = Math.random() < 0.6 ? ROOT_I : FIFTH_I; len = 16; mel.phrase = 0; mel.rest = 12 + Math.floor(Math.random() * 20);
  }
  neyNote(t, hz(SCALE[mel.i] + (mel.oct || 0)), 0.8 + intensity * 0.4, first);
  mel.left = len - 1;
}
function scheduleStep(s, t, sixteenth) {
  const p = s % 16, I = intensity;
  const drum = 0.55 + I * 0.6;
  if (MAQSUM[p] === 'D') dum(t, drum);
  if (MAQSUM[p] === 'T') tek(t, drum);
  if (FILL[p] === 'k' && Math.random() < I) tek(t, drum * 0.45);
  // danger: oud ostinato on D, F# and A
  if (I > 0.25 && p % 2 === 0) oud(t, hz([-12, -12, -5, -12, -8, -5, -12, -5][(p / 2) | 0]), I);
  // calm: every other bar, a qanun run up or down the chord (D, F#, A, D an octave up), one note per sixteenth
  if (p === 0 && s % 32 === 0 && I < 0.5 && Math.random() < 0.7) {
    const run = [12, 16, 19, 24]; if (Math.random() < 0.4) run.reverse();
    run.forEach((st, i) => qanun(t + i * sixteenth, hz(st), (1 - I) * (0.9 - i * 0.1)));
  }
  melodyStep(t, sixteenth);
}
function dangerLevel() {
  if (!G.active) return 0;
  if (G.playTime - G.lastHurt < CFG.audio.dangerHoldSeconds) return 1;
  if (G.dragon && G.dragon.st !== 'roost' && G.dragon.st !== 'search') return 1;
  return G.enemies.some(e => e.state === 'chase') ? 0.55 : 0;
}

/* ---------- per frame ---------- */
export function updateAudio(dt) {
  if (!ac) return;
  const A = CFG.audio, t = ac.currentTime;
  // wind follows speed (silent at rest; at full speed about as loud as the old cruising speed)
  const sp = G.active ? clamp(Math.abs(G.speed) / CFG.player.baseSpeed, 0, 1) : 0;
  const gust = 0.75 + 0.25 * Math.sin(t * 0.7) * Math.sin(t * 0.31 + 1); // slow swells, so it reads as wind
  windGain.gain.setTargetAtTime(A.windVolume * sp * sp * gust * 0.4, t, 0.15);
  windFilter.frequency.setTargetAtTime((220 + sp * 280) * (0.85 + 0.3 * gust), t, 0.2);
  // music
  const playing = G.mode === 'play' || G.mode === 'title';
  musicBus.gain.setTargetAtTime(playing ? A.musicVolume : A.musicVolume * 0.35, t, 0.5);
  intensity = lerp(intensity, dangerLevel(), Math.min(1, dt * (dangerLevel() > intensity ? 1.5 : 0.25)));
  droneFilter.frequency.setTargetAtTime(450 + intensity * 900, t, 0.3);
  droneGain.gain.setTargetAtTime(0.05 + intensity * 0.03, t, 0.3);
  const bpm = lerp(A.tempoCalm, A.tempoDanger, intensity), sixteenth = 60 / bpm / 4;
  if (nextT < t) nextT = t + 0.02; // after a stall (tab hidden), don't race to catch up
  while (nextT < t + 0.15) { scheduleStep(step, nextT, sixteenth); step++; nextT += sixteenth; }
}
