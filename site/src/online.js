// Talks to the leaderboard API (/api). Each name registered from this browser keeps its
// secret token here, so only this browser can post scores under that name.
const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export const accounts = () => load('blockstrike.accounts', []);
export const current = () => {
  const name = localStorage.getItem('blockstrike.current');
  return accounts().find(a => a.name === name) || null;
};
export const setCurrent = name => localStorage.setItem('blockstrike.current', name);

// Drop a name the server no longer recognises (e.g. removed by hand)
export function forget(name) {
  save('blockstrike.accounts', accounts().filter(a => a.name !== name));
  if (localStorage.getItem('blockstrike.current') === name) localStorage.removeItem('blockstrike.current');
}

async function call(path, body) {
  try {
    const res = await fetch(`/api/${path}`, body
      ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
      : undefined);
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, ...data } : { ok: false, status: res.status, error: data.error || 'Could not reach the leaderboard.' };
  } catch {
    return { ok: false, error: 'Could not reach the leaderboard. Check the internet connection.' };
  }
}

// { ok, name, token } or { ok: false, error }
export async function register(name) {
  const r = await call('register', { name });
  if (r.ok) {
    save('blockstrike.accounts', [...accounts().filter(a => a.name !== r.name), { name: r.name, token: r.token }]);
    setCurrent(r.name);
  }
  return r;
}

export const board = d => call(`board?d=${d}`);

// This player's own duel wins and survival bests per difficulty: { ok, duel, surv }
export async function me() {
  const p = current();
  return p ? call('me', { name: p.name, token: p.token }) : { ok: false };
}

// Ask for a match ticket; returns the ticket string or null.
export async function startMatch(mode, difficulty) {
  const me = current();
  if (!me) return null;
  const r = await call('start', { name: me.name, token: me.token, mode, difficulty });
  return r.ok ? r.ticket : null;
}

export async function finishMatch(ticketPromise, result) {
  const me = current();
  const ticket = await ticketPromise;
  if (!me || !ticket) return { ok: false, error: 'Score not saved (offline).' };
  return call('finish', { name: me.name, token: me.token, ticket, ...result });
}
