import * as THREE from 'three';
import { CFG } from './config.js';
import { G, W } from './state.js';
import { buildCastle } from './palace.js';
import { emit, burst, C } from './particles.js';
import { sfx } from './audio.js';
import { toast } from './hud.js';
import { addRing } from './combat.js';
import { mark } from './perf.js';
import { createProgress } from './simulation/modules/progress.js';
const core=createProgress({get THREE(){return THREE;},
get CFG(){return CFG;},
get G(){return G;},
get W(){return W;},
buildCastle:(...args)=>buildCastle(...args),
emit:(...args)=>emit(...args),
burst:(...args)=>burst(...args),
get C(){return C;},
sfx:(...args)=>sfx(...args),
toast:(...args)=>toast(...args),
addRing:(...args)=>addRing(...args),
mark:(...args)=>mark(...args)});
export const { stageCount, carryCap, levelFor, applyLevel, upgradeHint, updateDeposit }=core;
