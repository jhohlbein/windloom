// Shared original gameplay. Presentation and state are injected; no DOM or WebGL dependency.
export function createMotion(services) {
  const random = services.random || Math.random,
    R = random;
  const { THREE } = services;
  const { CFG } = services;
  const { G } = services;
  const { W } = services;
  const { settings } = services;
  const { castle } = services;
  const { palace } = services;
  const { player } = services;
  const groundH = (...args) => services.groundH(...args);
  const terrainH = (...args) => services.terrainH(...args);
  const clamp = (...args) => services.clamp(...args);
  const lerp = (...args) => services.lerp(...args);
  const sfx = (...args) => services.sfx(...args);
  const toast = (...args) => services.toast(...args);
  const emit = (...args) => services.emit(...args);
  const { C } = services;
  const castFire = (...args) => services.castFire(...args);
  const castNova = (...args) => services.castNova(...args);
  const animateRig = (...args) => services.animateRig(...args);
  const onPlace = (...args) => services.onPlace(...args);
  function placePlayerAtCastle() {
    const d = Math.hypot(W.CX, W.CZ),
      ux = d > 1 ? W.CX / d : 0,
      uz = d > 1 ? W.CZ / d : 1,
      back = 27;
    G.yaw = Math.atan2(ux, uz);
    G.playerPos.set(
      W.CX + ux * back,
      Math.min(CFG.world.ceiling - 3, W.PH + G.castleTopY + 30),
      W.CZ + uz * back
    );
    G.pitch = 0;
    G.bodyPitch = 0;
    G.keyPitch = 0;
    G.roll = 0;
    G.speed = 0;
    G.strafe = 0;
    G.steerX = G.steerY = 0;
    onPlace();
  }

  // Lowest height the carpet's centre may have here: the centre keeps groundClearance above the ground, and each
  // corner of the (tilted) carpet keeps cornerClearance above the ground beneath that corner.
  const CORNERS = [
    [-1.7, 2.5],
    [1.7, 2.5],
    [-1.7, -2.5],
    [1.7, -2.5]
  ].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const cEuler = new THREE.Euler(0, 0, 0, 'YXZ'),
    cTmp = new THREE.Vector3();
  function groundFloor(P) {
    const cp = CFG.player;
    let floor = groundH(P.x, P.z) + cp.groundClearance;
    cEuler.set(G.bodyPitch, G.yaw, G.roll);
    for (const c of CORNERS) {
      cTmp.copy(c).applyEuler(cEuler);
      floor = Math.max(floor, groundH(P.x + cTmp.x, P.z + cTmp.z) + cp.cornerClearance - cTmp.y);
    }
    return floor;
  }

  // Palace and creature collision. The carpet is treated as a sphere of radius PR. Coming from above, it rides on roofs and
  // domes; from the side, it is pushed out of walls and towers and slides along them.
  const PR = 2.6;
  function collidePalace(P, prevY) {
    const cx = castle.position.x,
      cy = castle.position.y,
      cz = castle.position.z,
      clear = CFG.player.groundClearance;
    for (let pass = 0; pass < 2; pass++) {
      // two passes settle corners where shapes meet
      for (const c of palace.colliders) {
        const top = cy + c.top + clear;
        if (P.y >= top) continue;
        const lx = P.x - cx - c.x,
          lz = P.z - cz - c.z;
        let nx, nz, depth;
        if (c.cyl) {
          const d = Math.hypot(lx, lz);
          depth = c.r + PR - d;
          if (depth <= 0) continue;
          nx = d > 1e-4 ? lx / d : 1;
          nz = d > 1e-4 ? lz / d : 0;
        } else {
          const qx = clamp(lx, -c.hx, c.hx),
            qz = clamp(lz, -c.hz, c.hz),
            dx = lx - qx,
            dz = lz - qz,
            d = Math.hypot(dx, dz);
          if (d > 1e-4) {
            depth = PR - d;
            if (depth <= 0) continue;
            nx = dx / d;
            nz = dz / d;
          } else {
            // centre inside the box: leave by the nearest face
            const ex = c.hx - Math.abs(lx),
              ez = c.hz - Math.abs(lz);
            if (ex < ez) {
              nx = Math.sign(lx) || 1;
              nz = 0;
              depth = ex + PR;
            } else {
              nx = 0;
              nz = Math.sign(lz) || 1;
              depth = ez + PR;
            }
          }
        }
        if (prevY >= top - 1.5)
          P.y = top; // was above it (or nearly): settle on top
        else {
          P.x += nx * depth;
          P.z += nz * depth;
        } // hit it from the side: slide along it
      }
    }
  }

  // Height mode 'hold': the height to fly at, hoverHeight above the highest surface (ground, or a palace roof or
  // tower) under the carpet and along its path for lookAheadSeconds, so it starts to rise before a slope; never above
  // the ceiling (taller ground is a wall, see below)
  function surfaceTop(x, z) {
    let h = groundH(x, z);
    const cx = castle.position.x,
      cy = castle.position.y,
      cz = castle.position.z;
    for (const c of palace.colliders) {
      const lx = x - cx - c.x,
        lz = z - cz - c.z;
      const inside = c.cyl
        ? Math.hypot(lx, lz) < c.r + PR
        : Math.abs(lx) < c.hx + PR && Math.abs(lz) < c.hz + PR;
      if (inside) h = Math.max(h, cy + c.top);
    }
    return h;
  }
  function holdTarget(P) {
    const A = CFG.player.altitude,
      v = G.playerVel,
      hs = Math.hypot(v.x, v.z);
    let top = surfaceTop(P.x, P.z);
    if (hs > 1) {
      const L = Math.max(8, hs * A.lookAheadSeconds),
        ux = v.x / hs,
        uz = v.z / hs;
      for (let i = 1; i <= 6; i++)
        top = Math.max(top, surfaceTop(P.x + (ux * L * i) / 6, P.z + (uz * L * i) / 6));
    }
    return Math.min(CFG.world.ceiling, top + A.hoverHeight);
  }

  // Ground the carpet may not fly over, as a smooth field: the mean ground height (plus clearance) at the point and
  // in a ring of wallSmoothRadius around it. Where it exceeds the ceiling there is a wall. Averaging rounds off the
  // facets, gullies and spurs of the mountains, so the wall is a gentle contour instead of following every triangle.
  function wallH(x, z) {
    const r = CFG.player.wallSmoothRadius;
    let s = groundH(x, z);
    const here = groundFloor(wTmp.set(x, 0, z)); // the lowest the carpet itself can be here, corners included
    for (let i = 0; i < 8; i++) s += groundH(x + WALL_RING[i][0] * r, z + WALL_RING[i][1] * r);
    // ... but never more than wallOvershoot below the real ground here, so a sharp spur cannot carry the carpet
    // far above the ceiling
    return Math.max(s / 9 + CFG.player.groundClearance, here - CFG.player.wallOvershoot);
  }
  const wTmp = new THREE.Vector3();
  const WALL_RING = Array.from({ length: 8 }, (_, i) => [
    Math.cos((i * Math.PI) / 4),
    Math.sin((i * Math.PI) / 4)
  ]);
  // Mountains taller than the ceiling are walls. A move into one is deflected: the same step is tried turned by
  // 15, 30 … 105 degrees to either side (first towards the side the wall's contour runs on, which is remembered so
  // the carpet does not flip-flop), and the smallest turn that is free is taken, a little shorter the sharper the
  // turn. So the carpet slides around a mountain whatever its facets look like; only a pocket closed on both sides
  // stops it. (If it somehow is already above such ground, it may still move anywhere that is not higher.)
  let wallSide = 1,
    wallSideT = -9;
  function slideAlongWall(P, prevX, prevZ) {
    const limit = Math.max(CFG.world.ceiling, wallH(prevX, prevZ));
    if (wallH(P.x, P.z) <= limit) return;
    const dx = P.x - prevX,
      dz = P.z - prevZ;
    if (G.playTime - wallSideT > 0.5) {
      // a fresh contact: pick the side from the slope here
      const e = 4,
        gx = wallH(P.x + e, P.z) - wallH(P.x - e, P.z),
        gz = wallH(P.x, P.z + e) - wallH(P.x, P.z - e);
      let tx = -gz,
        tz = gx;
      if (dx * tx + dz * tz < 0) {
        tx = -tx;
        tz = -tz;
      } // along the contour, the way we are heading
      wallSide = dx * tz - dz * tx >= 0 ? 1 : -1;
    }
    wallSideT = G.playTime;
    for (let n = 1; n <= 7; n++) {
      const a = (n * Math.PI) / 12,
        c = Math.cos(a),
        sn = Math.sin(a),
        f = Math.max(0.3, c);
      for (const side of [wallSide, -wallSide]) {
        const x = prevX + (dx * c - dz * sn * side) * f,
          z = prevZ + (dx * sn * side + dz * c) * f;
        if (wallH(x, z) <= limit) {
          P.x = x;
          P.z = z;
          wallSide = side;
          return;
        }
      }
    }
    P.x = prevX;
    P.z = prevZ; // a pocket: stay
  }

  let throttleHeld = false;
  function updatePlayer(dt, actions = true) {
    const cp = CFG.player,
      I = G.input,
      keys = G.keys,
      P = G.playerPos;
    const CK = CFG.controls.keys,
      hold = cp.altitude.mode === 'hold';
    // Arrow keys, finely: a turn builds up while ← or → is held (a tap is a small correction, held it reaches a full
    // turn after turnRampSeconds). In 'hold' mode ↑ ↓ move the nose gradually; let go and it eases back to level with
    // the time constant levelTimeConstant (0 leaves it where it is). In 'free' mode they climb and dive while held.
    const kx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0),
      kyHeld = ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * (settings.invertKeys ? -1 : 1);
    if (!kx || kx !== G.keyTurnDir) G.keyTurn = kx ? CK.turnStart : 0;
    else G.keyTurn = Math.min(1, G.keyTurn + (dt * (1 - CK.turnStart)) / CK.turnRampSeconds);
    G.keyTurnDir = kx;
    if (!hold) G.keyPitch = 0;
    else if (kyHeld) G.keyPitch = clamp(G.keyPitch + (kyHeld * dt) / CK.pitchSeconds, -1, 1);
    else if (CK.levelTimeConstant > 0) G.keyPitch *= Math.exp(-dt / CK.levelTimeConstant);
    const ky = hold ? G.keyPitch : kyHeld * 0.7;
    // Touch drag and tilt: a softer response near the centre (exponent controls.expo) for fine adjustments
    const ex = (v) => Math.sign(v) * Math.pow(Math.abs(v), CFG.controls.expo);
    const sx = clamp(I.mouseX + ex(I.touchX) + ex(I.tiltX) + kx * G.keyTurn, -1, 1),
      sy = clamp(
        I.mouseY * (settings.invertMouse ? -1 : 1) + ex(I.touchY) + ex(I.tiltY) + ky,
        -1,
        1
      );
    const RS = cp.response; // how quickly steering, pitch, speed, strafe and roll follow the controls (per second)
    G.steerX = lerp(G.steerX, sx, Math.min(1, dt * RS.steer));
    G.steerY = lerp(G.steerY, sy, Math.min(1, dt * RS.steer));
    G.yaw -= G.steerX * cp.turnRate * dt;
    G.pitch = lerp(
      G.pitch,
      G.steerY * (G.steerY > 0 ? cp.pitchMaxUp : cp.pitchMaxDown),
      Math.min(1, dt * RS.pitch)
    ); // the nose points further up than down
    // Throttle: W (or the pad's up arrow) speeds the carpet up to baseSpeed; let go and it keeps its speed, but never drops
    // below minSpeed (0: it can rest). S (or the pad's down arrow) brakes, then flies backwards; let go and it comes back to minSpeed.
    const T = cp.throttle,
      fwd = !!(keys.KeyW || I.touchBoost),
      back = keys.KeyS || I.touchBack;
    if (fwd && !throttleHeld && G.speed < cp.baseSpeed * 0.6) sfx('whoosh', 0.9); // the throttle engaging from a glide
    throttleHeld = fwd;
    const want = back
      ? -cp.baseSpeed * cp.reverseMultiplier
      : fwd
        ? cp.baseSpeed
        : Math.max(G.speed, T.minSpeed);
    const rate = want > G.speed && G.speed >= 0 ? T.acceleration : T.brakeDeceleration;
    G.speed =
      G.speed < want ? Math.min(want, G.speed + rate * dt) : Math.max(want, G.speed - rate * dt);
    const st =
      ((keys.KeyD || I.touchRight ? 1 : 0) - (keys.KeyA || I.touchLeft ? 1 : 0)) * cp.strafeSpeed;
    G.strafe = lerp(G.strafe, st, Math.min(1, dt * RS.strafe));
    G.roll = lerp(
      G.roll,
      -G.steerX * 0.6 - (G.strafe / cp.strafeSpeed) * 0.35,
      Math.min(1, dt * RS.roll)
    );
    const cpi = Math.cos(G.pitch);
    G.fwd.set(-Math.sin(G.yaw) * cpi, Math.sin(G.pitch), -Math.cos(G.yaw) * cpi);
    G.rightV.set(Math.cos(G.yaw), 0, -Math.sin(G.yaw));
    // Height: in 'hold' mode the carpet flies level and keeps hoverHeight above the ground by itself, and up/down only
    // turn the view and aim (G.fwd); in 'free' mode the carpet flies where it points, so up/down climb and dive
    if (hold)
      G.playerVel
        .set(-Math.sin(G.yaw) * G.speed, 0, -Math.cos(G.yaw) * G.speed)
        .addScaledVector(G.rightV, G.strafe);
    else G.playerVel.copy(G.fwd).multiplyScalar(G.speed).addScaledVector(G.rightV, G.strafe);
    const prevX = P.x,
      prevY = P.y,
      prevZ = P.z;
    P.addScaledVector(G.playerVel, dt);
    if (hold) {
      const A = cp.altitude,
        vy = clamp((holdTarget(P) - P.y) * A.response, -A.sinkRate, A.climbRate);
      P.y += vy * dt;
      G.playerVel.y = vy;
    }
    G.bodyPitch = G.pitch; // the nose shows where you aim (in 'free' mode also where you fly)
    collidePalace(P, prevY);
    for (const e of G.enemies) if (e.collide) e.collide(P, PR); // solid creatures (sandworms)
    // Mountains taller than the ceiling are walls: where the ground would rise above the ceiling, the move is
    // undone along that axis, so the carpet slides along the slope instead of climbing it. (If it somehow is
    // already above such ground, it may still move anywhere that is not higher.)
    slideAlongWall(P, prevX, prevZ);
    const gy = groundFloor(P);
    let skim = P.y - gy;
    if (skim < 0) {
      P.y = gy;
      skim = 0;
    }
    const top = Math.max(CFG.world.ceiling, gy); // never push the carpet into a peak taller than the ceiling
    if (P.y > top) P.y = top;
    const r = Math.hypot(P.x, P.z),
      B = CFG.world.boundRadius;
    if (r > B) {
      P.x *= B / r;
      P.z *= B / r;
      if (G.wallToast <= 0) {
        toast('A sandstorm turns you back', 1800, true);
        G.wallToast = 4;
      }
    }
    player.position.copy(P);
    player.rotation.set(G.bodyPitch, G.yaw, G.roll);
    animateRig(dt);
    if (skim < 7 && random() < 0.8) {
      const wet = terrainH(P.x, P.z) < 0.5;
      emit(
        P.x + (random() - 0.5) * 2,
        groundH(P.x, P.z) + 0.2,
        P.z + (random() - 0.5) * 2,
        (random() - 0.5) * 6 - G.playerVel.x * 0.1,
        3 + random() * 4,
        (random() - 0.5) * 6 - G.playerVel.z * 0.1,
        wet ? C.SPRAY : C.DUST,
        2.2,
        0.7
      );
    }
    const tail = G.speed >= 0 ? -2.4 : 2.4;
    emit(
      P.x + G.fwd.x * tail,
      P.y + G.fwd.y * tail - 0.2,
      P.z + G.fwd.z * tail,
      (random() - 0.5) * 3,
      (random() - 0.5) * 3,
      (random() - 0.5) * 3,
      C.MANA,
      1.2,
      0.6
    );
    if (G.playTime - G.lastHurt > cp.regenDelaySeconds && G.hp < G.maxHp)
      G.hp = Math.min(G.maxHp, G.hp + cp.regenPerSecond * dt);
    const SM = CFG.spells.mana;
    G.spellMana = Math.min(SM.max, G.spellMana + SM.regenPerSecond * dt);
    if (G.spellExhausted && G.spellMana >= SM.refireAt) G.spellExhausted = false;
    G.fireCd -= dt;
    G.novaCd -= dt;
    G.invuln = Math.max(0, G.invuln - dt);
    G.wallToast -= dt;
    if (actions && (I.mouseFire || I.touchFire || keys.Space)) castFire();
    if (actions && I.novaReq) {
      I.novaReq = false;
      castNova();
    }
    player.visible = G.invuln <= 0 || Math.floor(G.invuln * 14) % 2 === 0;
  }
  return { placePlayerAtCastle, updatePlayer };
}
