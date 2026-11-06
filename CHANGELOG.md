# Changelog

All notable changes to Windloom are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.9] - 2026-11-06

### Added
- Tilt steering on phones: tilt the phone left/right to turn and tip it towards/away from you to climb or dive. The centre is how you hold it when you start or resume (`controls.tilt`). It is on by default and can be switched off in Settings; dragging still works alongside it. On iPhone, Safari asks for motion permission the first time you start.
- The Settings button is on the pause and results screens too, not only the start screen.

### Changed
- The start, pause and results screens offer the same choices: a timed round and a free flight on this island, and New island. Pause also has Resume, and a finished free flight has Keep flying. After a timed round you can now go straight into a free flight. New island always leads to the new island's start screen, where you pick the mode.
- Land height has two independent settings: `lowlandScale` for the rolling hills and `mountainHeight` for the tallest peak in metres. `mountainCover` sets the share of the island where mountains may rise. They replace `heightScale` and `mountainScale`, which multiplied each other. Each island is calibrated so these mean the same on every seed.
- Fewer but much taller mountains: typically 1–3 per island, with the main peak around 100 m (70–130 m by seed). Before, peaks were 25–50 m.
- Mountains taller than the flight `ceiling` are walls: the carpet slides along their slopes instead of riding up and over them. Mana that lands above the ceiling rolls downhill until you can reach it.
- Dunes have rounder crests. The new `duneSharpness` setting (0.2) goes from 0 = smooth swells to 1 = the old sharp ridges.
- `terraceStep` is now the real step height on the ground (6 m; before, 12 was squashed to about 6). Islands from a given seed look different from before.

### Fixed
- The start screen title ("Windloom") was cut off on screens narrower than about 1000 px. It now always fits on one line, and the title, island line, intro text and buttons are centred.

## [0.2.8] - 2026-11-06

### Fixed
- Safari (Mac and iPhone): clouds, glows and projectiles showed specks of stray colour. Their soft-disc textures are now built from pixel data instead of a canvas gradient.

## [0.2.7] - 2026-11-06

### Changed
- Surge (W, Shift or the Surge button) is a short burst now: 0.9 s at surge speed, then the carpet eases back to cruising speed. Held down, it repeats every 2 s (`player.surgeSeconds`, `surgeCooldownSeconds`). Keyboard play now works like touch play, where you mostly cruise and keep the thumb on Fire.
- Each burst plays a short swish. The wind noise is low-passed and swells slowly, so it no longer sounds like running water.
- Spawning has one rule per creature type in `spawning` (`wyverns`, `drakes`, `skeletons`, `sandworms`, `krakens`): `fromStage`, `base`, `add` per stage after that, and `max`. Drakes no longer appear by chance among the wyverns. `everyStages`, `flyersAtStart`, the drake chance keys and `dragonRespawnSeconds` (now `dragon.respawnSeconds`) are gone.
- Fewer creatures per stage. At stage 6 there are 7 wyverns, 3 drakes, 6 skeleton groups, 3 sandworms and 3 krakens. Before, there were 13 flyers, 9 groups, 6 sandworms and 6 krakens.
- Touch: the Surge button is above Back, like W above S.
- Phones: the vitality, spell mana, carried mana and palace panels are narrow and have no labels. They show only bars, numbers and the stage numeral.
- Phones: in-game messages use a smaller font and sit a little lower.
- The sea no longer shows a regular grid of ripples. The water shader blends the ripple texture at three unrelated scales, angles and drift directions, and the ripple strength varies slowly across the sea.
- The carpet ripples like cloth: slightly more at speed and towards its back edge (calm while surging). It also bobs and sways gently.
- The riders lean into speed and turns and turn their heads into a turn. The sultan's turban has a loose end that streams and flutters behind him. The princess's scarf lifts back with speed, two scarf ends and a sash ribbon flutter behind her, and her veil stirs.

### Fixed
- The carpet and rider cast no shadow: shadows were switched on before their parts were attached.

## [0.2.6] - 2026-11-05

### Fixed
- The mana counter at the top left could break onto two lines ("/ 200 full"); it now always stays on one line in a slightly wider box.
- Enemy projectiles (wyvern and drake bolts, kraken ink, sandworm acid, the dragon's fire and boulders, arrows) washed out to white over the sea and sky, like the fireballs did. They now have a solid core and a soft, non-additive halo in their own colour (fireballs too).

## [0.2.5] - 2026-11-05

### Added
- The radar shows a bird's-eye map of the island (land, green areas, rock and sea), turned with your heading.
- Shadows from the sun for the carpet, creatures, palace, palms, rocks and mountains, in an area around the player (`graphics` section); can be switched off in Settings.

### Changed
- Removed the glow around the carpet.
- Rock, mesa tops and boulders are a muted taupe instead of red-orange, so fireballs stand out against the mountains.
- When your carry is full, the mana counter at the top left pulses slowly (orange) until you bank it.
- Banking speeds up with each palace stage (`depositPerSecondPerStage`, 28 per second at stage 1 up to 88 at stage 6).

### Fixed
- Fireballs looked white over the water: their additive glow added up with the bright blue. They now have a solid orange core.
- Vharoth could fly beyond the sandstorm boundary and drop its hoard where the player could not reach it. It now stays inside, and mana orbs never come to rest outside the boundary.

## [0.2.4] - 2026-11-05

### Added
- A message tells you when the mana you carry is enough to raise the palace to its next stage (once per stage).
- Islands vary: heights, mountains, dunes, green cover, oases, rocks and palms are drawn per island from its seed around the config values (`world.variation`; oases Poisson-distributed). The start screen names an island's character, e.g. "rugged, lush". Gameplay numbers are not varied. Existing seeds look somewhat different from before.

### Fixed
- Opening the game with a seed only worked in the exact form `#s<seed>` and only on a fresh page load. It now also accepts `#<seed>`, `#seed=<seed>`, `?seed=<seed>`, `?s=<seed>` and `?<seed>`, and editing the seed in the address bar of an open page builds that island.

## [0.2.3] - 2026-11-05

### Added
- Skeleton archers: fragile bowmen that roam the open land in groups of 2–4, four groups at the start and one more per palace stage. When one sees you or is hit, the whole group turns to fight. They shoot dropping arrows. Config `creatures.skeleton` and `spawning.skeletons`; 8 points each in a timed round.

### Changed
- The dragon's lair burns with a dark red, flickering fire (flames and cinders) instead of a large orange glow that looked like a second sun.
- Sandworms reworked: warm grey with darker bands for contrast against the sand, a body of overlapping balls and a round head with an open toothed maw instead of cylinders.

### Fixed
- Sandworms had no collision: the carpet flew through them. Head and body are now solid.
- The palace had no collision: the carpet flew through towers, walls and domes. Each stage now has collision shapes; from above the carpet rides on roofs, from the side it slides along walls.

## [0.2.2] - 2026-11-05

### Added
- Settings menu on the start screen. First option: the rider, either the turbaned rider or a veiled princess; the choice is saved in the browser.
- Mouse capture (pointer lock): clicking into the game hides the cursor and keeps the mouse in the window; Esc releases it and pauses. Mouse movement steers a virtual stick (`controls` section).
- Camera `lookHeight`: the view tilts up a little so the carpet sits lower on screen (about two-thirds down instead of near the centre).
- Full screen: F key and a "Full screen" button on the start and pause screens.

### Changed
- Tester feedback: controls respond faster (steering, pitch, speed, strafe and camera follow; new `player.response` and `camera.follow`).
- Ground collision checks all four corners of the tilted carpet, not just its centre, and the carpet can fly lower (`groundClearance` 1.4, was 2.6).
- On-screen messages stay up according to their length; minor messages no longer cut off important ones (`hud` section).

## [0.2.1] - 2026-11-05

### Added
- `tools/serve.py`: local dev server with caching turned off, so the browser never mixes a new page with old cached modules.
- Two modes on the start screen: "Timed round" (the 4-minute scored game) and "Free flight" (no clock, no score, sunrise over 15 minutes, keep flying after the Sanctum is whole).
- The start screen checks whether a newer version is on the server and offers an "update now" button that replaces the browser's cached files and reloads.

### Changed
- Camera position is configurable (`camera` section) and sits closer to the carpet: 9 m behind and 3.4 m above (was 13 and 4.4).
- The sun rises over the round: dawn light at the start, bright late-morning light at the end (`sky` section). Sky is light blue instead of pink, water a darker blue.
- `greenCover` 0.3 → 0.4, `rockCount` 170 → 50, `ceiling` 320 → 50 (test), `orbLifetimeSeconds` 120 → 250.

### Fixed
- After an update the browser could keep running old game code even after a hard reload, because the game modules were loaded with a dynamic import. They are now imported statically (the config loads with a top-level await).
- With a low `ceiling`, the carpet could be pushed into peaks taller than the ceiling.

## [0.2.0] - 2026-11-05

### Added
- Start screen shows the time of the latest file change next to the version, so you can tell which build you loaded.
- Sandworms appear from palace stage 3, krakens from stage 4 and Vharoth from stage 5 (`fromStage` in the config). When a stage unlocks a creature, a line under "Palace raised" announces it.
- Starting mana: clusters of orbs lying on the island at the start of a game.
- Water reflects the sky and has moving ripples with sun glints.
- Synthesised sound: "shoosh" fireball, wind that follows your speed with a whoosh when surging, and generated background music in maqam Hijaz (drone, darbuka, ney) that speeds up and adds an oud ostinato under attack. Volumes and tempos in the new `audio` config section.
- Timed rounds of 4 minutes with a countdown on the HUD. The round ends early when the palace is complete and Vharoth is slain. A results screen shows the score (creatures slain, stages, Vharoth, completion and time bonus); the best score per island seed is kept in the browser.
- Spell mana: a blue bar under vitality. Fireball and nova cost spell mana, which refills at 8 per second; nova no longer spends carried mana; holding fire drains it slowly, and once empty you must wait until it partly refills.
- FPS counter under the radar (frames per second and the slowest frame of the last half second).

### Fixed
- Fire could stay on after releasing the left mouse button if the right button was pressed in between; right-click nova during fire did not cast. Mouse buttons are now read from the full button state.

### Changed
- When your carry is full, the HUD says "full" and a hint tells you to bank it; orbs only fly to you while you have room. Vharoth's hoard now lands in a tighter pile.
- World size is now set in metres: `world.scale` is replaced by `islandRadius` and `worldRadius`, and `boundRadius` is derived as `worldRadius × boundFraction` (0.95). Island seeds shift very slightly (scale 0.62 became a 480 m radius).
- Fireball speed 200 → 400, `heightScale` 0.78 → 0.5.
- Player vitality 30% lower (`maxHp` 100 → 70, `maxHpPerStage` 10 → 7).
- Twice as many krakens and sandworms (base, add and max doubled), e.g. 4 sandworms when they first appear.
- Mana orbs, their glow and their particles are a deeper gold.
- Fireballs fire twice as fast (`cooldownSeconds` 0.27 → 0.135). The vitality bar is always red.
- Reaching the Crescent Sanctum no longer opens a "keep flying" screen; the round goes on until time runs out or Vharoth is slain too.
- Flatter island with larger dune fields and green grass and scrub patches with palms (new `mountainScale`, `duneWavelength`, `greenCover`; `duneHeight` 4.2 → 7, `palmMax` 360 → 520).
- Music: calmer, legato flute melody that glides between notes and breathes per phrase.
- Finer terrain mesh: `terrainSegments` 170 → 320 (about 3.5 m per cell).

## [0.1.0] - 2026-11-05

First version in the repository. The game was prototyped as a single HTML file and is now split into modules.

### Added
- Flying carpet with turn, climb, surge, reverse and strafe; mouse, keyboard and touch controls.
- Fireball with light aim assist; nova blast that costs mana and clears nearby projectiles.
- Procedural desert island from a random seed: dunes, terraced mesas, oases with palm groves, sandstone boulders, turquoise sea. The seed is kept in the page address so an island can be replayed.
- Arabian palace with six stages (Minaret, Palace, Garden Walls, Golden Dome, Lantern Ring, Crescent Sanctum), raised by banking mana in its beam.
- Creatures: wyverns and drakes (winged reptiles that hunt by line of sight), krakens (surface from deep water), sandworms (tunnel and rear up), and the dragon Vharoth (roosts on the highest peak, hunts by sight, searches, gives up, avoids the palace ward).
- Golden mana dropped only by creatures; carrying limit grows with the palace.
- Slow health regeneration away from the palace; fast healing in the beam.
- HUD with vitals, palace progress, radar, centre-screen enemy health bars and a boss bar for the dragon.
- Synthesised sound effects.
- All gameplay numbers in `config/game-config.json`, documented in `config/CONFIG.md`.
- GitHub Pages setup, README, CLAUDE.md, refactor plan and acknowledgements.
