import * as THREE from 'three';
import { CFG, targetFor } from '../config.js';
import { G, W } from '../state.js';
import { TAU } from '../util.js';
import { terrainH, groundH } from '../terrain.js';
import { castShadows } from '../scene.js';
import { applyFlash, countKind, removeEnemyObj } from './common.js';
import { mark } from '../perf.js';
import { createFlyer } from './flyers.js';
import { createKraken } from './kraken.js';
import { createWorm } from './sandworm.js';
import { createDragon } from './dragon.js';
import { createSkeleton, createSkeletonGroup } from './skeleton.js';
import { spawnOrb } from '../combat.js';
import { createSpawn } from '../simulation/modules/spawn.js';
const core=createSpawn({get THREE(){return THREE;},
get CFG(){return CFG;},
targetFor:(...args)=>targetFor(...args),
get G(){return G;},
get W(){return W;},
get TAU(){return TAU;},
terrainH:(...args)=>terrainH(...args),
groundH:(...args)=>groundH(...args),
castShadows:(...args)=>castShadows(...args),
applyFlash:(...args)=>applyFlash(...args),
countKind:(...args)=>countKind(...args),
removeEnemyObj:(...args)=>removeEnemyObj(...args),
mark:(...args)=>mark(...args),
createFlyer:(...args)=>createFlyer(...args),
createKraken:(...args)=>createKraken(...args),
createWorm:(...args)=>createWorm(...args),
createDragon:(...args)=>createDragon(...args),
createSkeleton:(...args)=>createSkeleton(...args),
createSkeletonGroup:(...args)=>createSkeletonGroup(...args),
spawnOrb:(...args)=>spawnOrb(...args)});
export const { spawnFlyer, spawnFlyerNear, spawnKraken, spawnWorm, spawnSkeletonGroup, spawnDragon, unlocked, populate, spawnTick, updateEnemies, clearCreatures }=core;
