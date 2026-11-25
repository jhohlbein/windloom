import * as THREE from 'three';
import { G } from '../state.js';
import {
  scene,
  camera,
  mats,
  addSprite,
  coreMatFor,
  haloMatFor,
  fireCoreMat,
  castShadows
} from '../scene.js';
import { C } from '../simulation/palette.js';
import { player } from '../player.js';
import { createFlyer } from '../creatures/flyers.js';
import { createDragon } from '../creatures/dragon.js';
import { createKraken } from '../creatures/kraken.js';
import { createWorm } from '../creatures/sandworm.js';
import { createSkeleton, createSkeletonGroup } from '../creatures/skeleton.js';
import { animBeast } from '../creatures/beasts.js';
import { removeEnemyObj } from '../creatures/common.js';
import { spawnOrb, clearProjectiles } from '../combat.js';
import { clearCreatures } from '../creatures/spawn.js';
import { applyLevel } from '../progress.js';
import { lerpAngle, clamp } from '../util.js';
import { sfx } from '../audio.js';
import { flashHurt } from '../hud.js';

const GLOBAL = [
  'timed',
  'timeLeft',
  'finished',
  'endReason',
  'castleMana',
  'kills',
  'killsBy',
  'dragonSlain',
  'castleTopY'
];
const numberFields = [
  'carried',
  'hp',
  'maxHp',
  'invuln',
  'lastHurt',
  'atSpring',
  'spellMana',
  'spellExhausted'
];
const movement = [
  'yaw',
  'pitch',
  'bodyPitch',
  'keyPitch',
  'keyTurn',
  'keyTurnDir',
  'roll',
  'speed',
  'strafe',
  'steerX',
  'steerY',
  'fireCd',
  'novaCd',
  'wallToast'
];
const point = new THREE.Vector3();
export class OnlineView {
  constructor() {
    this.enemies = new Map();
    this.orbs = new Map();
    this.shots = new Map();
    this.bolts = new Map();
    this.rings = new Map();
    this.ghosts = new Map();
    this.latest = null;
    this.previous = null;
    this.runId = null;
    this.receivedAt = 0;
    this.interval = 100;
  }
  clear() {
    clearCreatures();
    clearProjectiles();
    for (const r of G.rings) {
      scene.remove(r.m);
      r.m.material.dispose();
    }
    G.rings.length = 0;
    for (const r of this.rings.values()) {
      scene.remove(r.m);
      r.m.geometry.dispose();
      r.m.material.dispose();
    }
    for (const ghost of this.ghosts.values()) {
      scene.remove(ghost.model);
      ghost.label.remove();
      ghost.model.traverse((o) => {
        if (o.material?.userData?.onlineGhost) o.material.dispose();
      });
    }
    for (const map of [this.enemies, this.orbs, this.shots, this.bolts, this.rings, this.ghosts])
      map.clear();
    this.latest = this.previous = null;
    this.runId = null;
  }
  receive(frame, rtt = 0) {
    const first = this.runId !== frame.room.runId;
    if (first) {
      this.clear();
      this.runId = frame.room.runId;
    }
    const now = performance.now();
    this.previous = this.latest;
    this.latest = frame;
    this.interval = Math.max(50, Math.min(250, now - this.receivedAt));
    this.receivedAt = now;
    if (first || G.level !== frame.level) applyLevel(frame.level, false);
    for (const k of GLOBAL) G[k] = frame[k];
    G.level = frame.level;
    G.playTime = frame.time;
    G.gameMode = frame.timed ? 'timed' : 'free';
    const own = frame.players.find((p) => p.id === frame.self);
    if (!own) return;
    if (!first && own.hp < G.hp) {
      flashHurt();
      sfx('hurt');
    }
    if (!first && own.carried > G.carried + 1) sfx('mana');
    for (const k of numberFields) G[k] = own[k];
    const target = point
      .fromArray(own.pos)
      .addScaledVector(new THREE.Vector3().fromArray(own.vel), Math.min(0.15, rtt / 2000));
    const snap = first || G.playerPos.distanceTo(target) > 12;
    G.playerPos.lerp(target, snap ? 1 : 0.45);
    G.playerVel.fromArray(own.vel);
    for (const k of movement)
      if (own[k] !== undefined)
        G[k] = !snap && k === 'yaw' ? lerpAngle(G.yaw, own.yaw, 0.6) : own[k];
    player.position.copy(G.playerPos);
    player.rotation.set(G.bodyPitch, G.yaw, G.roll);
    this.sync(
      frame.enemies,
      this.enemies,
      (d) => {
        const pos = new THREE.Vector3().fromArray(d.pos);
        const e =
          d.kind === 'wyvern' || d.kind === 'drake'
            ? createFlyer(d.kind, pos)
            : d.kind === 'dragon'
              ? createDragon()
              : d.kind === 'worm'
                ? createWorm(pos)
                : d.kind === 'kraken'
                  ? createKraken(pos)
                  : createSkeleton(pos, createSkeletonGroup(pos));
        e.id = d.id;
        castShadows(e.root);
        return e;
      },
      (e) => {
        removeEnemyObj(e);
      }
    );
    G.enemies = [...this.enemies.values()];
    this.sync(
      frame.orbs,
      this.orbs,
      (d) => {
        spawnOrb(new THREE.Vector3().fromArray(d.pos), d.val, null, true);
        const o = G.orbs.at(-1);
        o.id = d.id;
        return o;
      },
      (o) => scene.remove(o.g)
    );
    G.orbs = [...this.orbs.values()];
    for (const [name, map] of [
      ['shots', this.shots],
      ['bolts', this.bolts]
    ]) {
      this.sync(
        frame[name],
        map,
        (d) => {
          const color =
            Object.entries({ acid: C.ACID, ink: C.INK, bolt: C.RED, ember: C.EMBER }).find(
              ([, rgb]) => rgb.every((n, i) => n === d.col?.[i])
            )?.[0] || 'ember';
          const material = name === 'shots' ? mats.fire : mats[color];
          const g = addSprite(haloMatFor(material), name === 'shots' ? 5.5 : (d.sz || 2) / 0.38);
          const core = new THREE.Sprite(name === 'shots' ? fireCoreMat : coreMatFor(material));
          core.scale.setScalar(0.55);
          g.add(core);
          scene.add(g);
          return { g, pos: g.position, vel: new THREE.Vector3(), id: d.id };
        },
        (o) => scene.remove(o.g)
      );
      G[name] = [...map.values()];
    }
    this.sync(
      frame.rings || [],
      this.rings,
      (d) => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(1, 24, 16),
          new THREE.MeshBasicMaterial({
            color: d.color,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
          })
        );
        scene.add(m);
        return { m, id: d.id };
      },
      (r) => {
        scene.remove(r.m);
        r.m.geometry.dispose();
        r.m.material.dispose();
      }
    );
    G.dragon = G.enemies.find((e) => e.kind === 'dragon') || null;
    const others = frame.roster.filter((p) => p.id !== frame.self);
    this.sync(
      others,
      this.ghosts,
      (d) => {
        const model = player.clone(true);
        model.visible = true;
        model.traverse((o) => {
          if (o.material) {
            o.material = o.material.clone();
            o.material.transparent = true;
            o.material.opacity = 0.65;
            o.material.depthWrite = false;
            o.material.userData.onlineGhost = true;
          }
        });
        scene.add(model);
        const label = document.createElement('span');
        label.className = 'remote-name';
        document.getElementById('remoteNames').append(label);
        return { model, label, id: d.id };
      },
      (g) => {
        scene.remove(g.model);
        g.label.remove();
        g.model.traverse((o) => {
          if (o.material?.userData?.onlineGhost) o.material.dispose();
        });
      }
    );
  }
  sync(data, map, create, remove) {
    const ids = new Set(data.map((d) => d.id));
    for (const [id, o] of map)
      if (!ids.has(id)) {
        remove(o);
        map.delete(id);
      }
    for (const d of data) if (!map.has(d.id)) map.set(d.id, create(d));
  }
  interpolate(d, old, alpha, key = 'pos') {
    const a = old?.[key] || d[key];
    return d[key].map((n, i) => a[i] + (n - a[i]) * alpha);
  }
  render(now) {
    const f = this.latest;
    if (!f) return;
    const alpha = clamp((now - this.receivedAt) / this.interval, 0, 1),
      old = this.previous;
    const previous = new Map((old?.enemies || []).map((d) => [d.id, d]));
    for (const d of f.enemies) {
      const e = this.enemies.get(d.id),
        before = previous.get(d.id);
      if (!e) continue;
      e.pos.fromArray(this.interpolate(d, before, alpha));
      e.root.position.fromArray(this.interpolate(d, before, alpha, 'root'));
      e.root.rotation.set(...d.rot);
      for (const k of [
        'hp',
        'maxHp',
        'r',
        't',
        'state',
        'st',
        'ph',
        'flapPh',
        'jawOpen',
        'yawRate',
        'rise',
        'open',
        'flash',
        'barT',
        'canSee'
      ])
        if (d[k] !== undefined) e[k] = d[k];
      e.vel.fromArray(d.vel);
      e.ghost = e.hp;
      e.targetable = () => d.targetable;
      e.showBar = () => d.targetable;
      if (e.B) {
        e.B.lookX = d.lookX || 0;
        e.B.lookY = d.lookY || 0;
        animBeast(
          e.B,
          d.t,
          d.ph ?? d.flapPh ?? 0,
          e.L?.amp ?? 0.55,
          d.jawOpen || 0,
          d.yawRate || 0
        );
      }
      if (d.kind === 'kraken') {
        e.body.position.y = d.bodyY;
        for (const tn of e.tents)
          tn.segs.forEach((s, j) => {
            s.rotation.x = -0.08 + Math.sin(d.t * 2.1 + j * 0.75 + tn.ph) * 0.22;
          });
      }
      if (d.kind === 'skeleton') {
        e.body.position.y = d.bodyY;
        const sw = Math.sin(d.walk || 0) * 0.5 * (d.stride || 0);
        e.legL.rotation.x = sw;
        e.legR.rotation.x = -sw;
        e.armL.rotation.x = e.armR.rotation.x = (Math.min(1, (d.draw || 0) * 1.5) * Math.PI) / 2;
      }
      if (d.kind === 'worm') {
        e.head.position.fromArray(this.interpolate(d, before, alpha));
        e.head.quaternion.fromArray(d.head);
        d.segs?.forEach((p, i) => {
          const s = e.segs[i];
          s.p.fromArray(p);
          s.ball.position.copy(s.p);
          s.joint.position
            .copy(i ? e.segs[i - 1].p : e.pos)
            .add(s.p)
            .multiplyScalar(0.5);
        });
        for (const petal of e.petals) petal.rotation.y = -0.35 + (d.open || 0) * 1.1;
      }
    }
    for (const [name, map] of [
      ['orbs', this.orbs],
      ['shots', this.shots],
      ['bolts', this.bolts]
    ]) {
      const previous = new Map((old?.[name] || []).map((d) => [d.id, d]));
      for (const d of f[name]) {
        const o = map.get(d.id);
        o.pos.fromArray(this.interpolate(d, previous.get(d.id), alpha));
        o.vel.fromArray(d.vel);
        if (o.m) {
          o.m.rotation.y = now / 500;
          o.m.position.y = Math.sin(now / 330) * 0.5;
        }
      }
    }
    for (const d of f.rings || []) {
      const r = this.rings.get(d.id),
        progress = clamp(d.t / d.dur, 0, 1);
      r.m.position.fromArray(d.pos);
      r.m.scale.setScalar(2 + (d.max - 2) * (1 - Math.pow(1 - progress, 2)));
      r.m.material.opacity = 0.4 * (1 - progress);
    }
    const oldRoster = new Map((old?.roster || []).map((p) => [p.id, p]));
    for (const d of f.roster) {
      const ghost = this.ghosts.get(d.id);
      if (!ghost) continue;
      ghost.model.position.fromArray(this.interpolate(d, oldRoster.get(d.id), alpha));
      ghost.model.rotation.set(d.bodyPitch, d.yaw, d.roll);
      ghost.label.textContent = d.name + ' · ' + d.id.slice(0, 4);
      point.copy(ghost.model.position);
      point.y += 7;
      point.project(camera);
      ghost.label.hidden =
        point.z > 1 || point.z < -1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1;
      ghost.label.style.left = (point.x + 1) * 50 + '%';
      ghost.label.style.top = (-point.y + 1) * 50 + '%';
    }
  }
}
