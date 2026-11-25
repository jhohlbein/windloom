import * as THREE from 'three';
import { CFG, hpFor } from '../config.js';
import { G } from '../state.js';
import { scene, mats } from '../scene.js';
import { TAU, lerp, smooth, lerpAngle, R } from '../util.js';
import { terrainH } from '../terrain.js';
import { emit, burst, C } from '../particles.js';
import { sfx, sfxAt } from '../audio.js';
import { lobAtPlayer, hurtPlayer } from '../combat.js';
import { baseEnemy, setHp, trackMat } from './common.js';
import { createKraken as createModule } from '../simulation/modules/kraken.js';
const core=createModule({get THREE(){return THREE;},
get CFG(){return CFG;},
hpFor:(...args)=>hpFor(...args),
get G(){return G;},
get scene(){return scene;},
get mats(){return mats;},
get TAU(){return TAU;},
lerp:(...args)=>lerp(...args),
smooth:(...args)=>smooth(...args),
lerpAngle:(...args)=>lerpAngle(...args),
terrainH:(...args)=>terrainH(...args),
emit:(...args)=>emit(...args),
burst:(...args)=>burst(...args),
get C(){return C;},
sfx:(...args)=>sfx(...args),
sfxAt:(...args)=>sfxAt(...args),
lobAtPlayer:(...args)=>lobAtPlayer(...args),
hurtPlayer:(...args)=>hurtPlayer(...args),
baseEnemy:(...args)=>baseEnemy(...args),
setHp:(...args)=>setHp(...args),
trackMat:(...args)=>trackMat(...args)});
export const { createKraken }=core;
