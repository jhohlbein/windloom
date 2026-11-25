import * as THREE from 'three';
import { CFG } from './config.js';
import { G, W } from './state.js';
import { scene, addSprite, mats, fireCoreMat, coreMatFor, haloMatFor, shared } from './scene.js';
import { TAU, clamp, lerp } from './util.js';
import { terrainH, groundH } from './terrain.js';
import { emit, burst, C } from './particles.js';
import { sfx } from './audio.js';
import { toast, flashHurt } from './hud.js';
import { carryCap, stageCount } from './progress.js';
import { removeEnemyObj, inView } from './creatures/common.js';
import { mark } from './perf.js';
import { dragonAlert } from './creatures/dragon.js';
import { placePlayerAtCastle } from './player.js';
import { createCombat } from './simulation/modules/combat.js';
const core=createCombat({get THREE(){return THREE;},
get CFG(){return CFG;},
get G(){return G;},
get W(){return W;},
get scene(){return scene;},
addSprite:(...args)=>addSprite(...args),
get mats(){return mats;},
get fireCoreMat(){return fireCoreMat;},
coreMatFor:(...args)=>coreMatFor(...args),
haloMatFor:(...args)=>haloMatFor(...args),
shared:(...args)=>shared(...args),
get TAU(){return TAU;},
clamp:(...args)=>clamp(...args),
lerp:(...args)=>lerp(...args),
terrainH:(...args)=>terrainH(...args),
groundH:(...args)=>groundH(...args),
emit:(...args)=>emit(...args),
burst:(...args)=>burst(...args),
get C(){return C;},
sfx:(...args)=>sfx(...args),
toast:(...args)=>toast(...args),
flashHurt:(...args)=>flashHurt(...args),
carryCap:(...args)=>carryCap(...args),
stageCount:(...args)=>stageCount(...args),
removeEnemyObj:(...args)=>removeEnemyObj(...args),
inView:(...args)=>inView(...args),
mark:(...args)=>mark(...args),
dragonAlert:(...args)=>dragonAlert(...args),
placePlayerAtCastle:(...args)=>placePlayerAtCastle(...args)});
export const { spawnOrb, updateOrbs, addBolt, lobAtPlayer, updateBolts, damageEnemy, killEnemy, hurtPlayer, castFire, castNova, updateShots, addRing, updateRings, clearProjectiles }=core;
