// Players and their records, stored in this browser. Swap these functions for calls to a
// shared server if the game is ever hosted for friends.
import { key } from './names.js';

const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export const players = () => load('blockstrike.players', []);
export const current = () => localStorage.getItem('blockstrike.current');
export function setCurrent(name) {
  const list = players();
  if (!list.some(p => key(p) === key(name))) save('blockstrike.players', [...list, name]);
  localStorage.setItem('blockstrike.current', name);
}

// Duel: total wins per player. Survival: highest wave survived per player. Both per difficulty.
const duelKey = d => `blockstrike.duel.${d}`;
const survKey = d => `blockstrike.survival.${d}`;

export function addWin(d, name) {
  const all = load(duelKey(d), {});
  const k = key(name);
  all[k] = { name, wins: (all[k]?.wins || 0) + 1 };
  save(duelKey(d), all);
  return all[k].wins;
}
export const winsFor = (d, name) => load(duelKey(d), {})[key(name)]?.wins || 0;

// Returns { isBest, best } where best is the player's best after this run (or null).
export function recordWaves(d, name, waves) {
  const all = load(survKey(d), {});
  const k = key(name);
  const prev = all[k]?.waves || 0;
  if (waves > prev) {
    all[k] = { name, waves };
    save(survKey(d), all);
    return { isBest: true, best: waves };
  }
  return { isBest: false, best: prev || null };
}

export const duelBoard = d => Object.values(load(duelKey(d), {})).sort((a, b) => b.wins - a.wins);
export const survivalBoard = d => Object.values(load(survKey(d), {})).sort((a, b) => b.waves - a.waves);

// One-off: earlier builds kept each player's best duel result. A winning result becomes 1 win.
for (const d of ['easy', 'normal', 'hard']) {
  const old = load(`blockstrike.best.${d}`, null);
  if (!old) continue;
  const all = load(duelKey(d), {});
  for (const [k, r] of Object.entries(old)) {
    if (r.you > r.bot && !all[k]) all[k] = { name: r.name, wins: 1 };
  }
  save(duelKey(d), all);
  localStorage.removeItem(`blockstrike.best.${d}`);
}
