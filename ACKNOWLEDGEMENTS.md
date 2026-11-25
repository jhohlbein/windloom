# Acknowledgements

## Libraries

- **three.js** r128 (0.128.0), MIT License. 3D rendering. https://threejs.org · https://github.com/mrdoob/three.js · loaded from jsDelivr: https://cdn.jsdelivr.net/npm/three@0.128.0/

## Fonts

- **Syne** by Bonjour Monde, SIL Open Font License 1.1. https://fonts.google.com/specimen/Syne
- **IBM Plex Mono** by IBM, SIL Open Font License 1.1. https://fonts.google.com/specimen/IBM+Plex+Mono
- Both served by Google Fonts: https://fonts.google.com

## Artwork

- The app icon (`icons/icon.svg` and the PNGs rendered from it) is original artwork made for Windloom.

## Algorithms

- **mulberry32** pseudo-random number generator by Tommy Ettinger, public domain. Used for seeded islands. https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
- Value noise and fractal Brownian motion for the terrain follow common textbook formulations; see Inigo Quilez's articles for background: https://iquilezles.org/articles/fbm/

## Services

- **jsDelivr** CDN for three.js: https://www.jsdelivr.com
- **GitHub Pages** for hosting: https://pages.github.com

## Inspiration

- *Magic Carpet* (Bullfrog Productions, 1994; published by Electronic Arts). Windloom is an original game inspired by its idea of flying over a world, hunting creatures for mana and growing a castle. It uses no code, art, sound or names from that game.

## Tools

- Prototyped and refactored with Claude (Anthropic).
## Multiplayer development tools

The browser still uses only the existing Three.js runtime dependency. The backend bundles the same Three.js math and transform code; its presentation adapter does not initialize WebGL. Local tooling uses [Cloudflare Wrangler and Miniflare](https://github.com/cloudflare/workers-sdk) (MIT/Apache-2.0), [Playwright](https://github.com/microsoft/playwright) (Apache-2.0), [esbuild](https://github.com/evanw/esbuild) (MIT) and [ws](https://github.com/websockets/ws) (MIT), and [Prettier](https://github.com/prettier/prettier) (MIT). They are development dependencies and are not downloaded by players.
