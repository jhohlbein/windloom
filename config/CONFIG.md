# Game settings

All gameplay numbers live in [`game-config.json`](game-config.json). Edit a value, save, and reload the page. JSON has no comments, so this file explains each setting. One world unit is one metre (the carpet is about 5 m long). Distances are in metres, times in seconds, speeds in metres per second.

The **Value** column shows what `game-config.json` currently contains. Keep it in step with the JSON whenever either file changes.

"Stage" means the palace stage, 1 (Minaret) to 6 (Crescent Sanctum). Several values scale with it.

## How scaling works

- **Hit points:** `hp + hpBonus × floor(stage / hpBonusEveryStages)`. Example: kraken `12 + 2 × floor(stage / 2)` gives 12 at stage 1, 14 at stages 2–3, 16 at 4–5.
- **Population targets** (`spawning.flyers`, `krakens`, `sandworms`): `min(base + add × floor(stage / everyStages), max)`.

## world

| Key | Value | Meaning |
|---|---|---|
| `islandRadius` | 480 | Nominal radius of the island in metres (the coastline is noisy, so it varies by about ±25%). Smaller packs creatures closer together. |
| `worldRadius` | 558 | Radius of the whole playable world including sea, in metres. The terrain mesh is a square of twice this size. Keep it at or above `islandRadius`. |
| `heightScale` | 0.5 | Multiplier on all land heights (base terrain and mountains). |
| `mountainScale` | 0.55 | Extra multiplier on the mountains only (1 = original). Lower gives a flatter island; the dragon's peak gets lower too. |
| `boundFraction` | 0.95 | The sandstorm turns the player back at `worldRadius × boundFraction` (530 m now). Creature spawning and the kraken's swim limit use the same distance. |
| `ceiling` | 50 | Highest altitude the carpet can reach (metres above sea level). Over terrain taller than this, the carpet can still skim the ground. |
| `fogNear`, `fogFar` | 150, 950 | Haze starts / is complete at these distances. |
| `terrainSegments` | 320 | Mesh resolution of the island (higher = finer and slower to generate). |
| `duneHeight` | 7 | Height of dune ridges on low sand (varies by dune field, up to about 1.6× this). |
| `duneWavelength` | 60 | Distance between dune crests in metres. |
| `greenCover` | 0.4 | Roughly the share of low, gentle land covered by green grass and scrub patches (0–1). Palms grow in them. |
| `terraceStep` | 12 | Height of each step on terraced mesas. |
| `oasisCount` | 3 | Number of inland oases. |
| `oasisRadiusMin`, `oasisRadiusMax` | 34, 50 | Size range of oases. |
| `palmMax` | 520 | Upper limit on palm trees. |
| `rockCount` | 50 | Number of sandstone boulders. |
| `palaceFlattenOuter`, `palaceFlattenInner` | 70, 34 | The ground is flattened for the palace inside the inner radius and blended out to the outer radius. |
| `lairMinDistanceFromPalace` | 290 | The dragon's peak is at least this far from the palace. |
| `lairSearchRadius` | 440 | The dragon's peak is searched within this distance of the centre. |

## camera

| Key | Value | Meaning |
|---|---|---|
| `distance` | 9 | How far behind the carpet the camera sits, in metres (was 13). |
| `height` | 3.4 | How far above the carpet the camera sits (was 4.4). |
| `lookAhead` | 26 | The camera looks at a point this far ahead of the carpet. |
| `fov`, `fovSurgeExtra` | 72, 9 | Field of view in degrees, and how much it widens at full surge. |

## sky

The sun rises over the course of a round: dawn at the start (low, warm, dim light), late morning at the end (high, white, bright light). The sky goes from peach to light blue.

| Key | Value | Meaning |
|---|---|---|
| `startElevationDeg`, `endElevationDeg` | 3, 50 | Height of the sun above the horizon at the start and end of a round, in degrees. |
| `titlePhase` | 0.3 | Time of day on the title screen (0 = sunrise, 1 = end of a round). |
| `freeFlightDayMinutes` | 15 | In free flight (no timer) the sun takes this long to rise from dawn to late morning, then stays. |

## player

| Key | Value | Meaning |
|---|---|---|
| `baseSpeed` | 44 | Normal forward speed. |
| `surgeMultiplier` | 1.85 | Speed while surging (W). |
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
| `pointsPerKill` | wyvern 10, drake 25, worm 30, kraken 40 | Points per creature slain (Vharoth scores through `dragonSlainBonus`). |
| `pointsPerStage` | 100 | Points per palace stage above the first (500 for the Crescent Sanctum). |
| `dragonSlainBonus` | 500 | Points for slaying Vharoth. |
| `completionBonus`, `pointsPerSecondLeft` | 1000, 10 | Bonus for ending the round early (palace complete and Vharoth slain), plus points for every second left on the clock. |

## palace

| Key | Value | Meaning |
|---|---|---|
| `stageNames` | Minaret, Palace, Garden Walls, Golden Dome, Lantern Ring, Crescent Sanctum | Names shown on the HUD, one per stage. |
| `stageThresholds` | 0, 50, 130, 250, 420, 650 | Banked mana needed for each stage (first must be 0). The number of entries is the number of stages; the last one wins the game. |
| `depositPerSecond` | 28 | How fast carried mana flows into the palace. |
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
| `intervalSeconds` | 2 | How often the game tops up creature numbers (one creature per check). |
| `flyersAtStart` | 6 | Wyverns/drakes present when a game starts. |
| `flyers` | base 4, add 2, everyStages 1, max 13 | Population target (see scaling above). |
| `krakens` | fromStage 4, base 2, add 2, everyStages 2, max 6 | Population target (see scaling above), from palace stage `fromStage` on. |
| `sandworms` | fromStage 3, base 2, add 2, everyStages 2, max 6 | Population target (see scaling above), from palace stage `fromStage` on. |
| `krakens.announce`, `sandworms.announce`, `drakes.announce`, `dragon.announce` | see JSON | Line shown under "Palace raised" when the stage that unlocks this creature is reached. Leave empty for no message. |
| `drakes.fromStage` | 2 | First stage at which drakes can appear. |
| `drakes.chanceBase`, `chancePerStage` | 0.16, 0.05 | Chance that a new flyer is a drake: base + perStage × stage. |
| `drakes.maxBase`, `maxAdd`, `maxEveryStages` | 1, 1, 2 | Maximum drakes alive at once. |
| `dragon.fromStage` | 5 | Palace stage at which Vharoth first appears on its peak. |
| `dragonRespawnSeconds` | 240 | Time until Vharoth returns after it falls. |

## creatures

Common keys (values are listed per creature in the tables below):

| Key | Meaning |
|---|---|
| `hp`, `hpBonus`, `hpBonusEveryStages` | Toughness (see scaling above). |
| `hitRadius` | Size of the target for your fireballs. |
| `drops`, `manaPerDrop` | Number of mana orbs dropped on death and mana per orb. |

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
