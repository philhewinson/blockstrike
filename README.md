# Block Strike

A blocky first-person shooter in the browser. Two modes: **Duel** (you vs a bot, first to 5) and **Survival** (one life; wave N sends N bots, up to 8). Four difficulties: Easy, Normal, Hard, Extreme.

Live: https://blockstrike.netlify.app

## Play locally

Double-click `play.command`. It runs `server/dev-server.mjs` (Node) on port 8765, which serves `site/` plus a local copy of the leaderboard API, stored in `.netlify/local-scores.json`. The local board is separate from the live one.

## Controls

WASD move · Mouse look · Click shoot · Right click (hold) or E (toggle) aim · 1 2 3 / scroll switch weapon · R reload · G grenade · Space jump · Shift sprint · C slide · Esc pause

## Rules

- Loadout on the home screen: primary (assault rifle / sniper), secondary (spray gun / pistol), melee (knife / fists), plus 2 grenades.
- Knife in the back, or a knife hit while sliding (C while running), is an instant elimination.
- Ammo is limited. Green ammo boxes refill it and your grenades, then reappear elsewhere. Respawning also refills.
- Health regenerates after 4 seconds without damage. Both sides respawn 3 seconds after being eliminated.
- Each new survival wave refills health, ammo and grenades.

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
| `site/src/main.js` | Match flow, player, shooting, melee, grenades, HUD, menus |
| `site/src/weapons.js` | Weapon stats (damage, fire rate, ammo) |
| `site/src/bot.js` | Bot model and AI; difficulty tuning in `DIFF` at the top |
| `site/src/weapon.js` | Weapon models on screen and their animations |
| `site/src/world.js` | Map layout, lighting, ray tests against the level |
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
