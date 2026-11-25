# Online play with the existing Pages site

GitHub Pages continues to serve `index.html`, CSS, configuration and browser modules from the repository root. Its existing deployment settings and seed links stay in place. No frontend build is needed. A separately published Cloudflare Worker provides rooms, presence and rankings; it does not host game assets.

## Local development

Use Node.js 22.13 or newer, then run:

```sh
npm ci
npm run dev:server
```

In a second terminal, run `npm run dev` and open **http://127.0.0.1:8000**. The game automatically uses the local Worker at `http://127.0.0.1:8787`. `dev:server` explicitly runs locally, creates an ignored random signing secret in `server/.dev.vars.local`, and keeps local Durable Object storage under `.artifacts/local-state`. No Cloudflare account is needed for local play or tests. Use these exact ports: the development origin allowlist covers `localhost:8000` and `127.0.0.1:8000` only.

`config/online.json` points to `https://windloom-online.alatiaun.workers.dev`. On localhost, the browser still selects the development Worker at `http://127.0.0.1:8787`; an explicitly configured loopback backend can override that port for local tests. A backend outage never prevents the static game from starting.

## Maintaining the published backend

The backend was deployed with explicit approval on **2026-11-25** to the contributor’s Cloudflare Workers Free account. No GitHub changes have been committed or published as part of that deployment. The original Pages site gains multiplayer after the owner merges and publishes the frontend. The backend account holder controls its availability, secrets and future deployments; the repository owner should agree to that arrangement before merging. The following steps describe recreating or updating the backend.

1. Use a Cloudflare account on **Workers Free**, with SQLite-backed Durable Objects. Keep that plan; this project does not enable paid services or automatic upgrades. No Vercel, Render, Supabase, TURN relay or always-running virtual machine is required.
2. Inspect `server/wrangler.jsonc`. Its production `ALLOWED_ORIGINS` is the existing Pages **origin**, `https://jhohlbein.github.io`, without a trailing slash or `/windloom/` path. For a fork or custom domain, replace it with the actual exact origin. Comma-separated additional origins must each be explicitly trusted. Origin checks apply separately to HTTP and WebSocket upgrades. Localhost appears only in the local environment.
3. Authorize Wrangler with `npx wrangler login --scopes account:read user:read workers_scripts:write` and confirm the intended account. For a new backend, put a unique `SESSION_SECRET` of at least 32 random characters in an ignored private `.env.production.json` file. Upload it with `--secrets-file` during deployment, then remove the temporary file after success while retaining a private password-manager backup. Never print it, put it in Pages, a shared URL or tracked configuration. Preserve an existing production secret during routine updates; changing it invalidates browser guest credentials.
4. After deployment approval, use `npx wrangler deploy --config server/wrangler.jsonc --secrets-file .env.production.json` for the initial secret upload. Omit `--secrets-file` for routine updates that preserve the existing secret. The configuration declares the initial SQLite Durable Object migration. Do not remove or rename deployed classes/migration tags on subsequent updates without a migration plan.
5. Put the resulting public HTTPS origin in `config/online.json`, for example `{"backendUrl":"https://windloom-online.YOUR-SUBDOMAIN.workers.dev"}`. It is a public address, not a secret. Shared game links still point to the existing GitHub Pages path. Publish the approved static changes through the repository's existing Pages workflow/settings.
6. Check two browsers on the real Pages origin. Local tests do not establish Internet routing latency or a deployment's account allowance. The game compares its version/configuration ruleset with the backend and asks for a reload when they differ; publish matching versions together.

`npm run check:server` bundles the Worker with `--dry-run` and does not deploy it. Production credentials and Cloudflare account changes are unnecessary for that check.

## Playing and room lifecycle

Choose Co-op or Competitive, choose timed or free flight, enter a nickname and seed, and press Start. Copy the island link for friends; they join by opening it and pressing Start. The room key includes the seed, mode, timed/free setting and version/configuration hash. Existing `#s12345`, legacy seed-query links and the Pages subdirectory are preserved.

Co-op shares enemies, drops, palace progression and team score. Each carpet has its own health, spell mana and carried mana. The existing death rule respawns that player; a death does not eliminate the team. Late arrivals inherit the shared world and remaining timed clock. The room standings show team score plus each player's kills and banked mana; these contributions do not change the original score formula.

Competitive players have independent enemies, drops and palaces, full individual timed rounds, and non-interacting avatars of other players. Neither mode permits player combat. Free flight stays unranked and continues after palace completion. The tutorial is solo.

Room standings open automatically; press Tab to toggle them while flying (or tap their heading on touch devices). Menus release your controls while an online world's clock and creatures continue. Disconnections neutralize controls and reserve the player's slot/progress for 30 seconds. Joining another tab with the same browser identity replaces the previous connection. Hidden tabs leave after 90 seconds. A room has eight slots including reconnect reservations; presence counts connected players in unfinished timed rounds or free flight, deduplicated by guest identity across rooms. Ranking viewers are not counted as players. Presence uses a 90-second crash-expiry lease and usually updates immediately on joins/leaves.

Finished timed worlds stop ticking. Empty worlds are discarded after reconnect grace. No simulation timer runs perpetually. A server restart interrupts an unfinished run visibly; its temporary world is not recovered. Idle presence sockets use the hibernation API and automatic ping/pong, without a polling timer. An active game's physics necessarily keeps its room awake.

## Saved rankings and trust

Competitive rankings retain each guest's best completed server result. Co-op saves team runs separately for each **peak simultaneous party size** (including reconnect reservations). A rotating party's display lists up to the first eight contributing identities. Scores are the original timed formula. Free flight cannot publish a ranked result, and there is no public score-submission endpoint. Existing browser-only solo results remain separate.

SQLite retains the top 100 per cohort and at most three rulesets. The UI shows the leading ten; the read API exposes all retained rows. Rankings persist through Worker restarts. Guest IDs and signed credentials live in that browser's local storage: clearing it loses that identity and creates a new one. Nicknames are public labels, not verified accounts, and duplicate names are allowed; a short ID distinguishes them. This limits client-forged score submissions but is not a guarantee against bots, multiple guest identities or automated legitimate controls.

HTTP uses signed guest credentials for room tickets. Tickets expire after 30 seconds, are single-use and bound to a channel/room; WebSocket subprotocols carry them, never URLs. Anonymous read-only viewers use separately rate-limited tickets. Nicknames render as text. Inputs accept only validated controls and increasing sequences, with size/rate limits. Snapshot acknowledgements travel in the existing control packets; slow readers receive an error, stop receiving snapshots and leave active presence before their backlog can grow without bound. Movement and snapshots do not write the database. Presence renewals and final results do.

## Free allowances and expected capacity

Cloudflare's Free plan has finite account-wide allowances. The official documentation checked on **2026-11-19** lists 100,000 Durable Object requests/day, 13,000 GB-s/day of duration, 100,000 SQLite rows written/day and 5 million rows read/day. Incoming WebSocket messages use a 20:1 compute-request billing ratio; outgoing messages are not charged as requests. Duration is charged for an active room's allocated 128 MB, irrespective of actual heap usage. See [Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) and [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

At ten control packets/second, 100,000 requests corresponds to roughly **56 player-hours/day** before admission, button transitions, presence, rankings and other account usage. Separately, 13,000 GB-s corresponds to roughly **28 active room-hours/day** at the documented 0.128 GB allocation. These are illustrative ceilings, not promised availability; concurrent rooms add their duration and other services share account quotas. SQL row accounting and actual messages must also be monitored. There is no way to offer unlimited authoritative multiplayer for free under finite allowances.

The application caps active rooms at 16, spectators at 128 and slots at eight; these are admission caps, not a daily budget meter. Lower `MAX_ACTIVE_ROOMS` if needed. Cloudflare enforces its Free allowances; exhausted or unavailable services show an online failure and leave solo available through Pages. Remain on Workers Free to keep the no-cost requirement. This implementation does not purchase capacity or switch plans.

The saved benchmark exercises eight independent competitive simulations with snapshots, including an all-creature population stress fixture. Read its machine-specific results in [VALIDATION.md](VALIDATION.md) and regenerate them with `npm run benchmark`. They measure local CPU/heap/payload sizes, not guaranteed Cloudflare placement or Internet latency. Full snapshots trade simplicity for bandwidth; a typical snapshot is tens of kilobytes, so eight competitive players can produce megabytes per second of aggregate outbound traffic. Client prediction and interpolation reduce visible latency; geographically distant players still depend on distance to the room's Cloudflare location.

## Verification commands

```sh
npm test
npm run install:browser
npm run test:browser
npm run benchmark
npm run check:server
```

Tests use the real local workerd runtime and SQLite, isolated from local development data. Browser tests replace only the Three.js CDN download with the same installed pinned version. Offline checks block the backend. The eight-client capacity test uses one full game view and seven browser contexts running the production network client; separate tests run two complete 3D views together. This avoids claiming that one software-rendered test machine represents eight independent gaming devices.
