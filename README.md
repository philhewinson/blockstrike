# Block Strike

A blocky first-person shooter in the browser. Two modes: **Duel** (you vs a bot, first to 5) and **Survival** (one life; wave N sends N bots, up to 8).

## Play

Double-click `play.command` (starts a local server on port 8765 and opens the browser). Or: `python3 -m http.server 8765` in this folder, then open http://localhost:8765.

Keep port 8765: players and scores are stored in the browser per address, so a different port shows an empty board.

## Controls

WASD move · Mouse look · Click shoot · Right click (hold) or E (toggle) aim · 1 2 3 / scroll switch weapon · R reload · G grenade · Space jump · Shift sprint · C slide · Esc pause

## Rules

- Loadout on the home screen: primary (assault rifle / sniper), secondary (spray gun / pistol), melee (knife / fists), plus 2 grenades.
- Knife in the back, or a knife hit while sliding (C while running), is an instant elimination.
- Ammo is limited. Green ammo boxes refill it and your grenades, then reappear elsewhere. Respawning also refills.
- Health regenerates after 4 seconds without damage. Both sides respawn 3 seconds after being eliminated.

## Players and leaderboard

Players pick a name once (3–12 characters, unique on this device, rude words blocked). The leaderboard follows the selected difficulty and has two columns: **Duel wins** (total) and **Survival waves** (best number of waves cleared). Leaving a duel records nothing; leaving a survival run keeps the waves already cleared. Each new survival wave refills health, ammo and grenades.

## Code

| File | What it does |
|---|---|
| `src/main.js` | Match flow, player, shooting, melee, grenades, HUD, menus |
| `src/weapons.js` | Weapon stats (damage, fire rate, ammo) |
| `src/bot.js` | Bot model and AI; difficulty tuning in `DIFF` at the top |
| `src/weapon.js` | Weapon models on screen and their animations |
| `src/world.js` | Map layout, lighting, ray tests against the level |
| `src/pickups.js` | Ammo boxes |
| `src/names.js` | Name rules and the rude-word filter |
| `src/scores.js` | Players and best scores (browser storage; swap for a server when hosting) |
| `src/nav.js` | Waypoints and pathfinding for the bot |
| `src/physics.js` | Movement and collision |
| `src/effects.js` | Sparks, tracers, explosions, elimination burst |
| `src/audio.js` | Synthesised sounds |

Static files only, so it can be hosted as-is on GitHub Pages or Netlify.
