// Palace progress: banking mana in the beam raises the palace through its stages.
import * as THREE from 'three';
import { CFG } from './config.js';
import { G, W } from './state.js';
import { buildCastle } from './palace.js';
import { emit, burst, C } from './particles.js';
import { sfx } from './audio.js';
import { toast } from './hud.js';
import { addRing } from './combat.js';

const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
export const stageCount = () => CFG.palace.stageThresholds.length;
export const carryCap = () => CFG.player.carryBase + CFG.player.carryPerStage * G.level;
export function levelFor(m) { const T = CFG.palace.stageThresholds; let L = 1; for (let i = 1; i < T.length; i++) if (m >= T[i]) L = i + 1; return L; }

export function applyLevel(L, announce) {
  const prev = G.level; G.level = L;
  const ratio = G.hp / G.maxHp;
  G.maxHp = CFG.player.maxHp + CFG.player.maxHpPerStage * (L - 1);
  G.hp = Math.min(G.maxHp, Math.max(G.hp, ratio * G.maxHp) + (announce ? CFG.palace.stageUpHealBonus : 0));
  buildCastle(L);
  if (announce && L > prev) {
    addRing(new THREE.Vector3(W.CX, W.PH + 10, W.CZ), 160, 1.1, 0xffd36b);
    burst(new THREE.Vector3(W.CX, W.PH + G.castleTopY, W.CZ), 70, C.GOLD, 40, 3, 1.2);
    // Name any creatures whose fromStage was just reached
    const S = CFG.spawning, news = [S.sandworms, S.drakes, S.krakens, S.dragon]
      .filter(r => r && r.announce && r.fromStage > prev && r.fromStage <= L).map(r => r.announce);
    if (L >= stageCount() && !G.dragonSlain) news.push(G.timed ? 'Slay Vharoth to end the round early.' : 'Slay Vharoth to make the Sanctum whole.');
    toast(['Palace raised: ' + CFG.palace.stageNames[L - 1], ...news].join('\n'), news.length ? 5200 : 3200); sfx('level');
  }
}

// Tell the player once per stage when the mana they carry (plus what is banked) is enough for the next stage
export function upgradeHint() {
  const T = CFG.palace.stageThresholds;
  if (G.level >= T.length || G.upgradeHint === G.level) return;
  if (G.castleMana + G.carried >= T[G.level]) {
    G.upgradeHint = G.level;
    toast('You carry enough mana to raise the palace to ' + CFG.palace.stageNames[G.level] + '.\nBring it home to the beam!', 4500);
    sfx('mana');
  }
}

// Inside the beam: bank carried mana and heal
export function updateDeposit(dt) {
  const P = G.playerPos, cp = CFG.palace;
  const near = Math.hypot(P.x - W.CX, P.z - W.CZ) < cp.depositRadius && P.y < W.PH + G.castleTopY + 55;
  if (near && G.hp < G.maxHp) G.hp = Math.min(G.maxHp, G.hp + cp.healPerSecond * dt);
  if (near && G.carried > 0) {
    const amt = Math.min(G.carried, cp.depositPerSecond * dt); G.carried -= amt; G.castleMana += amt;
    tmp2.set(W.CX, W.PH + G.castleTopY, W.CZ);
    for (let i = 0; i < 3; i++) {
      const v = tmp.copy(tmp2).sub(P); const l = v.length() || 1; v.multiplyScalar(45 / l);
      emit(P.x, P.y + 0.5, P.z, v.x + (Math.random() - 0.5) * 14, v.y + (Math.random() - 0.5) * 14, v.z + (Math.random() - 0.5) * 14, C.GOLD, 1.8, 0.9);
    }
    sfx('deposit');
    const L = levelFor(G.castleMana);
    if (L > G.level) applyLevel(L, true);
  }
}
