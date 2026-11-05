// Renderer, scene, camera, light, sky, clouds, water and shared materials/geometries.
import * as THREE from 'three';
import { CFG } from './config.js';
import { TAU } from './util.js';

export const canvas = document.getElementById('view');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
export const scene = new THREE.Scene();
const FOG = new THREE.Color(0xeeae7c);
scene.background = FOG;
scene.fog = new THREE.Fog(FOG, CFG.world.fogNear, CFG.world.fogFar);
export const camera = new THREE.PerspectiveCamera(72, 1, 0.5, 6500);

const sunDir = new THREE.Vector3(-0.8, 0.30, -0.55).normalize();
const sun = new THREE.DirectionalLight(0xffd6a0, 1.35);
sun.position.copy(sunDir).multiplyScalar(500);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xc8a8e0, 0x8a6a48, 0.95));

/* ---------- textures, shared materials and geometry ---------- */
function radialTex(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(s => gr.addColorStop(s[0], s[1]));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
export const glowTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]);
const cloudTex = radialTex([[0, 'rgba(255,255,255,.9)'], [0.5, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]);
export function addSprite(mat, scale) { const s = new THREE.Sprite(mat); s.scale.set(scale, scale, 1); return s; }
export function glowMat(color) { return new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }); }
export const mats = {
  fire: glowMat(0xffa040), bolt: glowMat(0xff3d5a), mana: glowMat(0x62e6ff), gold: glowMat(0xffc94a),
  ink: glowMat(0x9b6bff), acid: glowMat(0x9dff4a), ember: glowMat(0xff5a1a), eye: glowMat(0xff3a1a)
};
// Geometries flagged as shared are never disposed when a palace stage or island is rebuilt.
export function shared(g) { g.userData.shared = true; return g; }
export const geo = {
  sph: shared(new THREE.SphereGeometry(1, 12, 9)),
  box: shared(new THREE.BoxGeometry(1, 1, 1)),
  cyl: shared(new THREE.CylinderGeometry(1, 1, 1, 14)),
  oct: shared(new THREE.CylinderGeometry(1, 1, 1, 8)),
  octa: shared(new THREE.OctahedronGeometry(1, 0))
};
export function disposeTree(root) {
  root.traverse(o => { if (o.geometry && !o.isSprite && !o.geometry.userData.shared) o.geometry.dispose(); });
}

/* ---------- sky ---------- */
export const sky = new THREE.Mesh(new THREE.SphereGeometry(5200, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x1a1446) }, mid: { value: new THREE.Color(0xa8577a) }, hor: { value: FOG } },
  vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: 'uniform vec3 top;uniform vec3 mid;uniform vec3 hor;varying vec3 vP;void main(){float h=clamp(vP.y,-1.0,1.0);vec3 c=mix(hor,mid,smoothstep(0.0,0.22,h));c=mix(c,top,smoothstep(0.14,0.75,h));c=mix(hor*0.92,c,smoothstep(-0.12,0.02,h));gl_FragColor=vec4(c,1.0);}'
}));
sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
{
  const n = 420, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, y = 0.25 + Math.random() * 0.75, r = Math.sqrt(1 - y * y);
    p[i * 3] = Math.cos(a) * r * 4800; p[i * 3 + 1] = y * 4800; p[i * 3 + 2] = Math.sin(a) * r * 4800;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.75, fog: false, depthWrite: false }));
  pts.frustumCulled = false; pts.renderOrder = -9; sky.add(pts);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc88a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
  sunSprite.scale.set(1700, 1700, 1); sunSprite.position.copy(sunDir).multiplyScalar(4300); sunSprite.renderOrder = -8; sky.add(sunSprite);
}
const clouds = [];
for (let i = 0; i < 40; i++) {
  const cm = new THREE.SpriteMaterial({ map: cloudTex, color: i % 3 ? 0xf6c09a : 0xe0a8c0, transparent: true, opacity: 0.28 + Math.random() * 0.22, depthWrite: false, fog: false });
  const cs = new THREE.Sprite(cm); const ca = Math.random() * TAU, cr = 500 + Math.random() * 2200;
  cs.position.set(Math.cos(ca) * cr, 230 + Math.random() * 180, Math.sin(ca) * cr);
  const cw = 260 + Math.random() * 420; cs.scale.set(cw, cw * 0.24, 1);
  scene.add(cs); clouds.push(cs);
}
const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: 0x2aa6ad, transparent: true, opacity: 0.82, roughness: 0.2, metalness: 0.05 }));
water.rotation.x = -Math.PI / 2; scene.add(water);

export function updateSky(dt) {
  for (const c of clouds) { c.position.x += dt * 4; if (c.position.x > 2800) c.position.x = -2800; }
  sky.position.copy(camera.position);
}
export function resizeRenderer(w, h) {
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
