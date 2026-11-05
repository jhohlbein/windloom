// Renderer, scene, camera, light, sky, clouds, water and shared materials/geometries.
import * as THREE from 'three';
import { CFG } from './config.js';
import { TAU } from './util.js';

export const canvas = document.getElementById('view');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
export const scene = new THREE.Scene();
const FOG = new THREE.Color(0xeeae7c);
scene.background = FOG;
scene.fog = new THREE.Fog(FOG, CFG.world.fogNear, CFG.world.fogFar);
export const camera = new THREE.PerspectiveCamera(72, 1, 0.5, 6500);

// Sun direction, light colours and sky colours are set by setDaylight() (sunrise over the round)
const sunDir = new THREE.Vector3(-0.8, 0.30, -0.55).normalize();
const sun = new THREE.DirectionalLight(0xffd6a0, 1.35);
sun.position.copy(sunDir).multiplyScalar(500);
scene.add(sun); scene.add(sun.target);
/* ---------- shadows ---------- */
// The sun casts shadows inside a box of graphics.shadowRange metres that follows the player (a box over the
// whole island would make them blurry). Switched on and off in Settings.
{
  const S = CFG.graphics, sc = sun.shadow.camera, h = S.shadowRange / 2;
  sun.shadow.mapSize.set(S.shadowMapSize, S.shadowMapSize);
  sc.left = -h; sc.right = h; sc.top = h; sc.bottom = -h; sc.near = 1; sc.far = 1400; sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
}
export function setShadows(on) { sun.castShadow = !!on; }
const shCenter = new THREE.Vector3();
// Call every frame after setDaylight: centres the shadow box on `center`, snapped to whole shadow-map texels
// so shadows do not shimmer as the box moves
export function updateShadows(center) {
  if (!sun.castShadow) return;
  const texel = CFG.graphics.shadowRange / CFG.graphics.shadowMapSize;
  shCenter.set(Math.round(center.x / texel) * texel, Math.round(center.y / texel) * texel, Math.round(center.z / texel) * texel);
  sun.target.position.copy(shCenter); sun.position.copy(sunDir).multiplyScalar(600).add(shCenter);
  sun.target.updateMatrixWorld();
}
// Marks every solid mesh under root to cast (and optionally receive) shadows; glows, sprites and see-through
// parts are skipped
export function castShadows(root, receive = false) {
  root.traverse(o => {
    if (!o.isMesh || o.isSprite) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.transparent || m.isMeshBasicMaterial) return;
    o.castShadow = true; if (receive) o.receiveShadow = true;
  });
}
const hemi = new THREE.HemisphereLight(0xc8a8e0, 0x8a6a48, 0.95);
scene.add(hemi);

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
  fire: glowMat(0xffa040), bolt: glowMat(0xff3d5a), mana: glowMat(0x62e6ff), gold: glowMat(0xffb21f),
  ink: glowMat(0x9b6bff), acid: glowMat(0x9dff4a), ember: glowMat(0xff5a1a), eye: glowMat(0xff3a1a)
};
// Geometries flagged as shared are never disposed when a palace stage or island is rebuilt.
// Solid orange core for fireballs, drawn with normal blending: additive glow alone turns white over the bright,
// blue water (orange + blue light = white); the core keeps the fireball orange over any background
export const fireCoreMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xff9a1c, transparent: true, depthWrite: false });
// Projectiles are a solid core plus a soft halo, both drawn with normal blending in the glow material's colour
// (one material per colour). Additive glows add up to white over the bright sea and sky; these do not.
const coreMats = new Map(), haloMats = new Map();
function projMat(cache, glow, opacity) {
  const hex = glow.color.getHex();
  if (!cache.has(hex)) cache.set(hex, new THREE.SpriteMaterial({ map: glowTex, color: hex, transparent: true, opacity, depthWrite: false }));
  return cache.get(hex);
}
export const coreMatFor = glow => projMat(coreMats, glow, 1);
export const haloMatFor = glow => projMat(haloMats, glow, 0.45);
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
let pts, sunSprite;
{
  const n = 420, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, y = 0.25 + Math.random() * 0.75, r = Math.sqrt(1 - y * y);
    p[i * 3] = Math.cos(a) * r * 4800; p[i * 3 + 1] = y * 4800; p[i * 3 + 2] = Math.sin(a) * r * 4800;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.75, fog: false, depthWrite: false }));
  pts.frustumCulled = false; pts.renderOrder = -9; sky.add(pts);
  sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc88a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
  sunSprite.scale.set(1700, 1700, 1); sunSprite.position.copy(sunDir).multiplyScalar(4300); sunSprite.renderOrder = -8; sky.add(sunSprite);
}
const clouds = [];
for (let i = 0; i < 40; i++) {
  const cm = new THREE.SpriteMaterial({ map: cloudTex, color: 0xffffff, transparent: true, opacity: 0.28 + Math.random() * 0.22, depthWrite: false, fog: false });
  const cs = new THREE.Sprite(cm); const ca = Math.random() * TAU, cr = 500 + Math.random() * 2200;
  cs.position.set(Math.cos(ca) * cr, 230 + Math.random() * 180, Math.sin(ca) * cr);
  const cw = 260 + Math.random() * 420; cs.scale.set(cw, cw * 0.24, 1);
  cs.userData.tint = i % 3 ? 0 : 1; scene.add(cs); clouds.push(cs);
}
/* ---------- water: sky reflection + scrolling ripples ---------- */
// The sky (with stars and sun) is rendered into a cube map that the water reflects; refreshed every few
// seconds as the sun rises. Terrain and creatures are not reflected (that would need a second full render).
const envTarget = new THREE.WebGLCubeRenderTarget(256, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
const envScene = new THREE.Scene(), cubeCam = new THREE.CubeCamera(1, 6000, envTarget);
function refreshReflection() {
  envScene.add(sky); sky.position.set(0, 0, 0);   // borrow the sky for a moment
  cubeCam.update(renderer, envScene);
  scene.add(sky);
}
// Tileable ripple normal map, generated from a few sine waves with integer frequencies
function rippleNormals(n = 256) {
  const c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n), K = TAU / n;
  const waves = [[3, 1, 0.0], [1, 4, 1.3], [5, -2, 2.1], [-2, 7, 0.7], [9, 5, 2.9], [-7, 11, 4.1]];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let dx = 0, dy = 0;
    for (const [a, b, p] of waves) { const amp = 1 / Math.hypot(a, b), c0 = Math.cos((a * x + b * y) * K + p) * amp; dx += c0 * a; dy += c0 * b; }
    const nx = -dx * 0.12, ny = -dy * 0.12, l = Math.hypot(nx, ny, 1), i = (y * n + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(160, 160);
  return t;
}
const waterNormals = rippleNormals();
const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({
  color: 0x135a85, transparent: true, opacity: 0.85, roughness: 0.06, metalness: 0.1,
  envMap: envTarget.texture, envMapIntensity: 0.5, normalMap: waterNormals, normalScale: new THREE.Vector2(0.35, 0.35)
}));
water.rotation.x = -Math.PI / 2; water.receiveShadow = true; scene.add(water);

/* ---------- daylight: sunrise over the round ---------- */
// Colour keyframes at phase 0 (dawn), 0.35 (early morning) and 1 (late morning)
const STOPS = [0, 0.35, 1];
const KEYS = {
  top: [0x24346e, 0x2f5fae, 0x2d6cc8],     // sky at the zenith
  mid: [0xd9a184, 0x9cc2e4, 0x8ec5ee],     // sky part-way up
  hor: [0xf0c39a, 0xdcdfe0, 0xcfe5f4],     // horizon and fog
  sun: [0xffa860, 0xffdcae, 0xfff4e6],     // sunlight
  sunGlow: [0xff9a50, 0xffd9a0, 0xfff0d8], // sun disc in the sky
  hemiSky: [0xc9a894, 0xb5cbe0, 0xc4dcf2],
  cloud: [0xf5c3a0, 0xf4ece6, 0xffffff],
  cloud2: [0xe8b4b0, 0xe6e6ee, 0xf4f8ff]
};
const KC = {}; for (const k in KEYS) KC[k] = KEYS[k].map(c => new THREE.Color(c));
const tmpC = new THREE.Color();
function keyColor(k, t, out) {
  const s = t <= STOPS[1] ? 0 : 1, f = (t - STOPS[s]) / (STOPS[s + 1] - STOPS[s]);
  return out.copy(KC[k][s]).lerp(KC[k][s + 1], Math.min(1, Math.max(0, f)));
}
let lastPhase = -1, envAge = 99;
// phase: 0 = sunrise, 1 = end of the round
export function setDaylight(phase, dt = 0) {
  envAge += dt;
  phase = Math.min(1, Math.max(0, phase));
  if (Math.abs(phase - lastPhase) < 0.002) return;
  const S = CFG.sky, el = (S.startElevationDeg + (S.endElevationDeg - S.startElevationDeg) * Math.sqrt(phase)) * Math.PI / 180;
  const az = Math.atan2(-0.55, -0.8);
  sunDir.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  sun.position.copy(sunDir).multiplyScalar(500);
  sunSprite.position.copy(sunDir).multiplyScalar(4300);
  keyColor('sun', phase, sun.color); sun.intensity = 0.7 + 0.45 * phase;
  keyColor('sunGlow', phase, sunSprite.material.color);
  keyColor('hemiSky', phase, hemi.color); hemi.intensity = 0.65 + 0.15 * phase;
  const U = sky.material.uniforms;
  keyColor('top', phase, U.top.value); keyColor('mid', phase, U.mid.value); keyColor('hor', phase, FOG);
  scene.fog.color.copy(FOG);
  pts.material.opacity = 0.7 * Math.max(0, 1 - phase / 0.3);
  for (const c of clouds) keyColor(c.userData.tint ? 'cloud2' : 'cloud', phase, c.material.color);
  lastPhase = phase;
  if (envAge > 2) { envAge = 0; refreshReflection(); }
}

export function updateSky(dt) {
  waterNormals.offset.x += dt * 0.012; waterNormals.offset.y += dt * 0.007;
  for (const c of clouds) { c.position.x += dt * 4; if (c.position.x > 2800) c.position.x = -2800; }
  sky.position.copy(camera.position);
}
export function resizeRenderer(w, h) {
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
