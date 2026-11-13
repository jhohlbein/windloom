// Keyboard, mouse and touch input. Writes into G.keys and G.input; flight logic reads them in player.js.
import { G } from './state.js';
import { canvas } from './scene.js';
import { clamp } from './util.js';
import { CFG } from './config.js';
import { audioInit } from './audio.js';
import { settings } from './settings.js';

/* ---------- pointer lock and fullscreen ---------- */
// With pointer lock the cursor is hidden and cannot leave the window; mouse movement then drives a virtual
// steering stick (vx, vy in pixels from the centre) instead of the cursor position. Esc releases the lock.
let vx = 0, vy = 0;
export const pointerLocked = () => document.pointerLockElement === canvas;
export function lockPointer() {
  if (!CFG.controls.pointerLock || !settings.mouse || pointerLocked() || !canvas.requestPointerLock) return;
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { /* not allowed now */ }
}
export function unlockPointer() { if (pointerLocked() && document.exitPointerLock) document.exitPointerLock(); }
export const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const fsApi = () => document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
export const fullscreenAvailable = () => !!fsApi();
// Started from the Home Screen (installed): there are no browser bars to hide
export const runningInstalled = () => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;
// Enters full screen if possible; must be called from a tap or click
export function enterFullscreen() {
  if (isFullscreen() || runningInstalled() || !fsApi()) return;
  try { const p = fsApi().call(document.documentElement); if (p && p.catch) p.catch(() => { }); } catch (e) { /* not allowed now */ }
}
export function toggleFullscreen() {
  const d = document, el = d.documentElement;
  try {
    if (isFullscreen()) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else { const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (p && p.catch) p.catch(() => { }); }
  } catch (e) { /* fullscreen not available (e.g. iPhone) */ }
}

export function bindControls({ onPause, onMute, onBlur, onLockLost, onCentre }) {
  const I = G.input;
  window.addEventListener('keydown', e => {
    G.keys[e.code] = true;
    if (e.code === 'Escape' || e.code === 'KeyP') { onPause(); return; }
    if (e.code === 'KeyM') { onMute(); return; }
    if (e.code === 'KeyF' && !e.repeat) { toggleFullscreen(); return; }
    if (!G.active) return;
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) I.novaReq = true;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    // Steering with the arrow keys re-centres the mouse's virtual stick, which otherwise stays where the mouse
    // last left it and would keep adding a slight turn, climb or dive on top of the keys
    if (e.code.startsWith('Arrow') && !e.repeat) { vx = vy = 0; I.mouseX = I.mouseY = 0; }
  });
  window.addEventListener('keyup', e => { G.keys[e.code] = false; });
  window.addEventListener('blur', onBlur);
  document.addEventListener('pointerlockchange', () => { if (!pointerLocked()) { vx = vy = 0; onLockLost(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) onBlur(); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Mouse: offset from screen centre steers (dead zone in the middle). Touch: drag from where the finger lands.
  let steerTouch = null;
  // Mouse buttons are read from the e.buttons bitmask on every pointer event. Browsers send pointerdown only for
  // the first button pressed and pointerup only when the last one is released; a second button (e.g. right-click
  // for nova while holding fire) arrives as pointermove. Reading e.button alone left fire stuck on.
  let prevButtons = 0;
  const mouseButtons = e => {
    if (e.pointerType !== 'mouse' || !settings.mouse) return; // Settings → Mouse and trackpad off: keys only
    const b = e.buttons, pressed = b & ~prevButtons; prevButtons = b;
    if (!(b & 1)) I.mouseFire = false;
    if (!G.active || e.target !== canvas) return;
    if (G.mode === 'play' && !pointerLocked()) lockPointer(); // first click in the game captures the mouse
    if (pressed & 1) I.mouseFire = true;
    if (pressed & 2) I.novaReq = true;
  };
  window.addEventListener('pointerdown', mouseButtons);
  window.addEventListener('pointerup', mouseButtons);
  canvas.addEventListener('pointerdown', e => {
    audioInit();
    if (!G.active) return;
    if (e.pointerType !== 'mouse') {
      steerTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' && steerTouch && steerTouch.id === e.pointerId) {
      I.touchX = clamp((e.clientX - steerTouch.x) / 70, -1, 1); I.touchY = clamp(-(e.clientY - steerTouch.y) / 70, -1, 1);
    }
  });
  const endTouch = e => {
    if (e.pointerType === 'mouse') return;
    if (steerTouch && steerTouch.id === e.pointerId) { steerTouch = null; I.touchX = 0; I.touchY = 0; }
  };
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);
  window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !settings.mouse) return;
    if (e.buttons !== prevButtons) mouseButtons(e);
    const w = window.innerWidth, h = window.innerHeight, s = Math.min(w, h) * 0.36, dz = 0.07;
    const shape = v => { const a = Math.abs(v); return a < dz ? 0 : Math.sign(v) * (a - dz) / (1 - dz); };
    if (pointerLocked()) {
      // relative movement moves the virtual stick; it stays where you leave it, like the cursor did
      const k = CFG.controls.lockedSensitivity;
      vx = clamp(vx + e.movementX * k, -s, s); vy = clamp(vy + e.movementY * k, -s, s);
    } else { vx = e.clientX - w / 2; vy = e.clientY - h / 2; }
    I.mouseX = shape(clamp(vx / s, -1, 1));
    I.mouseY = shape(clamp(-vy / s, -1, 1));
  });

  // On-screen buttons for touch devices
  const bindHold = (id, on, off) => {
    const b = document.getElementById(id);
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audioInit(); b.classList.add('down'); on(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => b.addEventListener(n, () => { b.classList.remove('down'); off(); }));
  };
  bindHold('btnFire', () => { I.touchFire = true; }, () => { I.touchFire = false; });
  bindHold('btnNova', () => { I.novaReq = true; }, () => { });
  bindHold('btnCentre', () => { recentreTilt(); if (onCentre) onCentre(); }, () => { });
  bindHold('btnPause', () => { onPause(); }, () => { });
  // Four-way pad: the direction from the pad's centre to the finger picks go (up), back (down) and strafe
  // (left/right); between two arms both are on, so speeding up and strafing work together. The finger may slide off the pad.
  const pad = document.getElementById('dpad'), arms = {};
  for (const k of ['up', 'down', 'left', 'right']) arms[k] = pad.querySelector('.' + k);
  let padId = null;
  const padSet = (u, d, l, r) => {
    I.touchBoost = u; I.touchBack = d; I.touchLeft = l; I.touchRight = r;
    arms.up.classList.toggle('on', u); arms.down.classList.toggle('on', d); arms.left.classList.toggle('on', l); arms.right.classList.toggle('on', r);
  };
  const padMove = e => {
    const b = pad.getBoundingClientRect(), dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2), len = Math.hypot(dx, dy);
    if (len < b.width * 0.12) { padSet(false, false, false, false); return; } // resting on the hub: nothing
    const nx = dx / len, ny = dy / len, s = 0.38; // sin(22.5 deg): eight directions
    padSet(ny < -s, ny > s, nx < -s, nx > s);
  };
  pad.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); audioInit(); padId = e.pointerId;
    try { pad.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
    padMove(e);
  });
  pad.addEventListener('pointermove', e => { if (e.pointerId === padId) padMove(e); });
  const padEnd = e => { if (e.pointerId === padId) { padId = null; padSet(false, false, false, false); } };
  pad.addEventListener('pointerup', padEnd); pad.addEventListener('pointercancel', padEnd);
  // tilt: a new screen orientation changes which way is "left", so the centre is taken again
  const reorient = () => recentreTilt();
  window.addEventListener('orientationchange', reorient);
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', reorient);
}

/* ---------- tilt steering (phones) ---------- */
// Tilting the phone left/right steers, tipping it towards/away from you climbs/dives, relative to how it was
// held when the game started or resumed. The device angles are turned into the direction of "up" in screen
// coordinates, which works in portrait and landscape and has no jumps when the phone is held near upright.
// iOS asks for permission, which must be requested from a tap (see requestTilt).
// Centring: for a short moment after start, resume, a turn of the screen or the Centre button, the readings are
// averaged (and steering is neutral); that average becomes the centre. One reading taken while the finger is
// still lifting from the button would be off by several degrees.
let tiltOn = false, tiltZero = null, tiltBound = false, settle = null;
const D2R = Math.PI / 180, SETTLE_MS = 400;
export const tiltAvailable = () => typeof window.DeviceOrientationEvent !== 'undefined' && matchMedia('(pointer:coarse)').matches;
export function recentreTilt() { tiltZero = null; settle = null; G.input.tiltX = G.input.tiltY = 0; }
function onOrientation(e) {
  const I = G.input;
  if (!tiltOn || e.beta == null || e.gamma == null) { I.tiltX = I.tiltY = 0; return; }
  const b = e.beta * D2R, g = e.gamma * D2R;
  const x = -Math.cos(b) * Math.sin(g), y = Math.sin(b), z = Math.cos(b) * Math.cos(g); // "up" in device axes
  const ang = ((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0) % 360;
  let sx = x, sy = y; // ... and in screen axes (x right, y up)
  if (ang === 90) { sx = -y; sy = x; } else if (ang === 270 || ang === -90) { sx = y; sy = -x; } else if (ang === 180 || ang === -180) { sx = -x; sy = -y; }
  const roll = Math.asin(clamp(-sx, -1, 1)); // right edge down = +roll
  // top edge up = +pitch; undefined when the phone is rolled onto its side, so keep the last value then
  const pitch = Math.hypot(sy, z) > 0.35 ? Math.atan2(sy, z) : (tiltZero ? tiltZero.last : settle ? settle.p / Math.max(1, settle.n) : 0);
  if (!tiltZero) {
    const now = performance.now();
    if (!settle) settle = { t: now, r: 0, p: 0, n: 0 };
    settle.r += roll; settle.p += pitch; settle.n++;
    I.tiltX = I.tiltY = 0;
    if (now - settle.t < SETTLE_MS) return;
    tiltZero = { roll: settle.r / settle.n, pitch: settle.p / settle.n }; settle = null;
  }
  tiltZero.last = pitch;
  const T = CFG.controls.tilt, dz = T.deadzoneDegrees * D2R;
  const axis = (v, max) => { const a = Math.abs(v); return a < dz ? 0 : clamp(Math.sign(v) * (a - dz) / (max * D2R - dz), -1, 1); };
  let dp = pitch - tiltZero.pitch; if (dp > Math.PI) dp -= 2 * Math.PI; if (dp < -Math.PI) dp += 2 * Math.PI;
  I.tiltX = axis(roll - tiltZero.roll, T.steerDegrees);
  I.tiltY = axis(dp, T.pitchDegrees) * (T.invertPitch ? -1 : 1);
}
// Switches tilt steering on or off. Call from a tap: on iOS that is the only moment permission can be asked.
export function requestTilt(on) {
  tiltOn = false; recentreTilt();
  if (!on || !tiltAvailable()) return;
  const start = () => { tiltOn = true; if (!tiltBound) { tiltBound = true; window.addEventListener('deviceorientation', onOrientation); } };
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    try { DOE.requestPermission().then(r => { if (r === 'granted') start(); }).catch(() => { }); } catch (e) { /* not from a tap */ }
  } else start();
}

export function releaseInput() {
  const I = G.input;
  I.mouseFire = I.touchFire = I.touchBoost = I.touchBack = I.touchLeft = I.touchRight = false; I.mouseX = I.mouseY = 0; I.novaReq = false; vx = vy = 0;
  G.keyPitch = 0; G.keyTurn = 0;
  for (const k in G.keys) delete G.keys[k];
}
