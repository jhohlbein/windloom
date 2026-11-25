import * as THREE from 'three';
import { CFG, hpFor } from '../config.js';
import { G, W } from '../state.js';
import { scene, mats } from '../scene.js';
import { clamp, lerp, wrapA, R } from '../util.js';
import { groundH, lineOfSight, inWard } from '../terrain.js';
import { emit, burst, C } from '../particles.js';
import { sfx, sfxAt } from '../audio.js';
import { toast } from '../hud.js';
import { addBolt, hurtPlayer } from '../combat.js';
import { baseEnemy, setHp, yes } from './common.js';
import { instBeast, animBeast, lookBeast } from './beasts.js';
import { createDragon as createModule } from '../simulation/modules/dragon.js';
const core=createModule({get THREE(){return THREE;},
get CFG(){return CFG;},
hpFor:(...args)=>hpFor(...args),
get G(){return G;},
get W(){return W;},
get scene(){return scene;},
get mats(){return mats;},
clamp:(...args)=>clamp(...args),
lerp:(...args)=>lerp(...args),
wrapA:(...args)=>wrapA(...args),
groundH:(...args)=>groundH(...args),
lineOfSight:(...args)=>lineOfSight(...args),
inWard:(...args)=>inWard(...args),
emit:(...args)=>emit(...args),
burst:(...args)=>burst(...args),
get C(){return C;},
sfx:(...args)=>sfx(...args),
sfxAt:(...args)=>sfxAt(...args),
toast:(...args)=>toast(...args),
addBolt:(...args)=>addBolt(...args),
hurtPlayer:(...args)=>hurtPlayer(...args),
baseEnemy:(...args)=>baseEnemy(...args),
setHp:(...args)=>setHp(...args),
yes:(...args)=>yes(...args),
instBeast:(...args)=>instBeast(...args),
animBeast:(...args)=>animBeast(...args),
lookBeast:(...args)=>lookBeast(...args)});
export const { createDragon, dragonAlert }=core;
