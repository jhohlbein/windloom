# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Windloom is a browser game (three.js r128, plain ES modules, no build step) inspired by Bullfrog's *Magic Carpet*. It is served as a static site by GitHub Pages from the repository root. The owner tunes gameplay through `config/game-config.json`, so keep gameplay numbers there rather than in code.

## Run and check

- Serve locally: `python3 tools/serve.py` in the repo root (like `python3 -m http.server 8000` but with caching off, so edited modules are always reloaded), open http://localhost:8000. Opening `index.html` from disk does not work (modules and `fetch` are blocked on `file://`).
- There is no test suite yet. After a change: load the page, check the browser console for errors, start a game, fly, shoot, bank mana in the beam until the palace rises a stage, pause, and try "New island". Run the tutorial through once when its steps or the controls change.
- Headless check (if Playwright is available): load the page, pick a game mode (`input[name=mode][value=timed|free|tutorial]`), click `#start`, and read `window.windloom.G` (state), `window.windloom.W` (island) and `window.windloom.CFG`.
- A specific island can be reproduced with `#s<seed>` in the URL.
- Stutters (on `localhost` only): frames over 50 ms are logged to the console as `[hitch]` with the events of that frame (`src/perf.js`; add `mark('...')` calls to tag more events), and kept in `window.windloom.hitches`.

## Architecture

- `src/config.js` loads `config/game-config.json` into `CFG` with a top-level `await`, so every module that imports it can read `CFG` at import time. `src/main.js` imports `game.js` statically; do not switch back to a dynamic `import()`, because browsers keep dynamically imported modules cached even on a hard reload.
- Shared mutable state lives on two objects in `src/state.js`: `G` (game state, player, entity arrays) and `W` (current island layout: seed, palace centre `CX/CZ/PH`, dragon lair `LX/LZ/LH`, oases). ES module exports cannot be reassigned, so never `export let` state; put it on `G` or `W`.
- `three` is resolved by the import map in `index.html` (jsDelivr, pinned to 0.128.0). Import it as `import * as THREE from 'three'`.
- Modules import each other in cycles (e.g. `combat` ↔ `creatures/dragon`, `combat` ↔ `player`). This is fine because cross-module calls happen at runtime, not at import time. Do not call imported functions at module top level.
- Geometry flagged with `shared()` (see `scene.js`) is reused and must not be disposed. `disposeTree()` respects the flag.
- Creatures share one interface (see `creatures/common.js`): `kind, name, pos, vel, r, hp, maxHp, update(e, dt), targetable(), showBar(), hitTest(point, radius), barPos(out), radar, root`, plus an optional `collide(P, radius)` that pushes the carpet out of a solid body (sandworms use it). Add new creature types by following that shape and registering them in `creatures/spawn.js`.
- Wyverns, drakes and the dragon are built by one parametric model in `creatures/beasts.js`; appearance parameters live there, gameplay numbers in the config.
- Landscape settings that vary per island (`world.variation` in the config) are drawn from the seed in `islandParams()` (`world.js`) into `W.P`; terrain and world code read them from `W.P`, not from `CFG.world`.
- Coordinates: one unit is one metre (the carpet is about 5 m long); y is up, the island is centred on the origin, sea level is y = 0. Models face −z.

## Conventions

- Version lives in `src/version.js`; keep it in step with `CHANGELOG.md` (Keep a Changelog, SemVer). Add changes under `[Unreleased]` as you go.
- New tunable numbers go into `config/game-config.json` and get a line in `config/CONFIG.md`.
- `config/CONFIG.md` shows the current value of every key in `config/game-config.json` (the "Value" column). Whenever a value is changed, or a key is added or removed, update both files in the same change.
- New third-party code, fonts or assets get an entry in `ACKNOWLEDGEMENTS.md`. Do not use assets, names or logos from Bullfrog/EA's *Magic Carpet*.
- Keep it dependency-free at runtime apart from three.js; no bundler unless the owner asks for one.
- Feature ideas and the planned refactor are in `REFACTOR_PLAN.md`.
