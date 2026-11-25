// A presentation port with real transforms and zero geometry, textures, DOM or WebGL.
// Creature hit centres depend on animated bones, so Object3D maths is retained.
import * as THREE from 'three';
import { C } from './palette.js';
class Geometry {
  constructor() {
    this.userData = {};
  }
  rotateX() {
    return this;
  }
  rotateY() {
    return this;
  }
  rotateZ() {
    return this;
  }
  translate() {
    return this;
  }
  scale() {
    return this;
  }
  setAttribute() {
    return this;
  }
  setIndex() {
    return this;
  }
  computeVertexNormals() {
    return this;
  }
  applyMatrix4() {
    return this;
  }
  dispose() {}
  clone() {
    return new Geometry();
  }
}
class Material {
  constructor(options = {}) {
    Object.assign(this, options);
    this.userData = {};
    this.color = new THREE.Color(options.color ?? 0xffffff);
    this.emissive = new THREE.Color(options.emissive ?? 0);
  }
  clone() {
    const m = new Material(this);
    m.userData = { ...this.userData };
    return m;
  }
  dispose() {}
}
class Mesh extends THREE.Object3D {
  constructor(geometry = new Geometry(), material = new Material()) {
    super();
    this.geometry = geometry;
    this.material = material;
    this.isMesh = true;
  }
  copy(o, recursive = true) {
    super.copy(o, recursive);
    this.geometry = o.geometry;
    this.material = o.material;
    return this;
  }
}
class Sprite extends Mesh {
  constructor(material) {
    super(undefined, material);
    this.isSprite = true;
  }
}
class InstancedMesh extends Mesh {
  constructor(g, m, count) {
    super(g, m);
    this.count = count;
    this.instanceMatrix = {};
  }
  setMatrixAt() {}
  setColorAt() {}
}
class Shape {
  moveTo() {
    return this;
  }
  lineTo() {
    return this;
  }
  quadraticCurveTo() {
    return this;
  }
  absarc() {
    return this;
  }
}
export const headlessThree = {
  ...THREE,
  Mesh,
  Sprite,
  InstancedMesh,
  Shape,
  MeshStandardMaterial: Material,
  MeshBasicMaterial: Material,
  SpriteMaterial: Material,
  BufferGeometry: Geometry,
  SphereGeometry: Geometry,
  IcosahedronGeometry: Geometry,
  CylinderGeometry: Geometry,
  TorusGeometry: Geometry,
  LatheGeometry: Geometry,
  ShapeGeometry: Geometry,
  ConeGeometry: Geometry,
  CircleGeometry: Geometry,
  BoxGeometry: Geometry,
  PlaneGeometry: Geometry
};
export function presentation() {
  const mats = Object.fromEntries(
    ['fire', 'gold', 'bolt', 'ink', 'acid', 'ember', 'mana'].map((k) => [k, new Material()])
  );
  const geometry = new Geometry();
  return {
    THREE: headlessThree,
    scene: { add() {}, remove() {} },
    mats,
    geo: new Proxy({}, { get: () => geometry }),
    C,
    fireCoreMat: mats.fire,
    shared: (o) => o,
    addSprite: (_m, size) => {
      const s = new Sprite();
      s.scale.setScalar(size || 1);
      return s;
    },
    glowMat: () => new Material(),
    coreMatFor: (m) => m,
    haloMatFor: (m) => m,
    emit() {},
    burst() {},
    sfx() {},
    sfxAt() {},
    toast() {},
    flashHurt() {},
    mark() {},
    castShadows() {},
    disposeTree() {},
    animateRig() {},
    onPlace() {}
  };
}
