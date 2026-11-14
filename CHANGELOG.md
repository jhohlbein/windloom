# Changelog

All notable changes to Windloom are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.5.1] - 2026-11-14

### Added
- Two springs of fire on every island, placed from its seed on level ground away from the palace, the dragon's peak and each other: an ember spring (tall crimson flames, unlike the lair's orange fire) mends you at the palace's rate while you hover in its flames, with no waiting after a hit, and an azure spring (blue flames) restores spell mana five times faster than usual. Both show on the map as small flames, and a toast names each the first time you drink from it (config `springs`).

### Changed
- The carpet is faster: top speed 50 m/s (`player.baseSpeed`, was 44) and it accelerates at 50 m/s² (`player.throttle.acceleration`, was 44), so it still reaches top speed in 1 s.
- Both riders sit cross-legged: the robe and gown now end at the hips and drape over the lap, and the thighs, knees, folded shins and slippers show in front of and beside it from every angle (before, a bell-shaped robe down to the carpet hid the legs except from straight ahead).
- Creatures are smooth-shaded like the riders (the world keeps its low-poly facets): rounder bodies, finer spheres, wing fingers as tapered rods instead of bars, and the wyverns, drakes and the dragon have a rounded skull, brow and snout instead of boxes.
- Creature motion: wyverns and drakes bank into their turns (from the turn rate) instead of rolling on a fixed sine, beat harder when climbing and glide into a dive, and their tails trail out of turns; wyverns, drakes and the dragon turn their heads to follow the carpet while they see it. Skeleton archers have knees and walk with a bob and a lean that ease in and out, fold the draw arm at the elbow when they shoot, and turn their heads towards the carpet. The kraken's mantle breathes.
- Enemies attack with different rhythms instead of all sitting in the same band (damage per second barely changes for each kind): skeleton archers shoot often and lightly (`fireIntervalSeconds` 1.6, `arrowDamage` 4; were 2.6, 6); wyverns sting often with quick bolts (2.2 s, 6 damage, `boltSpeed` 95; were 3.4 s, 9, 76); drakes fire rarely, slowly and hard (4.5 s, 22 damage, `boltSpeed` 70, `boltSize` 11; were 2.3 s, 15, 84, 9); the kraken lobs slow, heavy ink (3.5 s, 16; was 2.3 s, 10); the sandworm sprays light acid while surfaced (1.2 s, 6; was 1.7 s, 10) and its bite hurts more (20, was 16).
- The carpet flies 4 m above the ground (`player.altitude.hoverHeight`, was 5), so the terrain shows more in the flight.
- The nose points further up and less far down: up to 57° up (`player.pitchMaxUp`, 1.0 rad) to reach high-flying creatures, and 23° down (`player.pitchMaxDown`, 0.4 rad; both replace `pitchMax`, which was 46° either way). With the carpet so low, a nose lowered further sent fireballs straight into the sand. The camera follows the nose by half (`camera.pitchFollow`, was 0.25), so the aiming circle stays on screen with the nose fully up.
- The aim assist's cone is narrower (`spells.fireball.aimAssistCone` 0.975 ≈ 13°, was 16°), and it ignores creatures the terrain hides, which used to draw fireballs into the ridge in front of them.
- Enemy health bars are not drawn for creatures hidden behind a hill or mountain (line of sight from the carpet, checked every 0.15 s per creature).
- Touch: the movement pad is an outlined cross with a chevron on each arm (speed up, brake, strafe), and the fire and nova buttons show symbols instead of words (a fireball with a trail, a ring with rays), all as grey lines on a semi-transparent ground. The controls list, README and tutorial texts follow.
- Tutorial on phones held sideways: the task panel sits at the top centre between the bars and the map, in small type, instead of below the map where it covered the middle of the screen. Messages still appear just below it.

## [0.5.0] - 2026-11-13

### Added
- Leaderboard on the start screen (and after a timed round): the five best timed rounds in this browser, each with its score, island name and seed, the palace stage reached and the date (`round.leaderboardSize`; one row per island, its best score). Picking an island asks once, then starts a timed round there to try to beat its score. Best scores saved by earlier versions are carried over. The results screen says where the round placed.
- Adaptive rendering resolution: when the game runs slowly it lowers the rendering resolution a step at a time (down to `graphics.pixelRatioMin`) and raises it again once frames are quick (up to `graphics.pixelRatioMax`, which replaces the fixed 1.75 cap in the code); the fps counter shows the scale while it is lowered. `graphics.adaptiveResolution: false` switches it off.
- Sound: a short, warm reverb that every sound and the music pass through a little (`audio.reverb`, a generated impulse, no sound file); creature sounds come from the side they are on (`audio.stereoWidth`); a qanun-like plucked run up or down the chord every other bar while the music is calm; and a whoosh when the throttle engages from a glide.

### Changed
- The carpet and its riders. The carpet has a woven medallion design (gold border with ink lozenges, teal guard stripes, corner spandrels, a lobed central medallion with an eight-pointed star), tassels that hang from its ends and stream back at speed, and a soft golden lift underneath. Both riders now have arms and hands: at rest they lie near the knees, a fireball throws the right hand forward with a glow in the palm, and a nova spreads both arms. The turbaned prince (Settings; was "Turbaned rider") sits cross-legged in blue trousers with gold slippers, wears an ember vest, a gold sash, a wrapped turban band, a beard and a teal plume; the princess has gold cuffs and slippers peeking out of her gown.
- New islands build about three times faster: the terrain's heights are sampled once into a grid, and the slopes for the colours, the radar map and the placing of palms and rocks read from it instead of sampling the terrain noise again (about 520,000 samples per island before, 130,000 now). Islands look the same for the same seed.
- Settings → Mouse and trackpad (on computers, on by default): switch it off to play with the keys only, so brushing a laptop's trackpad no longer steers, fires or turns a tutorial page; the cursor is then hidden during flight. Browsers cannot tell a mouse from a trackpad, so it is a setting rather than automatic.
- Throttle instead of a fixed cruising speed. Hold W (or Go, the pad's top arm, which was Surge) to speed up to full speed in 1 s (`player.throttle.acceleration`); let go and it keeps its speed; S brakes, then flies backwards (`throttle.brakeDeceleration`, rest to full in about half a second). The carpet never flies slower than a 10 m/s glide unless S is held (`throttle.minSpeed`, 0 lets it rest). The surge burst is gone (`surgeMultiplier`, `surgeSeconds`, `surgeCooldownSeconds` and `response.speed` removed); it may come back as a spell. The view widens a little with speed (`camera.fovSpeedExtra`, replaces `fovSurgeExtra`), and the wind is silent at rest.
- Nova is on Shift (was E; right-click still works with the mouse); fireballs stay on Space (and click). The controls list, README and tutorial texts follow, and the tutorial's Surge lesson is now Speed up.
- The carpet keeps its height by itself: it flies level 5 m above the ground (`player.altitude.hoverHeight`), looks 0.8 s ahead along its path and starts to rise before a slope or the palace, and never goes above 35 m above sea level, so taller mountains are still walls. Up/down (mouse, arrow keys, tilt, drag) now raise and lower the carpet's nose to aim at things above and below; the camera stays nearly level (`camera.pitchFollow`), and the aiming circle moves to where the nose points (it now also shows on touch screens). The old way, where up/down climb and dive, is still there as `player.altitude.mode: "free"`. The controls list, the tilt setting and the first tutorial lesson say what up/down do in the current mode.
- Finer steering with keys and touch. Arrow-key turns build up while held (a tap is a small correction, a full turn after half a second: `controls.keys`); ↑ ↓ move the nose gradually (level to full in 0.3 s: `controls.keys.pitchSeconds`), and when let go it eases back to level (time constant 0.25 s: `keys.levelTimeConstant`). Touch drag and tilt respond more gently near the centre (`controls.expo`).
- Settings → Mouse and keys: up and down can be inverted, separately for the arrow keys and for the mouse (off by default, remembered in this browser).

### Fixed
- An error inside one frame no longer floods the console every frame: the first few are logged and the game goes on.
- After the browser drops and restores the WebGL context (phones under memory pressure, a laptop waking up) the sea's reflection and the daylight are redrawn instead of staying black.
- The published page no longer refetches every module at start to show when it was last changed; that timestamp is a development aid and now appears only on a local server (like the hitch log). The update check is unchanged.
- Shock rings (nova, palace stage, Vharoth's fall) share one geometry instead of building and disposing a sphere each time.
- Steering with the arrow keys no longer picks up a slight turn, climb or dive left over from the mouse. The mouse works as a stick that stays where you leave it, and a small nudge kept adding to the keys; pressing an arrow key now re-centres it.

## [0.4.0] - 2026-11-07

### Added
- Tutorial, a third game mode on a practice island (`tutorial.seed`). It opens by explaining the HUD in five short pages, two lines each: the bars at the top left (vitality and spell mana, then carried mana and the palace), the map at the top right (you and your palace, then mana and creatures), and the golden beam above the palace, which flashes in the view. The part being explained has a gold outline; on the second page of each, the parts that are still empty at the start blink with a sample (the carried-mana and palace bars fill, and the map shows mana specks and creature dots in their colours) until you continue, and an italic line under the text says to press Enter or click (tap on touch) to continue; the carpet holds still meanwhile. Then one task at a time: five flying lessons in order (look up and down, turn, slide sideways, surge, brake), shown as chips 1/5 … 5/5 that turn green; then gather 50 mana (it appears around the palace once the lessons are done), bank it in the beam (banking only opens at this step, with a word on what banked mana does), slay three wyverns with fireballs, find a group of skeleton archers and strike them with a nova, and bank the creatures' mana. No other creatures, no clock, and the carpet cannot fall. Task texts follow the device (mouse and keys, touch pad, or tilt). The task panel at the top is in large type (smaller on phones), and messages appear just below it, in large type, and stay until the next one replaces them. Task texts and messages put each sentence on its own line. A finished task stays up with a green tick for a second (`tutorial.pauseSeconds`) before the next one appears, and the panel keeps the height of its longest task so the messages below never jump. When it is done, the closing screen offers Keep flying (free practice on the island: wyverns and skeleton archers keep coming, and the palace can be raised to its sixth stage, with no end) or Exit tutorial; Exit tutorial is also on the pause screen. Numbers in the new config section `tutorial`.
- A frame hitch log for tracking down rare stutters, only when the game runs on a local server (`localhost`): any frame that takes longer than 50 ms is reported in the browser console as `[hitch]`, with what happened in it (spawns, kills, novas, the palace being rebuilt, shaders compiled, new geometry or textures), and kept in `windloom.hitches`. It also tags starting, pausing, resuming, window resizes, pointer lock and full screen. In Chrome, each long frame is also reported as `[long frame]`, with where its time went (scripts and what started them, rendering, style and layout, and the rest).
- Touch: a pause button (II) above Centre. There was no way to pause on a phone before.

### Changed
- Creatures are topped up every 4 seconds instead of every 2 (`spawning.intervalSeconds`), so slain ones take longer to be replaced.
- The carpet flies at most 35 m above sea level (`world.ceiling`, was 50), so flights stay closer to the ground. To go with it: the palace always stands at least 12 m below the ceiling (`world.palaceCeilingMargin`), so its beam is always in reach; wyverns and drakes patrol no more than about 12 m above the ceiling; skeleton archers only rise on ground the carpet can reach; and a flight starts (and resumes after a fall) just below the ceiling beside the palace, inside the beam and facing across it, since the palace's towers are now taller than the ceiling.
- Start screen: a game mode selector (Timed round, Free flight, Tutorial; remembered in this browser, with a line on each) and one Start button, instead of a button per mode. After the tutorial, Timed round is selected.
- Start screen order: title, island and a shorter description first, then the game mode and buttons. On a phone, Start is now visible without scrolling.
- The controls (keyboard and mouse, touch) and the bestiary moved off the start screen into a new menu point, Controls + more, next to Settings. Both open right below the buttons, one at a time, on the start, pause and results screens.

## [0.3.3] - 2026-11-06

### Added
- `world.landCover` sets how much of each island is land; each island draws its own share (spread 0.45), from a few small isles to one large island, and the start screen calls it "small" or "large". Until now the amount of land was down to the luck of the noise (from 6 % to 24 % of the map, so some seeds had almost none).
- Spawn rules can scale with the island's land (`perLand`); skeletons and sandworms do, so small islands are no longer crowded with land creatures. Palms and rocks scale the same way.

### Changed
- The sun is a small, crisp disc drawn by the sky itself, with a tight glow and a faint warm light over that part of the sky, instead of one large glowing blob. The sea reflects it as a glitter path. Its size and glow are set by `sky.sunDiscDegrees` and `sky.sunGlow` in the config.

## [0.3.2] - 2026-11-06

### Changed
- HUD: the palace moved from its own panel at the bottom left into the panel at the top left, under carried mana, on every screen size. It is the stage name with its numeral (Minaret · I; on phones only the numeral) over a light green progress bar, with no numbers.
- HUD: carried mana is a gold bar like vitality and spell mana, with no numbers. A full carry still pulses orange, and the label reads "Mana carried · full".
- HUD: on larger screens the map at the top right is as tall as the panel on the left (152 px instead of 112 px) and drawn at a higher resolution. Phones keep the 112 px map.
- The steering dot in the centre is dark grey with a light rim instead of turquoise, so it no longer disappears against the sea.

### Removed
- The key reminder in the bottom right corner during flight. The controls are still listed on the start and pause screens.

## [0.3.1] - 2026-11-06

### Changed
- Touch: Surge, Back and strafe are one four-way pad under the left thumb. The thumb's direction from the centre picks the move, and between two arms both are on (for example surge and strafe right).
- Tilt centring: the centre is now the average of the first 0.4 s of readings after start or resume, so lifting your finger from the button no longer skews it. It is also taken again whenever the screen turns between portrait and landscape. A new Centre button (above Nova) re-centres at any time.

## [0.3.0] - 2026-11-06

### Added
- Phones and tablets go full screen when a flight starts (Settings → "Full screen when a flight starts", on by default). This doesn't work on iPhone, where Safari has no full screen for web pages.
- Windloom can be added to the Home Screen and then runs without browser bars, also on iPhone. This uses a web app manifest, app icons (`icons/`, original artwork) and the iOS meta tags. On iPhone, Settings shows how to do it.

### Changed
- Tilt steering is more responsive: full turn at 15° of tilt (was 25°), full climb or dive at 12° (was 20°), with a 1.5° dead zone.
- Touch controls are laid out like a keyboard: Surge, Back and the new strafe buttons ◀ ▶ sit on the left like W, S, A and D, with Fire and Nova on the right. On phones the palace moves into the top-left panel as one line: the stage numeral (I–VI), a gold bar and stored / next mana. The bottom panel is gone there.

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
