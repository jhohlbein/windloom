// Tutorial: a practice island (fixed seed) that teaches one task at a time. Numbers in the config section "tutorial".
// 0. The HUD: the bars (top left), then the map (top right), each highlighted until a click, tap or Enter; the
//    carpet holds still meanwhile.
// 1. Five flying lessons, in order, shown as chips 1/5 … 5/5 that turn green: look up and down, turn left and
//    right, slide sideways (strafe), surge, brake. 2. Gather manaGoal mana (several times that appears around the
//    palace once the lessons are done). 3. Bank it in the beam (banking is off until this task). 4. Slay the wyverns
//    that now appear (fireballs). 5. Find a group of skeleton archers and blast them with a nova. 6. Bank the
//    creatures' mana. Then done.
// No creatures appear on their own, there is no clock, and the carpet cannot fall (vitality stops at 1).
import * as THREE from 'three';
import { CFG } from './config.js';
import { G, W } from './state.js';
import { TAU } from './util.js';
import { groundH } from './terrain.js';
import { spawnOrb } from './combat.js';
import { spawnFlyerNear, spawnSkeletonGroup } from './creatures/spawn.js';
import { countKind } from './creatures/common.js';
import { toast, lineBySentence } from './hud.js';
import { sfx } from './audio.js';
import { tiltAvailable, releaseInput } from './controls.js';
import { settings } from './settings.js';

const $ = id => document.getElementById(id);
const hudEl = $('hud'), elToast = $('toast'), panel = $('task'), elName = $('taskName'), elChips = $('taskChips'), elCount = $('taskCount'), elText = $('taskText'), elCont = $('taskCont');
const touch = () => window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
const tilt = () => settings.tilt && tiltAvailable();

// The HUD pages before the lessons: the element to highlight, a name, a short text (one line per thing shown)
// and which of that element's pages it is. demo: the empty bars, or the map, blink with sample contents (see
// #vitals.demo in style.css and drawRadar in hud.js), or the beam flashes (updatePalace), until the page is turned
const cont = () => touch() ? 'Tap to continue …' : 'Press Enter or click to continue …';
const HUD_PAGES = [
  { el: 'vitals', name: 'Your bars', text: 'Red is vitality; your palace\'s beam heals it.\nBlue is spell mana for your spells.', n: 1, of: 2 },
  { el: 'vitals', name: 'Your bars', text: 'Gold is the mana you carry.\nGreen is your palace\'s next stage.', n: 2, of: 2, demo: 'bars' },
  { el: 'radarWrap', name: 'Your map', text: 'Up is where you fly; the arrow is you.\nThe turquoise diamond is your palace.', n: 1, of: 2 },
  { el: 'radarWrap', name: 'Your map', text: 'Gold specks are mana.\nColoured dots are creatures.', n: 2, of: 2, demo: 'map' },
  { el: null, name: 'The beam', text: 'This golden beam rises from your palace.\nFly into it to bank mana and heal.', n: 1, of: 1, demo: 'beam' }
];

// The flying lessons; each test is checked every frame and only for the current lesson, so they go in order
const LESSONS = [
  {
    name: 'Look up and down',
    text: () => tilt() ? 'Tip the phone towards you and away from you (or drag up and down) to climb and dive.'
      : touch() ? 'Drag up and down on the screen to climb and dive.'
        : 'Move the mouse up and down (or press ↑ and ↓) to climb and dive.',
    test: t => both(t, 'up', G.steerY > t.th, 'down', G.steerY < -t.th)
  },
  {
    name: 'Turn left and right',
    text: () => tilt() ? 'Tilt the phone left and right (or drag sideways) to turn.'
      : touch() ? 'Drag left and right on the screen to turn.'
        : 'Move the mouse left and right (or press ← and →) to turn.',
    test: t => both(t, 'left', G.steerX < -t.th, 'right', G.steerX > t.th)
  },
  {
    name: 'Slide sideways',
    text: () => touch() ? 'Press left and right on the pad to slide sideways without turning.'
      : 'Press A and D to slide sideways without turning.',
    test: t => both(t, 'sLeft', G.strafe < -t.strafe, 'sRight', G.strafe > t.strafe)
  },
  {
    name: 'Surge',
    text: () => touch() ? 'Press up on the pad (Surge) for a burst of speed. Held, it comes again every 2 seconds.'
      : 'Press W for a burst of speed. Held, it comes again every 2 seconds.',
    test: () => G.surging
  },
  {
    name: 'Brake',
    text: () => touch() ? 'Hold down on the pad (Back) to brake and fly backwards. Between two arms of the pad you do both, for example surge and slide.'
      : 'Hold S to brake and fly backwards.',
    test: () => G.speed < 0
  }
];

// Both directions must have happened, in any order (each is remembered once seen)
function both(t, a, aNow, b, bNow) { if (aNow) t[a] = true; if (bNow) t[b] = true; return !!(t[a] && t[b]); }

// Task texts after the lessons: name, text and (optional) progress counter, by step
const TASKS = {
  gather: () => ['Gather mana', 'Fly through the golden orbs around your palace to gather their mana. Close by, they are drawn to you.', count(G.carried, CFG.tutorial.manaGoal)],
  bank: () => ['Bank it in the beam', 'Fly home into the golden beam above your palace (the turquoise diamond on the map). The mana you carry is banked there.', count(G.castleMana, CFG.tutorial.manaGoal)],
  fight: () => ['Slay the wyverns', 'Wyverns are coming (red dots on the map). Aim at them and ' + (touch() ? 'hold Fire' : 'click or press Space') +
    ' to throw fireballs; they curve a little towards a creature near your aim.', count(CFG.tutorial.wyverns - countKind('wyvern'), CFG.tutorial.wyverns)],
  skeletons: T => ['Nova the skeletons', 'Skeleton archers have risen (pale dots on the map). Fly in close and ' +
    (touch() ? 'tap Nova' : 'right-click or press E') + ' to strike them all at once.', count(T.skel - countKind('skeleton'), T.skel)],
  bankAgain: () => ['Bring their mana home', 'Slain creatures drop mana. Gather it and bank it in the beam.']
};
const count = (n, of) => Math.min(of, Math.floor(n)) + ' / ' + of;

function show(name, text, count) {
  elName.textContent = name; elText.textContent = lineBySentence(text); elCount.textContent = count || '';
  elCount.hidden = !count;
}
function chips(T) {
  elChips.hidden = T.step !== 'lessons';
  if (elChips.hidden) return;
  elChips.innerHTML = LESSONS.map((l, i) => '<i class="' + (i < T.lesson ? 'done' : i === T.lesson ? 'now' : '') + '">' + (i + 1) + '/' + LESSONS.length + '</i>').join('');
}
// A finished task: green border and a tick on its name for pauseSeconds before the next task appears
function complete(T, then) {
  T.next = then; T.wait = CFG.tutorial.pauseSeconds;
  panel.classList.add('complete'); elName.textContent = '✓ ' + elName.textContent;
  panel.classList.remove('pop'); void panel.offsetWidth; panel.classList.add('pop'); sfx('mana');
}
// The panel keeps the height of its tallest task (measured with every text at the current width), so the
// messages below it never jump when the text changes
function fitPanel() {
  const T = G.tut; if (!T || panel.hidden) return;
  if (T.step === 'hud') { panel.style.minHeight = ''; return; } // the HUD pages size to their own text
  const keep = [elName.textContent, elText.textContent, elCount.textContent, elCount.hidden, elChips.hidden, elChips.innerHTML];
  panel.style.minHeight = '';
  let tallest = 0;
  const measure = (name, text, cnt, withChips) => {
    elChips.hidden = !withChips; show('✓ ' + name, text, cnt ? '50 / 50' : '');
    tallest = Math.max(tallest, panel.offsetHeight);
  };
  chips({ step: 'lessons', lesson: 0 });
  for (const l of LESSONS) measure(l.name, l.text(), false, true);
  for (const k in TASKS) { const [n, t, c] = TASKS[k]({ skel: 4 }); measure(n, t, c, false); }
  [elName.textContent, elText.textContent, elCount.textContent, elCount.hidden, elChips.hidden, elChips.innerHTML] = keep;
  panel.style.minHeight = tallest + 'px';
}
window.addEventListener('resize', () => requestAnimationFrame(fitPanel));

// Mana for the tutorial: orbs on land around the palace that never expire, several times the goal in total
function scatterOrbs() {
  const T = CFG.tutorial;
  for (let i = 0, tries = 0; i < T.orbCount && tries < T.orbCount * 30; tries++) {
    const a = Math.random() * TAU, r = T.orbRadiusMin + Math.random() * (T.orbRadiusMax - T.orbRadiusMin);
    const x = W.CX + Math.cos(a) * r, z = W.CZ + Math.sin(a) * r, h = groundH(x, z);
    if (h < 1.5 || h > CFG.world.ceiling - 6) continue;
    spawnOrb(new THREE.Vector3(x, h + 2.4, z), T.orbValue, null, true); i++;
  }
}

// Called by startGame for the tutorial (island, player and creatures are already reset)
export function startTutorial() {
  const T = CFG.tutorial;
  G.tut = { step: 'hud', page: 0, lesson: 0, wait: 0, next: null, th: T.lookThreshold, strafe: CFG.player.strafeSpeed * 0.5, deposit: false, banked0: 0, skel: 0, done: false };
  hudEl.classList.add('tut'); panel.hidden = false;
  enter(G.tut);
  requestAnimationFrame(fitPanel); // once the HUD is shown (it is still hidden while the game starts)
}
export function stopTutorial() { spot(null); $('vitals').classList.remove('demo'); G.tut = null; panel.hidden = true; panel.style.minHeight = ''; hudEl.classList.remove('tut'); elToast.style.top = ''; }
// Messages sit just below the task panel
function placeToast() { const top = Math.round(panel.getBoundingClientRect().bottom + 14) + 'px'; if (elToast.style.top !== top) elToast.style.top = top; }

// Highlights one HUD element (or none)
function spot(id) { for (const p of HUD_PAGES) if (p.el) $(p.el).classList.toggle('spot', p.el === id); }
// The carpet holds still (no flying, no spells) while the HUD is explained
export const tutorialHolds = () => !!(G.tut && G.tut.step === 'hud');
// A click, tap or Enter/Space turns the HUD pages (only while playing, so the pause screen's buttons do not)
function nextPage(e) {
  const T = G.tut; if (!T || T.step !== 'hud' || G.mode !== 'play') return;
  if (e.target && e.target.closest && e.target.closest('button')) return; // Pause and the spell buttons keep their jobs
  if (e.type === 'keydown' && e.code !== 'Enter' && e.code !== 'Space' && e.code !== 'NumpadEnter') return;
  if (e.type === 'keydown' && e.repeat) return;
  T.page++; sfx('mana');
  if (T.page >= HUD_PAGES.length) { T.step = 'lessons'; releaseInput(); } // so the click does not fire a fireball
  enter(T);
  if (T.step === 'lessons') fitPanel();
}
window.addEventListener('pointerdown', nextPage, true);
window.addEventListener('keydown', nextPage, true);

// Starts the current task: what appears with it, and its text
function enter(T) {
  const C = CFG.tutorial;
  panel.classList.remove('complete');
  const page = T.step === 'hud' ? HUD_PAGES[T.page] : null;
  spot(page && page.el); T.demo = page && page.demo || null;
  $('vitals').classList.toggle('demo', T.demo === 'bars');
  if (T.step === 'gather') scatterOrbs();
  if (T.step === 'fight') for (let i = 0; i < C.wyverns; i++) spawnFlyerNear('wyvern', W.CX, W.CZ, C.wyvernRadiusMin, C.wyvernRadiusMax);
  if (T.step === 'skeletons') {
    G.spellMana = CFG.spells.mana.max; G.spellExhausted = false; // a full bar for the nova lesson
    spawnSkeletonGroup({ x: W.CX, z: W.CZ, rMin: C.skeletonRadiusMin, rMax: C.skeletonRadiusMax });
    T.skel = countKind('skeleton');
  }
  chips(T);
  elCont.hidden = T.step !== 'hud';
  if (T.step === 'hud') { const p = HUD_PAGES[T.page]; show(p.name, p.text, count(p.n, p.of)); elCont.textContent = cont(); }
  else if (T.step === 'lessons') { const l = LESSONS[T.lesson]; show(l.name, l.text()); }
  else show(...TASKS[T.step](T));
}

// After the last task, if the player keeps flying: practice with no end. Wyverns and skeletons keep spawning by the
// usual rules (see game.js), banking raises the palace up to its last stage, and nothing else comes.
function practice(T) {
  T.step = 'practice'; T.done = false; panel.classList.remove('complete'); chips(T);
  show('Free practice', 'Wyverns and skeleton archers keep coming. Hunt them, bank their mana and raise your palace up to its sixth stage, or just keep flying. ' + (touch() ? 'Tap II' : 'Press Esc') + ' to pause, then start a game or leave the tutorial.');
}
export const tutorialFinished = () => !!(G.tut && G.tut.step === 'practice');
// Returns true once the tutorial is finished (the caller shows the closing screen)
export function updateTutorial(dt) {
  const T = G.tut; if (!T) return false;
  const C = CFG.tutorial;
  placeToast();
  if (T.wait > 0) {
    T.wait -= dt;
    if (T.wait <= 0) { if (T.done) { practice(T); return true; } if (T.next) T.step = T.next; enter(T); }
    return false;
  }
  if (T.step === 'lessons') {
    if (LESSONS[T.lesson].test(T)) {
      T.lesson++; chips(T);
      if (T.lesson < LESSONS.length) complete(T, null);
      else { complete(T, 'gather'); toast('You can fly! Next: gather mana.', 2600); }
    }
  } else if (T.step === 'gather') {
    elCount.textContent = count(G.carried, C.manaGoal);
    if (G.carried >= C.manaGoal) {
      T.deposit = true; complete(T, 'bank');
      toast('Well gathered! Next: take it home to the beam.', 2600);
    }
  } else if (T.step === 'bank') {
    elCount.textContent = count(G.castleMana, C.manaGoal);
    if (G.castleMana >= C.manaGoal - 0.01) {
      complete(T, 'fight');
      toast('Banked mana raises your palace, stage by stage.\nEach stage gives you more vitality, lets you carry more and makes your spells stronger.\nThe beam also heals you.', 6500);
      // mana gathered from here on (beyond what is banked or carried now) counts for the last task
      T.banked0 = G.castleMana + G.carried;
    }
  } else if (T.step === 'fight') {
    const left = countKind('wyvern');
    elCount.textContent = count(C.wyverns - left, C.wyverns);
    if (!left) complete(T, 'skeletons');
  } else if (T.step === 'skeletons') {
    const left = countKind('skeleton');
    elCount.textContent = count(T.skel - left, T.skel);
    if (!left) {
      complete(T, 'bankAgain');
      if (!T.novaCast) toast('Next time, try the nova: ' + (touch() ? 'tap Nova' : 'right-click or press E') + ' when they are close.', 3200);
    }
  } else if (T.step === 'bankAgain') {
    if (G.castleMana > T.banked0 + 0.5 && G.carried < 0.5) {
      complete(T, null); T.done = true;
      toast('Tutorial complete', 2000);
    }
  }
  return false;
}
