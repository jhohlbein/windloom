# Refactor and feature plan

Ideas for the next versions, roughly in the order they build on each other. Part 1 is implemented; the rest are ideas.

## 1. Timed rounds (done)

Implemented in `src/round.js`, numbers in the config section `round`:

- A round lasts 4 minutes (`round.durationSeconds` 240), with a countdown at the top of the HUD that turns red in the last 30 seconds.
- The clock keeps running in the palace beam; it stops only while paused.
- The round ends when time runs out, or early when the palace is complete and Vharoth is slain.
- Score: points per creature slain by kind, per palace stage raised, for slaying Vharoth, and for finishing early plus points per second left.
- A results screen shows the breakdown; the best score per seed is stored in `localStorage` and shown with the island name.

## 2. Enemies grow with the palace

Today the palace stage already raises creature counts and hit points a little. Make this the main difficulty curve and keep it in the config.

- Replace the scattered per-creature `hpBonus` rules with one table in the config: for each palace stage, multipliers for creature count, hit points, damage, speed and fire rate.
- Unlock new behaviours by stage: drakes from stage 2, wyverns hunting in packs from stage 3, sandworms that can surface twice in a row from stage 4, a second kraken from stage 5.
- Let Vharoth notice the palace: from stage 4 it may attack the palace's outer wall instead of the player, draining banked mana unless driven off.
- Keep the early game gentle: stage 1 should feel like learning to fly.
- Difficulty levels chosen on the start screen (for example gentle, normal, fierce) as multipliers on the same table: creature damage, fire rate and counts; the current numbers (0.5.1) are the normal level and already a little hotter than before, by choice.

## 3. Weapon upgrades

Spend banked mana (or reach palace stages) to unlock and level up spells.

- Fireball: faster fire rate, larger blast, piercing.
- Nova: wider radius, lower cost.
- New spells: lightning that chains between creatures; a shield that absorbs damage; a ground spell that raises or lowers terrain (a nod to the original game).
- An upgrade screen at the palace (open while inside the beam) with costs in the config.
- Refactor: move spells out of `combat.js` into `src/spells/` with one file per spell and a shared interface (`cooldown`, `cost`, `cast()`, `update()`).

## 4. Teleporters

Ancient gates scattered over the island that link to each other.

- Place 2–4 gates per island at seeded positions (on mesas or near oases).
- Flying through one moves you to its partner; the first use of each gate needs to be "activated" with mana.
- Gates could also carry banked mana home faster, or let creatures through as a risk.
- Open question: do gates help speed up rounds (good with the 5-minute timer), or are they a late-stage unlock?

## 5. Multiplayer

The biggest change; worth doing only after rounds and upgrades settle.

- Option A, cooperative: 2–4 players share an island and a palace, each on their own carpet. Simplest rules, good first step.
- Option B, competitive: each player has a palace, as in the original game, and can steal mana from rivals.
- Technology: GitHub Pages can only host static files, so a small relay server is needed (WebSocket on a cheap VPS, or a managed service such as Cloudflare Durable Objects or PartyKit). Peer-to-peer WebRTC needs a signalling server too.
- Refactor first: separate simulation (positions, health, mana) from rendering, so the simulation can run with a fixed time step and be synchronised. The shared seed already makes islands identical for everyone; creature spawning would need the same seeded random numbers.

## Supporting refactors

- Fixed-timestep simulation loop separate from rendering (needed for multiplayer, also makes behaviour independent of frame rate).
- A small automated smoke test (Playwright): load the page, start a game, check for console errors, bank mana until a stage-up.
- Config validation on load with readable error messages for typos.
- Optional bundling (Vite) only if load time becomes a problem; not needed now.
- Sound: replace synthesised beeps with a few recorded effects (with licences noted in ACKNOWLEDGEMENTS.md).
