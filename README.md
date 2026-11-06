# Windloom

A browser flying game in the spirit of Bullfrog's *Magic Carpet* (1994). Ride a flying carpet over a desert island, hunt wyverns, drakes, krakens, sandworms and the dragon Vharoth for golden mana, and carry it home to raise your palace through six stages.

**Play:** https://jhohlbein.github.io/windloom/

Every game generates a new island. The page address ends with the island's seed (`#s123456789`); open that link to replay the same island.

Version 0.3.0. See [CHANGELOG.md](CHANGELOG.md).

## Controls

| Action | Keyboard and mouse | Touch |
|---|---|---|
| Turn | mouse left/right, ← → | tilt the phone left/right, or drag |
| Climb / dive | mouse up/down, ↑ ↓ | tip the phone towards/away from you, or drag |
| Surge forward (a short burst, repeats every 2 s while held) | W or Shift | Surge |
| Fly backwards | S | Back (hold) |
| Strafe | A / D | ◀ ▶ |
| Fireball | left click or Space | Fire (hold) |
| Nova (costs mana) | right click or E | Nova |
| Pause / mute | Esc / M | – |

On phones and tablets the game goes full screen when a flight starts. iPhone Safari cannot do that for web pages. Instead, tap Share → Add to Home Screen and start Windloom from its icon: it then runs without browser bars. This also works on Android.

## How the game works

- Creatures drop golden mana when they die. Fly through it to collect it, up to your carrying limit.
- Fly into the golden beam above your palace to bank the mana and heal. Banked mana raises the palace: Minaret, Palace, Garden Walls, Golden Dome, Lantern Ring, Crescent Sanctum.
- Away from the beam you heal slowly once you have avoided damage for a few seconds.
- Wyverns, drakes and the dragon hunt by sight: hills and mesas block their view. The dragon searches where it last saw you before giving up, hears your spells nearby, and will not cross the palace beam.
- More creatures appear as the palace grows. Drakes appear from the second stage.

## Tuning the game

All gameplay numbers (speeds, hit points, damage, timers, spawn counts, palace thresholds, world size) are in [`config/game-config.json`](config/game-config.json). Each setting is explained in [`config/CONFIG.md`](config/CONFIG.md). Edit the file, reload the page, done. No build step.

While playing, the browser console exposes `windloom.G` (game state), `windloom.W` (island layout) and `windloom.CFG` (loaded settings) for quick experiments.

## Running locally

The game uses JavaScript modules and loads its config with `fetch`, which browsers block for pages opened straight from disk. Start any static web server in the project folder:

```bash
cd windloom
python3 tools/serve.py        # or: python3 -m http.server 8000 (may serve stale cached modules after edits)
# then open http://localhost:8000
```

Alternatives: `npx serve .` or the "Live Server" extension in VS Code.

## Project layout

```
index.html              page markup, HUD and title screen
css/style.css           all styling
config/game-config.json gameplay settings (edit me)
config/CONFIG.md        what each setting does
src/main.js             entry: loads config, then the game
src/game.js             screens, new islands, main loop
src/state.js            shared game state (G) and island layout (W)
src/config.js           config loader and scaling helpers
src/scene.js            renderer, camera, sky, water, shared materials
src/terrain.js          seeded height function, line of sight
src/world.js            builds an island: oases, palace site, lair, palms, rocks
src/palace.js           the six palace stages
src/progress.js         banking mana, stage-ups
src/player.js           carpet model, flight model, camera
src/controls.js         keyboard, mouse and touch input
src/combat.js           spells, projectiles, mana orbs, damage
src/hud.js              HUD, radar, health bars, toasts
src/particles.js        sparks, dust and spray
src/audio.js            synthesised sound effects
src/creatures/          beasts (shared winged-reptile model), flyers, kraken, sandworm, dragon, spawning
```

## Publishing on GitHub Pages

The game is a static site, so GitHub Pages serves it directly from the repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save.** After a minute it is live at https://jhohlbein.github.io/windloom/. Every push to `main` updates it.

## Credits

See [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md). Ideas for what comes next are in [REFACTOR_PLAN.md](REFACTOR_PLAN.md).
