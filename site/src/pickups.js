import * as THREE from 'three';
import { collides } from './physics.js';

// Ammo boxes: a few are out at a time; each one collected reappears somewhere else.
const SPOTS = [
  [2.8, 2.5, -2.8], [25, 2.4, 26], [-25, 2.4, -26], [-25, 0, 3], [25, 0, -3], [-23, 0, 21], [23, 0, -21],
  [-10, 0, 6], [10, 0, -6], [0, 0, 12], [0, 0, -12], [15, 0, 25], [-15, 0, -25], [-18, 0, -12], [18, 0, 12],
];
const ACTIVE = 3;
const RESPAWN = 3;

export class Pickups {
  constructor(scene, world) {
    this.scene = scene;
    this.spots = SPOTS.map(s => new THREE.Vector3(...s))
      .filter(p => !collides(new THREE.Vector3(p.x, p.y + 0.05, p.z), 0.4, 1, world.colliders));
    const boxGeo = new THREE.BoxGeometry(0.6, 0.45, 0.45);
    const bandGeo = new THREE.BoxGeometry(0.62, 0.12, 0.47);
    const beamGeo = new THREE.CylinderGeometry(0.28, 0.28, 7, 12, 1, true).translate(0, 3.5, 0);
    const green = new THREE.MeshStandardMaterial({ color: 0x35d06e, roughness: 0.5, emissive: 0x0f5a28, emissiveIntensity: 0.6 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.5 });
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x5cff8f, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.items = [];
    for (let i = 0; i < ACTIVE; i++) {
      const g = new THREE.Group();
      const box = new THREE.Group();
      const b = new THREE.Mesh(boxGeo, green);
      b.castShadow = true;
      box.add(b, new THREE.Mesh(bandGeo, yellow));
      g.add(box, new THREE.Mesh(beamGeo, beamMat));
      scene.add(g);
      this.items.push({ group: g, box, spot: -1, wait: 0 });
    }
    this.t = 0;
    this.reset();
  }

  freeSpot(exclude) {
    const used = new Set(this.items.map(i => i.spot));
    const options = this.spots.map((_, i) => i).filter(i => !used.has(i) && i !== exclude);
    return options[Math.random() * options.length | 0];
  }

  place(item, exclude = -1) {
    item.spot = -1;
    item.spot = this.freeSpot(exclude);
    item.group.position.copy(this.spots[item.spot]);
    item.group.visible = true;
    item.wait = 0;
  }

  reset() {
    for (const it of this.items) it.spot = -1;
    for (const it of this.items) this.place(it);
  }

  // wants(): does the player need anything? collect(): give it to them.
  update(dt, playerPos, wants, collect) {
    this.t += dt;
    for (const it of this.items) {
      if (!it.group.visible) {
        it.wait -= dt;
        if (it.wait <= 0) this.place(it, it.lastSpot);
        continue;
      }
      it.box.position.y = 0.5 + Math.sin(this.t * 2.5 + it.spot) * 0.1;
      it.box.rotation.y = this.t * 1.5;
      const p = it.group.position;
      if (Math.hypot(playerPos.x - p.x, playerPos.z - p.z) < 1.2 && Math.abs(playerPos.y - p.y) < 1.2 && wants()) {
        collect();
        it.group.visible = false;
        it.lastSpot = it.spot;
        it.spot = -1;
        it.wait = RESPAWN;
      }
    }
  }
}
