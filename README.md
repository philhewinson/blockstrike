# Block Strike

A blocky first-person shooter in the browser. Two modes: **Duel** (you vs a bot, first to 5) and **Survival** (one life; wave N sends N bots, up to 8). Four difficulties: Easy, Normal, Hard, Extreme.

Live: https://blockstrike.netlify.app

## Play locally

Double-click `play.command`. It runs `server/dev-server.mjs` (Node) on port 8765, which serves `site/` plus a local copy of the leaderboard API, stored in `.netlify/local-scores.json`. The local board is separate from the live one.

## Phones and tablets

Phones and tablets never load the game. A check at the top of `site/index.html` (phone/tablet names in the browser, iPads that report as a Mac, touch-only screens, small touchscreens without a mouse) sends them to a page with a "play on a computer" message and the leaderboard for all four difficulties (`site/src/mobile.js`). Computers whose browser can't run the 3D game get the same page with a different message. Add `?mobile` or `?desktop` to the address to force either view.

## Controls

WASD move · Mouse look · Click shoot · Right click (hold) or E (toggle) aim · 1 2 3 / scroll switch weapon · R reload · G grenade · Space jump · Shift sprint · C slide · Esc pause

## Rules

- Loadout on the home screen: primary (assault rifle / sniper), secondary (spray gun / pistol), melee (knife / fists), plus 2 grenades.
- Knife in the back, or a knife hit while sliding (C while running), is an instant elimination.
- Ammo is limited. Green ammo boxes refill it and your grenades, then reappear elsewhere. Respawning also refills.
- Health regenerates after 4 seconds without damage. Both sides respawn 3 seconds after being eliminated.
- Each new survival wave refills health, ammo and grenades.
- Bots by difficulty (tuning in `DIFF`, weapons in `BOT_WEAPONS`, both in `site/src/bot.js`):
  - Easy: assault rifle only. Normal: rifle, spray gun or pistol.
  - Hard and Extreme: each bot carries a primary (rifle or sniper), a secondary (spray gun or pistol) and a knife, and switches by distance (sniper far, secondary close, knife right up close; a knife in your back is instant). They heal out of combat and throw grenades when you hide (Hard 1, Extreme 2 per life). Sniper bots stand still and show a red laser while aiming; on Extreme their sniper is a one-shot kill.
  - A "GRENADE!" warning flashes when a bot's grenade lands near you.

## Maps

Arena is open from the start. Each other map unlocks from the player's leaderboard numbers, shown with a progress bar in the map picker:

| Map | Unlock | New feature |
|---|---|---|
| Crossroads | 10 duel wins on Normal | |
| Warehouse | Survive 5 waves on Normal | |
| Rooftops | 10 duel wins on Hard | Jump pads |
| Canyon | Survive 5 waves on Hard | Teleporters |
| Fort | 10 duel wins on Extreme | Power-ups: Speed, Shield (+50), Double Damage |
| Night City | Survive 5 waves on Extreme | Night-time, teleporters and jump pads |

Wins and waves count on any map; there is one shared leaderboard. Bots move between levels (stairs, ledges, drops), ride jump pads and follow you through teleporters; they don't collect power-ups. Waypoints for bots are rebuilt on each map load (`site/src/nav.js`).

## Players and leaderboard

- A player picks a nickname once (3–12 characters, rude words blocked). The server checks it is unique across everyone and gives that browser a secret token, so only that browser can post scores under the name. The same name can't be used from a second device.
- The leaderboard follows the selected difficulty: **Duel wins** (total) and **Survival waves** (best number of waves cleared).
- Leaving a duel records nothing; leaving a survival run keeps the waves already cleared.
- Anti-cheat (in `server/core.mjs`): one-use match tickets from the server, results must be possible (a duel win is 5 kills and at least 30 seconds; survival allows at most one wave per 4 seconds), and at most 30 results per player per hour. Stops casual cheating, not a determined programmer.

## Hosting

Netlify, free plan, deploying from GitHub `main`. `netlify.toml` publishes `site/` and bundles `netlify/functions/api.mjs`, which stores players in Netlify Blobs (store `blockstrike`, one blob per player under `p/<name>`).

Each production deploy costs 15 of the free plan's 300 monthly credits, so batch changes before pushing. If the credits run out, Netlify pauses the site until next month; it never charges on the free plan.

## Code

| File | What it does |
|---|---|
| `site/src/boot.js` | Loads the game on computers, or the phone/tablet page |
| `site/src/mobile.js` | Phone/tablet page: play-on-a-computer message and leaderboard |
| `site/src/main.js` | Match flow, player, shooting, melee, grenades, HUD, menus |
| `site/src/weapons.js` | Weapon stats (damage, fire rate, ammo) |
| `site/src/bot.js` | Bot model and AI; difficulty tuning in `DIFF` at the top |
| `site/src/weapon.js` | Weapon models on screen and their animations |
| `site/src/maps.js` | Map layouts, colours, spawn and ammo spots, unlock rules |
| `site/src/world.js` | Loads a map (blocks, colours, sky, lighting), ray tests against the level, map-picker pictures |
| `site/src/pickups.js` | Ammo boxes |
| `site/src/names.js` | Name rules and the rude-word filter (shared with the server) |
| `site/src/online.js` | Talks to the leaderboard API; keeps this browser's player tokens |
| `site/src/nav.js` | Waypoints and pathfinding for the bot |
| `site/src/physics.js` | Movement and collision |
| `site/src/effects.js` | Sparks, tracers, explosions, elimination burst |
| `site/src/audio.js` | Synthesised sounds |
| `server/core.mjs` | Leaderboard API: names, match tickets, results, board |
| `server/dev-server.mjs` | Local server for the game plus the API |
| `netlify/functions/api.mjs` | Runs the API on Netlify with Blobs storage |
