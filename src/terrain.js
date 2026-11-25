import { CFG } from './config.js';
import { W } from './state.js';
import { fbm, smooth, lerp, clamp, mulberry } from './util.js';
import { createTerrain } from './simulation/modules/terrain.js';
const core=createTerrain({get CFG(){return CFG;},
get W(){return W;},
fbm:(...args)=>fbm(...args),
smooth:(...args)=>smooth(...args),
lerp:(...args)=>lerp(...args),
clamp:(...args)=>clamp(...args),
mulberry:(...args)=>mulberry(...args)});
export const { SIZE, calibrateTerrain, rawH, terrainH, greenAt, groundH, lineOfSight, inWard, isleName }=core;
