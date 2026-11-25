# Validation

Verified on 2026-11-25 with Node.js v24.21.0 on Windows. Commands are documented in [ONLINE.md](ONLINE.md).

## Automated checks

- **40 Node tests:** isolated deterministic simulations and all creature families; movement, palace growth, individual respawn and original scoring; co-op pickup/spawn eligibility; timed/free lifecycle; eight-player capacity and late joining; reconnect expiry and duplicate connections; guest credentials, ticket expiry/reuse, CORS, message validation/rates/sequences, rejected peers and slow readers; SQLite top-100 cohorts and presence. Integration tests use the real local workerd runtime and SQLite.
- **9 browser scenarios:** two full co-op games with Unicode and literal-markup nicknames, server correction and presence; two full competitive games with independent rounds/reconnect; eight clients and ninth-player refusal/solo fallback; measured 100/200 ms WebSocket delay; timed-to-free replay; offline timed/free/tutorial startup. Browser tests use the pinned Three.js r128 package in place of the CDN download.
- The eight-client test uses one full 3D view and seven separate browser contexts running the production network client. Two complete 3D views are tested separately. It does not represent eight independently rendered gaming devices.
- A complete manual tutorial playthrough has not been performed.

## Eight-world benchmark

Eight independent competitive simulations, three 60 Hz physics steps per 20 Hz callback, and eight personalized snapshots serialized at 10 Hz. Each fixture has 100 warm-up and 600 measured callbacks.

| Scenario | Worlds | p95 callback | Largest callback | Average snapshot |
|---|---:|---:|---:|---:|
| Starting islands | 8 | 6.76 ms | 11.19 ms | 14,924 bytes |
| All creature families at stage-six population targets | 8 | 15.90 ms | 24.56 ms | 24,003 bytes |

Both p95 results fit the local 50 ms callback budget. The stress fixture unlocks every creature family with stage-six population targets; it does not replay every possible late-game state. Heap growth was about 35/67 MiB; total Node heap was about 42/93 MiB. These are local measurements, not Cloudflare isolate accounting, geographic latency or a service-level guarantee. Regenerate `.artifacts/benchmark.json` with `npm run benchmark`.

## Deployed backend

`https://windloom-online.alatiaun.workers.dev` was deployed on 2026-11-25 using Workers Free, SQLite Durable Objects and a production signing secret stored in Cloudflare. No signing secret or deployment credentials are included in this repository.

Live checks verified HTTP health, allowed-origin access, rejection of missing/unrelated origins, and matching rulesets. Two network clients verified shared co-op state, movement controls, live presence, reconnect to the same run and independent competitive worlds. Test runs were unranked, and checked rankings remained empty. Presence returned to zero after clients left; closure/presence cleanup can lag and is bounded by the documented lifecycle.

The frontend configuration points to the deployed Worker. Localhost continues to use its local development Worker. The original Pages frontend is updated by merging and publishing the PR. Production forced eviction, dashboard quota accounting and ranking recovery across a real production restart have not been exercised. SQLite persistence and interrupted-room behavior are tested locally.

Two full browser contexts also loaded the candidate frontend assets at `https://jhohlbein.github.io/windloom/` through local test interception and connected to the deployed Worker. Co-op shared one run, competitive worlds remained independent, and neither browser reported page errors. This exercises the real Pages origin and path before publication, while leaving the actual hosted files unchanged.
