# Game settings

All gameplay numbers live in [`game-config.json`](game-config.json). Edit a value, save, and reload the page. JSON has no comments, so this file explains each setting. One world unit is one metre (the carpet is about 5 m long). Distances are in metres, times in seconds, speeds in metres per second.

The **Value** column shows what `game-config.json` currently contains. Keep it in step with the JSON whenever either file changes.

"Stage" means the palace stage, 1 (Minaret) to 6 (Crescent Sanctum). Several values scale with it.

## How scaling works

- **Hit points:** `hp + hpBonus × floor(stage / hpBonusEveryStages)`. Example: kraken `12 + 2 × floor(stage / 2)` gives 12 at stage 1, 14 at stages 2–3, 16 at 4–5.
- **Population targets** (every creature in `spawning` except the dragon): none before `fromStage`, then `min(base + floor(add × (stage − fromStage)), max)`. `add` may be a fraction: 0.5 adds one creature every second stage. Example: sandworms `fromStage 3, base 2, add 0.5, max 3` give 2 at stages 3–4 and 3 from stage 5.
- **perLand:** a rule with `"perLand": true` (skeletons, sandworms) multiplies that target by the island's land relative to the mean (`landCover` drawn for this island ÷ `world.landCover`, so 0.55–1.45), rounded, and at least 1 once unlocked. Example: 4 skeleton groups become 2 on a small island and 6 on a large one.

## world

| Key | Value | Meaning |
|---|---|---|
| `islandRadius` | 480 | Nominal radius of the island in metres (the coastline is noisy, so it varies by about ±25%). Smaller packs creatures closer together. |
| `worldRadius` | 558 | Radius of the whole playable world including sea, in metres. The terrain mesh is a square of twice this size. Keep it at or above `islandRadius`. |
| `landCover` | 0.17 | Share of the island oval (0–1) that is land above the sea; the rest is shallows and bays. Each island's sea level is set so it gets exactly its share. Before this was a setting, islands ranged from 6% to 30% by chance. Land creatures, palms and rocks scale with it (see `spawning`), so a small island is not crowded. |
| `lowlandScale` | 0.5 | Height of the rolling lowland hills (multiplier; 1 = the original, hillier island). Does not affect the mountains or dunes. |
| `mountainHeight` | 100 | Height of the island's tallest peak in metres (before terracing). Every island is scaled so its highest mountain reaches this; the dragon's lair sits on it. Lower peaks scale with it. |
| `mountainCover` | 0.06 | Share of the island (0–1) where mountains may rise: the highest-lying 6% of the land. Mountains follow ridges inside it. At 0.06 an island typically has 1–3 mountains (up to 6), and the lower ones are smaller than the main peak. Lower = fewer, more isolated mountains. |
| `boundFraction` | 0.95 | The sandstorm turns the player back at `worldRadius × boundFraction` (530 m now). Creature spawning and the kraken's swim limit use the same distance. |
| `ceiling` | 50 | Highest altitude the carpet can reach (metres above sea level). Mountains taller than this are walls: the carpet slides along their slopes and cannot cross them. |
| `fogNear`, `fogFar` | 150, 950 | Haze starts / is complete at these distances. |
| `terrainSegments` | 320 | Mesh resolution of the island (higher = finer and slower to generate). |
| `duneHeight` | 7 | Height of dune ridges on low sand (varies by dune field, up to about 1.6× this). |
| `duneWavelength` | 60 | Distance between dune crests in metres. Longer gives gentler slopes. |
| `duneSharpness` | 0.2 | Shape of the crests: 0 = smooth rounded swells, 1 = sharp wind-cut ridges (the old look). |
| `greenCover` | 0.4 | Roughly the share of low, gentle land covered by green grass and scrub patches (0–1). Palms grow in them. |
| `terraceStep` | 6 | Height of each step on terraced mountains, in metres. |
| `oasisCount` | 3 | Number of inland oases. |
| `oasisRadiusMin`, `oasisRadiusMax` | 34, 50 | Size range of oases. |
| `palmMax` | 520 | Upper limit on palm trees (scaled by the island's land, relative to `landCover`). |
| `rockCount` | 50 | Number of sandstone boulders (scaled by the island's land, like `palmMax`). |
| `palaceFlattenOuter`, `palaceFlattenInner` | 70, 34 | The ground is flattened for the palace inside the inner radius and blended out to the outer radius. |
| `lairMinDistanceFromPalace` | 290 | The dragon's peak is at least this far from the palace. |
| `lairSearchRadius` | 440 | The dragon's peak is searched within this distance of the centre. |

**variation** (per-island randomness)

For the landscape settings listed here, the value above is the **mean**; each island draws its own value from its seed, so the same seed always gives the same island (and best scores per seed stay comparable). Gameplay numbers are never varied. Remove an entry to fix that setting; set `"variation": {}` to switch it off entirely. The start screen names an island's character when it is far from the mean (for example "rugged, lush").

| Key | Value | Meaning |
|---|---|---|
| `landCover` | spread 0.45 | Factor between 0.55 and 1.45 (about 9–25% of the oval): from a few small isles to one large island. Named "small" or "large" on the start screen. |
| `lowlandScale` | spread 0.25 | Each island: mean × a factor between 0.75 and 1.25. |
| `mountainHeight` | spread 0.3 | Factor between 0.7 and 1.3 (tallest peak 70–130 m). |
| `mountainCover` | spread 0.35 | Factor between 0.65 and 1.35. |
| `duneHeight` | spread 0.35 | Factor between 0.65 and 1.35. |
| `duneWavelength` | spread 0.25 | Factor between 0.75 and 1.25. |
| `greenCover` | min 0.25, max 0.55 | Any value in this range (the mean above is not used). |
| `oasisCount` | poisson, min 1, max 5 | Poisson-distributed around the mean (3), clamped to 1–5. |
| `rockCount` | spread 0.4 | Factor between 0.6 and 1.4. |
| `palmMax` | spread 0.3 | Factor between 0.7 and 1.3. |

Kinds: `{ "spread": s }` = mean × (1 ± s), uniform; `{ "min": a, "max": b }` = uniform in a–b; `{ "dist": "poisson", "min", "max" }` = Poisson around the mean, for counts. `min`/`max` also clamp the other kinds.

## graphics

| Key | Value | Meaning |
|---|---|---|
| `shadowMapSize` | 2048 | Resolution of the sun's shadow map (1024 is faster and blurrier, 4096 sharper and slower). |
| `shadowRange` | 220 | Size in metres of the area around the player in which things cast shadows. Larger covers more but makes shadows blurrier. Shadows can be switched off in Settings. |

## controls

| Key | Value | Meaning |
|---|---|---|
| `pointerLock` | true | Clicking into the game captures the mouse: the cursor is hidden and cannot leave the window, so steering never gets stuck at the screen edge. Esc releases it and pauses. Set to `false` for the old free cursor. |
| `lockedSensitivity` | 1 | With the mouse captured: how far the steering moves per pixel of mouse movement (higher = more sensitive). |
| `tilt` | steerDegrees 15, pitchDegrees 12, deadzoneDegrees 1.5, invertPitch false | Phones (Settings → Tilt to steer): tilting the phone this many degrees left/right gives full turn, tipping it this many degrees towards/away from you gives full climb/dive, measured from how it was held at start or resume. Smaller tilts inside the dead zone are ignored. `invertPitch` swaps climb and dive (by default tipping the top towards you climbs, like pulling back on a stick). |

## hud

On-screen messages stay up long enough to read: `max(toastMinSeconds, toastBaseSeconds + toastSecondsPerChar × characters)`, or longer if the message asks for it. Minor messages (a creature slain, sound on/off, out of spell mana) never replace an important one that is still showing.

| Key | Value | Meaning |
|---|---|---|
| `toastMinSeconds` | 2.5 | Shortest time an important message is shown. |
| `toastBaseSeconds`, `toastSecondsPerChar` | 1.5, 0.055 | Reading time: a 60-character message stays about 4.8 s. |
| `toastMinShowSeconds` | 1.8 | An important message is shown at least this long before the next one replaces it; the next one waits. |

## camera

| Key | Value | Meaning |
|---|---|---|
| `distance` | 9 | How far behind the carpet the camera sits, in metres (was 13). |
| `height` | 3.4 | How far above the carpet the camera sits (was 4.4). |
| `lookAhead` | 26 | The camera looks at a point this far ahead of the carpet. |
| `lookHeight` | 5 | ...and this far above it. Higher tilts the view up, so the carpet sits lower on screen (0 = carpet close to the centre). |
| `follow` | 10 | How quickly the camera catches up with the carpet (higher = tighter, less lag; was 7). |
| `fov`, `fovSurgeExtra` | 72, 9 | Field of view in degrees, and how much it widens at full surge. |

## sky

The sun rises over the course of a round: dawn at the start (low, warm, dim light), late morning at the end (high, white, bright light). The sky goes from peach to light blue.

| Key | Value | Meaning |
|---|---|---|
| `startElevationDeg`, `endElevationDeg` | 3, 50 | Height of the sun above the horizon at the start and end of a round, in degrees. |
| `titlePhase` | 0.3 | Time of day on the title screen (0 = sunrise, 1 = end of a round). |
| `freeFlightDayMinutes` | 15 | In free flight (no timer) the sun takes this long to rise from dawn to late morning, then stays. |
| `sunDiscDegrees` | 1.6 | Radius of the sun disc in the sky, in degrees (the real sun is about 0.27). |
| `sunGlow` | 1 | Strength of the glow around the sun and of the warm light it casts over that part of the sky; 0 leaves only the disc. |

## player

| Key | Value | Meaning |
|---|---|---|
| `baseSpeed` | 44 | Normal forward speed. |
| `surgeMultiplier` | 1.85 | Speed during a surge burst (W). |
| `surgeSeconds` | 0.9 | How long one surge burst lasts. The carpet then eases back to `baseSpeed`. |
| `surgeCooldownSeconds` | 2 | Time from the start of one burst to the next while W (or Surge) is held down. |
| `reverseMultiplier` | 0.6 | Speed backwards (S), as a fraction of base speed. |
| `strafeSpeed` | 32 | Sideways speed (A/D). |
| `turnRate` | 1.55 | How fast the carpet turns (radians per second at full steer). |
| `pitchMax` | 0.8 | Steepest climb or dive angle (radians). |
| `maxHp`, `maxHpPerStage` | 70, 7 | Starting vitality and the gain per palace stage. |
| `regenPerSecond` | 1.5 | Healing per second away from the palace. |
| `regenDelaySeconds` | 5 | Healing starts after this long without taking damage. |
| `invulnerableAfterHitSeconds` | 0.6 | Grace period after each hit. |
| `respawnInvulnerableSeconds` | 3 | Grace period after falling and waking in the palace. |
| `carryBase`, `carryPerStage` | 100, 20 | Mana you can carry: base + per stage × stage. |
| `groundClearance` | 1.4 | Lowest the carpet's centre can fly above the ground (was a fixed 2.6). |
| `cornerClearance` | 0.4 | Each corner of the tilted carpet stays at least this far above the ground beneath it, so it does not dip into slopes. |
| `response` | steer 12, pitch 6, speed 3.5, strafe 7, roll 6 | How quickly the carpet follows the controls, per second (higher = snappier, less delay). Before: steer 8, pitch 3, speed 2, strafe 4, roll 4. |

## spells

**mana** (spell mana, the blue bar; separate from the gold mana you carry to the palace). Fireball and nova both draw from it.

| Key | Value | Meaning |
|---|---|---|
| `max` | 100 | Size of the spell mana pool. |
| `regenPerSecond` | 8 | Refill per second, always. Holding fire spends `fireball.manaCost / fireball.cooldownSeconds` per second (about 14.8), so nonstop fire drains a full pool in about 15 s. |
| `refireAt` | 25 | Once the pool runs dry, fireballs are blocked until it has refilled to this. |

**fireball**

| Key | Value | Meaning |
|---|---|---|
| `cooldownSeconds` | 0.135 | Time between fireballs (about 7.4 per second). |
| `manaCost` | 2 | Spell mana per fireball. |
| `speed`, `lifetimeSeconds` | 400, 2.1 | Flight speed and how long a fireball lasts. |
| `damage`, `damagePerStage` | 1, 0.25 | Damage per hit: damage + perStage × (stage − 1). |
| `aimAssistRange` | 330 | Creatures within this distance can attract the aim assist. |
| `aimAssistCone` | 0.962 | Cosine of the aim-assist cone (0.962 ≈ 16°). Set to 1 to turn aim assist off. |
| `noiseRadius` | 260 | Casting within this distance of the dragon alerts it. |

**nova**

| Key | Value | Meaning |
|---|---|---|
| `manaCost` | 12 | Spell mana spent per nova. |
| `cooldownSeconds` | 1.6 | Time between novas. |
| `radius` | 75 | Blast radius; also destroys enemy projectiles inside it. |
| `damage`, `damagePerStage` | 3, 0.5 | Damage per creature hit. |

## round

There are two modes, chosen on the start screen. **Timed round** is described below. **Free flight** has no clock and no score; when the palace is complete and Vharoth is slain, a short screen says so and you can keep flying.

A timed game is a round. The clock keeps running everywhere, including in the palace beam; it stops only while paused. The round ends when time runs out, or early when the palace reaches its last stage **and** Vharoth is slain. The best score per island seed is kept in the browser (`localStorage`).

| Key | Value | Meaning |
|---|---|---|
| `durationSeconds` | 240 | Length of a round (4 minutes). |
| `warnSeconds` | 30 | The clock turns red below this. |
| `pointsPerKill` | skeleton 8, wyvern 10, drake 25, worm 30, kraken 40 | Points per creature slain (Vharoth scores through `dragonSlainBonus`). |
| `pointsPerStage` | 100 | Points per palace stage above the first (500 for the Crescent Sanctum). |
| `dragonSlainBonus` | 500 | Points for slaying Vharoth. |
| `completionBonus`, `pointsPerSecondLeft` | 1000, 10 | Bonus for ending the round early (palace complete and Vharoth slain), plus points for every second left on the clock. |

## palace

| Key | Value | Meaning |
|---|---|---|
| `stageNames` | Minaret, Palace, Garden Walls, Golden Dome, Lantern Ring, Crescent Sanctum | Names shown on the HUD, one per stage. |
| `stageThresholds` | 0, 50, 130, 250, 420, 650 | Banked mana needed for each stage (first must be 0). The number of entries is the number of stages; the last one wins the game. |
| `depositPerSecond`, `depositPerSecondPerStage` | 28, 12 | How fast carried mana flows into the palace: 28 per second at stage 1, plus 12 per stage after that (88 at stage 6), so banking a bigger load stays quick. |
| `depositRadius` | 30 | How close to the palace centre you must be to bank and heal. |
| `healPerSecond` | 10 | Healing inside the beam. |
| `stageUpHealBonus` | 20 | Instant healing when the palace rises. |
| `wardRadius` | 110 | The dragon will not enter this radius, and cannot see you inside it. |

## mana

| Key | Value | Meaning |
|---|---|---|
| `orbLifetimeSeconds` | 250 | Mana dropped by ordinary creatures disappears after this long. The dragon's hoard never disappears. |
| `magnetRadius` | 34 | Orbs fly towards you inside this distance. |
| `pickupRadius` | 3.8 | Orbs are collected inside this distance. |
| `startClusters`, `startOrbsPerCluster`, `startOrbValue` | 8, 3, 2 | Mana lying on the island at the start of a game: this many clusters of orbs, each orb worth this much (48 in total). They are placed on land away from the palace and never disappear. |

## spawning

| Key | Value | Meaning |
|---|---|---|
| `intervalSeconds` | 2 | How often the game tops up creature numbers (one creature, or one skeleton group, per check; the type furthest below its target goes first). A new game starts with every type at its target. |
| `wyverns` | fromStage 1, base 5, add 0.5, max 7 | Population target (see scaling above): 5 at stage 1, 7 from stage 5. |
| `drakes` | fromStage 2, base 1, add 0.5, max 3 | 1 at stages 2–3, 2 at 4–5, 3 at stage 6. |
| `skeletons` | fromStage 1, perLand, base 4, add 0.5, max 6, groupSizeMin 2, groupSizeMax 4 | Skeleton archers roam in groups of 2–4; the target counts groups (4 at stage 1, 6 from stage 5). A group counts as long as one member lives; lost groups are replaced. |
| `sandworms` | fromStage 3, perLand, base 2, add 0.5, max 3 | 2 at stages 3–4, 3 from stage 5. |
| `krakens` | fromStage 4, base 2, add 0.5, max 3 | 2 at stages 4–5, 3 at stage 6. |
| `dragon.fromStage`, `dragon.respawnSeconds` | 5, 240 | There is only ever one Vharoth. It wakes at this stage and returns this long after being slain. |
| `drakes.announce`, `sandworms.announce`, `krakens.announce`, `dragon.announce` | see JSON | Line shown under "Palace raised" when the stage that unlocks this creature is reached. Any rule can have one; leave it out for no message. |
| `dragon.fromStage` | 5 | Palace stage at which Vharoth first appears on its peak. |
| `dragonRespawnSeconds` | 240 | Time until Vharoth returns after it falls. |

## creatures

Common keys (values are listed per creature in the tables below):

| Key | Meaning |
|---|---|
| `hp`, `hpBonus`, `hpBonusEveryStages` | Toughness (see scaling above). |
| `hitRadius` | Size of the target for your fireballs. |
| `drops`, `manaPerDrop` | Number of mana orbs dropped on death and mana per orb. |

**skeleton** (archer on foot)

| Key | Value | Meaning |
|---|---|---|
| `scale` | 1.7 | Model size (about 3.5 m tall). |
| `hitRadius` | 2.6 | Size of the target for your fireballs. |
| `hp`, `hpBonus`, `hpBonusEveryStages` | 2, 1, 3 | Toughness: 2 hit points at first, one fireball or two. |
| `walkSpeed`, `roamRadius` | 4, 70 | Walking speed; each group roams within this radius of where it appeared. |
| `groupAlertSeconds` | 6 | When one member sees you or is hit, the whole group turns to fight for this long (renewed while any member still sees you). |
| `sightRange` | 170 | Distance at which it spots you (needs line of sight). |
| `fireIntervalSeconds`, `fireRange` | 2.6, 160 | Time between arrows and maximum shooting distance. |
| `arrowDamage`, `arrowSpeed` | 6, 110 | Its arrows, which drop slightly and are aimed where you are heading. |
| `drops`, `manaPerDrop` | 2, 3 | Mana orbs dropped on death and mana per orb. |

**wyvern / drake**

| Key | Wyvern | Drake | Meaning |
|---|---|---|---|
| `scale` | 0.55 | 0.95 | Model size. |
| `hitRadius` | 5.4 | 9.5 | Size of the target for your fireballs. |
| `hp`, `hpBonus`, `hpBonusEveryStages` | 3, 1, 3 | 8, 1, 3 | Toughness. |
| `patrolSpeed`, `chaseSpeed` | 20, 34 | 16, 28 | Speed while wandering and while hunting you. |
| `sightRange` | 150 | 215 | Distance at which it can spot you (needs line of sight). |
| `giveUpSeconds` | 3 | 3 | It stops chasing after this long without seeing you. |
| `fireIntervalSeconds`, `fireRange` | 3.4, 135 | 2.3, 135 | Time between shots and maximum shooting distance. |
| `boltDamage`, `boltSpeed`, `boltSize` | 9, 76, 6 | 15, 84, 9 | Its projectile. |
| `drops`, `manaPerDrop` | 4, 3 | 8, 4 | Mana orbs dropped on death and mana per orb. |
| `wingbeat` | 6.5 | 4.2 | Wing flap speed (visual). |

**kraken**

| Key | Value | Meaning |
|---|---|---|
| `hitRadius` | 7.5 | Size of the target for your fireballs. |
| `hp`, `hpBonus`, `hpBonusEveryStages` | 12, 2, 2 | Toughness. |
| `aggroRange` | 260 | It reacts to you within this horizontal distance. |
| `swimSpeed` | 15 | Speed while submerged (slower when surfaced or idle). |
| `inkDamage`, `inkIntervalSeconds`, `inkRange` | 10, 2.3, 220 | Lobbed ink. |
| `grabDamage`, `grabRange`, `grabCooldownSeconds` | 12, 30, 2.2 | Tentacle grab when you fly low over it. |
| `surfacedSeconds` | 7 | Minimum time it stays up before diving. |
| `drops`, `manaPerDrop` | 8, 4 | Mana orbs dropped on death and mana per orb. |

**sandworm**

| Key | Value | Meaning |
|---|---|---|
| `hitRadius` | 3.4 | Size of the target for your fireballs. |
| `hp`, `hpBonus`, `hpBonusEveryStages` | 9, 2, 2 | Toughness. |
| `aggroRange` | 240 | It tunnels towards you within this distance. |
| `burrowSpeed` | 20 | Tunnelling speed when hunting. |
| `acidDamage`, `acidIntervalSeconds`, `acidRange` | 10, 1.7, 200 | Spat acid. |
| `biteDamage`, `biteRange` | 16, 10 | Bite when you fly into its maw. |
| `surfacedSeconds` | 5 | Minimum time it stays reared up. |
| `drops`, `manaPerDrop` | 6, 4 | Mana orbs dropped on death and mana per orb. |

**dragon**

| Key | Value | Meaning |
|---|---|---|
| `scale` | 2.6 | Model size. |
| `hitRadius` | 12 | Size of the target for your fireballs. |
| `hp`, `hpBonus`, `hpBonusEveryStages` | 95, 25, 1 | Toughness. |
| `roostSpeed`, `huntSpeed` | 30, 54 | Speed while circling its peak and while hunting. |
| `roostSightRange` | 300 | Spotting distance while it roosts. |
| `roostSightRangeLowFlying`, `lowFlyingHeight` | 170, 12 | Shorter spotting distance if you fly lower than this above the ground. |
| `searchSightRange`, `huntSightRange` | 360, 540 | Spotting distance while searching and while hunting. |
| `loseSightSeconds` | 2.5 | Out of sight this long and it switches to searching. |
| `searchSeconds` | 10 | How long it searches before returning to its peak. |
| `breathRange`, `breathSeconds`, `breathDamage` | 150, 2.6, 7 | Fire breath: starting distance, duration, damage per flame. |
| `volleyIntervalSeconds`, `volleyDamage` | 6, 22 | Three burning boulders fired from range. |
| `contactDamage` | 22 | Damage when you fly into it. |
| `drops`, `manaPerDrop` | 36, 5 | Mana orbs dropped on death and mana per orb. |

## audio

All sound is synthesised in the browser; there are no sound files. Volumes are 0–1.

| Key | Value | Meaning |
|---|---|---|
| `masterVolume` | 0.9 | Overall volume (M mutes). |
| `sfxVolume` | 1 | Effects and wind. |
| `musicVolume` | 0.35 | Background music (drops to a third while paused). |
| `windVolume` | 0.09 | Wind noise at full surge speed; quieter when slower. The surge whoosh scales with it too. |
| `tempoCalm`, `tempoDanger` | 88, 124 | Music tempo in beats per minute when calm and under attack. |
| `melodyGlideSeconds` | 0.25 | How long the flute takes to slide from one note to the next (legato). |
| `dangerHoldSeconds` | 6 | After taking damage the music stays dramatic this long. It is also dramatic while the dragon hunts you, and halfway there while a wyvern or drake chases you. |
