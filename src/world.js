import * as THREE from 'three';

export function buildWorld(scene, renderer) {
  const colliders = [];
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  function canvasTex(draw, size = 128) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    return t;
  }

  const panel = canvasTex((g, s) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 700; i++) {
      const v = 226 + Math.random() * 29 | 0;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(Math.random() * s, Math.random() * s, 3, 3);
    }
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 6; g.strokeRect(0, 0, s, s);
  });

  const crate = canvasTex((g, s) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 16) { g.fillStyle = y % 32 ? '#f2f2f2' : '#e6e6e6'; g.fillRect(0, y, s, 16); }
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 18; g.strokeRect(0, 0, s, s);
    g.lineWidth = 10; g.beginPath();
    g.moveTo(10, 10); g.lineTo(s - 10, s - 10); g.moveTo(s - 10, 10); g.lineTo(10, s - 10); g.stroke();
  });

  // Scales a box's UVs so the texture tiles at a fixed world size instead of stretching.
  function tileUVs(geo, w, h, d, tile) {
    const uv = geo.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0] / tile, uv.getY(k) * dims[f][1] / tile);
    }
    uv.needsUpdate = true;
  }

  const M = (color, map = panel) => new THREE.MeshStandardMaterial({ color, map, roughness: 0.85, metalness: 0 });
  const mats = {
    floor: M(0xd3d9e2), wall: M(0x6f7f9c), teal: M(0x33b5c7), yellow: M(0xf4b63f),
    cream: M(0xeee5d3), blue: M(0x5a6fe0), low: M(0xa3adb9), pillar: M(0xe0605a),
    crate: M(0xe8913f, crate), crate2: M(0xc9733a, crate), purple: M(0x9b6be0),
  };

  // x/z = centre, y = bottom
  function box(x, z, w, d, h, y = 0, mat = mats.cream, tile = 2) {
    const geo = new THREE.BoxGeometry(w, h, d);
    if (tile) tileUVs(geo, w, h, d, tile);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    colliders.push(new THREE.Box3(new THREE.Vector3(x - w / 2, y, z - d / 2), new THREE.Vector3(x + w / 2, y + h, z + d / 2)));
    return m;
  }
  const crateBox = (x, z, s = 1.2, y = 0, mat = mats.crate) => box(x, z, s, s, s, y, mat, 0);

  // Stairs climbing towards a platform edge at edgeZ; dir = +1/-1 is the way they run out from it.
  function stairsZ(x, edgeZ, dir, width, height, steps, depth, mat) {
    for (let i = 0; i < steps; i++) {
      box(x, edgeZ + dir * (steps - i - 0.5) * depth, width, depth, height * (i + 1) / steps, 0, mat, 1);
    }
  }

  // ---- Floor and perimeter
  box(0, 0, 64, 64, 1, -1, mats.floor, 2).castShadow = false;
  box(0, 30.5, 62, 1, 5, 0, mats.wall);
  box(0, -30.5, 62, 1, 5, 0, mats.wall);
  box(30.5, 0, 1, 62, 5, 0, mats.wall);
  box(-30.5, 0, 1, 62, 5, 0, mats.wall);

  // ---- Centre platform with stairs north and south
  box(0, 0, 10, 10, 2.5, 0, mats.teal);
  stairsZ(0, 5, 1, 3, 2.5, 6, 0.6, mats.teal);
  stairsZ(0, -5, -1, 3, 2.5, 6, 0.6, mats.teal);
  for (const s of [1, -1]) {
    box(-3.5, 4.8 * s, 3, 0.4, 1.0, 2.5, mats.low);
    box(3.5, 4.8 * s, 3, 0.4, 1.0, 2.5, mats.low);
    box(4.8 * s, 0, 0.4, 4, 1.0, 2.5, mats.low);
  }
  crateBox(0, 0, 1.2, 2.5);

  // ---- Corner platforms (NE and SW): stairs plus a crate to jump up from
  for (const s of [1, -1]) {
    box(24 * s, 24 * s, 8, 8, 2.4, 0, mats.yellow);
    stairsZ(26 * s, 20 * s, -s, 2.5, 2.4, 6, 0.6, mats.yellow);
    box(20.2 * s, 25 * s, 0.4, 5, 1.0, 2.4, mats.low);
    crateBox(19.2 * s, 22.5 * s);
  }

  // ---- L-shaped hideouts (NW and SE)
  for (const s of [1, -1]) {
    box(-23 * s, 16 * s, 8, 0.8, 3.5, 0, mats.blue);
    box(-19 * s, 20.6 * s, 0.8, 8.4, 3.5, 0, mats.blue);
    crateBox(-25 * s, 27 * s);
    crateBox(-23.8 * s, 27 * s, 1.2, 0, mats.crate2);
    crateBox(-25 * s, 27 * s, 1.2, 1.2);
  }

  // ---- Side lanes: tall walls with climbable crate stacks
  for (const s of [1, -1]) {
    box(-14 * s, 2 * s, 0.8, 7, 3.5, 0, mats.cream);
    crateBox(-12.8 * s, -3 * s);
    crateBox(-12.8 * s, -3 * s, 1.2, 1.2, mats.crate2);
    crateBox(-12.8 * s, -4.2 * s);
    box(-24 * s, 0, 6, 0.6, 1.0, 0, mats.low);
    crateBox(-21 * s, 6 * s);
  }

  // ---- Mid cover: low walls, pillars, big crates
  box(0, 17, 10, 0.6, 1.0, 0, mats.low);
  box(0, -17, 10, 0.6, 1.0, 0, mats.low);
  for (const [x, z] of [[-8, 14], [8, -14], [8, 14], [-8, -14]]) box(x, z, 1.4, 1.4, 5, 0, mats.pillar);
  box(7, 8, 2, 2, 2, 0, mats.crate, 0);
  box(-7, -8, 2, 2, 2, 0, mats.crate, 0);
  crateBox(-6, 11); crateBox(6, -11);
  box(12, 24, 2, 2, 2, 0, mats.crate2, 0);
  box(-12, -24, 2, 2, 2, 0, mats.crate2, 0);
  box(-4, 24, 0.8, 5, 3, 0, mats.purple);
  box(4, -24, 0.8, 5, 3, 0, mats.purple);

  // ---- Distant skyline (decoration only, no collision)
  const skyline = new THREE.Group();
  const colours = [0xf6c28b, 0x9fd3c7, 0xf4a6a6, 0xb8c4f0, 0xf7e08c];
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 + Math.random() * 0.05;
    const r = 110 + Math.random() * 60;
    const w = 8 + Math.random() * 14, h = 10 + Math.random() * 40;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w),
      new THREE.MeshLambertMaterial({ color: colours[i % colours.length] }));
    m.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r);
    m.rotation.y = Math.random() * Math.PI;
    skyline.add(m);
  }
  scene.add(skyline);

  // ---- Sky, fog, lights
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3d9cf0) }, bottom: { value: new THREE.Color(0xd6efff) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = max(vP.y, 0.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.55)), 1.0);\n#include <colorspace_fragment>\n}',
  }));
  sky.renderOrder = -1;
  scene.add(sky);
  scene.fog = new THREE.Fog(0xcfe6fb, 70, 260);

  scene.add(new THREE.HemisphereLight(0xdcecff, 0x8a7c66, 1.4));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.position.set(28, 50, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  // ---- Ray queries against the level
  const ray = new THREE.Ray();
  const p = new THREE.Vector3();
  function rayWorld(origin, dir, maxDist) {
    ray.set(origin, dir);
    let best = maxDist, bestBox = null;
    const hit = new THREE.Vector3();
    for (const b of colliders) {
      if (ray.intersectBox(b, p)) {
        const d = p.distanceTo(origin);
        if (d < best) { best = d; bestBox = b; hit.copy(p); }
      }
    }
    if (!bestBox) return null;
    const normal = new THREE.Vector3();
    const e = 0.002;
    if (Math.abs(hit.x - bestBox.min.x) < e) normal.set(-1, 0, 0);
    else if (Math.abs(hit.x - bestBox.max.x) < e) normal.set(1, 0, 0);
    else if (Math.abs(hit.y - bestBox.max.y) < e) normal.set(0, 1, 0);
    else if (Math.abs(hit.y - bestBox.min.y) < e) normal.set(0, -1, 0);
    else if (Math.abs(hit.z - bestBox.min.z) < e) normal.set(0, 0, -1);
    else normal.set(0, 0, 1);
    return { dist: best, point: hit, normal };
  }

  const losDir = new THREE.Vector3();
  function los(a, b) {
    losDir.subVectors(b, a);
    const len = losDir.length();
    if (len < 1e-4) return true;
    losDir.divideScalar(len);
    return !rayWorld(a, losDir, len);
  }

  return {
    colliders, rayWorld, los, sky,
    playerSpawn: new THREE.Vector3(0, 0, -26.5),
    spawnYaw: Math.PI, // facing +z, into the arena
  };
}
