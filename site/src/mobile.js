// The page phones and tablets see: why they can't play, the link to use on a computer,
// and the leaderboard for every difficulty.
import * as online from './online.js';

const DIFFS = ['easy', 'normal', 'hard', 'extreme'];
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function show(reason) {
  const el = document.getElementById('mobile');
  const link = location.host + location.pathname.replace(/index\.html$/, '');
  const why = reason === 'nogame'
    ? "This browser can't run the 3D game. Try Chrome, Edge, Firefox or Safari on a laptop or desktop."
    : 'Block Strike needs a keyboard and mouse, so it only plays on a laptop or desktop computer.';
  el.innerHTML = `
    <h1 class="logo small">BLOCK<span>STRIKE</span></h1>
    <div class="card m-card">
      <h2>PLAY ON A COMPUTER</h2>
      <p class="lead">${why}</p>
      <div class="m-link"><span>${esc(link)}</span><button type="button" id="m-copy">COPY LINK</button></div>
    </div>
    <div class="card m-card">
      <h2 class="m-board-title">LEADERBOARD</h2>
      <div class="diff m-tabs">${DIFFS.map(d => `<button type="button" data-d="${d}">${d.toUpperCase()}</button>`).join('')}</div>
      <div class="board-cols">
        <div><h3>DUEL WINS</h3><ol id="m-duel"></ol></div>
        <div><h3>SURVIVAL WAVES</h3><ol id="m-surv"></ol></div>
      </div>
    </div>`;
  el.classList.remove('hidden');

  const copy = document.getElementById('m-copy');
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(`https://${link}`); copy.textContent = 'COPIED!'; }
    catch { copy.textContent = 'COPY FAILED'; }
    setTimeout(() => { copy.textContent = 'COPY LINK'; }, 1800);
  });

  const cache = {};
  let current = localStorage.getItem('blockstrike.diff');
  if (!DIFFS.includes(current)) current = 'normal';
  const rows = (list, value, empty) => list.length
    ? list.map((e, i) => `<li><span class="rank">${i + 1}</span><span class="name">${esc(e.name)}</span><span class="val">${value(e)}</span></li>`).join('')
    : `<li class="empty">${empty}</li>`;
  async function select(d) {
    current = d;
    el.querySelectorAll('.m-tabs button').forEach(b => b.classList.toggle('sel', b.dataset.d === d));
    const put = b => {
      document.getElementById('m-duel').innerHTML = rows(b.duel, e => e.wins, 'No wins yet');
      document.getElementById('m-surv').innerHTML = rows(b.survival, e => e.waves, 'No waves yet');
    };
    if (cache[d]) put(cache[d]);
    else ['m-duel', 'm-surv'].forEach(id => { document.getElementById(id).innerHTML = '<li class="empty">Loading…</li>'; });
    const b = await online.board(d);
    if (current !== d) return;
    if (b.ok) { cache[d] = b; put(b); }
    else if (!cache[d]) ['m-duel', 'm-surv'].forEach(id => { document.getElementById(id).innerHTML = '<li class="empty">Leaderboard offline</li>'; });
  }
  el.querySelectorAll('.m-tabs button').forEach(b => b.addEventListener('click', () => select(b.dataset.d)));
  select(current);
}
