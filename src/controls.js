// Keyboard, mouse and touch input. Writes into G.keys and G.input; flight logic reads them in player.js.
import { G } from './state.js';
import { canvas } from './scene.js';
import { clamp } from './util.js';
import { audioInit } from './audio.js';

export function bindControls({ onPause, onMute, onBlur }) {
  const I = G.input;
  window.addEventListener('keydown', e => {
    G.keys[e.code] = true;
    if (e.code === 'Escape' || e.code === 'KeyP') { onPause(); return; }
    if (e.code === 'KeyM') { onMute(); return; }
    if (!G.active) return;
    if (e.code === 'KeyE' && !e.repeat) I.novaReq = true;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', e => { G.keys[e.code] = false; });
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', () => { if (document.hidden) onBlur(); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Mouse: offset from screen centre steers (dead zone in the middle). Touch: drag from where the finger lands.
  let steerTouch = null;
  canvas.addEventListener('pointerdown', e => {
    audioInit();
    if (!G.active) return;
    if (e.pointerType === 'mouse') {
      if (e.button === 0) I.mouseFire = true;
      else if (e.button === 2) I.novaReq = true;
    } else {
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
    if (e.pointerType === 'mouse') { if (e.button === 0) I.mouseFire = false; return; }
    if (steerTouch && steerTouch.id === e.pointerId) { steerTouch = null; I.touchX = 0; I.touchY = 0; }
  };
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);
  window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && e.button === 0) I.mouseFire = false; });
  window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const w = window.innerWidth, h = window.innerHeight, s = Math.min(w, h) * 0.36, dz = 0.07;
    const shape = v => { const a = Math.abs(v); return a < dz ? 0 : Math.sign(v) * (a - dz) / (1 - dz); };
    I.mouseX = shape(clamp((e.clientX - w / 2) / s, -1, 1));
    I.mouseY = shape(clamp(-(e.clientY - h / 2) / s, -1, 1));
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
}

export function releaseInput() {
  const I = G.input;
  I.mouseFire = I.touchFire = I.touchBoost = I.touchBack = false; I.mouseX = I.mouseY = 0;
  for (const k in G.keys) delete G.keys[k];
}
