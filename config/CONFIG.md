# Game settings

All gameplay numbers live in [`game-config.json`](game-config.json). Edit a value, save, and reload the page. JSON has no comments, so this file explains each setting. Distances are in world units (the carpet is about 5 units long); times are in seconds; speeds are units per second.

"Stage" means the palace stage, 1 (Minaret) to 6 (Crescent Sanctum). Several values scale with it.

## How scaling works

- **Hit points:** `hp + hpBonus × floor(stage / hpBonusEveryStages)`. Example: kraken `12 + 2 × floor(stage / 2)` gives 12 at stage 1, 14 at stages 2–3, 16 at 4–5.
- **Population targets** (`spawning.flyers`, `krakens`, `sandworms`): `min(base + add × floor(stage / everyStages), max)`.

## world

| Key | Meaning |
|---|---|
| `scale` | Horizontal size of the island (1 = the original large island). Smaller packs creatures closer together. |
| `heightScale` | Multiplier on mountain and dune heights. |
| `boundRadius` | Distance from the centre where the sandstorm turns the player back. |
| `ceiling` | Highest altitude the carpet can reach. |
| `fogNear`, `fogFar` | Haze starts / is complete at these distances. |
| `terrainSegments` | Mesh resolution of the island (higher = finer and slower to generate). |
| `duneHeight` | Height of dune ridges on low sand. |
| `terraceStep` | Height of each step on terraced mesas. |
| `oasisCount` | Number of inland oases. |
| `oasisRadiusMin`, `oasisRadiusMax` | Size range of oases. |
| `palmMax` | Upper limit on palm trees. |
| `rockCount` | Number of sandstone boulders. |
| `palaceFlattenOuter`, `palaceFlattenInner` | The ground is flattened for the palace inside the inner radius and blended out to the outer radius. |
| `lairMinDistanceFromPalace` | The dragon's peak is at least this far from the palace. |
| `lairSearchRadius` | The dragon's peak is searched within this distance of the centre. |

## player

| Key | Meaning |
|---|---|
| `baseSpeed` | Normal forward speed. |
| `surgeMultiplier` | Speed while surging (W). |
| `reverseMultiplier` | Speed backwards (S), as a fraction of base speed. |
| `strafeSpeed` | Sideways speed (A/D). |
| `turnRate` | How fast the carpet turns (radians per second at full steer). |
| `pitchMax` | Steepest climb or dive angle (radians). |
| `maxHp`, `maxHpPerStage` | Starting vitality and the gain per palace stage. |
| `regenPerSecond` | Healing per second away from the palace. |
| `regenDelaySeconds` | Healing starts after this long without taking damage. |
| `invulnerableAfterHitSeconds` | Grace period after each hit. |
| `respawnInvulnerableSeconds` | Grace period after falling and waking in the palace. |
| `carryBase`, `carryPerStage` | Mana you can carry: base + per stage × stage. |

## spells

**fireball**

| Key | Meaning |
|---|---|
| `cooldownSeconds` | Time between fireballs. |
| `speed`, `lifetimeSeconds` | Flight speed and how long a fireball lasts. |
| `damage`, `damagePerStage` | Damage per hit: damage + perStage × (stage − 1). |
| `aimAssistRange` | Creatures within this distance can attract the aim assist. |
| `aimAssistCone` | Cosine of the aim-assist cone (0.962 ≈ 16°). Set to 1 to turn aim assist off. |
| `noiseRadius` | Casting within this distance of the dragon alerts it. |

**nova**

| Key | Meaning |
|---|---|
| `manaCost` | Carried mana spent per nova. |
| `cooldownSeconds` | Time between novas. |
| `radius` | Blast radius; also destroys enemy projectiles inside it. |
| `damage`, `damagePerStage` | Damage per creature hit. |

## palace

| Key | Meaning |
|---|---|
| `stageNames` | Names shown on the HUD, one per stage. |
| `stageThresholds` | Banked mana needed for each stage (first must be 0). The number of entries is the number of stages; the last one wins the game. |
| `depositPerSecond` | How fast carried mana flows into the palace. |
| `depositRadius` | How close to the palace centre you must be to bank and heal. |
| `healPerSecond` | Healing inside the beam. |
| `stageUpHealBonus` | Instant healing when the palace rises. |
| `wardRadius` | The dragon will not enter this radius, and cannot see you inside it. |

## mana

| Key | Meaning |
|---|---|
| `orbLifetimeSeconds` | Mana dropped by ordinary creatures disappears after this long. The dragon's hoard never disappears. |
| `magnetRadius` | Orbs fly towards you inside this distance. |
| `pickupRadius` | Orbs are collected inside this distance. |

## spawning

| Key | Meaning |
|---|---|
| `intervalSeconds` | How often the game tops up creature numbers (one creature per check). |
| `flyersAtStart` | Wyverns/drakes present when a game starts. |
| `flyers`, `krakens`, `sandworms` | Population targets (see scaling above). |
| `drakes.fromStage` | First stage at which drakes can appear. |
| `drakes.chanceBase`, `chancePerStage` | Chance that a new flyer is a drake: base + perStage × stage. |
| `drakes.maxBase`, `maxAdd`, `maxEveryStages` | Maximum drakes alive at once. |
| `dragonRespawnSeconds` | Time until Vharoth returns after it falls. |

## creatures

Common keys:

| Key | Meaning |
|---|---|
| `hp`, `hpBonus`, `hpBonusEveryStages` | Toughness (see scaling above). |
| `hitRadius` | Size of the target for your fireballs. |
| `drops`, `manaPerDrop` | Number of mana orbs dropped on death and mana per orb. |

**wyvern / drake**

| Key | Meaning |
|---|---|
| `scale` | Model size. |
| `patrolSpeed`, `chaseSpeed` | Speed while wandering and while hunting you. |
| `sightRange` | Distance at which it can spot you (needs line of sight). |
| `giveUpSeconds` | It stops chasing after this long without seeing you. |
| `fireIntervalSeconds`, `fireRange` | Time between shots and maximum shooting distance. |
| `boltDamage`, `boltSpeed`, `boltSize` | Its projectile. |
| `wingbeat` | Wing flap speed (visual). |

**kraken**

| Key | Meaning |
|---|---|
| `aggroRange` | It reacts to you within this horizontal distance. |
| `swimSpeed` | Speed while submerged (slower when surfaced or idle). |
| `inkDamage`, `inkIntervalSeconds`, `inkRange` | Lobbed ink. |
| `grabDamage`, `grabRange`, `grabCooldownSeconds` | Tentacle grab when you fly low over it. |
| `surfacedSeconds` | Minimum time it stays up before diving. |

**sandworm**

| Key | Meaning |
|---|---|
| `aggroRange` | It tunnels towards you within this distance. |
| `burrowSpeed` | Tunnelling speed when hunting. |
| `acidDamage`, `acidIntervalSeconds`, `acidRange` | Spat acid. |
| `biteDamage`, `biteRange` | Bite when you fly into its maw. |
| `surfacedSeconds` | Minimum time it stays reared up. |

**dragon**

| Key | Meaning |
|---|---|
| `scale` | Model size. |
| `roostSpeed`, `huntSpeed` | Speed while circling its peak and while hunting. |
| `roostSightRange` | Spotting distance while it roosts. |
| `roostSightRangeLowFlying`, `lowFlyingHeight` | Shorter spotting distance if you fly lower than this above the ground. |
| `searchSightRange`, `huntSightRange` | Spotting distance while searching and while hunting. |
| `loseSightSeconds` | Out of sight this long and it switches to searching. |
| `searchSeconds` | How long it searches before returning to its peak. |
| `breathRange`, `breathSeconds`, `breathDamage` | Fire breath: starting distance, duration, damage per flame. |
| `volleyIntervalSeconds`, `volleyDamage` | Three burning boulders fired from range. |
| `contactDamage` | Damage when you fly into it. |
