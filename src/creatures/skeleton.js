import * as THREE from 'three';
import { CFG, hpFor } from '../config.js';
import { G, W } from '../state.js';
import { scene, addSprite, glowMat } from '../scene.js';
import { TAU, lerp, lerpAngle, wrapA } from '../util.js';
import { groundH, lineOfSight } from '../terrain.js';
import { C } from '../particles.js';
import { sfxAt } from '../audio.js';
import { addBolt } from '../combat.js';
import { baseEnemy, setHp, trackMat } from './common.js';
import { createSkeleton as createModule } from '../simulation/modules/skeleton.js';
const core=createModule({get THREE(){return THREE;},
get CFG(){return CFG;},
hpFor:(...args)=>hpFor(...args),
get G(){return G;},
get W(){return W;},
get scene(){return scene;},
addSprite:(...args)=>addSprite(...args),
glowMat:(...args)=>glowMat(...args),
get TAU(){return TAU;},
lerp:(...args)=>lerp(...args),
lerpAngle:(...args)=>lerpAngle(...args),
wrapA:(...args)=>wrapA(...args),
groundH:(...args)=>groundH(...args),
lineOfSight:(...args)=>lineOfSight(...args),
get C(){return C;},
sfxAt:(...args)=>sfxAt(...args),
addBolt:(...args)=>addBolt(...args),
baseEnemy:(...args)=>baseEnemy(...args),
setHp:(...args)=>setHp(...args),
trackMat:(...args)=>trackMat(...args)});
export const { createSkeletonGroup, createSkeleton }=core;
