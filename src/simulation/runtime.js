import * as THREE from 'three';
import * as math from '../util.js';
import { createState } from './state.js';
import { hpFor, targetFor } from './config.js';
import { createLayout } from './layout.js';
import { presentation } from './headless.js';
import { createTerrain } from './modules/terrain.js';
import { createPalace } from './modules/palace.js';
import { createMotion } from './modules/motion.js';
import { createProgress } from './modules/progress.js';
import { createRound } from './modules/round.js';
import { createCombat } from './modules/combat.js';
import { createBeasts } from './modules/beasts.js';
import { createFlyers } from './modules/flyers.js';
import { createDragon } from './modules/dragon.js';
import { createKraken } from './modules/kraken.js';
import { createWorm } from './modules/worm.js';
import { createSkeleton } from './modules/skeleton.js';
import { createSpawn } from './modules/spawn.js';
import { createSprings } from './modules/springs.js';

const GLOBAL = new Set(
  'mode castleMana level kills killsBy playTime timed timeLeft dragonSlain endTimer endReason finished gameMode enemies orbs shots bolts rings dragon dragonTimer dragonSeen spawnTimer castleTopY upgradeHint'.split(
    ' '
  )
);
const PLAYER_FIELDS =
  'carried hp maxHp invuln lastHurt atSpring yaw pitch bodyPitch keyPitch keyTurn keyTurnDir roll speed strafe steerX steerY fireCd novaCd wallToast castFx novaFx spellMana spellExhausted'.split(
    ' '
  );
const vec = (v) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
export function createSimulation(config, seed, { timed = true, layout: knownLayout } = {}) {
  const CFG = structuredClone(config);
  CFG.world.boundRadius = CFG.world.worldRadius * CFG.world.boundFraction;
  const state = createState(THREE),
    base = state.G,
    W = state.W,
    players = new Map();
  let current = base,
    nextId = 0;
  const G = new Proxy(base, {
    get: (_, key) => (GLOBAL.has(key) ? base[key] : current[key]),
    set: (_, key, v) => {
      (GLOBAL.has(key) ? base : current)[key] = v;
      return true;
    }
  });
  const services = {
    ...math,
    ...presentation(),
    CFG,
    G,
    W,
    hpFor,
    targetFor,
    random: math.mulberry(seed ^ 0x67616d65),
    settings: { invertKeys: false, invertMouse: false },
    player: new THREE.Object3D()
  };
  const modules = {};
  // Forwarders resolve cycles at call time, matching the browser module graph.
  for (const name of [
    'groundH',
    'terrainH',
    'rawH',
    'calibrateTerrain',
    'lineOfSight',
    'inWard',
    'stageCount',
    'carryCap',
    'levelFor',
    'applyLevel',
    'buildCastle',
    'addRing',
    'spawnOrb',
    'castFire',
    'castNova',
    'hurtPlayer',
    'dragonAlert',
    'addBolt',
    'lobAtPlayer',
    'placePlayerAtCastle',
    'instBeast',
    'animBeast',
    'lookBeast',
    'createFlyer',
    'createKraken',
    'createWorm',
    'createDragon',
    'createSkeleton',
    'createSkeletonGroup'
  ])
    services[name] = (...args) => {
      for (const m of Object.values(modules))
        if (typeof m[name] === 'function') return m[name](...args);
      throw Error('Missing gameplay service ' + name);
    };
  services.yes = () => true;
  services.baseEnemy = (kind, name) => ({
    id: 'e' + ++nextId,
    kind,
    name,
    mats: [],
    flash: 0,
    barT: 0,
    ghost: 1,
    hp: 1,
    maxHp: 1,
    vel: new THREE.Vector3(),
    r: 5,
    t: services.random() * 10,
    provoked: false,
    _fl: false,
    dropN: 4,
    dropV: 3,
    keepDrops: false
  });
  services.setHp = (e, v) => {
    e.hp = e.maxHp = e.ghost = v;
  };
  services.trackMat = (e, m) => {
    m.userData.base = m.emissive?.getHex() || 0;
    e.mats.push(m);
    return m;
  };
  services.removeEnemyObj = (e) => {
    e.mats.length = 0;
  };
  services.applyFlash = () => {};
  services.countKind = (k) => base.enemies.filter((e) => e.kind === k).length;
  services.inView = (e) => services.lineOfSight(G.playerPos, e.pos);
  const nearest = (pos, eligible = () => true) => {
    let picked = null,
      dist = Infinity;
    for (const p of players.values()) {
      if (p.finished || !eligible(p)) continue;
      const d = p.playerPos.distanceToSquared(pos);
      if (d < dist) {
        dist = d;
        picked = p;
      }
    }
    return picked;
  };
  const select = (p) => {
    current = p || base;
  };
  services.beforeEnemy = (e) => select(nearest(e.pos));
  services.isFar = (x, z, d) =>
    [...players.values()].every((p) => Math.hypot(x - p.playerPos.x, z - p.playerPos.z) >= d);
  services.beforeOrb = (o) =>
    select(
      nearest(
        o.pos,
        (p) => p.carried < CFG.player.carryBase + CFG.player.carryPerStage * base.level
      )
    );
  services.beforeBolt = (b) => select(nearest(b.pos));
  services.beforeShot = (s) => select(players.get(s.owner));
  services.onKill = () => {
    if (current.id) current.kills++;
  };
  const factories = {
    terrain: createTerrain,
    palace: createPalace,
    progress: createProgress,
    round: createRound,
    combat: createCombat,
    beasts: createBeasts,
    flyers: createFlyers,
    dragon: createDragon,
    kraken: createKraken,
    worm: createWorm,
    skeleton: createSkeleton,
    spawn: createSpawn,
    springs: createSprings,
    motion: createMotion
  };
  for (const [name, factory] of Object.entries(factories)) {
    modules[name] = factory(services);
    if (name === 'palace') {
      services.castle = modules.palace.castle;
      services.palace = modules.palace.palace;
    }
  }
  const layout = createLayout(CFG, W, modules.terrain);
  if (knownLayout) Object.assign(W, structuredClone(knownLayout));
  else layout.buildLayout(seed);
  modules.palace.castle.position.set(W.CX, W.PH, W.CZ);
  modules.springs.buildSprings(math.mulberry(W.SEED ^ 0x73507269));
  base.mode = 'play';
  base.gameMode = timed ? 'timed' : 'free';
  base.level = 1;
  base.active = false;
  modules.round.resetRound(timed);
  modules.palace.buildCastle(1);
  const initialLayout = structuredClone({ ...W, SPRINGS: [] });
  function addPlayer(id) {
    if (players.has(id)) return players.get(id);
    const p = createState(THREE).G;
    p.id = id;
    p.active = true;
    p.finished = false;
    p.kills = 0;
    p.banked = 0;
    p.hp = p.maxHp = CFG.player.maxHp + CFG.player.maxHpPerStage * (base.level - 1);
    p.invuln = 2;
    p.spellMana = CFG.spells.mana.max;
    players.set(id, p);
    select(p);
    modules.motion.placePlayerAtCastle();
    if (players.size === 1 && base.enemies.length === 0) {
      modules.spawn.populate();
    }
    return p;
  }
  function setInput(id, controls) {
    const p = players.get(id);
    if (!p) return;
    p.keys = { ...(controls.keys || {}) };
    Object.assign(p.input, controls.input || {});
    if (controls.settings) {
      p.invertKeys = !!controls.settings.invertKeys;
      p.invertMouse = !!controls.settings.invertMouse;
    }
  }
  function step(dt) {
    if (!players.size || (base.finished && base.timed)) return;
    base.playTime += dt;
    for (const p of players.values()) {
      select(p);
      services.settings.invertKeys = !!p.invertKeys;
      services.settings.invertMouse = !!p.invertMouse;
      modules.motion.updatePlayer(dt);
      const before = base.castleMana,
        level = base.level;
      modules.progress.updateDeposit(dt);
      p.banked += base.castleMana - before;
      modules.springs.updateSprings(dt);
      if (base.level > level)
        for (const other of players.values())
          if (other !== p) {
            const ratio = other.hp / other.maxHp;
            other.maxHp = CFG.player.maxHp + CFG.player.maxHpPerStage * (base.level - 1);
            other.hp = Math.min(
              other.maxHp,
              Math.max(other.hp, ratio * other.maxHp) + CFG.palace.stageUpHealBonus
            );
          }
    }
    modules.spawn.updateEnemies(dt);
    modules.combat.updateShots(dt);
    modules.combat.updateBolts(dt);
    modules.combat.updateOrbs(dt);
    modules.combat.updateRings(dt);
    base.spawnTimer -= dt;
    if (base.spawnTimer <= 0) {
      base.spawnTimer = CFG.spawning.intervalSeconds;
      modules.spawn.spawnTick();
    }
    if (!base.dragon && modules.spawn.unlocked(CFG.spawning.dragon)) {
      base.dragonTimer -= dt;
      if (base.dragonTimer <= 0) modules.spawn.spawnDragon();
    }
    modules.round.updateRound(dt);
  }
  function playerSnapshot(p) {
    return {
      id: p.id,
      pos: vec(p.playerPos),
      vel: vec(p.playerVel),
      ...Object.fromEntries(PLAYER_FIELDS.map((k) => [k, p[k]])),
      kills: p.kills,
      banked: p.banked
    };
  }
  function snapshot() {
    const entity = (e) => ({
      id: e.id,
      kind: e.kind,
      pos: vec(e.pos),
      vel: vec(e.vel),
      root: vec(e.root.position),
      rot: [e.root.rotation.x, e.root.rotation.y, e.root.rotation.z],
      hp: e.hp,
      maxHp: e.maxHp,
      r: e.r,
      t: e.t,
      state: e.state,
      st: e.st,
      targetable: e.targetable(),
      ph: e.ph,
      flapPh: e.flapPh,
      jawOpen: e.jawOpen,
      yawRate: e.yawRate,
      lookX: e.B?.lookX,
      lookY: e.B?.lookY,
      bodyY: e.body?.position.y,
      walk: e.walk,
      draw: e.draw,
      stride: e.stride,
      rise: e.rise,
      open: e.open,
      flash: e.flash,
      barT: e.barT,
      canSee: e.canSee,
      head: e.kind === 'worm' ? e.head.quaternion.toArray() : undefined,
      segs: e.segs?.map((s) => vec(s.p))
    });
    const item = (o) => ({
      id: o.id || (o.id = 'o' + ++nextId),
      pos: vec(o.pos),
      vel: vec(o.vel),
      val: o.val,
      life: o.life,
      age: o.age,
      col: o.col,
      sz: o.sz
    });
    return {
      seed: W.SEED,
      time: base.playTime,
      timed: base.timed,
      timeLeft: base.timeLeft,
      finished: base.finished,
      endReason: base.endReason,
      level: base.level,
      castleMana: base.castleMana,
      kills: base.kills,
      killsBy: { ...base.killsBy },
      dragonSlain: base.dragonSlain,
      castleTopY: base.castleTopY,
      score: modules.round.scoreRound(),
      players: [...players.values()].map(playerSnapshot),
      enemies: base.enemies.map(entity),
      orbs: base.orbs.map(item),
      shots: base.shots.map(item),
      bolts: base.bolts.map(item),
      rings: base.rings.map((r) => ({
        id: r.id || (r.id = 'r' + ++nextId),
        pos: vec(r.m.position),
        t: r.t,
        max: r.max,
        dur: r.dur,
        color: r.m.material.color.getHex()
      }))
    };
  }
  return {
    G: base,
    W,
    players,
    layout: initialLayout,
    addPlayer,
    setInput,
    step,
    snapshot,
    playerSnapshot,
    score: modules.round.scoreRound,
    removePlayer: (id) => players.delete(id)
  };
}
