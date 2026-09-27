import * as THREE from 'three';
import { moveEntity } from './physics.js';
import { flashTexture } from './effects.js';

// Tuning per difficulty. spread = aim wobble (radians), track = how quickly it follows you,
// reaction = pause before the first shot after spotting you; speed scales how fast it moves.
// damage is per assault-rifle bullet (other weapons scale from it); sniperDmg is per sniper hit.
// sniper = always carries the sniper as its main weapon (still switches up close); alert = reacts instantly when shot; restless = never stands still in a fight, changes direction more often,
// and jumps more, so it's a hard target at range. (Bot health stays 100 so the sniper is always one hit, one kill.)
// weapons = what bots may spawn with (switching bots carry a primary, a secondary and a knife, and change by distance); nades = grenades per life; regen = heals out of combat like you do.
export const DIFF = {
  easy:    { reaction: 0.9,  spread: 0.055, track: 4.5, damage: 8,  burst: [2, 4],  pause: [0.7, 1.2],  speed: 0.8,
             weapons: ['rifle'], nades: 0, regen: false, sniperDmg: 0 },
  normal:  { reaction: 0.55, spread: 0.036, track: 7,   damage: 11, burst: [3, 6],  pause: [0.45, 0.8], speed: 0.9,
             weapons: ['rifle', 'smg', 'pistol'], nades: 0, regen: false, sniperDmg: 0 },
  hard:    { reaction: 0.22, spread: 0.017, track: 15,  damage: 18, burst: [6, 12], pause: [0.2, 0.4],  speed: 1,
             weapons: ['rifle', 'smg', 'pistol', 'sniper'], nades: 1, regen: true, sniperDmg: 75, switching: true },
  extreme: { reaction: 0.09, spread: 0.006, track: 30,  damage: 26, burst: [10, 20], pause: [0.08, 0.18], speed: 1.25,
             weapons: ['rifle', 'smg', 'pistol', 'sniper'], nades: 2, regen: true, sniperDmg: 100, switching: true,
             alert: true, restless: true, sniper: true },
};

// How each weapon behaves in a bot's hands. dmg and spread multiply the difficulty's values;
// range = distances it likes to fight at; sniper bots stand still and show a laser while aiming.
const BOT_WEAPONS = {
  rifle:  { rate: 0.1,   dmg: 1,   spread: 1,   mag: 30, reload: 2.2, burst: 1,   range: [0, 24],  len: 0.8,  colour: 0x2a2a2a, sound: 'rifle' },
  smg:    { rate: 0.065, dmg: 0.6, spread: 1.4, mag: 25, reload: 1.8, burst: 1.5, range: [0, 10],  len: 0.55, colour: 0xff8a3d, sound: 'smg' },
  pistol: { rate: 0.32,  dmg: 1.8, spread: 0.9, mag: 8,  reload: 1.5, burst: 0.4, range: [0, 18],  len: 0.4,  colour: 0x3a3f48, sound: 'pistol' },
  knife:  { rate: 0.7,   dmg: 0,   spread: 0,   mag: 1,  reload: 0,   burst: 0,   range: [0, 0],   len: 0.22, colour: 0xd9dee5, melee: true },
  sniper: { rate: 1.3,   dmg: 0,   spread: 0.3, mag: 5,  reload: 2.6, burst: 0,   range: [16, 60], len: 1.15, colour: 0x56663f, sound: 'sniper', aimTime: 0.9 },
};

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = ([a, b]) => Math.floor(rand(a, b + 1));
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const angDiff = (a, b) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

const GEO = {
  leg: new THREE.BoxGeometry(0.28, 0.85, 0.3).translate(0, -0.425, 0),
  torso: new THREE.BoxGeometry(0.72, 0.7, 0.42),
  head: new THREE.BoxGeometry(0.48, 0.48, 0.48),
  eye: new THREE.BoxGeometry(0.1, 0.1, 0.02),
  arm: new THREE.BoxGeometry(0.2, 0.2, 0.62),
  gun: new THREE.BoxGeometry(0.1, 0.15, 0.8),
  mag: new THREE.BoxGeometry(0.07, 0.2, 0.1),
  bar: new THREE.PlaneGeometry(0.9, 0.1),
  barFill: new THREE.PlaneGeometry(0.86, 0.06).translate(0.43, 0, 0),
};

export class Bot {
  constructor(scene, difficulty, pos) {
    const b = DIFF[difficulty];
    this.p = { ...b };
    const pick = list => list[Math.random() * list.length | 0];
    const primary = b.sniper ? 'sniper' : pick(['rifle', 'sniper']);
    this.loadout = b.switching ? { primary, secondary: pick(['smg', 'pistol']) } : null;
    this.weapon = this.loadout ? this.loadout.primary : pick(b.weapons);
    this.w = BOT_WEAPONS[this.weapon];
    this.ammoOf = {}; this.switchCd = 0;
    this.nades = b.nades; this.nadeCd = 3; this.aimT = 0; this.sinceHurt = 99;
    this.scene = scene;
    this.pos = pos.clone();
    this.vel = new THREE.Vector3();
    this.radius = 0.4; this.height = 1.95;
    this.grounded = false; this.blocked = false;
    this.maxHealth = b.health || 100;
    this.health = this.maxHealth; this.alive = true;
    this.yaw = Math.atan2(pos.x, pos.z); // roughly facing the middle
    this.pitch = 0;
    this.state = 'patrol';
    this.path = [];
    this.lastSeen = new THREE.Vector3();
    this.lostTimer = 0; this.reactTimer = 0; this.searchTimer = null; this.patrolTimer = 0;
    this.strafeDir = 1; this.strafeTimer = 0;
    this.lookTarget = new THREE.Vector3(); this.lookTimer = 0;
    this.ammo = this.w.mag; this.reloading = 0; this.fireCd = 0; this.burstLeft = this.newBurst(); this.burstPause = 0;
    this.hearCd = 0;
    this.stuckTimer = 0; this.stuckFrom = this.pos.clone();
    this.walkPhase = 0; this.stride = 0; this.flash = 0; this.hurtFlash = 0; this.spawnT = 0;
    this.v = { eye: new THREE.Vector3(), head: new THREE.Vector3(), chest: new THREE.Vector3(), to: new THREE.Vector3(),
      wish: new THREE.Vector3(), dir: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(),
      muzzle: new THREE.Vector3(), end: new THREE.Vector3(), hp: new THREE.Vector3(), bp: new THREE.Vector3() };
    this.headBox = new THREE.Box3();
    this.bodyBox = new THREE.Box3();
    this.colours = [0xe24b4b, 0xf5c542, 0x2f3545, 0x2a2a2a];
    this.build();
  }

  build() {
    const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0 });
    const [red, yellow, dark, gunC] = this.colours.map(mat);
    const black = this.eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    this.mats = [red, yellow, dark, gunC];
    const add = (geo, m, x, y, z, parent) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    const g = this.group = new THREE.Group();
    this.legL = new THREE.Group(); this.legL.position.set(-0.18, 0.85, 0); g.add(this.legL);
    this.legR = new THREE.Group(); this.legR.position.set(0.18, 0.85, 0); g.add(this.legR);
    add(GEO.leg, dark, 0, 0, 0, this.legL);
    add(GEO.leg, dark, 0, 0, 0, this.legR);
    add(GEO.torso, red, 0, 1.2, 0, g);
    add(GEO.head, yellow, 0, 1.79, 0, g);
    add(GEO.eye, black, -0.11, 1.83, -0.245, g);
    add(GEO.eye, black, 0.11, 1.83, -0.245, g);

    this.arms = new THREE.Group(); this.arms.position.set(0, 1.42, 0); g.add(this.arms);
    add(GEO.arm, red, 0.42, -0.02, -0.25, this.arms);
    add(GEO.arm, red, -0.3, -0.05, -0.32, this.arms).rotation.y = -0.45;
    this.muzzle = new THREE.Object3D(); this.arms.add(this.muzzle);
    this.gunMats = { dark: gunC };
    const lg = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
    this.laser = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({
      color: 0xff2a2a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.laser.visible = false;
    this.scene.add(this.laser);
    this.buildGun();
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffd08a,
    }));
    this.flashSprite.scale.setScalar(0.6);
    this.flashSprite.visible = false;
    this.muzzle.add(this.flashSprite);

    // floating health bar
    this.bar = new THREE.Group();
    this.bar.add(new THREE.Mesh(GEO.bar, new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7, depthWrite: false })));
    this.barFill = new THREE.Mesh(GEO.barFill, new THREE.MeshBasicMaterial({ color: 0xff4d4d, depthWrite: false }));
    this.barFill.position.set(-0.43, 0, 0.001);
    this.bar.add(this.barFill);
    this.bar.visible = false;

    g.position.copy(this.pos);
    this.scene.add(g, this.bar);
  }

  // The gun in its hands matches its weapon: length and colour, a scope on the sniper, a blade for the knife.
  buildGun() {
    if (this.gun) { this.arms.remove(this.gun); this.gun.traverse(o => o.geometry && o.geometry.dispose()); }
    const w = this.w, g = this.gun = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: w.colour, roughness: w.melee ? 0.3 : 0.6 });
    this.gunMats.body?.dispose();
    this.gunMats.body = mat;
    const add = (geo, m, x, y, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = true; g.add(mesh); };
    if (w.melee) {
      add(new THREE.BoxGeometry(0.05, 0.06, 0.16), this.gunMats.dark, 0.14, 0, -0.3);
      add(new THREE.BoxGeometry(0.02, 0.07, w.len), mat, 0.14, 0.01, -0.38 - w.len / 2);
    } else {
      add(new THREE.BoxGeometry(0.1, 0.15, w.len), mat, 0.14, 0.02, -0.22 - w.len / 2);
      add(GEO.mag, this.gunMats.dark, 0.14, -0.12, -0.4);
      if (this.weapon === 'sniper') add(new THREE.BoxGeometry(0.08, 0.08, 0.35), this.gunMats.dark, 0.14, 0.14, -0.45);
    }
    this.arms.add(g);
    this.muzzle.position.set(0.14, 0.04, -0.25 - w.len);
  }

  setWeapon(id) {
    if (id === this.weapon) return;
    this.ammoOf[this.weapon] = this.ammo;
    this.weapon = id;
    this.w = BOT_WEAPONS[id];
    this.ammo = this.ammoOf[id] ?? this.w.mag;
    this.reloading = 0;
    this.aimT = 0;
    this.fireCd = Math.max(this.fireCd, 0.35); // time to draw it
    this.burstLeft = this.newBurst();
    this.buildGun();
  }

  // Hard and Extreme bots pick the right tool for the distance, like a player would
  bestWeapon(dist) {
    const { primary, secondary } = this.loadout;
    if (dist < 3.2) return 'knife';
    if (dist < 12) return secondary;
    return primary;
  }

  // Night City: red glowing eyes you can spot in the dark
  glowEyes() { this.eyeMat.color.setHex(0xff3a2a); }

  dispose() {
    this.scene.remove(this.group, this.bar);
    this.scene.remove(this.laser);
    this.gunMats.body?.dispose();
    for (const m of this.mats) m.dispose();
  }

  newBurst() {
    const [a, b] = this.p.burst;
    return Math.max(1, Math.round(rand(a, b) * this.w.burst));
  }

  eye() { return this.v.eye.set(this.pos.x, this.pos.y + 1.6, this.pos.z); }

  aimDir(out) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  startSearch(pos, g) {
    this.state = 'search';
    this.lastSeen.copy(pos);
    this.path = g.nav.findPath(this.pos, pos);
    this.searchTimer = null;
  }

  // Player fired a shot: the bot comes to investigate.
  hear(pos, g) {
    if (this.state === 'engage' || this.hearCd > 0) return;
    this.hearCd = 1;
    this.startSearch(pos, g);
  }

  takeDamage(amount, fromPos, g) {
    this.health -= amount;
    this.hurtFlash = 0.12;
    this.sinceHurt = 0;
    if (this.state !== 'engage') {
      this.startSearch(fromPos, g);
      this.lookTarget.copy(fromPos);
      this.lookTimer = 1.2;
      if (this.p.alert) this.hitAlert = true;
    }
    if (this.health <= 0) this.alive = false;
    return !this.alive;
  }

  hitTest(ray) {
    const p = this.pos;
    this.headBox.min.set(p.x - 0.27, p.y + 1.53, p.z - 0.27);
    this.headBox.max.set(p.x + 0.27, p.y + 2.05, p.z + 0.27);
    this.bodyBox.min.set(p.x - 0.42, p.y, p.z - 0.42);
    this.bodyBox.max.set(p.x + 0.42, p.y + 1.55, p.z + 0.42);
    let best = null;
    if (ray.intersectBox(this.headBox, this.v.hp)) {
      best = { dist: this.v.hp.distanceTo(ray.origin), head: true, point: this.v.hp.clone() };
    }
    if (ray.intersectBox(this.bodyBox, this.v.bp)) {
      const d = this.v.bp.distanceTo(ray.origin);
      if (!best || d < best.dist) best = { dist: d, head: false, point: this.v.bp.clone() };
    }
    return best;
  }

  update(dt, g) {
    const v = this.v, pl = g.player;
    this.spawnT = Math.min(1, this.spawnT + dt * 4);
    this.hearCd -= dt;
    this.nadeCd -= dt;
    this.sinceHurt += dt;
    if (this.p.regen && this.sinceHurt > 4) this.health = Math.min(this.maxHealth, this.health + 25 * dt);
    const eye = this.eye();
    const head = v.head.set(pl.pos.x, pl.pos.y + 1.6, pl.pos.z);
    const chest = v.chest.set(pl.pos.x, pl.pos.y + 1.15, pl.pos.z);
    const to = v.to.subVectors(chest, eye);
    const dist = to.length();
    const flat = Math.hypot(to.x, to.z) || 1;

    // ---- Perception
    let sees = false;
    if (pl.alive) {
      const dot = (to.x * -Math.sin(this.yaw) + to.z * -Math.cos(this.yaw)) / flat;
      if (this.state === 'engage' || dot > 0.4 || dist < 5) {
        sees = dist < 80 && (g.los(eye, head) || g.los(eye, chest));
      }
    }
    if (sees) {
      if (this.state !== 'engage') {
        this.state = 'engage';
        this.reactTimer = this.hitAlert ? 0 : this.p.reaction; // shot at: no hesitation
        this.hitAlert = false;
        this.path = [];
      }
      this.lastSeen.copy(pl.pos);
      this.lostTimer = 0;
    } else if (this.state === 'engage') {
      this.lostTimer += dt;
      if (this.lostTimer > 0.7) {
        // You ducked behind cover: maybe lob a grenade where it last saw you
        const d = Math.hypot(this.lastSeen.x - this.pos.x, this.lastSeen.z - this.pos.z);
        if (this.nades > 0 && this.nadeCd <= 0 && d > 6 && d < 26 && Math.random() < 0.75) {
          this.nades--;
          this.nadeCd = 7;
          g.botGrenade(this, this.lastSeen);
        }
        this.startSearch(this.lastSeen, g);
      }
    }

    // ---- Movement intent
    const wish = v.wish.set(0, 0, 0);
    let speed = 4.2, spinning = false;
    if (this.state === 'engage') {
      const fx = to.x / flat, fz = to.z / flat;
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0 || this.blocked) {
        this.strafeDir = !this.p.restless && Math.random() < 0.2 ? 0 : (this.blocked ? -this.strafeDir || 1 : (Math.random() < 0.5 ? 1 : -1));
        this.strafeTimer = this.p.restless ? rand(0.25, 0.8) : rand(0.35, 1.3);
      }
      if (this.loadout) {
        this.switchCd -= dt;
        const want = this.bestWeapon(dist);
        if (want !== this.weapon && this.switchCd <= 0) { this.setWeapon(want); this.switchCd = 0.8; }
      }
      // close in to its weapon's range; only the sniper backs off (so melee players can still reach the rest)
      const [near, far] = this.w.range;
      let fwd = dist > far ? 0.8 : dist < near ? -0.6 : 0;
      if (this.reloading > 0) fwd = -0.5;
      if (this.w.melee) fwd = 1; // knife out: charge
      const strafe = this.aimT > 0 ? 0 : this.strafeDir; // a sniper stands still while it lines up the shot
      if (this.aimT > 0) fwd = 0;
      wish.set(fx * fwd - fz * strafe, 0, fz * fwd + fx * strafe);
      speed = this.w.melee ? 6.5 : 5.2;
      if (this.grounded && Math.random() < dt * (this.p.restless ? 0.6 : 0.2)) this.vel.y = 8.4;
    } else {
      if (!this.path.length) {
        if (this.state === 'search') {
          if (this.searchTimer === null) this.searchTimer = 2.2;
          this.searchTimer -= dt;
          spinning = true;
          if (this.searchTimer <= 0) { this.state = 'patrol'; this.patrolTimer = 0; }
        } else {
          this.path = g.nav.randomPath(this.pos);
        }
      }
      if (this.state === 'patrol') {
        // A bot that wanders too long goes looking for you, to keep the action coming.
        this.patrolTimer += dt;
        if (this.patrolTimer > 8 && pl.alive) { this.patrolTimer = 0; this.startSearch(pl.pos, g); }
      }
      if (this.path.length) {
        const t = this.path[0];
        const dx = t.x - this.pos.x, dz = t.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.6) this.path.shift();
        else wish.set(dx / d, 0, dz / d);
        speed = this.state === 'search' ? 5.5 : 4.2;
      }
      if (this.ammo < this.w.mag / 2 && this.reloading <= 0) this.reloading = this.w.reload;
    }
    if (wish.lengthSq() > 1) wish.normalize();

    // stuck detection
    if (wish.lengthSq() > 0) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 1) {
        if (this.pos.distanceTo(this.stuckFrom) < 0.5) { this.path = []; this.strafeDir = -this.strafeDir || 1; }
        this.stuckTimer = 0;
        this.stuckFrom.copy(this.pos);
      }
    }

    speed *= this.p.speed;
    if (!this.padFlight) {
      const k = Math.min(1, (this.grounded ? 10 : 2) * dt);
      this.vel.x += (wish.x * speed - this.vel.x) * k;
      this.vel.z += (wish.z * speed - this.vel.z) * k;
    }
    moveEntity(this, dt, g.colliders);
    if (this.grounded) this.padFlight = false;
    const ev = g.applyFeatures(this, dt);
    if (ev?.type === 'portal') {
      this.yaw = ev.exit.yaw;
      // it came out where its path wanted; skip the waypoint it just jumped past
      while (this.path.length > 1 && this.path[0].distanceTo(this.pos) > this.path[1].distanceTo(this.pos)) this.path.shift();
    }
    if (ev) { const sp = g.spatial(this.pos); if (sp.dist < 30) (ev.type === 'pad' ? g.audio.pad : g.audio.teleport)(); }
    if (this.pos.y < -20) { this.pos.set(0, 3, 0); this.vel.set(0, 0, 0); }

    // ---- Aim / look
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.lookTimer -= dt;
    let tYaw = this.yaw, tPitch = 0, rate = 6;
    if (this.state === 'engage') {
      tYaw = Math.atan2(-to.x, -to.z);
      tPitch = Math.atan2(to.y, flat);
      rate = this.p.track;
    } else if (this.lookTimer > 0) {
      tYaw = Math.atan2(-(this.lookTarget.x - this.pos.x), -(this.lookTarget.z - this.pos.z));
      rate = this.hitAlert ? Math.max(8, this.p.track) : 8; // an alert bot snaps round to face the shot
    } else if (hs > 0.5) {
      tYaw = Math.atan2(-this.vel.x, -this.vel.z);
    }
    if (spinning) this.yaw += 2.2 * dt;
    else this.yaw += angDiff(this.yaw, tYaw) * Math.min(1, rate * dt);
    this.pitch += (tPitch - this.pitch) * Math.min(1, rate * dt);

    // ---- Shooting
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) this.ammo = this.w.mag;
    }
    this.fireCd -= dt;
    this.burstPause -= dt;
    const w = this.w;
    const ready = this.state === 'engage' && sees && this.reloading <= 0 && this.fireCd <= 0;
    if (this.state === 'engage' && sees) this.reactTimer -= dt;
    const aimErr = ready ? Math.acos(Math.min(1, this.aimDir(v.dir).dot(to) / dist)) : 1;
    if (w.aimTime) {
      // Sniper: hold still with the laser on you, then fire
      if (ready && this.reactTimer <= 0 && aimErr < 0.06) {
        this.aimT += dt;
        if (this.aimT >= w.aimTime) { this.shoot(g); this.aimT = 0; }
      } else this.aimT = Math.max(0, this.aimT - dt * 2);
    } else if (w.melee) {
      // Knife: a stab in your back is an instant elimination, same as yours
      if (ready && this.reactTimer <= 0 && dist < 2.4) {
        const bx = this.pos.x - pl.pos.x, bz = this.pos.z - pl.pos.z, bl = Math.hypot(bx, bz) || 1;
        const behind = (-Math.sin(pl.yaw) * bx + -Math.cos(pl.yaw) * bz) / bl < -0.2;
        g.damagePlayer(behind ? 100 : 45, this.pos);
        g.audio.stab(behind);
        this.fireCd = w.rate;
        this.stabT = 0.25;
      }
    } else if (ready && this.reactTimer <= 0 && this.burstPause <= 0 && aimErr < 0.12) {
      this.shoot(g);
      if (this.ammo > 0 && --this.burstLeft <= 0) { this.burstPause = rand(...this.p.pause); this.burstLeft = this.newBurst(); }
    }

    this.animate(dt, g, hs);
  }

  shoot(g) {
    this.fire(g);
    this.fireCd = this.w.rate;
    if (--this.ammo <= 0) this.reloading = this.w.reload;
  }

  fire(g) {
    const v = this.v;
    const dir = this.aimDir(v.dir);
    const moving = Math.hypot(this.vel.x, this.vel.z) > 1.5;
    const s = this.p.spread * this.w.spread * (moving ? 1.35 : 1) * (this.grounded ? 1 : 2);
    v.right.set(-dir.z, 0, dir.x).normalize();
    v.up.crossVectors(v.right, dir);
    dir.addScaledVector(v.right, gauss() * s).addScaledVector(v.up, gauss() * s).normalize();

    const origin = this.eye();
    const wh = g.rayWorld(origin, dir, 200);
    const ph = g.playerRayHit(origin, dir);
    const end = v.end;
    if (ph !== null && (!wh || ph < wh.dist)) {
      end.copy(origin).addScaledVector(dir, ph);
      g.damagePlayer(this.w.aimTime ? this.p.sniperDmg : this.p.damage * this.w.dmg, this.pos);
    } else if (wh) {
      end.copy(wh.point);
      g.fx.impact(wh.point, wh.normal);
    } else {
      end.copy(origin).addScaledVector(dir, 120);
    }
    this.muzzle.getWorldPosition(v.muzzle);
    g.fx.tracer(v.muzzle, end, 0xffb070);
    this.flash = 0.05;
    this.flashSprite.material.rotation = Math.random() * Math.PI;
    const sp = g.spatial(this.pos);
    g.audio.gunshot(sp.vol * 0.9, sp.pan, sp.far, this.w.sound);
  }

  animate(dt, g, hs) {
    this.walkPhase += hs * dt * 2.2;
    const swing = Math.sin(this.walkPhase) * Math.min(hs / 5, 1) * 0.7;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.stabT = (this.stabT || 0) - dt;
    this.arms.rotation.x = this.pitch - (this.stabT > 0 ? Math.sin(this.stabT / 0.25 * Math.PI) * 0.8 : 0);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    const s = 1 - Math.pow(1 - this.spawnT, 3);
    this.group.scale.setScalar(Math.max(0.01, s));

    this.flash -= dt;
    this.flashSprite.visible = this.flash > 0;

    if (this.laser) {
      this.laser.visible = this.aimT > 0;
      if (this.laser.visible) {
        const m = this.v.muzzle;
        this.muzzle.getWorldPosition(m);
        const dir = this.aimDir(this.v.dir);
        const wh = g.rayWorld(m, dir, 90);
        const ph = g.playerRayHit(m, dir);
        const len = Math.min(wh ? wh.dist : 90, ph ?? 90);
        this.laser.position.copy(m);
        this.laser.lookAt(this.v.end.copy(m).add(dir));
        this.laser.scale.set(0.025, 0.025, len);
        this.laser.material.opacity = 0.35 + 0.5 * Math.min(1, this.aimT / this.w.aimTime);
      }
    }
    this.hurtFlash -= dt;
    const e = Math.max(0, this.hurtFlash / 0.12) * 0.7;
    for (const m of this.mats) m.emissiveIntensity = e;

    if (this.grounded && hs > 1) {
      this.stride += hs * dt;
      if (this.stride > 2.2) {
        this.stride = 0;
        const sp = g.spatial(this.pos);
        g.audio.footstep(sp.vol * 0.35, sp.pan);
      }
    }

    this.bar.visible = this.health < this.maxHealth;
    if (this.bar.visible) {
      this.bar.position.set(this.pos.x, this.pos.y + 2.35, this.pos.z);
      this.bar.quaternion.copy(g.camera.quaternion);
      this.barFill.scale.x = Math.max(0.001, this.health / this.maxHealth);
    }
  }
}
