import * as THREE from 'three';
import { scene, geo, shared, addSprite, mats, disposeTree, castShadows } from './scene.js';
import { G } from './state.js';
import { TAU } from './util.js';
import { createPalace } from './simulation/modules/palace.js';
const core=createPalace({get THREE(){return THREE;},
get scene(){return scene;},
get geo(){return geo;},
shared:(...args)=>shared(...args),
addSprite:(...args)=>addSprite(...args),
get mats(){return mats;},
disposeTree:(...args)=>disposeTree(...args),
castShadows:(...args)=>castShadows(...args),
get G(){return G;},
get TAU(){return TAU;}});
export const { castle, palace, buildCastle, updatePalace }=core;
