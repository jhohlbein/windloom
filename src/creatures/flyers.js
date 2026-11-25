import * as THREE from 'three';
import { CFG, hpFor } from '../config.js';
import { G } from '../state.js';
import { scene, mats } from '../scene.js';
import { clamp, lerp, wrapA, TAU } from '../util.js';
import { groundH, lineOfSight } from '../terrain.js';
import { C } from '../particles.js';
import { addBolt } from '../combat.js';
import { baseEnemy, setHp, yes } from './common.js';
import { instBeast, animBeast, lookBeast } from './beasts.js';
import { createFlyers } from '../simulation/modules/flyers.js';
const core=createFlyers({get THREE(){return THREE;},
get CFG(){return CFG;},
hpFor:(...args)=>hpFor(...args),
get G(){return G;},
get scene(){return scene;},
get mats(){return mats;},
clamp:(...args)=>clamp(...args),
lerp:(...args)=>lerp(...args),
wrapA:(...args)=>wrapA(...args),
get TAU(){return TAU;},
groundH:(...args)=>groundH(...args),
lineOfSight:(...args)=>lineOfSight(...args),
get C(){return C;},
addBolt:(...args)=>addBolt(...args),
baseEnemy:(...args)=>baseEnemy(...args),
setHp:(...args)=>setHp(...args),
yes:(...args)=>yes(...args),
instBeast:(...args)=>instBeast(...args),
animBeast:(...args)=>animBeast(...args),
lookBeast:(...args)=>lookBeast(...args)});
export const { createFlyer }=core;
