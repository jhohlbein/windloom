# Changelog

All notable changes to Windloom are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
