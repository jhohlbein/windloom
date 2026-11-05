// Shared mutable state. Modules import these objects and read/write their fields;
// ES module exports cannot be reassigned from outside, so scalars live on G and W.
import * as THREE from 'three';

// World layout for the current island (set by world.js on every new island)
export const W = {
  SEED: 0, OFF: [0, 0, 0, 0, 0, 0, 0, 0], ISL_ANG: 0, ISL_EX: 0, DUNE_ANG: 0, OASES: [],
  CX: 0, CZ: 0, PH: 18,   // palace centre and plateau height
  LX: 0, LZ: 0, LH: 12,   // dragon lair
  P: {}                   // this island's landscape settings, drawn from the seed (see islandParams in world.js)
};

// Game state
export const G = {
  mode: 'title',          // 'title' | 'play' | 'pause' | 'results'
  active: false,          // true while the player is flying
  keys: {},
  carried: 0, castleMana: 0, level: 1, hp: 100, maxHp: 100, invuln: 0,
  kills: 0, playTime: 0, lastHurt: -99,
  timed: true, timeLeft: 0, killsBy: {}, dragonSlain: false, endTimer: -1, endReason: '', finished: false, // round (see round.js)
  yaw: 0, pitch: 0, roll: 0, speed: 0, strafe: 0, steerX: 0, steerY: 0,
  fireCd: 0, novaCd: 0, wallToast: 0,
  spellMana: 100, spellExhausted: false, // fireball energy (config spells.mana), separate from carried mana
  playerPos: new THREE.Vector3(), playerVel: new THREE.Vector3(),
  fwd: new THREE.Vector3(0, 0, -1), rightV: new THREE.Vector3(1, 0, 0),
  input: { mouseX: 0, mouseY: 0, touchX: 0, touchY: 0, mouseFire: false, touchFire: false, touchBoost: false, touchBack: false, novaReq: false },
  enemies: [], orbs: [], shots: [], bolts: [], rings: [],
  dragon: null, dragonTimer: 0, dragonSeen: false, surging: false,
  spawnTimer: 0, upgradeHint: 0, // last stage for which the 'enough mana' message was shown
  castleTopY: 24
};
