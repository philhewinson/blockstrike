import * as THREE from 'three';
import { flashTexture } from './effects.js';

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const mat = (c, r = 0.55, met = 0.3) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: met });
const M = {
  dark: mat(0x2b2f36), mid: mat(0x474e59), accent: mat(0x30c6d9, 0.5, 0.1), orange: mat(0xff8a3d, 0.5, 0.1),
  olive: mat(0x56663f, 0.7, 0.1), gold: mat(0xf2b134, 0.4, 0.5), steel: mat(0xe4e9f0, 0.3, 0.15),
  glove: mat(0x2a2a2a, 0.9, 0), sleeve: mat(0x3a5ba8, 0.9, 0), dot: new THREE.MeshBasicMaterial({ color: 0xff2020 }),
};

function part(parent, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  parent.add(mesh);
  return mesh;
}

// A box stretched from one point to another: used for forearms.
function limb(parent, from, to, t = 0.08) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const mesh = new THREE.Mesh(B(t, t, a.distanceTo(b)), M.sleeve);
  mesh.position.copy(a).lerp(b, 0.5);
  mesh.lookAt(b);
  parent.add(mesh);
  return mesh;
}

function barrel(parent, r, len, x, y, z, m = M.dark) {
  return part(parent, new THREE.CylinderGeometry(r, r, len, 10), m, x, y, z, Math.PI / 2);
}

function redDot(g, y) {
  part(g, B(0.04, 0.02, 0.06), M.dark, 0, y - 0.035, -0.02);
  part(g, B(0.006, 0.05, 0.01), M.dark, -0.024, y, -0.02);
  part(g, B(0.006, 0.05, 0.01), M.dark, 0.024, y, -0.02);
  part(g, B(0.054, 0.006, 0.01), M.dark, 0, y + 0.025, -0.02);
  part(g, B(0.004, 0.004, 0.002), M.dot, 0, y, -0.02);
}

function twoHands(g, gripZ, foreZ, foreY = -0.055) {
  part(g, B(0.06, 0.08, 0.09), M.glove, 0.01, -0.1, gripZ);
  limb(g, [0.03, -0.13, gripZ + 0.04], [0.16, -0.36, gripZ + 0.32]);
  part(g, B(0.085, 0.06, 0.1), M.glove, 0, foreY, foreZ);
  limb(g, [-0.02, foreY - 0.025, foreZ + 0.02], [-0.22, -0.42, foreZ + 0.35]);
}

// Each builder returns { group, hip, ads, mag, flashZ, flashY }
const BUILD = {
  rifle() {
    const g = new THREE.Group();
    part(g, B(0.07, 0.09, 0.42), M.dark, 0, 0, 0);
    part(g, B(0.03, 0.015, 0.3), M.mid, 0, 0.052, -0.02);
    part(g, B(0.075, 0.075, 0.24), M.mid, 0, 0, -0.3);
    part(g, B(0.078, 0.02, 0.2), M.accent, 0, 0, -0.3);
    barrel(g, 0.013, 0.3, 0, 0.015, -0.44);
    part(g, B(0.035, 0.035, 0.06), M.dark, 0, 0.015, -0.6);
    const mag = part(g, B(0.05, 0.17, 0.085), M.mid, 0, -0.11, -0.08, 0.25);
    part(g, B(0.04, 0.1, 0.05), M.dark, 0, -0.08, 0.1, -0.3);
    part(g, B(0.05, 0.08, 0.2), M.mid, 0, -0.01, 0.3);
    part(g, B(0.06, 0.12, 0.03), M.accent, 0, -0.02, 0.41);
    redDot(g, 0.105);
    twoHands(g, 0.1, -0.3);
    return { group: g, hip: [0.19, -0.2, -0.5], ads: [0, -0.105, -0.22], mag, magY: -0.11, flashZ: -0.68, flashY: 0.015 };
  },
  sniper() {
    const g = new THREE.Group();
    part(g, B(0.07, 0.09, 0.44), M.olive, 0, 0, 0);
    part(g, B(0.06, 0.1, 0.3), M.olive, 0, -0.02, 0.34);
    part(g, B(0.065, 0.13, 0.03), M.gold, 0, -0.03, 0.5);
    barrel(g, 0.014, 0.62, 0, 0.015, -0.52);
    part(g, B(0.04, 0.04, 0.08), M.dark, 0, 0.015, -0.84);
    barrel(g, 0.032, 0.32, 0, 0.1, -0.02);
    barrel(g, 0.038, 0.05, 0, 0.1, -0.19, M.mid);
    barrel(g, 0.038, 0.05, 0, 0.1, 0.15, M.mid);
    part(g, B(0.03, 0.04, 0.03), M.dark, 0, 0.055, -0.1);
    part(g, B(0.03, 0.04, 0.03), M.dark, 0, 0.055, 0.08);
    part(g, B(0.06, 0.015, 0.015), M.gold, 0.05, 0.03, 0.12);
    const mag = part(g, B(0.05, 0.1, 0.08), M.dark, 0, -0.08, -0.02);
    part(g, B(0.04, 0.1, 0.05), M.dark, 0, -0.08, 0.14, -0.3);
    twoHands(g, 0.14, -0.3);
    return { group: g, hip: [0.2, -0.23, -0.66], ads: [0, -0.1, -0.3], mag, magY: -0.08, flashZ: -0.95, flashY: 0.015 };
  },
  smg() {
    const g = new THREE.Group();
    part(g, B(0.07, 0.1, 0.32), M.dark, 0, 0, 0);
    part(g, B(0.072, 0.05, 0.2), M.orange, 0, 0.0, -0.05);
    barrel(g, 0.013, 0.12, 0, 0.015, -0.22);
    part(g, B(0.03, 0.03, 0.04), M.dark, 0, 0.015, -0.29);
    const mag = part(g, B(0.045, 0.2, 0.06), M.mid, 0, -0.14, -0.06);
    part(g, B(0.04, 0.1, 0.05), M.dark, 0, -0.09, 0.1, -0.3);
    part(g, B(0.02, 0.06, 0.2), M.dark, 0, -0.01, 0.26);
    part(g, B(0.05, 0.08, 0.02), M.orange, 0, -0.02, 0.36);
    redDot(g, 0.095);
    twoHands(g, 0.1, -0.16, -0.06);
    return { group: g, hip: [0.18, -0.19, -0.44], ads: [0, -0.095, -0.24], mag, magY: -0.14, flashZ: -0.35, flashY: 0.015 };
  },
  pistol() {
    const g = new THREE.Group();
    part(g, B(0.045, 0.05, 0.2), M.dark, 0, 0.03, -0.02);
    part(g, B(0.047, 0.012, 0.16), M.accent, 0, 0.012, -0.02);
    part(g, B(0.04, 0.03, 0.18), M.mid, 0, -0.005, -0.02);
    part(g, B(0.042, 0.11, 0.055), M.mid, 0, -0.07, 0.05, -0.25);
    const mag = part(g, B(0.036, 0.03, 0.045), M.dark, 0, -0.125, 0.065, -0.25);
    part(g, B(0.008, 0.014, 0.01), M.dark, 0, 0.062, -0.11);
    part(g, B(0.009, 0.014, 0.01), M.dark, -0.012, 0.062, 0.07);
    part(g, B(0.009, 0.014, 0.01), M.dark, 0.012, 0.062, 0.07);
    part(g, B(0.065, 0.09, 0.08), M.glove, 0.005, -0.07, 0.07);
    limb(g, [0.02, -0.1, 0.1], [0.13, -0.38, 0.42]);
    part(g, B(0.06, 0.07, 0.07), M.glove, -0.045, -0.08, 0.06);
    limb(g, [-0.06, -0.11, 0.09], [-0.24, -0.4, 0.4]);
    return { group: g, hip: [0.16, -0.17, -0.4], ads: [0, -0.066, -0.32], mag, magY: -0.125, flashZ: -0.16, flashY: 0.03 };
  },
  knife() {
    const g = new THREE.Group();
    const k = new THREE.Group();
    k.rotation.set(0.5, 0.25, -0.2);
    g.add(k);
    part(k, B(0.032, 0.036, 0.13), M.dark, 0, 0, 0.02);
    part(k, B(0.07, 0.014, 0.022), M.gold, 0, 0, -0.05);
    part(k, B(0.009, 0.04, 0.2), M.steel, 0, 0.004, -0.16);
    part(k, B(0.009, 0.028, 0.03), M.steel, 0, 0.012, -0.27, 0.6);
    part(k, B(0.07, 0.07, 0.1), M.glove, 0, -0.005, 0.02);
    limb(k, [0.01, -0.02, 0.06], [0.08, -0.12, 0.42]);
    return { group: g, hip: [0.2, -0.2, -0.38], ads: [0.2, -0.2, -0.38], flashZ: 0, flashY: 0 };
  },
  fists() {
    const g = new THREE.Group();
    const fist = x => {
      const f = new THREE.Group();
      f.position.set(x, 0, 0);
      part(f, B(0.09, 0.08, 0.1), M.glove, 0, 0, 0);
      part(f, B(0.092, 0.03, 0.03), M.accent, 0, 0.03, -0.036);
      limb(f, [0, -0.02, 0.04], [x * 0.6, -0.26, 0.42], 0.085);
      g.add(f);
      return f;
    };
    const l = fist(-0.17), r = fist(0.17);
    return { group: g, hip: [0, -0.18, -0.36], ads: [0, -0.18, -0.36], fists: [l, r], flashZ: 0, flashY: 0 };
  },
};

// The weapon you hold, drawn in its own scene on top of the world so it never clips into walls.
export class Viewmodel {
  constructor(aspect) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xdfefff, 0x6b5a4a, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(1, 2, 1.5);
    this.scene.add(sun);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.models = {};
    for (const id of Object.keys(BUILD)) {
      const m = BUILD[id]();
      m.group.visible = false;
      this.root.add(m.group);
      this.models[id] = m;
    }
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffd08a,
    }));
    this.flash.visible = false;

    this.current = null;
    this.kick = 0; this.flashT = 0; this.bobT = 0;
    this.swayX = 0; this.swayY = 0; this.sprintT = 0; this.drawT = 1; this.slideT = 0;
    this.punchSide = 0;
  }

  setWeapon(id) {
    if (this.current) this.models[this.current].group.visible = false;
    this.current = id;
    const m = this.models[id];
    m.group.visible = true;
    m.group.add(this.flash);
    this.flash.position.set(0, m.flashY, m.flashZ);
    this.drawT = 0;
  }

  fire(kick = 1) {
    this.kick = Math.min(this.kick + 0.8 * kick, 1.2 * Math.max(1, kick));
    this.flashT = 0.045;
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flash.scale.setScalar((0.14 + Math.random() * 0.08) * (kick > 1 ? 1.6 : 1));
  }

  punch() { this.punchSide ^= 1; }

  // s = { speed, grounded, ads, sprint, slide, reload (0..1 or -1), attack (0..1 or -1), throwT (0..1 or -1), lookDX, lookDY }
  update(dt, s) {
    const m = this.models[this.current];
    if (!m) return;
    const lerp = (a, b, t) => a + (b - a) * t;
    const a = s.ads;
    let x = lerp(m.hip[0], m.ads[0], a), y = lerp(m.hip[1], m.ads[1], a), z = lerp(m.hip[2], m.ads[2], a);
    let rx = 0, ry = 0, rz = 0;

    if (s.grounded && s.speed > 0.5 && !s.slide) this.bobT += dt * s.speed * 1.4;
    const bob = Math.min(s.speed / 7, 1.3) * (1 - 0.85 * a) * (s.grounded && !s.slide ? 1 : 0.3);
    x += Math.sin(this.bobT) * 0.012 * bob;
    y -= Math.abs(Math.cos(this.bobT)) * 0.012 * bob;

    const clamp = (v, lim) => Math.max(-lim, Math.min(lim, v));
    this.swayX = lerp(this.swayX, clamp(-s.lookDX * 0.0006, 0.04), Math.min(1, dt * 10));
    this.swayY = lerp(this.swayY, clamp(s.lookDY * 0.0006, 0.03), Math.min(1, dt * 10));
    x += this.swayX * (1 - 0.8 * a);
    y += this.swayY * (1 - 0.8 * a);
    ry += this.swayX * 1.5;

    this.sprintT = lerp(this.sprintT, s.sprint ? 1 : 0, Math.min(1, dt * 10));
    x -= 0.05 * this.sprintT; y -= 0.05 * this.sprintT;
    ry += 0.6 * this.sprintT; rx -= 0.25 * this.sprintT;

    this.slideT = lerp(this.slideT, s.slide ? 1 : 0, Math.min(1, dt * 10));
    rz += 0.25 * this.slideT; y += 0.02 * this.slideT;

    if (m.mag) {
      let drop = 0;
      if (s.reload >= 0) {
        const r = s.reload;
        const tilt = Math.sin(Math.min(r, 1) * Math.PI);
        rz += 0.7 * tilt; rx += 0.2 * tilt; y -= 0.05 * tilt;
        const ss = t => t * t * (3 - 2 * t);
        drop = r < 0.45 ? ss(Math.max(0, Math.min(1, (r - 0.15) / 0.25))) : 1 - ss(Math.max(0, Math.min(1, (r - 0.5) / 0.22)));
      }
      m.mag.position.y = m.magY - 0.3 * drop;
      m.mag.visible = drop < 0.95;
    }

    if (s.attack >= 0) {
      const t = s.attack, sw = Math.sin(Math.min(t, 1) * Math.PI);
      if (this.current === 'knife') {
        ry += (0.7 - 1.8 * t) * sw; rz -= 0.9 * sw; rx -= 0.3 * sw;
        x -= 0.12 * sw; z -= 0.12 * sw;
      } else if (m.fists) {
        const f = m.fists[this.punchSide];
        f.position.z = -0.24 * sw;
        f.position.y = 0.05 * sw;
        m.fists[this.punchSide ^ 1].position.z *= 0.8;
      }
    } else if (m.fists) {
      for (const f of m.fists) { f.position.z *= 0.8; f.position.y *= 0.8; }
    }

    if (s.throwT >= 0) {
      const sw = Math.sin(Math.min(s.throwT, 1) * Math.PI);
      y -= 0.2 * sw; rx -= 0.5 * sw;
    }

    this.drawT = Math.min(1, this.drawT + dt / 0.3);
    const d = 1 - Math.pow(1 - this.drawT, 3);
    y -= 0.25 * (1 - d); rx -= 0.7 * (1 - d);

    this.kick *= Math.exp(-dt * 16);
    z += this.kick * 0.05 * (1 - 0.5 * a);
    rx += this.kick * 0.07 * (1 - 0.5 * a);

    this.root.position.set(x, y, z);
    this.root.rotation.set(rx, ry, rz);
    this.flashT -= dt;
    this.flash.visible = this.flashT > 0;
  }
}
