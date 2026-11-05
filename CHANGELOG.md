# Changelog

All notable changes to Windloom are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
