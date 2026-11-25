import * as THREE from 'three';
import { CFG } from './config.js';
import { G, W } from './state.js';
import { scene, addSprite, glowMat, disposeTree } from './scene.js';
import { TAU } from './util.js';
import { terrainH } from './terrain.js';
import { emit, C } from './particles.js';
import { toast } from './hud.js';
import { createSprings } from './simulation/modules/springs.js';
const core=createSprings({get THREE(){return THREE;},
get CFG(){return CFG;},
get G(){return G;},
get W(){return W;},
get scene(){return scene;},
addSprite:(...args)=>addSprite(...args),
glowMat:(...args)=>glowMat(...args),
disposeTree:(...args)=>disposeTree(...args),
get TAU(){return TAU;},
terrainH:(...args)=>terrainH(...args),
emit:(...args)=>emit(...args),
get C(){return C;},
toast:(...args)=>toast(...args)});
export const { buildSprings, updateSprings }=core;
