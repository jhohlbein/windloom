// Keyboard, mouse and touch input. Writes into G.keys and G.input; flight logic reads them in player.js.
import { G } from './state.js';
import { canvas } from './scene.js';
import { clamp } from './util.js';
import { CFG } from './config.js';
import { audioInit } from './audio.js';

/* ---------- pointer lock and fullscreen ---------- */
// With pointer lock the cursor is hidden and cannot leave the window; mouse movement then drives a virtual
// steering stick (vx, vy in pixels from the centre) instead of the cursor position. Esc releases the lock.
let vx = 0, vy = 0;
export const pointerLocked = () => document.pointerLockElement === canvas;
export function lockPointer() {
  if (!CFG.controls.pointerLock || pointerLocked() || !canvas.requestPointerLock) return;
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

export function bindControls({ onPause, onMute, onBlur, onLockLost }) {
  const I = G.input;
  window.addEventListener('keydown', e => {
    G.keys[e.code] = true;
    if (e.code === 'Escape' || e.code === 'KeyP') { onPause(); return; }
    if (e.code === 'KeyM') { onMute(); return; }
    if (e.code === 'KeyF' && !e.repeat) { toggleFullscreen(); return; }
    if (!G.active) return;
    if (e.code === 'KeyE' && !e.repeat) I.novaReq = true;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
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
    if (e.pointerType !== 'mouse') return;
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
    if (e.pointerType !== 'mouse') return;
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
  bindHold('btnBoost', () => { I.touchBoost = true; }, () => { I.touchBoost = false; });
  bindHold('btnBack', () => { I.touchBack = true; }, () => { I.touchBack = false; });
  bindHold('btnLeft', () => { I.touchLeft = true; }, () => { I.touchLeft = false; });
  bindHold('btnRight', () => { I.touchRight = true; }, () => { I.touchRight = false; });
}

/* ---------- tilt steering (phones) ---------- */
// Tilting the phone left/right steers, tipping it towards/away from you climbs/dives, relative to how it was
// held when the game started or resumed. The device angles are turned into the direction of "up" in screen
// coordinates, which works in portrait and landscape and has no jumps when the phone is held near upright.
// iOS asks for permission, which must be requested from a tap (see requestTilt).
let tiltOn = false, tiltZero = null, tiltBound = false;
const D2R = Math.PI / 180;
export const tiltAvailable = () => typeof window.DeviceOrientationEvent !== 'undefined' && matchMedia('(pointer:coarse)').matches;
export function recentreTilt() { tiltZero = null; }
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
  const pitch = Math.hypot(sy, z) > 0.35 ? Math.atan2(sy, z) : (tiltZero ? tiltZero.last : 0);
  if (!tiltZero) tiltZero = { roll, pitch };
  tiltZero.last = pitch;
  const T = CFG.controls.tilt, dz = T.deadzoneDegrees * D2R;
  const axis = (v, max) => { const a = Math.abs(v); return a < dz ? 0 : clamp(Math.sign(v) * (a - dz) / (max * D2R - dz), -1, 1); };
  let dp = pitch - tiltZero.pitch; if (dp > Math.PI) dp -= 2 * Math.PI; if (dp < -Math.PI) dp += 2 * Math.PI;
  I.tiltX = axis(roll - tiltZero.roll, T.steerDegrees);
  I.tiltY = axis(dp, T.pitchDegrees) * (T.invertPitch ? -1 : 1);
}
// Switches tilt steering on or off. Call from a tap: on iOS that is the only moment permission can be asked.
export function requestTilt(on) {
  tiltOn = false; G.input.tiltX = G.input.tiltY = 0; recentreTilt();
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
  for (const k in G.keys) delete G.keys[k];
}
