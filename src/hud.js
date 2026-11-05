// HUD: vitals, palace progress, radar, toasts, and the 2D overlay with enemy health bars.
import * as THREE from 'three';
import { CFG } from './config.js';
import { G, W } from './state.js';
import { camera } from './scene.js';
import { clamp, smooth, TAU } from './util.js';
import { carryCap } from './progress.js';
import { SIZE } from './terrain.js';
import { formatClock } from './round.js';

const $ = id => document.getElementById(id);
export const hud = $('hud');
const elHpLbl = $('hpLbl'), elHp = $('hpFill'), elSpLbl = $('spLbl'), elSp = $('spFill'), elMana = $('manaNum'), elCap = $('manaCap'), elStage = $('stage'),
  elCastle = $('castleFill'), elCastleTxt = $('castleTxt'), elToast = $('toast'), elHurt = $('hurt'), elSteer = $('steer'), elClock = $('clock');
const rctx = $('radar').getContext('2d');
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
// Messages stay up long enough to read (longer text, longer time; config "hud"). Minor ones ("Wyvern slain",
// "Sound on") never replace an important message that is still showing; an important one replaces another
// only after that has been up for toastMinShowSeconds, otherwise it waits in a short queue.
let toastTimer = 0, toastShown = 0, toastMinor = true;
const toastQueue = [];
function showToast(msg, secs, minor) {
  elToast.textContent = msg; elToast.classList.add('on');
  toastTimer = secs; toastShown = 0; toastMinor = minor;
}
export function toast(msg, ms = 2400, minor = false) {
  const H = CFG.hud, secs = minor ? Math.max(ms / 1000, 1.2) : Math.max(ms / 1000, H.toastMinSeconds, H.toastBaseSeconds + H.toastSecondsPerChar * msg.length);
  const busy = toastTimer > 0 && !toastMinor;
  if (minor && busy) return;
  if (!minor && busy && toastShown < H.toastMinShowSeconds) {
    if (toastQueue.length < 2 && !toastQueue.some(q => q.msg === msg) && elToast.textContent !== msg) toastQueue.push({ msg, secs });
    return;
  }
  showToast(msg, secs, minor);
}
export function updateToast(dt) {
  if (toastTimer <= 0) return;
  toastTimer -= dt; toastShown += dt;
  if (toastQueue.length && !toastMinor && toastShown >= CFG.hud.toastMinShowSeconds && toastTimer < 0.6) { const q = toastQueue.shift(); showToast(q.msg, q.secs, false); return; }
  if (toastTimer <= 0) {
    if (toastQueue.length) { const q = toastQueue.shift(); showToast(q.msg, q.secs, false); }
    else elToast.classList.remove('on');
  }
}
export function clearToasts() { toastQueue.length = 0; toastTimer = 0; elToast.classList.remove('on'); }
export function flashHurt() { elHurt.style.opacity = '1'; setTimeout(() => { elHurt.style.opacity = '0'; }, 180); }
export const stageLabel = L => CFG.palace.stageNames[L - 1] + ' · ' + NUMERALS[L - 1];

const cache = {};
function setText(el, key, v) { if (cache[key] !== v) { cache[key] = v; el.textContent = v; } }
export function updateHud() {
  const hpPct = clamp(G.hp / G.maxHp, 0, 1);
  elHp.style.width = (hpPct * 100).toFixed(1) + '%';
  setText(elHpLbl, 'hl', G.hp < G.maxHp && G.playTime - G.lastHurt > CFG.player.regenDelaySeconds ? 'Vitality · mending' : 'Vitality');
  elSp.style.width = (clamp(G.spellMana / CFG.spells.mana.max, 0, 1) * 100).toFixed(1) + '%';
  elSp.classList.toggle('out', G.spellExhausted);
  setText(elSpLbl, 'sl', G.spellExhausted ? 'Spell mana · recovering' : 'Spell mana');
  setText(elMana, 'm', String(Math.floor(G.carried)));
  setText(elCap, 'c', G.carried >= carryCap() ? '/ ' + carryCap() + ' full' : '/ ' + carryCap());
  const full = G.carried >= carryCap();
  elMana.classList.toggle('full', full); elCap.classList.toggle('full', full);
  setText(elStage, 's', stageLabel(G.level));
  const T = CFG.palace.stageThresholds, last = T.length;
  const lo = T[G.level - 1], hi = G.level < last ? T[G.level] : T[last - 1];
  const frac = G.level >= last ? 1 : clamp((G.castleMana - lo) / (hi - lo), 0, 1);
  elCastle.style.width = (frac * 100).toFixed(1) + '%';
  setText(elCastleTxt, 'ct', G.level >= last ? 'Complete' : Math.floor(G.castleMana) + ' / ' + hi);
  elClock.hidden = !G.timed;
  setText(elClock, 'clk', formatClock(G.timeLeft));
  elClock.classList.toggle('warn', G.timeLeft <= CFG.round.warnSeconds);
  elSteer.style.transform = 'translate(' + (G.steerX * 70).toFixed(1) + 'px,' + (-G.steerY * 70).toFixed(1) + 'px)';
}

export function drawRadar() {
  const Wd = 224, c = 112, range = 320, k = (c - 8) / range, P = G.playerPos;
  rctx.clearRect(0, 0, Wd, Wd); rctx.save();
  rctx.beginPath(); rctx.arc(c, c, c - 2, 0, TAU); rctx.clip();
  rctx.fillStyle = '#1b4c78'; rctx.fillRect(0, 0, Wd, Wd); // open sea beyond the map
  const fx = -Math.sin(G.yaw), fz = -Math.cos(G.yaw), rx = Math.cos(G.yaw), rz = -Math.sin(G.yaw);
  if (W.map) {
    // bird's-eye map of the island, turned so that the flight direction points up (same mapping as toScreen)
    const a = k * rx, b = -k * fx, cc = k * rz, d = -k * fz, S = SIZE;
    rctx.save(); rctx.globalAlpha = 0.85;
    rctx.setTransform(a, b, cc, d, c - (a * P.x + cc * P.z), c - (b * P.x + d * P.z));
    rctx.imageSmoothingEnabled = true; rctx.drawImage(W.map, -S / 2, -S / 2, S, S);
    rctx.restore();
  }
  rctx.fillStyle = 'rgba(20,15,34,.25)'; rctx.fillRect(0, 0, Wd, Wd); // darken a little so the dots stand out
  rctx.strokeStyle = 'rgba(247,238,221,.16)'; rctx.lineWidth = 1;
  [36, 72, 104].forEach(r => { rctx.beginPath(); rctx.arc(c, c, r, 0, TAU); rctx.stroke(); });
  rctx.beginPath(); rctx.moveTo(c, 6); rctx.lineTo(c, Wd - 6); rctx.moveTo(6, c); rctx.lineTo(Wd - 6, c); rctx.stroke();
  function toScreen(x, z, clampEdge) {
    const dx = x - P.x, dz = z - P.z;
    const sx = dx * rx + dz * rz, sy = dx * fx + dz * fz;
    let px = sx * k, py = -sy * k; const d = Math.hypot(px, py);
    if (d > c - 10) { if (!clampEdge) return null; px *= (c - 10) / d; py *= (c - 10) / d; }
    return [c + px, c + py];
  }
  function diamond(s, r) { rctx.beginPath(); rctx.moveTo(s[0], s[1] - r); rctx.lineTo(s[0] + r * 0.85, s[1]); rctx.lineTo(s[0], s[1] + r); rctx.lineTo(s[0] - r * 0.85, s[1]); rctx.closePath(); }
  rctx.fillStyle = '#ffcf63';
  for (const o of G.orbs) { const s = toScreen(o.pos.x, o.pos.z, false); if (s) rctx.fillRect(s[0] - 1.2, s[1] - 1.2, 2.6, 2.6); }
  for (const e of G.enemies) {
    const RD = e.radar, s = toScreen(e.pos.x, e.pos.z, !!RD.edge); if (!s) continue;
    rctx.globalAlpha = e.targetable() ? 1 : 0.4; rctx.fillStyle = RD.c;
    if (e.kind === 'dragon') { diamond(s, 9); rctx.fill(); rctx.strokeStyle = '#f7eedd'; rctx.lineWidth = 1.5; rctx.stroke(); }
    else { rctx.beginPath(); rctx.arc(s[0], s[1], RD.s, 0, TAU); rctx.fill(); }
  }
  rctx.globalAlpha = 1;
  const cs = toScreen(W.CX, W.CZ, true);
  rctx.fillStyle = '#5fe0d6'; diamond(cs, 7); rctx.fill();
  rctx.fillStyle = '#f7eedd'; rctx.beginPath(); rctx.moveTo(c, c - 8); rctx.lineTo(c + 5.5, c + 6); rctx.lineTo(c, c + 3); rctx.lineTo(c - 5.5, c + 6); rctx.closePath(); rctx.fill();
  rctx.restore();
  rctx.strokeStyle = 'rgba(247,238,221,.35)'; rctx.lineWidth = 2; rctx.beginPath(); rctx.arc(c, c, c - 2, 0, TAU); rctx.stroke();
}

/* ---------- enemy health bars ---------- */
const fxc = $('fx'), fctx = fxc.getContext('2d');
let fxW = 1, fxH = 1, fxDpr = 1;
export function resizeFx() { fxDpr = Math.min(window.devicePixelRatio || 1, 2); fxW = window.innerWidth; fxH = window.innerHeight; fxc.width = Math.round(fxW * fxDpr); fxc.height = Math.round(fxH * fxDpr); }
const projV = new THREE.Vector3(), camSpace = new THREE.Vector3();
const hpColor = f => f > 0.5 ? '#ff4d6d' : f > 0.25 ? '#ff8a3d' : '#ffcf63';
const spacing = (px) => { if ('letterSpacing' in fctx) fctx.letterSpacing = px; };
export function drawBars() {
  fctx.setTransform(fxDpr, 0, 0, fxDpr, 0, 0);
  fctx.clearRect(0, 0, fxW, fxH);
  if (G.mode !== 'play') return;
  const cx = fxW / 2, cy = fxH / 2, md = Math.min(fxW, fxH);
  fctx.textAlign = 'center'; fctx.textBaseline = 'bottom';
  spacing('1.5px');
  fctx.font = "500 10px 'IBM Plex Mono', ui-monospace, monospace";
  for (const e of G.enemies) {
    if (!e.showBar()) continue;
    e.barPos(projV);
    const d = projV.distanceTo(camera.position);
    if (d > (e.kind === 'dragon' ? 950 : 540)) continue;
    camSpace.copy(projV).applyMatrix4(camera.matrixWorldInverse);
    if (camSpace.z > -1) continue;
    projV.project(camera);
    const sx = (projV.x + 1) / 2 * fxW, sy = (1 - projV.y) / 2 * fxH;
    const cd = Math.hypot(sx - cx, sy - cy) / md;
    const a = Math.max(smooth(0.30, 0.15, cd), Math.min(1, e.barT));
    if (a <= 0.02) continue;
    const w = e.kind === 'dragon' ? 130 : e.kind === 'wyvern' ? 44 : 62, h = e.kind === 'dragon' ? 7 : 5;
    const x = Math.round(sx - w / 2), y = Math.round(sy);
    const f = clamp(e.hp / e.maxHp, 0, 1), gf = clamp(e.ghost / e.maxHp, 0, 1);
    fctx.globalAlpha = a;
    fctx.fillStyle = 'rgba(20,15,34,.75)'; fctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    fctx.fillStyle = 'rgba(247,238,221,.6)'; fctx.fillRect(x, y, w * gf, h);
    fctx.fillStyle = hpColor(f); fctx.fillRect(x, y, w * f, h);
    fctx.fillStyle = '#f7eedd'; fctx.fillText(e.name.toUpperCase(), sx, y - 4);
  }
  fctx.globalAlpha = 1;
  const D = G.dragon;
  if (D && D.st !== 'roost') {
    const wide = fxW >= 720, bw = wide ? Math.min(440, fxW - 460) : fxW - 32, bx = Math.round((fxW - bw) / 2), by = wide ? 72 : 156;
    const df = clamp(D.hp / D.maxHp, 0, 1), dg = clamp(D.ghost / D.maxHp, 0, 1);
    fctx.font = "700 13px Syne, 'Helvetica Neue', Arial, sans-serif"; spacing('2px');
    fctx.fillStyle = '#ff4d6d'; fctx.fillText('VHAROTH, THE ASH WYRM', fxW / 2, by - 6);
    fctx.fillStyle = 'rgba(20,15,34,.8)'; fctx.fillRect(bx - 2, by - 2, bw + 4, 13);
    fctx.fillStyle = 'rgba(247,238,221,.6)'; fctx.fillRect(bx, by, bw * dg, 9);
    fctx.fillStyle = '#ff4d6d'; fctx.fillRect(bx, by, bw * df, 9);
    fctx.strokeStyle = 'rgba(255,77,109,.6)'; fctx.lineWidth = 1; fctx.strokeRect(bx - 2.5, by - 2.5, bw + 5, 14);
    const status = D.st === 'search' ? 'SEARCHING FOR YOU · ' + Math.ceil(Math.max(0, D.searchT)) + 's' : D.canSee ? 'HUNTING YOU' : 'TRACKING YOUR LAST POSITION';
    fctx.font = "500 10px 'IBM Plex Mono', ui-monospace, monospace"; fctx.textBaseline = 'top'; spacing('1.5px');
    fctx.fillStyle = D.canSee ? '#ff4d6d' : '#ffcf63'; fctx.fillText(status, fxW / 2, by + 16);
    fctx.textBaseline = 'bottom';
  }
  spacing('0px');
}
