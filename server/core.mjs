// Leaderboard API. Runs as a Netlify Function in production and inside dev-server.mjs locally.
// `store` is a Netlify Blobs store (or the local stand-in with the same methods).
//
// Anti-cheat, in short: a name is owned by the browser that registered it (secret token);
// every result needs a one-use match ticket from the server; results must be possible
// (a duel win is 5 kills and takes a real match's time; survival waves must fit the run time);
// and each player can only submit so many results an hour. It stops casual cheating,
// not a determined programmer; bad entries can be removed by deleting that player's blob.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { check, key as nameKey, tidy } from '../site/src/names.js';

const DIFFS = ['easy', 'normal', 'hard', 'extreme'];
const MODES = ['duel', 'survival'];
const BOARD_SIZE = 20;
const MIN_DUEL_WIN_SECS = 30;
const MIN_SECS_PER_WAVE = 4;
const MAX_RESULTS_PER_HOUR = 30;
const TICKET_LIFE_MS = 3 * 3600e3;

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
const hash = t => createHash('sha256').update(t).digest('hex');
const pkey = name => `p/${nameKey(name)}`;

async function readBody(req) {
  try { return await req.json(); } catch { return {}; }
}

async function auth(store, name, token) {
  if (typeof name !== 'string' || typeof token !== 'string' || !name || !token) return null;
  const p = await store.get(pkey(name), { type: 'json' });
  if (!p) return null;
  const a = Buffer.from(hash(token)), b = Buffer.from(p.tokenHash);
  return a.length === b.length && timingSafeEqual(a, b) ? p : null;
}

async function board(store, d) {
  const { blobs } = await store.list({ prefix: 'p/' });
  const players = (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean);
  const duel = players.filter(p => p.duel?.[d] > 0).map(p => ({ name: p.name, wins: p.duel[d] }))
    .sort((a, b) => b.wins - a.wins).slice(0, BOARD_SIZE);
  const survival = players.filter(p => p.surv?.[d] > 0).map(p => ({ name: p.name, waves: p.surv[d] }))
    .sort((a, b) => b.waves - a.waves).slice(0, BOARD_SIZE);
  return { duel, survival };
}

export async function handle(req, store, now = Date.now()) {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/?/, '');

  if (req.method === 'GET' && route === 'board') {
    const d = url.searchParams.get('d');
    return json(200, await board(store, DIFFS.includes(d) ? d : 'normal'));
  }
  if (req.method !== 'POST') return json(405, { error: 'Not allowed.' });
  const body = await readBody(req);

  if (route === 'register') {
    const name = tidy(String(body.name || ''));
    const err = check(name, []);
    if (err) return json(400, { error: err });
    if (await store.get(pkey(name), { type: 'json' })) {
      return json(409, { error: 'That name is taken. Pick another.' });
    }
    const token = randomBytes(24).toString('base64url');
    await store.setJSON(pkey(name), { name, tokenHash: hash(token), created: now, duel: {}, surv: {}, tickets: {}, recent: [] });
    return json(200, { name, token });
  }

  const p = await auth(store, body.name, body.token);
  if (!p) return json(401, { error: 'Unknown player. Pick your name again.' });
  p.duel ||= {}; p.surv ||= {}; p.tickets ||= {}; p.recent ||= [];

  if (route === 'start') {
    if (!MODES.includes(body.mode) || !DIFFS.includes(body.difficulty)) return json(400, { error: 'Bad match.' });
    const kept = Object.entries(p.tickets).filter(([, t]) => now - t.t < TICKET_LIFE_MS).slice(-4);
    const ticket = randomBytes(12).toString('base64url');
    p.tickets = Object.fromEntries([...kept, [ticket, { mode: body.mode, d: body.difficulty, t: now }]]);
    await store.setJSON(pkey(p.name), p);
    return json(200, { ticket });
  }

  if (route === 'finish') {
    const t = p.tickets[body.ticket];
    if (!t || now - t.t > TICKET_LIFE_MS) return json(400, { error: 'That match has expired.' });
    delete p.tickets[body.ticket]; // one use only
    p.recent = p.recent.filter(x => now - x < 3600e3);
    if (p.recent.length >= MAX_RESULTS_PER_HOUR) {
      await store.setJSON(pkey(p.name), p);
      return json(429, { error: 'Too many results this hour.' });
    }
    p.recent.push(now);
    const secs = (now - t.t) / 1000;

    if (t.mode === 'duel') {
      const ok = body.you === 5 && Number.isInteger(body.them) && body.them >= 0 && body.them <= 4 && secs >= MIN_DUEL_WIN_SECS;
      if (!ok) { await store.setJSON(pkey(p.name), p); return json(400, { error: 'Result not accepted.' }); }
      p.duel[t.d] = (p.duel[t.d] || 0) + 1;
      await store.setJSON(pkey(p.name), p);
      return json(200, { wins: p.duel[t.d] });
    }

    const w = body.waves;
    const ok = Number.isInteger(w) && w >= 0 && w <= 200 && secs >= w * MIN_SECS_PER_WAVE;
    if (!ok) { await store.setJSON(pkey(p.name), p); return json(400, { error: 'Result not accepted.' }); }
    const prev = p.surv[t.d] || 0;
    if (w > prev) p.surv[t.d] = w;
    await store.setJSON(pkey(p.name), p);
    return json(200, { best: Math.max(w, prev), isBest: w > prev && w > 0 });
  }

  return json(404, { error: 'Not found.' });
}
