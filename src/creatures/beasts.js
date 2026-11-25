import * as THREE from 'three';
import { geo, addSprite, glowMat } from '../scene.js';
import { lerp, TAU } from '../util.js';
import { trackMat } from './common.js';
import { createBeasts } from '../simulation/modules/beasts.js';
const core=createBeasts({get THREE(){return THREE;},
get geo(){return geo;},
addSprite:(...args)=>addSprite(...args),
glowMat:(...args)=>glowMat(...args),
lerp:(...args)=>lerp(...args),
get TAU(){return TAU;},
trackMat:(...args)=>trackMat(...args)});
export const { BEASTS, instBeast, animBeast, lookBeast }=core;
