import * as THREE from 'three';

let flashTex = null;
export function flashTexture() {
  if (flashTex) return flashTex;
  const s = 128, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,220,120,0.9)');
  grad.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  g.strokeStyle = 'rgba(255,230,160,0.9)';
  g.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(s / 2, s / 2);
    g.lineTo(s / 2 + Math.cos(a) * s * 0.48, s / 2 + Math.sin(a) * s * 0.48); g.stroke();
  }
  flashTex = new THREE.CanvasTexture(c);
  flashTex.colorSpace = THREE.SRGBColorSpace;
  return flashTex;
}

export class Effects {
  constructor(scene, world) {
    this.scene = scene;
    this.colliders = world.colliders;
    this.cube = new THREE.BoxGeometry(1, 1, 1);
    this.parts = [];
    this.free = [];
    this.basicMats = new Map();
    this.litMats = new Map();

    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(20,20,25,0.95)');
    grad.addColorStop(0.45, 'rgba(30,30,35,0.7)');
    grad.addColorStop(1, 'rgba(30,30,35,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    const decalTex = new THREE.CanvasTexture(c);
    this.decalMat = new THREE.MeshBasicMaterial({
      map: decalTex, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4,
    });
    this.decalGeo = new THREE.PlaneGeometry(0.16, 0.16);
    this.decals = [];
    this.decalIdx = 0;

    const tg = new THREE.BoxGeometry(1, 1, 1);
    tg.translate(0, 0, 0.5);
    this.tracers = [];
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({
        color: 0xffe9a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      m.visible = false;
      m.userData.life = 0;
      scene.add(m);
      this.tracers.push(m);
    }
    this.tracerIdx = 0;

    // Grenade blast. The light lives in the scene from the start so the first explosion doesn't stall.
    this.boom = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({
      color: 0xffa13d, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.boom.visible = false;
    this.boomLight = new THREE.PointLight(0xffa04a, 0, 30, 2);
    this.boomT = null;
    scene.add(this.boom, this.boomLight);
  }

  mat(color, lit) {
    const cache = lit ? this.litMats : this.basicMats;
    if (!cache.has(color)) {
      cache.set(color, lit
        ? new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
        : new THREE.MeshBasicMaterial({ color }));
    }
    return cache.get(color);
  }

  spawn(pos, vel, size, color, life, lit = false, bounce = false) {
    const mesh = this.free.pop() || new THREE.Mesh(this.cube);
    mesh.material = this.mat(color, lit);
    mesh.position.copy(pos);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    mesh.scale.setScalar(size);
    mesh.castShadow = lit;
    mesh.visible = true;
    this.scene.add(mesh);
    this.parts.push({ mesh, vel, size, life, max: life, bounce, spin: (Math.random() - 0.5) * 12 });
  }

  impact(point, normal) {
    for (let i = 0; i < 6; i++) {
      const v = normal.clone().multiplyScalar(1.5 + Math.random() * 2.5)
        .add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(3));
      this.spawn(point, v, 0.04 + Math.random() * 0.03, i < 3 ? 0xffe38a : 0x9a9a9a, 0.3 + Math.random() * 0.2);
    }
    this.decal(point, normal);
  }

  hit(point) {
    for (let i = 0; i < 9; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(6);
      this.spawn(point, v, 0.05 + Math.random() * 0.04, i % 2 ? 0xffffff : 0xffd23f, 0.25);
    }
  }

  burst(pos, colours) {
    for (let i = 0; i < 30; i++) {
      const p = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.7, 0.2 + Math.random() * 1.7, (Math.random() - 0.5) * 0.7));
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4;
      const v = new THREE.Vector3(Math.cos(a) * sp, 3 + Math.random() * 5, Math.sin(a) * sp);
      this.spawn(p, v, 0.12 + Math.random() * 0.18, colours[i % colours.length], 1.6 + Math.random() * 0.8, true, true);
    }
    for (let i = 0; i < 14; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random(), Math.random() - 0.5).multiplyScalar(9);
      this.spawn(pos.clone().setY(pos.y + 1.1), v, 0.07, 0xffffff, 0.4);
    }
  }

  explosion(pos) {
    this.boom.position.copy(pos);
    this.boomLight.position.copy(pos).setY(pos.y + 0.5);
    this.boomT = 0;
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 7;
      const v = new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random() * 7, Math.sin(a) * sp);
      const c = [0xffc24a, 0xff7a2f, 0x555555, 0x333333][i % 4];
      this.spawn(pos.clone().setY(pos.y + 0.3), v, 0.1 + Math.random() * 0.15, c, 0.6 + Math.random() * 0.6, i % 4 > 1, true);
    }
  }

  decal(point, normal) {
    let m = this.decals[this.decalIdx];
    if (!m) {
      m = new THREE.Mesh(this.decalGeo, this.decalMat);
      this.scene.add(m);
      this.decals[this.decalIdx] = m;
    }
    this.decalIdx = (this.decalIdx + 1) % 80;
    m.visible = true;
    m.position.copy(point).addScaledVector(normal, 0.01);
    m.lookAt(point.clone().add(normal));
    m.rotateZ(Math.random() * Math.PI);
  }

  tracer(from, to, color = 0xffe9a8) {
    const m = this.tracers[this.tracerIdx];
    this.tracerIdx = (this.tracerIdx + 1) % this.tracers.length;
    const len = from.distanceTo(to);
    if (len < 0.5) return;
    m.position.copy(from);
    m.lookAt(to);
    m.scale.set(0.02, 0.02, len);
    m.material.color.setHex(color);
    m.material.opacity = 0.85;
    m.userData.life = 0.06;
    m.visible = true;
  }

  groundAt(x, z, y) {
    let top = -1;
    for (const b of this.colliders) {
      if (x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z && b.max.y <= y + 0.3 && b.max.y > top) top = b.max.y;
    }
    return top;
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.scene.remove(p.mesh);
        this.free.push(p.mesh);
        this.parts.splice(i, 1);
        continue;
      }
      p.vel.y -= 18 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.bounce) {
        const half = p.size / 2;
        const ground = this.groundAt(p.mesh.position.x, p.mesh.position.z, p.mesh.position.y);
        if (p.mesh.position.y - half < ground) {
          p.mesh.position.y = ground + half;
          p.vel.y = Math.abs(p.vel.y) * 0.35;
          p.vel.x *= 0.6; p.vel.z *= 0.6; p.spin *= 0.6;
        }
        p.mesh.rotation.x += p.spin * dt;
        p.mesh.rotation.z += p.spin * 0.7 * dt;
      }
      p.mesh.scale.setScalar(p.size * Math.min(1, p.life / 0.4));
    }
    if (this.boomT !== null) {
      this.boomT += dt;
      const k = this.boomT / 0.4;
      this.boom.visible = k < 1;
      this.boom.scale.setScalar(0.5 + 4.5 * Math.sqrt(Math.min(k, 1)));
      this.boom.material.opacity = Math.max(0, 1 - k);
      this.boomLight.intensity = Math.max(0, 1 - this.boomT / 0.5) * 400;
      if (k >= 1.3) this.boomT = null;
    }
    for (const t of this.tracers) {
      if (!t.visible) continue;
      t.userData.life -= dt;
      t.material.opacity = Math.max(0, t.userData.life / 0.06) * 0.85;
      if (t.userData.life <= 0) t.visible = false;
    }
  }

  clear() {
    for (const p of this.parts) { p.mesh.visible = false; this.scene.remove(p.mesh); this.free.push(p.mesh); }
    this.parts.length = 0;
    for (const d of this.decals) if (d) d.visible = false;
    this.boom.visible = false;
    this.boomLight.intensity = 0;
    this.boomT = null;
    for (const t of this.tracers) t.visible = false;
  }
}
