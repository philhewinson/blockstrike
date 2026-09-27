import * as THREE from 'three';
import { moveEntity } from './physics.js';
import { flashTexture } from './effects.js';

// Tuning per difficulty. spread = aim wobble (radians), track = how quickly it follows you,
// reaction = pause before the first shot after spotting you; speed scales how fast it moves.
export const DIFF = {
  easy:   { reaction: 0.9,  spread: 0.055, track: 4.5, damage: 8,  burst: [2, 4],  pause: [0.7, 1.2], speed: 0.8 },
  normal: { reaction: 0.55, spread: 0.036, track: 7,   damage: 11, burst: [3, 6],  pause: [0.45, 0.8], speed: 0.9 },
  hard:   { reaction: 0.22, spread: 0.017, track: 15,  damage: 18, burst: [6, 12], pause: [0.2, 0.4], speed: 1 },
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
    this.scene = scene;
    this.pos = pos.clone();
    this.vel = new THREE.Vector3();
    this.radius = 0.4; this.height = 1.95;
    this.grounded = false; this.blocked = false;
    this.health = 100; this.alive = true;
    this.yaw = Math.atan2(pos.x, pos.z); // roughly facing the middle
    this.pitch = 0;
    this.state = 'patrol';
    this.path = [];
    this.lastSeen = new THREE.Vector3();
    this.lostTimer = 0; this.reactTimer = 0; this.searchTimer = null; this.patrolTimer = 0;
    this.strafeDir = 1; this.strafeTimer = 0;
    this.lookTarget = new THREE.Vector3(); this.lookTimer = 0;
    this.ammo = 30; this.reloading = 0; this.fireCd = 0; this.burstLeft = randInt(b.burst); this.burstPause = 0;
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
    const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
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
    add(GEO.gun, gunC, 0.14, 0.02, -0.62, this.arms);
    add(GEO.mag, gunC, 0.14, -0.12, -0.55, this.arms);
    this.muzzle = new THREE.Object3D(); this.muzzle.position.set(0.14, 0.04, -1.05); this.arms.add(this.muzzle);
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

  dispose() {
    this.scene.remove(this.group, this.bar);
    for (const m of this.mats) m.dispose();
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
    if (this.state !== 'engage') {
      this.startSearch(fromPos, g);
      this.lookTarget.copy(fromPos);
      this.lookTimer = 1.2;
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
      if (this.state !== 'engage') { this.state = 'engage'; this.reactTimer = this.p.reaction; this.path = []; }
      this.lastSeen.copy(pl.pos);
      this.lostTimer = 0;
    } else if (this.state === 'engage') {
      this.lostTimer += dt;
      if (this.lostTimer > 0.7) this.startSearch(this.lastSeen, g);
    }

    // ---- Movement intent
    const wish = v.wish.set(0, 0, 0);
    let speed = 4.2, spinning = false;
    if (this.state === 'engage') {
      const fx = to.x / flat, fz = to.z / flat;
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0 || this.blocked) {
        this.strafeDir = Math.random() < 0.2 ? 0 : (this.blocked ? -this.strafeDir || 1 : (Math.random() < 0.5 ? 1 : -1));
        this.strafeTimer = rand(0.35, 1.3);
      }
      let fwd = dist > 24 ? 0.8 : 0; // it doesn't run from you, so melee players can close in
      if (this.reloading > 0) fwd = -0.5;
      wish.set(fx * fwd - fz * this.strafeDir, 0, fz * fwd + fx * this.strafeDir);
      speed = 5.2;
      if (this.grounded && Math.random() < dt * 0.2) this.vel.y = 8.4;
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
      if (this.ammo < 15 && this.reloading <= 0) this.reloading = 2.2;
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
    const k = Math.min(1, (this.grounded ? 10 : 2) * dt);
    this.vel.x += (wish.x * speed - this.vel.x) * k;
    this.vel.z += (wish.z * speed - this.vel.z) * k;
    moveEntity(this, dt, g.colliders);
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
      rate = 8;
    } else if (hs > 0.5) {
      tYaw = Math.atan2(-this.vel.x, -this.vel.z);
    }
    if (spinning) this.yaw += 2.2 * dt;
    else this.yaw += angDiff(this.yaw, tYaw) * Math.min(1, rate * dt);
    this.pitch += (tPitch - this.pitch) * Math.min(1, rate * dt);

    // ---- Shooting
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) this.ammo = 30;
    }
    this.fireCd -= dt;
    this.burstPause -= dt;
    if (this.state === 'engage' && sees) {
      this.reactTimer -= dt;
      const aimErr = Math.acos(Math.min(1, this.aimDir(v.dir).dot(to) / dist));
      if (this.reactTimer <= 0 && this.reloading <= 0 && this.burstPause <= 0 && this.fireCd <= 0 && aimErr < 0.12) {
        this.fire(g);
        this.fireCd = 0.1;
        this.ammo--;
        if (this.ammo <= 0) this.reloading = 2.2;
        else if (--this.burstLeft <= 0) { this.burstPause = rand(...this.p.pause); this.burstLeft = randInt(this.p.burst); }
      }
    }

    this.animate(dt, g, hs);
  }

  fire(g) {
    const v = this.v;
    const dir = this.aimDir(v.dir);
    const moving = Math.hypot(this.vel.x, this.vel.z) > 1.5;
    const s = this.p.spread * (moving ? 1.35 : 1) * (this.grounded ? 1 : 2);
    v.right.set(-dir.z, 0, dir.x).normalize();
    v.up.crossVectors(v.right, dir);
    dir.addScaledVector(v.right, gauss() * s).addScaledVector(v.up, gauss() * s).normalize();

    const origin = this.eye();
    const wh = g.rayWorld(origin, dir, 200);
    const ph = g.playerRayHit(origin, dir);
    const end = v.end;
    if (ph !== null && (!wh || ph < wh.dist)) {
      end.copy(origin).addScaledVector(dir, ph);
      g.damagePlayer(this.p.damage, this.pos);
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
    g.audio.gunshot(sp.vol * 0.9, sp.pan, sp.far);
  }

  animate(dt, g, hs) {
    this.walkPhase += hs * dt * 2.2;
    const swing = Math.sin(this.walkPhase) * Math.min(hs / 5, 1) * 0.7;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.arms.rotation.x = this.pitch;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    const s = 1 - Math.pow(1 - this.spawnT, 3);
    this.group.scale.setScalar(Math.max(0.01, s));

    this.flash -= dt;
    this.flashSprite.visible = this.flash > 0;
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

    this.bar.visible = this.health < 100;
    if (this.bar.visible) {
      this.bar.position.set(this.pos.x, this.pos.y + 2.35, this.pos.z);
      this.bar.quaternion.copy(g.camera.quaternion);
      this.barFill.scale.x = Math.max(0.001, this.health / 100);
    }
  }
}
