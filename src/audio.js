// Tiny synthesised sound effects (Web Audio oscillators, no sound files).
import { G } from './state.js';
import { camera } from './scene.js';
import { clamp } from './util.js';

let ac = null, muted = false;
const lastSfx = {};
export function audioInit() {
  if (ac) return;
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
  if (ac && ac.state === 'suspended' && ac.resume) ac.resume();
}
export function toggleMute() { muted = !muted; return muted; }
function tone(f0, f1, dur, type, vol) {
  if (!ac || muted || vol <= 0.002) return;
  try {
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.03);
  } catch (e) { /* audio is optional */ }
}
function throttle(name, ms) { const n = performance.now(); if (n - (lastSfx[name] || 0) < ms) return false; lastSfx[name] = n; return true; }
export function sfx(name, v = 1) {
  switch (name) {
    case 'fire': tone(520, 140, 0.2, 'sawtooth', 0.07 * v); break;
    case 'hit': tone(240, 70, 0.14, 'square', 0.08 * v); break;
    case 'kill': tone(200, 40, 0.45, 'sawtooth', 0.12 * v); tone(90, 30, 0.5, 'square', 0.1 * v); break;
    case 'mana': if (throttle(name, 70)) tone(880, 1320, 0.12, 'sine', 0.07 * v); break;
    case 'nova': tone(70, 520, 0.55, 'sawtooth', 0.14 * v); break;
    case 'hurt': tone(150, 45, 0.3, 'square', 0.14 * v); break;
    case 'level': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, f * 1.01, 0.35, 'triangle', 0.12 * v), i * 110)); break;
    case 'deposit': if (throttle(name, 90)) tone(520, 620, 0.1, 'triangle', 0.05 * v); break;
    case 'splash': if (throttle(name, 200)) tone(320, 70, 0.55, 'triangle', 0.09 * v); break;
    case 'rumble': if (throttle(name, 300)) tone(55, 32, 0.9, 'square', 0.1 * v); break;
    case 'lob': tone(380, 180, 0.2, 'triangle', 0.07 * v); break;
    case 'breath': if (throttle(name, 110)) tone(170, 60, 0.18, 'sawtooth', 0.05 * v); break;
    case 'boom': tone(140, 38, 0.6, 'square', 0.13 * v); break;
    case 'flap': if (throttle(name, 250)) tone(85, 45, 0.32, 'triangle', 0.1 * v); break;
    case 'roar': tone(115, 42, 1.5, 'sawtooth', 0.22 * v); tone(72, 30, 1.7, 'square', 0.14 * v); tone(170, 60, 1.0, 'sawtooth', 0.08 * v); break;
  }
}
// Positional sound: louder the closer it is to the player (or camera on the title screen)
export function sfxAt(name, pos, range = 320) {
  const d = pos.distanceTo(G.active ? G.playerPos : camera.position);
  const v = clamp(1 - d / range, 0, 1);
  if (v > 0.05) sfx(name, v);
}
