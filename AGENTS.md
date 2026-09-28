# Block Strike: guide for AI agents

A blocky first-person shooter in the browser (three.js, no build step), with an online leaderboard on Netlify. Live at https://blockstrike.netlify.app, code at https://github.com/philhewinson/blockstrike. `README.md` is the player-facing page; `SOURCE-CODE.md` is every prompt that built it.

## Directory map

```
fpsgame/
├── AGENTS.md              this file (CLAUDE.md just imports it)
├── README.md              player-facing overview and screenshots
├── SOURCE-CODE.md         every prompt that built the game, verbatim and timestamped
├── play.command           double-click to run the local copy
├── package.json           one dependency (@netlify/blobs); `npm run dev` = local server
├── netlify.toml           publish site/, bundle netlify/functions/
├── docs/                  screenshots for the READMEs (not deployed)
├── netlify/functions/
│   └── api.mjs            runs the leaderboard API on Netlify, with Blobs storage
├── server/
│   ├── core.mjs           leaderboard API: names, match tickets, results, board, anti-cheat limits
│   └── dev-server.mjs     local server: site/ plus the API, data in .netlify/local-scores.json
└── site/                  everything that's deployed
    ├── index.html         all screens and the HUD; phone/tablet check in <head>
    ├── style.css
    ├── vendor/            three.js r186 (three.module.js + three.core.js), via importmap
    └── src/
        ├── boot.js        computers get main.js; phones/tablets, or a failed 3D start, get mobile.js
        ├── main.js        match flow (duel, survival), player, shooting, melee, grenades, power-ups, HUD, menus, map picker
        ├── bot.js         bot model and AI; DIFF (per difficulty) and BOT_WEAPONS at the top
        ├── weapons.js     player weapon stats
        ├── weapon.js      on-screen weapon models and animations
        ├── maps.js        the 7 maps: layout build(b), theme colours, spawn, ammo spots, unlock rule, feature
        ├── world.js       loads a map, sky and lights; jump pads, teleporters; ray tests; map-picker pictures
        ├── nav.js         bot waypoints on every level (stairs, drops, pad and portal links) and pathfinding
        ├── physics.js     movement and box collision, step-up
        ├── pickups.js     ammo boxes
        ├── effects.js     sparks, tracers, decals, explosions, elimination burst
        ├── audio.js       synthesised sounds (Web Audio, no files)
        ├── names.js       name rules and rude-word filter (the server imports it too)
        ├── online.js      leaderboard API calls; this browser's player tokens
        ├── mobile.js      phone/tablet page: play-on-a-computer message and leaderboard tabs
        └── backdrop.js    orbiting 3D arena behind the phone/tablet page
```

## Run and test

- **Local:** `play.command`, or `node server/dev-server.mjs`, then http://localhost:8765. A phone on the same Wi-Fi can open `http://<this Mac's IP>:8765`. Add `?mobile` or `?desktop` to force either view.
- **Local leaderboard:** `.netlify/local-scores.json`, loaded when the server starts, so stop the server before editing it. It is separate from the live board.
- **Browser tests (Playwright):**
  - `window.__game` exposes `player`, `gun`, `inv`, `run`, `world`, `nav`, `grenades`, `loadMap`, `MAPS` and `stats`. Set `god = true` to turn off damage.
  - Pointer lock can't happen headless. Override `canvas.requestPointerLock` to define `document.pointerLockElement` and dispatch `pointerlockchange`.
  - Dispatch key events on `window` with `bubbles: true`.
  - Headless frames are slow, so hold clicks for longer than a frame. To pin a bot in place, replace its `update()`.
- **Server rules:** call `handle()` from `server/core.mjs` in Node with an in-memory store (`get`, `setJSON`, `list`).

## Publish

- Pushing `main` makes Netlify build and publish in about 30 seconds.
- **Each publish costs 15 of the free plan's 300 monthly credits.** Batch changes, and publish only when Phil asks.
- For commits that change only docs, put `[skip netlify]` in the message: no build, no credits.
- Netlify makes new projects private by default (Project configuration → General → Visitor access). This one is set to Public.
- **Leaderboard data** lives in the Netlify Blobs store `blockstrike`, one JSON blob per player at `p/<name, lowercase, no spaces>`: `{ name, tokenHash, duel: { difficulty: wins }, surv: { difficulty: waves }, tickets, recent }`. To remove a bad name, delete its blob.

## Where to change things

| Change | File |
|---|---|
| Player weapon damage, fire rate, ammo | `site/src/weapons.js` |
| Bot difficulty, bot weapons | `DIFF` and `BOT_WEAPONS` in `site/src/bot.js` |
| Maps, unlock rules, map features | `site/src/maps.js` (build API described at the top) |
| Name rules, rude-word list | `site/src/names.js` |
| Anti-cheat limits | constants at the top of `server/core.mjs` |

## Gotchas

- Every map fits inside the same 60 × 60 walls. Build stairs with `b.stairsZ` or `b.stairsX`: they add the waypoints bots need to use them. Bot waypoints are rebuilt on every map load.
- `world.colliders` is shared by physics, bots and effects, and is refilled in place. Never reassign it.
- Recoil is applied after a shot is aimed. The other way round made every shot go high.
- Web Audio exponential ramps can't reach 0. `env()` in `audio.js` clamps the peak.
- Player names are unique and owned by the browser that created them, through a secret token. The same name can't be used from a second device, and `localhost` and the live site have separate boards.
- Phil's shell hook blocks writing `.md` files from the shell, so edit Markdown with the Edit or Write tools.
