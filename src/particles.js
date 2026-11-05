// One additive point cloud for sparks, dust, spray and mana trails.
import * as THREE from 'three';
import { scene, renderer, camera } from './scene.js';
import { TAU } from './util.js';

const PN = 3200;
const pg = new THREE.BufferGeometry();
const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pSz = new Float32Array(PN), pAl = new Float32Array(PN);
const pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN), pMax = new Float32Array(PN), pS0 = new Float32Array(PN);
pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pg.setAttribute('pcolor', new THREE.BufferAttribute(pCol, 3));
pg.setAttribute('size', new THREE.BufferAttribute(pSz, 1));
pg.setAttribute('alpha', new THREE.BufferAttribute(pAl, 1));
const pMat = new THREE.ShaderMaterial({
  uniforms: { scale: { value: 600 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: 'attribute float size;attribute float alpha;attribute vec3 pcolor;uniform float scale;varying float vA;varying vec3 vC;void main(){vA=alpha;vC=pcolor;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=size*scale/max(0.1,-mv.z);gl_Position=projectionMatrix*mv;}',
  fragmentShader: 'varying float vA;varying vec3 vC;void main(){float r=length(gl_PointCoord-0.5)*2.0;float a=smoothstep(1.0,0.0,r);a*=a;gl_FragColor=vec4(vC,a*vA);}'
});
const points = new THREE.Points(pg, pMat); points.frustumCulled = false; scene.add(points);
let pHead = 0;

export const C = {
  MANA: [0.38, 0.9, 1], FIRE: [1, 0.6, 0.2], RED: [1, 0.25, 0.35], GOLD: [1, 0.8, 0.32], DUST: [0.9, 0.78, 0.55],
  SPRAY: [0.8, 0.95, 1], INK: [0.6, 0.42, 1], ACID: [0.6, 1, 0.3], EMBER: [1, 0.4, 0.12]
};
export function emit(x, y, z, vx, vy, vz, c, size, life) {
  const i = pHead; pHead = (pHead + 1) % PN;
  pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
  pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz;
  pCol[i * 3] = c[0]; pCol[i * 3 + 1] = c[1]; pCol[i * 3 + 2] = c[2];
  pS0[i] = size; pLife[i] = life; pMax[i] = life;
}
export function burst(p, n, c, speed, size, life) {
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * TAU, r = Math.sqrt(1 - u * u), s = speed * (0.3 + Math.random() * 0.7);
    emit(p.x, p.y, p.z, Math.cos(a) * r * s, u * s, Math.sin(a) * r * s, c, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6));
  }
}
export function updateParticles(dt) {
  const drag = 1 - Math.min(0.9, 1.6 * dt);
  for (let i = 0; i < PN; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt;
    if (pLife[i] <= 0) { pAl[i] = 0; pSz[i] = 0; continue; }
    const f = pLife[i] / pMax[i];
    pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    pVel[i * 3] *= drag; pVel[i * 3 + 1] = pVel[i * 3 + 1] * drag - 3 * dt; pVel[i * 3 + 2] *= drag;
    pAl[i] = f; pSz[i] = pS0[i] * (0.35 + 0.65 * f);
  }
  pg.attributes.position.needsUpdate = true; pg.attributes.pcolor.needsUpdate = true;
  pg.attributes.size.needsUpdate = true; pg.attributes.alpha.needsUpdate = true;
}
export function resizeParticles(h) {
  pMat.uniforms.scale.value = h * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
