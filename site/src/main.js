import * as THREE from 'three';
import { buildWorld, drawPlan } from './world.js';
import { MAPS, mapById, progress, unlockText } from './maps.js';
import { buildNav } from './nav.js';
import { moveEntity, collides } from './physics.js';
import { Bot } from './bot.js';
import { Viewmodel } from './weapon.js';
import { Effects } from './effects.js';
import { Pickups } from './pickups.js';
import { audio } from './audio.js';
import { WEAPONS, CHOICES, GRENADES } from './weapons.js';
import * as names from './names.js';
import * as online from './online.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const fmtTime = s => { s = Math.floor(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

const WIN = 5;
const RESPAWN = 3;
const EYE = 1.62, LOW_EYE = 0.95;
const TALL = 1.8, LOW = 1.0;
const SENS = 0.0022;

// ---------------------------------------------------------------- Renderer & scene
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.autoClear = false;
$('game').appendChild(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 1200);
camera.rotation.order = 'YXZ';
scene.add(camera);

const world = buildWorld(scene, renderer);
const nav = buildNav(world);
const fx = new Effects(scene, world);
const pickups = new Pickups(scene, world);

// ---------------------------------------------------------------- Maps
let stats = null; // this player's duel wins / survival bests, from the server (drives map unlocks)
const isOpen = m => !m.soon && progress(m, stats).open;

function loadMap(map) {
  world.load(map);
  nav.rebuild();
  pickups.setSpots(map.ammo);
  setupPowers();
  fx.clear();
  localStorage.setItem('blockstrike.map', map.id);
  $('map-name').textContent = map.name;
}

async function refreshStats() {
  const r = await online.me();
  if (r.status === 401) { // this computer's key for the name no longer works: pick a name again
    online.forget(online.current()?.name);
    stats = null;
    openNames();
  }
  stats = r.ok ? { duel: r.duel, surv: r.surv } : null;
  if (!isOpen(world.map)) loadMap(MAPS[0]); // e.g. switched to a player who hasn't unlocked it
  if (!$('maps').classList.contains('hidden')) openMaps();
}

// ---- Power-ups (Fort): Speed, Shield or Double Damage, fought over in the middle of the map
const POWERS = {
  speed: { name: 'SPEED', colour: 0xffd23f, time: 12 },
  shield: { name: 'SHIELD', colour: 0x4fc3ff, time: 0 },
  damage: { name: 'DOUBLE DAMAGE', colour: 0xff4d4d, time: 12 },
};
const powerItems = [];
function setupPowers() {
  for (const it of powerItems) scene.remove(it.group);
  powerItems.length = 0;
  for (const pos of world.powers) {
    const group = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 7, 12, 1, true).translate(0, 3.5, 0), new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    group.add(gem, beam);
    group.position.copy(pos);
    scene.add(group);
    const it = { group, gem, beam, pos, type: null, wait: 0 };
    rollPower(it);
    powerItems.push(it);
  }
}
function rollPower(it) {
  it.type = Object.keys(POWERS)[Math.random() * 3 | 0];
  it.gem.material.color.setHex(POWERS[it.type].colour);
  it.beam.material.color.setHex(POWERS[it.type].colour);
  it.group.visible = true;
}
function updatePowers(dt) {
  for (const it of powerItems) {
    if (!it.group.visible) { it.wait -= dt; if (it.wait <= 0) rollPower(it); continue; }
    it.gem.position.y = 0.9 + Math.sin(performance.now() / 300) * 0.12;
    it.gem.rotation.y += dt * 2;
    if (player.alive && Math.hypot(player.pos.x - it.pos.x, player.pos.z - it.pos.z) < 1.3 && Math.abs(player.pos.y - it.pos.y) < 1.5) {
      const P = POWERS[it.type];
      if (it.type === 'shield') player.shield = 50;
      else player.power = { type: it.type, t: P.time };
      it.group.visible = false;
      it.wait = 20;
      audio.pickup();
      $('toast').textContent = `${P.name}!`;
      restartAnim($('toast'), 'show');
    }
  }
  if (player.power) { player.power.t -= dt; if (player.power.t <= 0) player.power = null; }
}
const dmgMult = () => (player.power?.type === 'damage' ? 2 : 1);

const planCache = {};
function openMaps() {
  const grid = $('map-grid');
  grid.innerHTML = '';
  for (const m of MAPS) {
    const card = document.createElement('button');
    card.type = 'button';
    const open = isOpen(m), pr = m.unlock ? progress(m, stats) : null;
    card.className = `map-card ${open ? 'open' : 'locked'} ${world.map === m ? 'sel' : ''}`;
    let pic;
    if (m.soon) {
      pic = '<div class="map-pic soon">?</div>';
    } else {
      if (!planCache[m.id]) {
        const c = document.createElement('canvas');
        c.width = c.height = 150;
        drawPlan(c, m);
        planCache[m.id] = c.toDataURL();
      }
      pic = `<img class="map-pic" src="${planCache[m.id]}" alt="">`;
    }
    let foot;
    if (m.soon) foot = `<div class="map-req">COMING SOON</div><div class="map-sub">${unlockText(m)}</div>`;
    else if (open) foot = `<div class="map-req ok">${world.map === m ? '✓ SELECTED' : 'PLAY HERE'}</div>`;
    else foot = `<div class="map-sub">${unlockText(m)}</div>
      <div class="map-bar"><i style="width:${pr.have / pr.need * 100}%"></i></div><div class="map-count">${pr.have} / ${pr.need}</div>`;
    const feat = m.feature ? `<div class="map-feat">NEW: ${m.feature}</div>` : '';
    card.innerHTML = `${pic}${open || m.soon ? '' : '<div class="lock">🔒</div>'}<div class="map-title">${m.name}</div>${feat}${foot}`;
    if (open) card.addEventListener('click', () => { loadMap(m); closeMaps(); });
    else card.disabled = true;
    grid.appendChild(card);
  }
  $('menu').classList.add('hidden');
  $('maps').classList.remove('hidden');
}

function closeMaps() {
  $('maps').classList.add('hidden');
  $('menu').classList.remove('hidden');
}

loadMap(mapById(localStorage.getItem('blockstrike.map')));
const vm = new Viewmodel(innerWidth / innerHeight);
const muzzleLight = new THREE.PointLight(0xffc877, 0, 12, 2);
muzzleLight.position.set(0.2, -0.1, -0.9);
camera.add(muzzleLight);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = vm.camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  vm.camera.updateProjectionMatrix();
});

// ---------------------------------------------------------------- State
const player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), radius: 0.35, height: TALL, eye: EYE,
  grounded: false, blocked: false, health: 100, alive: true, yaw: 0, pitch: 0,
  lastHurt: -99, stepOffset: 0, stride: 0, deathT: 0, respawnT: 0, power: null, shield: 0, padFlight: false,
  slideT: 0, slideCd: 0, crouched: false,
};
const gun = {
  cd: 0, reloading: false, reloadT: 0, soundStep: 0, recoil: 0, bloom: 0, ads: 0, sprint: false,
  triggerHeld: false, pressed: false, muzzleT: 0, attackT: -1, attackDur: 0.3, throwT: -1,
};
const inv = { slots: [], cur: 0, prev: 1, ammo: {}, grenades: GRENADES };
const grenades = [];

let loadout = { primary: 'rifle', secondary: 'smg', melee: 'knife' };
try { loadout = { ...loadout, ...JSON.parse(localStorage.getItem('blockstrike.loadout')) }; } catch {}
let difficulty = localStorage.getItem('blockstrike.diff') || 'normal';
if (!['easy', 'normal', 'hard', 'extreme'].includes(difficulty)) difficulty = 'normal';
let state = 'menu'; // menu | locking | playing | paused | over
let run = null;
let menuT = 0;

const curId = () => inv.slots[inv.cur];
const curW = () => WEAPONS[curId()];
const curAmmo = () => inv.ammo[curId()];

// ---------------------------------------------------------------- Input
const keys = Object.create(null);
let mouseL = false, mouseR = false, lookDX = 0, lookDY = 0;
let wantSlide = false, wantThrow = false, aimToggle = false;

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (state !== 'playing') return;
  if (e.code === 'KeyR') startReload();
  if (e.code === 'Digit1') switchTo(0);
  if (e.code === 'Digit2') switchTo(1);
  if (e.code === 'Digit3') switchTo(2);
  if (e.code === 'KeyQ') switchTo(inv.prev);
  if (e.code === 'KeyG' && !e.repeat) wantThrow = true;
  if (e.code === 'KeyC' && !e.repeat) wantSlide = true;
  if (e.code === 'KeyE' && !e.repeat) aimToggle = !aimToggle; // E toggles aim; right click is hold-to-aim
  if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'KeyG', 'KeyQ', 'KeyE'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseL = mouseR = aimToggle = false; });
addEventListener('wheel', e => {
  if (state !== 'playing' || Math.abs(e.deltaY) < 4) return;
  switchTo((inv.cur + (e.deltaY > 0 ? 1 : 2)) % 3);
}, { passive: true });
document.addEventListener('mousemove', e => {
  if (state !== 'playing' || document.pointerLockElement !== canvas) return;
  const dx = clamp(e.movementX, -300, 300), dy = clamp(e.movementY, -300, 300);
  const zoom = curW().scope ? 1 - 0.7 * gun.ads : 1 - 0.35 * gun.ads;
  player.yaw -= dx * SENS * zoom;
  player.pitch = clamp(player.pitch - dy * SENS * zoom, -1.5, 1.5);
  lookDX += dx; lookDY += dy;
});
document.addEventListener('mousedown', e => {
  if (state !== 'playing') return;
  if (e.button === 0) { mouseL = true; gun.pressed = true; }
  if (e.button === 2) mouseR = true;
});
document.addEventListener('mouseup', e => {
  if (e.button === 0) mouseL = false;
  if (e.button === 2) mouseR = false;
});
document.addEventListener('contextmenu', e => e.preventDefault());

function requestLock() {
  const fail = () => { if (state === 'locking') showPause(true); };
  try {
    const p = canvas.requestPointerLock({ unadjustedMovement: true });
    if (p && p.catch) {
      p.catch(() => {
        try { const q = canvas.requestPointerLock(); if (q && q.catch) q.catch(fail); } catch { fail(); }
      });
    }
  } catch { fail(); }
}
document.addEventListener('pointerlockerror', () => { if (state === 'locking') showPause(true); });
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked && (state === 'locking' || state === 'paused')) {
    state = 'playing';
    $('pause').classList.add('hidden');
    $('hud').classList.remove('hidden');
  } else if (!locked && state === 'playing') {
    showPause(false);
  }
});

// ---------------------------------------------------------------- Helpers shared with the bot
const ray = new THREE.Ray();
const playerBox = new THREE.Box3();
const tmpV = new THREE.Vector3();

function playerRayHit(origin, dir) {
  const p = player.pos;
  playerBox.min.set(p.x - 0.4, p.y, p.z - 0.4);
  playerBox.max.set(p.x + 0.4, p.y + player.height + 0.05, p.z + 0.4);
  ray.set(origin, dir);
  return ray.intersectBox(playerBox, tmpV) ? tmpV.distanceTo(origin) : null;
}

function spatial(pos) {
  const dx = pos.x - player.pos.x, dz = pos.z - player.pos.z;
  const d = Math.hypot(dx, dz);
  const ang = Math.atan2(-dx, -dz) - player.yaw;
  return { vol: 1 / (1 + d / 10), pan: -Math.sin(ang) * 0.8, far: Math.min(1, d / 45), dist: d };
}

function damagePlayer(amount, fromPos) {
  if (!player.alive || !run || run.ending || window.__game.god) return;
  if (player.shield > 0) { const a = Math.min(player.shield, amount); player.shield -= a; amount -= a; }
  player.health -= amount;
  player.lastHurt = run.time;
  audio.hurt();
  restartAnim($('vignette'), 'hit');
  const rel = Math.atan2(-(fromPos.x - player.pos.x), -(fromPos.z - player.pos.z)) - player.yaw;
  const arrow = document.createElement('div');
  arrow.className = 'dmg';
  arrow.style.setProperty('--rot', `${-rel}rad`);
  arrow.addEventListener('animationend', () => arrow.remove());
  $('dmg-ring').appendChild(arrow);
  if (player.health <= 0) onPlayerKilled();
}

const botCtx = {
  player, colliders: world.colliders, rayWorld: world.rayWorld, los: world.los,
  nav, fx, audio, camera, damagePlayer, playerRayHit, spatial,
  botGrenade: (bot, target) => botGrenade(bot, target),
  applyFeatures: (e, dt) => world.applyFeatures(e, dt),
};

// ---------------------------------------------------------------- Inventory
function resetInventory() {
  inv.slots = [loadout.primary, loadout.secondary, loadout.melee];
  inv.ammo = {};
  for (const id of inv.slots) {
    const w = WEAPONS[id];
    if (w.kind === 'gun') inv.ammo[id] = { mag: w.mag, reserve: w.reserve };
  }
  inv.grenades = GRENADES;
  inv.cur = 0;
  inv.prev = 1;
  Object.assign(gun, { cd: 0, reloading: false, reloadT: 0, recoil: 0, bloom: 0, ads: 0, sprint: false, muzzleT: 0, attackT: -1, throwT: -1, pressed: false });
  vm.setWeapon(curId());
}

function switchTo(i) {
  if (i === inv.cur || !player.alive) return;
  inv.prev = inv.cur;
  inv.cur = i;
  gun.reloading = false;
  gun.attackT = -1;
  gun.cd = Math.max(gun.cd, 0.3);
  gun.bloom = 0;
  aimToggle = false;
  vm.setWeapon(curId());
}

function startReload() {
  const w = curW(), a = curAmmo();
  if (w.kind !== 'gun' || gun.reloading || !player.alive || a.mag === w.mag || a.reserve <= 0) return;
  gun.reloading = true;
  gun.reloadT = 0;
  gun.soundStep = 0;
}

function needsAmmo() {
  if (inv.grenades < GRENADES) return true;
  return inv.slots.some(id => inv.ammo[id] && inv.ammo[id].reserve < WEAPONS[id].reserve);
}

function collectAmmo() {
  for (const id of inv.slots) if (inv.ammo[id]) inv.ammo[id].reserve = WEAPONS[id].reserve;
  inv.grenades = GRENADES;
  audio.pickup();
  $('toast').textContent = '+ AMMO';
  restartAnim($('toast'), 'show');
}

// ---------------------------------------------------------------- Match lifecycle
// Two modes. Duel: you vs one bot, first to 5, both respawn.
// Survival: one life, wave N sends N bots (up to MAX_BOTS), each new wave refills health and ammo.
const MAX_BOTS = 8;

function startMatch(mode) {
  audio.init();
  cleanupMatch();
  run = {
    mode, difficulty, time: 0, bots: [], ending: null, shake: 0,
    you: 0, them: 0, botRespawn: 1,                         // duel
    wave: 0, cleared: 0, toSpawn: 0, spawnT: 0, breakT: 1,  // survival
  };
  run.ticket = online.startMatch(mode, difficulty); // the server's one-use ticket for this match
  spawnPlayer(world.playerSpawn, world.spawnYaw);
  pickups.reset();
  $('dmg-ring').innerHTML = '';
  $('top-duel').classList.toggle('hidden', mode !== 'duel');
  $('top-surv').classList.toggle('hidden', mode !== 'survival');
  $('diff-tag').textContent = difficulty.toUpperCase();
  $('diff-tag').dataset.d = difficulty;
  $('menu').classList.add('hidden');
  $('gameover').classList.add('hidden');
  $('pause').classList.add('hidden');
  $('hud').classList.remove('hidden');
  if (mode === 'duel') showBanner(`FIRST TO ${WIN}`);
  state = 'locking';
  requestLock();
}

function cleanupMatch() {
  if (run) {
    for (const b of run.bots) b.dispose();
    run.bots.length = 0;
  }
  for (const g of grenades) scene.remove(g.mesh);
  grenades.length = 0;
  fx.clear();
}

function spawnPlayer(pos, yaw) {
  player.pos.copy(pos);
  player.vel.set(0, 0, 0);
  Object.assign(player, {
    health: 100, alive: true, yaw, pitch: 0, lastHurt: -99, stepOffset: 0, stride: 0, deathT: 0,
    slideT: 0, slideCd: 0, crouched: false, height: TALL, eye: EYE, power: null, shield: 0, padFlight: false,
  });
  camera.fov = 75;
  camera.updateProjectionMatrix();
  mouseL = mouseR = aimToggle = false;
  resetInventory();
}

// A point on the map far from `from`, out of its sight, and not on top of another bot.
function farSpot(from, fromEye, avoid = []) {
  const e = new THREE.Vector3();
  let list = nav.nodes.filter(n => n.distanceTo(from) > 22 && !world.los(e.set(n.x, 1.6, n.z), fromEye)
    && avoid.every(b => n.distanceTo(b.pos) > 4));
  if (!list.length) list = [...nav.nodes].sort((a, b) => b.distanceTo(from) - a.distanceTo(from)).slice(0, 12);
  return list[Math.random() * list.length | 0];
}

function spawnBot() {
  const p = farSpot(player.pos, new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z), run.bots);
  const b = new Bot(scene, run.difficulty, p);
  run.bots.push(b);
  if (world.map.theme.glowEyes) b.glowEyes();
  if (player.alive) b.startSearch(player.pos, botCtx); // it comes hunting
}

function respawnPlayer() {
  const b = run.bots[0];
  const p = b ? farSpot(b.pos, new THREE.Vector3(b.pos.x, b.pos.y + 1.6, b.pos.z)) : world.playerSpawn;
  spawnPlayer(p, Math.atan2(p.x, p.z)); // face the middle
  $('center-msg').classList.add('hidden');
}

function startWave() {
  run.wave++;
  run.toSpawn = Math.min(run.wave, MAX_BOTS);
  run.spawnT = 0;
  player.health = 100;
  for (const id of inv.slots) if (inv.ammo[id]) inv.ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
  inv.grenades = GRENADES;
  gun.reloading = false;
  showBanner(`WAVE ${run.wave}`);
  audio.wave();
}

function onBotKilled(bot, label) {
  fx.burst(bot.pos, bot.colours);
  bot.dispose();
  run.bots.splice(run.bots.indexOf(bot), 1);
  audio.elim();
  let sub;
  if (run.mode === 'duel') {
    run.you++;
    sub = `${run.you} – ${run.them}`;
    if (run.you >= WIN) run.ending = { t: 1.6 };
    else run.botRespawn = RESPAWN;
  } else {
    const left = run.bots.length + run.toSpawn;
    sub = left ? `${left} LEFT` : 'WAVE CLEARED!';
    if (!left) { run.cleared = run.wave; run.breakT = 3; }
  }
  $('killpop-title').textContent = label;
  $('killpop-pts').textContent = sub;
  restartAnim($('killpop'), 'show');
}

function onPlayerKilled() {
  player.health = 0;
  player.alive = false;
  player.deathT = 0;
  mouseL = mouseR = aimToggle = false;
  gun.ads = 0;
  audio.death();
  if (run.mode === 'duel') {
    run.them++;
    if (run.them >= WIN) run.ending = { t: 1.8 };
    else {
      player.respawnT = RESPAWN;
      $('center-msg').classList.remove('hidden');
    }
  } else {
    run.ending = { t: 1.8 };
  }
}

function showPause(failed) {
  state = 'paused';
  mouseL = mouseR = aimToggle = false;
  $('pause-hint').classList.toggle('hidden', !failed);
  $('pause-sub').textContent = run.mode === 'duel'
    ? 'Leaving ends the duel without a result.'
    : 'Leaving ends the run. Waves you cleared still count.';
  $('pause').classList.remove('hidden');
}

function endMatch() {
  state = 'over';
  mouseL = mouseR = aimToggle = false;
  if (document.pointerLockElement) document.exitPointerLock();
  $('hud').classList.add('hidden');
  $('pause').classList.add('hidden');
  $('center-msg').classList.add('hidden');

  const d = run.difficulty, D = d.toUpperCase();
  const title = $('go-title'), best = $('go-best');
  const saving = text => { best.textContent = text; best.className = 'oldbest'; };
  let save = null;
  if (run.mode === 'duel') {
    const win = run.you >= WIN;
    title.textContent = win ? 'VICTORY!' : 'DEFEAT';
    title.className = win ? 'win' : 'loss';
    $('go-main').innerHTML = `<div class="go-score"><span>${run.you}</span><em>–</em><span>${run.them}</span></div>
      <div class="go-labels"><span>YOU</span><span>BOT</span></div>`;
    saving(win ? 'Saving your win…' : '');
    if (win) {
      audio.victory();
      save = online.finishMatch(run.ticket, { you: run.you, them: run.them }).then(r => {
        if (!r.ok) return saving(r.error);
        best.textContent = `+1 WIN · ${r.wins} ${r.wins === 1 ? 'WIN' : 'WINS'} ON ${D}`;
        best.className = 'newhs';
      });
    } else audio.defeat();
  } else {
    const waves = run.cleared;
    title.textContent = 'YOU SURVIVED';
    title.className = 'win';
    $('go-main').innerHTML = `<div class="go-score"><span>${waves}</span></div>
      <div class="go-labels"><span>${waves === 1 ? 'WAVE' : 'WAVES'}</span></div>`;
    saving('Saving…');
    save = online.finishMatch(run.ticket, { waves }).then(r => {
      if (!r.ok) { audio.defeat(); return saving(r.error); }
      if (r.isBest) { audio.victory(); best.textContent = 'NEW BEST!'; best.className = 'newhs'; }
      else { audio.defeat(); saving(r.best ? `Your best on ${D}: ${r.best} ${r.best === 1 ? 'wave' : 'waves'}` : 'Clear wave 1 to get on the board!'); }
    });
  }
  $('go-time').textContent = `${run.mode === 'duel' ? 'DUEL' : 'SURVIVAL'} · ${D} · ${fmtTime(run.time)}`;
  renderBoards('go', d);
  $('go-unlock').classList.add('hidden');
  if (save) save.then(async () => {
    renderBoards('go', d); // refresh once the result is in
    const before = MAPS.filter(isOpen);
    await refreshStats();
    const fresh = MAPS.filter(m => isOpen(m) && !before.includes(m));
    if (fresh.length) {
      $('go-unlock').textContent = `NEW MAP UNLOCKED: ${fresh.map(m => m.name).join(' + ')}!`;
      $('go-unlock').classList.remove('hidden');
      audio.pickup();
    }
  });
  $('gameover').classList.remove('hidden');
  cleanupMatch();
}

function goHome() {
  state = 'menu';
  if (document.pointerLockElement) document.exitPointerLock();
  cleanupMatch();
  $('gameover').classList.add('hidden');
  $('pause').classList.add('hidden');
  $('hud').classList.add('hidden');
  $('center-msg').classList.add('hidden');
  $('menu').classList.remove('hidden');
  renderBoards('menu', difficulty);
}

// ---------------------------------------------------------------- Per-frame game logic
function update(dt) {
  run.time += dt;
  updatePlayer(dt);
  updateGun(dt);
  updateGrenades(dt);
  if (player.alive) pickups.update(dt, player.pos, needsAmmo, collectAmmo);
  updatePowers(dt);

  for (const b of [...run.bots]) b.update(dt, botCtx);
  separateBots();

  if (!run.ending) {
    if (run.mode === 'duel') {
      if (!run.bots.length) {
        run.botRespawn -= dt;
        if (run.botRespawn <= 0) spawnBot();
      }
      if (!player.alive) {
        player.respawnT -= dt;
        $('respawn-count').textContent = Math.max(1, Math.ceil(player.respawnT));
        if (player.respawnT <= 0) respawnPlayer();
      }
    } else if (player.alive) {
      if (run.toSpawn > 0) {
        run.spawnT -= dt;
        if (run.spawnT <= 0) { spawnBot(); run.toSpawn--; run.spawnT = 0.7; }
      } else if (!run.bots.length) {
        run.breakT -= dt;
        if (run.breakT <= 0) startWave();
      }
    }
  }

  fx.update(dt);
  updateHUD();

  if (run.ending) {
    run.ending.t -= dt;
    if (run.ending.t <= 0) endMatch();
  }
}

// Bots don't collide with each other; nudge them apart so they don't stack up.
function separateBots() {
  const bots = run.bots;
  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const a = bots[i], b = bots[j];
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.9 || d < 1e-4) continue;
      const push = (0.9 - d) * 6, nx = dx / d, nz = dz / d;
      a.vel.x -= nx * push; a.vel.z -= nz * push;
      b.vel.x += nx * push; b.vel.z += nz * push;
    }
  }
}

function updatePlayer(dt) {
  if (!player.alive) {
    player.deathT += dt;
    const k = 1 - Math.pow(1 - Math.min(player.deathT / 0.6, 1), 3);
    camera.position.set(player.pos.x, player.pos.y + player.eye - (player.eye - 0.4) * k, player.pos.z);
    camera.rotation.set(player.pitch * (1 - k), player.yaw, 0.5 * k);
    if (camera.fov !== 75) { camera.fov = 75; camera.updateProjectionMatrix(); }
    return;
  }

  const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const str = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  let wx = -sy * fwd + cy * str, wz = -cy * fwd - sy * str;
  const wl = Math.hypot(wx, wz);
  if (wl > 0) { wx /= wl; wz /= wl; }
  const hs0 = Math.hypot(player.vel.x, player.vel.z);

  // Slide: a burst of speed, low to the ground
  player.slideCd -= dt;
  if (wantSlide) {
    wantSlide = false;
    if (player.grounded && hs0 > 4 && player.slideCd <= 0 && player.slideT <= 0) {
      player.slideT = 0.8;
      player.slideCd = 1.1;
      const boost = Math.max(12.5, hs0 + 3) / hs0;
      player.vel.x *= boost;
      player.vel.z *= boost;
      audio.slide();
    }
  }
  const sliding = player.slideT > 0;

  gun.sprint = !!(keys.ShiftLeft || keys.ShiftRight) && fwd > 0 && !mouseL && gun.ads < 0.5 && !sliding && !player.crouched;
  const melee = curW().kind === 'melee';
  let speed = (gun.sprint ? 9.5 : 7) * (melee ? 1.12 : 1) * (player.power?.type === 'speed' ? 1.35 : 1) - 2.8 * gun.ads;
  if (player.crouched) speed = 3.5;

  if (sliding) {
    player.slideT -= dt;
    const f = Math.exp(-dt * 1.4);
    player.vel.x *= f;
    player.vel.z *= f;
    if (wl > 0) { // a little steering
      player.vel.x += wx * 6 * dt;
      player.vel.z += wz * 6 * dt;
    }
  } else if (player.grounded || (wl > 0 && !player.padFlight)) {
    const t = Math.min(1, (player.grounded ? 14 : 2.5) * dt);
    player.vel.x += (wx * speed - player.vel.x) * t;
    player.vel.z += (wz * speed - player.vel.z) * t;
  }
  if (keys.Space && player.grounded && !player.crouched) {
    player.vel.y = 8.4;
    player.slideT = 0; // slide-jump keeps the momentum
    audio.jump();
  }

  // Stand back up after a slide if there's headroom
  const low = player.slideT > 0;
  if (!low && player.height < TALL) {
    if (collides(player.pos, player.radius, TALL, world.colliders)) player.crouched = true;
    else { player.height = TALL; player.crouched = false; }
  }
  if (low) player.height = LOW;
  player.eye += ((player.height < TALL ? LOW_EYE : EYE) - player.eye) * Math.min(1, dt * 14);

  const wasGrounded = player.grounded, vy = player.vel.y;
  const stepped = moveEntity(player, dt, world.colliders);
  if (player.grounded) player.padFlight = false;
  const ev = world.applyFeatures(player, dt);
  if (ev?.type === 'pad') audio.pad();
  if (ev?.type === 'portal') { player.yaw = ev.exit.yaw; audio.teleport(); restartAnim($('vignette-tp'), 'show'); }
  if (stepped) player.stepOffset -= stepped;
  player.stepOffset *= Math.exp(-dt * 14);
  if (!wasGrounded && player.grounded && vy < -7) audio.footstep(0.5, 0);
  if (player.pos.y < -15) { player.pos.copy(world.playerSpawn); player.vel.set(0, 0, 0); }

  const hs = Math.hypot(player.vel.x, player.vel.z);
  if (player.grounded && hs > 1.5 && !sliding) {
    player.stride += hs * dt;
    if (player.stride > (gun.sprint ? 2.8 : 2.3)) { player.stride = 0; audio.footstep(0.22, (Math.random() - 0.5) * 0.2); }
  }

  if (run.time - player.lastHurt > 4) player.health = Math.min(100, player.health + 25 * dt);

  run.shake *= Math.exp(-dt * 6);
  const sh = run.shake;
  camera.position.set(player.pos.x, player.pos.y + player.eye + player.stepOffset, player.pos.z);
  camera.rotation.set(
    clamp(player.pitch + gun.recoil, -1.55, 1.55) + (Math.random() - 0.5) * sh * 0.05,
    player.yaw + (Math.random() - 0.5) * sh * 0.05,
    (sliding ? 0.06 : 0) + (Math.random() - 0.5) * sh * 0.03,
  );
}

function updateGun(dt) {
  const w = curW(), a = curAmmo();
  const alive = player.alive;
  if (gun.reloading || gun.sprint || w.kind !== 'gun') aimToggle = false;
  const adsTarget = alive && w.kind === 'gun' && (mouseR || aimToggle) && !gun.reloading && !gun.sprint ? 1 : 0;
  gun.ads += (adsTarget - gun.ads) * Math.min(1, dt * 14);
  if (alive) {
    const fov = w.kind === 'gun' ? 75 - (75 - w.adsFov) * gun.ads : 75;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  if (gun.reloading) {
    gun.reloadT += dt;
    const T = w.reload;
    if (gun.soundStep === 0 && gun.reloadT > T * 0.18) { audio.magOut(); gun.soundStep = 1; }
    if (gun.soundStep === 1 && gun.reloadT > T * 0.62) { audio.magIn(); gun.soundStep = 2; }
    if (gun.soundStep === 2 && gun.reloadT > T * 0.85) { audio.bolt(); gun.soundStep = 3; }
    if (gun.reloadT >= T) {
      gun.reloading = false;
      const take = Math.min(w.mag - a.mag, a.reserve);
      a.mag += take;
      a.reserve -= take;
    }
  }

  gun.cd = Math.max(gun.cd - dt, mouseL && w.auto ? -0.1 : 0);
  const pressed = gun.pressed;
  gun.pressed = false;
  if (alive && !run.ending) {
    if (w.kind === 'melee') {
      if ((mouseL || pressed) && gun.cd <= 0) melee(w);
    } else if (!gun.reloading) {
      if (a.mag > 0) {
        if (w.auto && mouseL) {
          while (gun.cd <= 0 && a.mag > 0) { shoot(w, a); gun.cd += w.rate; }
        } else if (!w.auto && pressed && gun.cd <= 0) {
          shoot(w, a);
          gun.cd = w.rate;
        }
      } else if (pressed) {
        audio.empty();
      }
    }
    if (w.kind === 'gun' && a.mag === 0 && !gun.reloading) startReload();
    if (wantThrow) throwGrenade();
  }
  wantThrow = false;
  gun.triggerHeld = mouseL;
  if (!mouseL) gun.recoil *= Math.exp(-dt * 6);
  gun.bloom *= Math.exp(-dt * (mouseL ? 2 : 7));

  if (gun.attackT >= 0) { gun.attackT += dt / gun.attackDur; if (gun.attackT > 1) gun.attackT = -1; }
  if (gun.throwT >= 0) { gun.throwT += dt / 0.45; if (gun.throwT > 1) gun.throwT = -1; }

  gun.muzzleT -= dt;
  muzzleLight.intensity = gun.muzzleT > 0 ? 30 : 0;

  vm.update(dt, {
    speed: Math.hypot(player.vel.x, player.vel.z), grounded: player.grounded, ads: gun.ads,
    sprint: gun.sprint, slide: player.slideT > 0, reload: gun.reloading ? gun.reloadT / w.reload : -1,
    attack: gun.attackT, throwT: gun.throwT, lookDX, lookDY,
  });
  lookDX = lookDY = 0;
}

function aimBasis() {
  camera.rotation.set(clamp(player.pitch + gun.recoil, -1.55, 1.55), player.yaw, 0);
  camera.updateMatrixWorld();
  const q = camera.quaternion;
  return {
    origin: camera.position.clone(),
    fwd: new THREE.Vector3(0, 0, -1).applyQuaternion(q),
    right: new THREE.Vector3(1, 0, 0).applyQuaternion(q),
    up: new THREE.Vector3(0, 1, 0).applyQuaternion(q),
  };
}

const shotRay = new THREE.Ray();
function shoot(w, a) {
  a.mag--;
  const hs = Math.hypot(player.vel.x, player.vel.z);
  const ads = gun.ads;
  const spread = (w.spread + gun.bloom) * (1 - 0.75 * ads) + w.hip * (1 - ads)
    + (hs / 7) * w.moveSpread * (1 - 0.6 * ads)
    + (player.grounded ? 0 : 0.035);
  // aim first, then kick: the bullet goes where you were looking
  const { origin, fwd, right, up } = aimBasis();
  gun.bloom = Math.min(gun.bloom + w.bloomAdd, w.bloomMax);
  gun.recoil = Math.min(gun.recoil + w.recoil * (1 - 0.35 * ads), 0.12);
  player.yaw += (Math.random() - 0.5) * 0.004;
  const dir = fwd.clone().addScaledVector(right, gauss() * spread).addScaledVector(up, gauss() * spread).normalize();
  shotRay.set(origin, dir);
  const wh = world.rayWorld(origin, dir, 400);
  let bot = null, bh = null;
  for (const b of run.bots) {
    const h = b.alive && b.hitTest(shotRay);
    if (h && (!bh || h.dist < bh.dist)) { bh = h; bot = b; }
  }
  let end;
  if (bh && (!wh || bh.dist < wh.dist)) {
    end = bh.point;
    const killed = bot.takeDamage((bh.head ? w.dmg * w.headMult : w.dmg) * dmgMult(), player.pos, botCtx);
    fx.hit(bh.point);
    hitFeedback(bh.head, killed);
    if (killed) onBotKilled(bot, bh.head ? 'HEADSHOT!' : 'ELIMINATED');
  } else if (wh) {
    end = wh.point;
    fx.impact(wh.point, wh.normal);
  } else {
    end = origin.clone().addScaledVector(dir, 200);
  }

  const k = 1 - ads;
  const muzzle = origin.clone().addScaledVector(fwd, 0.8).addScaledVector(right, 0.22 * k).addScaledVector(up, -0.17 * k - 0.04);
  fx.tracer(muzzle, end);
  vm.fire(w.scope ? 2 : 1);
  audio.gunshot(0.85, 0, 0, w.sound);
  gun.muzzleT = 0.05;
  for (const b of run.bots) if (b.pos.distanceTo(player.pos) < 45) b.hear(player.pos, botCtx);
}

function melee(w) {
  gun.cd = w.rate;
  gun.attackT = 0;
  gun.attackDur = Math.min(0.3, w.rate * 0.9);
  if (w === WEAPONS.fists) vm.punch();
  audio.swing();

  // Nearest bot in reach and roughly in front of you
  const { origin, fwd } = aimBasis();
  let bot = null, chest = null, to = null, best = Infinity;
  for (const b of run.bots) {
    if (!b.alive) continue;
    const c = new THREE.Vector3(b.pos.x, b.pos.y + 1.1, b.pos.z);
    const t = c.clone().sub(origin);
    const hd = Math.hypot(t.x, t.z);
    if (hd > w.range + 0.4 || Math.abs(t.y) > 1.6 || hd >= best) continue;
    const angle = Math.acos(clamp(fwd.dot(t.clone().normalize()), -1, 1));
    if (angle > 0.75 && hd > 0.9) continue;
    if (!world.los(origin, c)) continue;
    bot = b; chest = c; to = t; best = hd;
  }
  if (!bot) return;

  // Knife in the back, or a knife while sliding, is an instant elimination.
  const rel = new THREE.Vector3(player.pos.x - bot.pos.x, 0, player.pos.z - bot.pos.z).normalize();
  const behind = -Math.sin(bot.yaw) * rel.x + -Math.cos(bot.yaw) * rel.z < 0;
  const backstab = w.backstab && (behind || player.slideT > 0);
  const killed = bot.takeDamage(backstab ? 999 : w.dmg * dmgMult(), player.pos, botCtx);
  fx.hit(chest.clone().addScaledVector(to.normalize(), -0.4));
  if (w === WEAPONS.fists) audio.punch(); else audio.stab(backstab);
  hitFeedback(false, killed);
  if (killed) onBotKilled(bot, backstab ? 'BACKSTAB!' : 'ELIMINATED');
}

function hitFeedback(head, killed) {
  audio.hit(head);
  const hm = $('hitmarker');
  hm.classList.toggle('head', head);
  hm.classList.toggle('kill', killed);
  restartAnim(hm, 'show');
}

// ---------------------------------------------------------------- Grenades
const nadeGeo = new THREE.SphereGeometry(0.1, 12, 8);
const nadeMat = new THREE.MeshStandardMaterial({ color: 0x3f5a2a, roughness: 0.6 });
const nadeBand = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0xffd23f }));

function throwGrenade() {
  if (inv.grenades <= 0 || gun.throwT >= 0) return;
  inv.grenades--;
  gun.throwT = 0;
  audio.throwG();
  const { origin, fwd } = aimBasis();
  const vel = fwd.clone().multiplyScalar(17).add(new THREE.Vector3(0, 3.5, 0)).addScaledVector(player.vel, 0.5);
  addGrenade(origin.clone().addScaledVector(fwd, 0.5), vel, 'player');
}

function addGrenade(pos, vel, owner) {
  const mesh = new THREE.Mesh(nadeGeo, nadeMat);
  mesh.add(nadeBand.clone());
  mesh.castShadow = true;
  mesh.position.copy(pos);
  scene.add(mesh);
  grenades.push({ mesh, pos, vel, fuse: 1.8, owner });
}

// A bot lobs a grenade in an arc so it lands about where it last saw you
function botGrenade(bot, target) {
  const from = new THREE.Vector3(bot.pos.x, bot.pos.y + 1.7, bot.pos.z);
  const dx = target.x - from.x, dz = target.z - from.z, dy = target.y + 0.1 - from.y;
  const T = clamp(Math.hypot(dx, dz) / 10, 0.9, 1.6); // a high arc, to clear walls
  const vel = new THREE.Vector3(dx / T, (dy + 0.5 * 24 * T * T) / T, dz / T);
  addGrenade(from, vel, 'bot');
  const sp = spatial(bot.pos);
  audio.throwG(sp.vol);
}

function insideLevel(p, r) {
  for (const b of world.colliders) {
    if (p.x > b.min.x - r && p.x < b.max.x + r && p.y > b.min.y - r && p.y < b.max.y + r && p.z > b.min.z - r && p.z < b.max.z + r) return true;
  }
  return false;
}

function updateGrenades(dt) {
  // warn about a bot's grenade landing near you
  const near = player.alive && grenades.some(g => g.owner === 'bot' && g.pos.distanceTo(player.pos) < 8);
  $('nade-warn').classList.toggle('hidden', !near);
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.vel.y -= 24 * dt;
    for (const ax of ['x', 'y', 'z']) {
      g.pos[ax] += g.vel[ax] * dt;
      if (insideLevel(g.pos, 0.1)) {
        g.pos[ax] -= g.vel[ax] * dt;
        if (Math.abs(g.vel[ax]) > 3) audio.bounce(spatial(g.pos).vol * 0.5);
        g.vel[ax] *= -0.35;
        if (ax === 'y') { g.vel.x *= 0.7; g.vel.z *= 0.7; }
      }
    }
    g.mesh.position.copy(g.pos);
    g.mesh.rotation.x += dt * 8;
    g.fuse -= dt;
    if (g.fuse <= 0) {
      explode(g.pos, g.owner);
      scene.remove(g.mesh);
      grenades.splice(i, 1);
    }
  }
}

function explode(pos, owner) {
  fx.explosion(pos);
  const sp = spatial(pos);
  audio.explosion(Math.min(1, sp.vol * 1.6), sp.pan);
  run.shake = Math.max(run.shake, Math.max(0, 1 - sp.dist / 18) * 1.2);
  const R = 6.5;
  const from = new THREE.Vector3(pos.x, pos.y + 0.3, pos.z);
  const blast = d => Math.round(130 * Math.pow(1 - d / R, 0.7));
  if (owner === 'bot') { // bot grenades hurt you, not other bots
    const chest = new THREE.Vector3(player.pos.x, player.pos.y + 1.1, player.pos.z);
    const d = chest.distanceTo(pos);
    if (player.alive && d < R && world.los(from, chest)) damagePlayer(blast(d), pos);
    return;
  }
  let hit = false, anyKill = false;
  for (const bot of [...run.bots]) {
    if (!bot.alive) continue;
    const chest = new THREE.Vector3(bot.pos.x, bot.pos.y + 1.1, bot.pos.z);
    const d = chest.distanceTo(pos);
    if (d > R || !world.los(from, chest)) {
      if (d < 25) bot.hear(player.pos, botCtx);
      continue;
    }
    hit = true;
    const killed = bot.takeDamage(blast(d), pos, botCtx);
    if (killed) { anyKill = true; onBotKilled(bot, 'GRENADE!'); }
  }
  if (hit) hitFeedback(false, anyKill);
}

// ---------------------------------------------------------------- HUD
const hudCache = {};
function setText(id, v) {
  if (hudCache[id] === v) return;
  hudCache[id] = v;
  $(id).textContent = v;
}

function updateHUD() {
  const hp = Math.ceil(player.health);
  setText('health-num', hp);
  const pw = player.power ? `${POWERS[player.power.type].name} ${Math.ceil(player.power.t)}s` : '';
  setText('power-hud', [pw, player.shield > 0 ? `SHIELD ${Math.ceil(player.shield)}` : ''].filter(Boolean).join(' · '));
  const fill = $('health-fill');
  fill.style.width = `${player.health}%`;
  fill.style.background = hp > 60 ? '#4ade80' : hp > 30 ? '#facc15' : '#f87171';
  $('lowhp').style.opacity = hp < 35 && player.alive ? String((35 - hp) / 35 * 0.9) : '0';

  if (run.mode === 'duel') {
    setText('sc-you', String(run.you));
    setText('sc-bot', String(run.them));
  } else {
    setText('sv-wave', String(Math.max(1, run.wave)));
    setText('sv-left', String(run.bots.length + run.toSpawn));
  }

  const w = curW(), a = curAmmo();
  setText('wpn-name', w.name);
  if (w.kind === 'gun') {
    setText('ammo-num', gun.reloading ? '--' : String(a.mag));
    setText('ammo-res', `/ ${a.reserve}`);
    $('ammo-num').classList.toggle('low', !gun.reloading && a.mag <= Math.ceil(w.mag / 4));
  } else {
    setText('ammo-num', '');
    setText('ammo-res', '');
  }
  $('reload-bar').style.visibility = gun.reloading ? 'visible' : 'hidden';
  $('reload-fill').style.width = `${gun.reloading ? gun.reloadT / w.reload * 100 : 0}%`;
  const slotsKey = `${inv.cur}|${inv.grenades}`;
  if (hudCache.slots !== slotsKey) {
    hudCache.slots = slotsKey;
    $('slots').innerHTML = inv.slots.map((id, i) =>
      `<span class="${i === inv.cur ? 'on' : ''}"><b>${i + 1}</b>${WEAPONS[id].short}</span>`).join('')
      + `<span class="nade ${inv.grenades ? '' : 'empty'}"><b>G</b>GRENADE ×${inv.grenades}</span>`;
  }

  const out = w.kind === 'gun' && a.mag === 0 && a.reserve === 0;
  $('hint').classList.toggle('hidden', !out || !player.alive);

  const scoped = w.scope && gun.ads > 0.85 && player.alive;
  $('scope').classList.toggle('hidden', !scoped);
  const hs = Math.hypot(player.vel.x, player.vel.z);
  const spread = w.kind === 'gun' ? (w.spread + gun.bloom) + w.hip + (hs / 7) * w.moveSpread + (player.grounded ? 0 : 0.035) : 0;
  const ch = $('crosshair');
  ch.style.setProperty('--gap', `${5 + spread * 500}px`);
  ch.style.opacity = (w.kind === 'gun' && gun.ads > 0.6) || gun.sprint || !player.alive ? '0' : '1';
}

function restartAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function showBanner(text) {
  $('banner').textContent = text;
  restartAnim($('banner'), 'show');
}

// ---------------------------------------------------------------- Menus
function esc(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Leaderboard: duel wins and survival best wave, side by side, for one difficulty.
// prefix is 'menu' or 'go' (the home screen or the end screen).
// Leaderboard from the server: duel wins and survival best wave, side by side, for one difficulty.
// prefix is 'menu' or 'go' (the home screen or the end screen).
const boardCache = {};
let boardReq = 0;
async function renderBoards(prefix, d) {
  document.querySelectorAll('.board-diff').forEach(e => { e.textContent = d.toUpperCase(); });
  const me = names.key(online.current()?.name || '');
  const rows = (list, value, empty) => list.length
    ? list.map((e, i) => `<li class="${names.key(e.name) === me ? 'me' : ''}"><span class="rank">${i + 1}</span>
        <span class="name">${esc(e.name)}</span><span class="val">${value(e)}</span></li>`).join('')
    : `<li class="empty">${empty}</li>`;
  const show = b => {
    $(`${prefix}-duel`).innerHTML = rows(b.duel, e => e.wins, 'No wins yet');
    $(`${prefix}-surv`).innerHTML = rows(b.survival, e => e.waves, 'No waves yet');
  };
  if (boardCache[d]) show(boardCache[d]);
  else for (const c of ['duel', 'surv']) $(`${prefix}-${c}`).innerHTML = '<li class="empty">Loading…</li>';
  const req = ++boardReq;
  const b = await online.board(d);
  if (req !== boardReq && prefix === 'menu') return; // a newer request (e.g. difficulty switch) is on its way
  if (b.ok) { boardCache[d] = b; show(b); }
  else if (!boardCache[d]) for (const c of ['duel', 'surv']) $(`${prefix}-${c}`).innerHTML = '<li class="empty">Leaderboard offline</li>';
}

function selectDifficulty(d) {
  difficulty = d;
  localStorage.setItem('blockstrike.diff', d);
  document.querySelectorAll('#diff button').forEach(b => b.classList.toggle('sel', b.dataset.d === d));
  renderBoards('menu', d);
}

function renderLoadout() {
  document.querySelectorAll('.choice').forEach(c => {
    c.querySelectorAll('button').forEach(b => b.classList.toggle('sel', loadout[c.dataset.slot] === b.dataset.w));
  });
}

document.querySelectorAll('.choice button').forEach(b => b.addEventListener('click', () => {
  const slot = b.parentElement.dataset.slot;
  if (!CHOICES[slot].includes(b.dataset.w)) return;
  loadout[slot] = b.dataset.w;
  localStorage.setItem('blockstrike.loadout', JSON.stringify(loadout));
  renderLoadout();
}));
document.querySelectorAll('#diff button').forEach(b => b.addEventListener('click', () => selectDifficulty(b.dataset.d)));

// ---- Who's playing
// Names are registered with the server; each one is owned by the browser that registered it.
function openNames() {
  const list = online.accounts();
  const cur = online.current();
  $('player-list').innerHTML = list.map(a =>
    `<button type="button" class="${cur && a.name === cur.name ? 'sel' : ''}" data-n="${esc(a.name)}">${esc(a.name)}</button>`).join('');
  $('player-list').classList.toggle('hidden', !list.length);
  $('player-list').querySelectorAll('button').forEach(b => b.addEventListener('click', () => choosePlayer(b.dataset.n)));
  $('name-title').textContent = list.length ? "WHO'S PLAYING?" : "WHAT'S YOUR NAME?";
  $('name-new-label').classList.toggle('hidden', !list.length);
  $('name-cancel').classList.toggle('hidden', !cur);
  // A name picked before the online leaderboard existed is offered again
  $('name-input').value = list.length ? '' : (localStorage.getItem('blockstrike.current') || '');
  $('name-error').textContent = '';
  $('menu').classList.add('hidden'); // the name card stands alone, not on top of the home screen
  $('names').classList.remove('hidden');
  setTimeout(() => $('name-input').focus(), 30);
}

function closeNames() {
  $('names').classList.add('hidden');
  $('menu').classList.remove('hidden');
}

function choosePlayer(n) {
  online.setCurrent(n);
  $('player-name').textContent = n;
  closeNames();
  renderBoards('menu', difficulty);
  refreshStats();
}

$('name-form').addEventListener('submit', async e => {
  e.preventDefault();
  const raw = $('name-input').value;
  const err = names.check(raw, online.accounts().map(a => a.name));
  if (err) { $('name-error').textContent = err; return; }
  const btn = $('name-form').querySelector('button');
  btn.disabled = true;
  $('name-error').textContent = '';
  const r = await online.register(names.tidy(raw));
  btn.disabled = false;
  if (!r.ok) { $('name-error').textContent = r.error; return; }
  choosePlayer(r.name);
});
$('name-input').addEventListener('input', () => { $('name-error').textContent = ''; });
$('name-cancel').addEventListener('click', closeNames);
$('player-chip').addEventListener('click', openNames);

const play = mode => { if (!online.current()) openNames(); else startMatch(mode); };
$('duel-btn').addEventListener('click', () => play('duel'));
$('surv-btn').addEventListener('click', () => play('survival'));
$('resume-btn').addEventListener('click', () => { state = 'locking'; requestLock(); });
$('quit-btn').addEventListener('click', () => (run.mode === 'survival' ? endMatch() : goHome()));
$('again-btn').addEventListener('click', () => startMatch(run.mode));
$('home-btn').addEventListener('click', goHome);
$('map-btn').addEventListener('click', openMaps);
$('maps-close').addEventListener('click', closeMaps);

selectDifficulty(difficulty);
renderLoadout();
// (Phones and tablets never get here: boot.js sends them to the leaderboard-only page.)
if (online.current()) {
  $('player-name').textContent = online.current().name;
  refreshStats();
} else openNames();

// ---------------------------------------------------------------- Main loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (state === 'playing') update(dt);
  else if (state === 'menu' || state === 'over') {
    menuT += dt;
    const a = menuT * 0.05;
    camera.position.set(Math.sin(a) * 40, 19, Math.cos(a) * 40);
    camera.lookAt(0, 1.5, 0);
    if (camera.fov !== 75) { camera.fov = 75; camera.updateProjectionMatrix(); }
    fx.update(dt);
    pickups.update(dt, new THREE.Vector3(999, 0, 999), () => false, () => {});
  }

  world.sky.position.copy(camera.position);
  world.update(dt);
  renderer.clear();
  renderer.render(scene, camera);
  const scoped = curId() && curW().scope && gun.ads > 0.85;
  if ((state === 'playing' || state === 'paused' || state === 'locking') && player.alive && !scoped) {
    renderer.clearDepth();
    renderer.render(vm.scene, vm.camera);
  }
}
requestAnimationFrame(frame);

// exposed for testing from the browser console
window.__game = {
  player, gun, inv, camera, world, nav, grenades, god: false, loadMap, MAPS,
  get stats() { return stats; },
  get run() { return run; }, get state() { return state; },
};
