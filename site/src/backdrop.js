// The slowly orbiting arena behind the phone/tablet page: scenery only (no bots, sound or game code),
// drawn at a lower resolution, no shadows, about 30 frames a second, paused while the tab is hidden.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { mapById } from './maps.js';

export function start() {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = false;
  document.getElementById('game').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1200);
  const world = buildWorld(scene, renderer);
  world.load(mapById(localStorage.getItem('blockstrike.map')));

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });

  let t = 0, last = performance.now(), skip = false;
  function frame(now) {
    requestAnimationFrame(frame);
    skip = !skip;
    if (skip) return; // every other frame is plenty for a slow orbit
    t += Math.min((now - last) / 1000, 0.1);
    last = now;
    const a = t * 0.05;
    // a little further out on a tall phone screen so the arena fits
    const r = camera.aspect < 1 ? 52 : 40;
    camera.position.set(Math.sin(a) * r, 22, Math.cos(a) * r);
    camera.lookAt(0, 1.5, 0);
    world.sky.position.copy(camera.position);
    world.update(0.033);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
