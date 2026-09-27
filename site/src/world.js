import * as THREE from 'three';

// The level: sky, lights and skyline stay put; world.load(map) swaps the map's blocks and colours.
export function buildWorld(scene, renderer) {
  const colliders = []; // shared by physics, bots and effects; refilled in place on each load
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

  const crateTex = canvasTex((g, s) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 16) { g.fillStyle = y % 32 ? '#f2f2f2' : '#e6e6e6'; g.fillRect(0, y, s, 16); }
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 18; g.strokeRect(0, 0, s, s);
    g.lineWidth = 10; g.beginPath();
    g.moveTo(10, 10); g.lineTo(s - 10, s - 10); g.moveTo(s - 10, 10); g.lineTo(10, s - 10); g.stroke();
  });

  const swirl = canvasTex((g, s) => {
    const c = s / 2;
    const grad = g.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0.15)');
    g.fillStyle = grad; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 5;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      for (let a = 0; a < 5.5; a += 0.1) {
        const r = a * 11, t = a + k * Math.PI / 2;
        g.lineTo(c + Math.cos(t) * r, c + Math.sin(t) * r);
      }
      g.stroke();
    }
  }, 256);
  swirl.wrapS = swirl.wrapT = THREE.ClampToEdgeWrapping;
  swirl.center.set(0.5, 0.5);

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

  // ---- Sky, fog, lights, distant skyline (recoloured per map)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = max(vP.y, 0.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.55)), 1.0);\n#include <colorspace_fragment>\n}',
  }));
  sky.renderOrder = -1;
  scene.add(sky);
  scene.fog = new THREE.Fog(0xffffff, 70, 260);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(28, 50, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  const skyline = new THREE.Group();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 + Math.random() * 0.05;
    const r = 110 + Math.random() * 60;
    const w = 8 + Math.random() * 14, h = 10 + Math.random() * 40;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshLambertMaterial());
    m.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r);
    m.rotation.y = Math.random() * Math.PI;
    skyline.add(m);
  }
  scene.add(skyline);

  // ---- The current map
  let level = null;
  let mats = {};

  function load(map) {
    if (level) {
      scene.remove(level);
      level.traverse(o => o.geometry && o.geometry.dispose());
      for (const m of Object.values(mats)) m.dispose();
    }
    level = new THREE.Group();
    scene.add(level);
    mats = {};
    colliders.length = 0;
    const t = map.theme;

    const mat = name => {
      if (!mats[name]) {
        const colour = t.colors[name] ?? 0xff00ff;
        mats[name] = name.startsWith('neon') || name === 'portalframe'
          ? new THREE.MeshBasicMaterial({ color: t.colors[name] ?? 0x40e0ff }) // glows: not affected by light
          : new THREE.MeshStandardMaterial({ color: colour, map: name.startsWith('crate') ? crateTex : panel, roughness: 0.85 });
      }
      return mats[name];
    };
    const addBox = (x, z, w, d, h, y, colour, tile, solid) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      if (tile) tileUVs(geo, w, h, d, tile);
      const m = new THREE.Mesh(geo, mat(colour));
      m.position.set(x, y + h / 2, z);
      m.castShadow = h > 0.05;
      m.receiveShadow = true;
      level.add(m);
      if (solid) colliders.push(new THREE.Box3(new THREE.Vector3(x - w / 2, y, z - d / 2), new THREE.Vector3(x + w / 2, y + h, z + d / 2)));
      return m;
    };
    const b = builder((x, z, w, d, h, y, colour, tile, solid) => addBox(x, z, w, d, h, y, colour, tile, solid), extra);

    // Map features: jump pads, teleporters, lights, power-up spots
    world.pads = []; world.portals = []; world.powers = []; world.links = []; world.waypoints = [];
    const byPair = {};
    function extra(kind, a) {
      if (kind === 'pad') {
        const pad = { pos: new THREE.Vector3(a.x, a.y, a.z), target: new THREE.Vector3(a.tx, a.ty, a.tz) };
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 24), new THREE.MeshBasicMaterial({ color: 0x3dff8a }));
        disc.position.set(a.x, a.y + 0.06, a.z);
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 1.6, 24, 1, true), new THREE.MeshBasicMaterial({
          color: 0x7dffb0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        ring.position.set(a.x, a.y + 0.8, a.z);
        level.add(disc, ring);
        pad.ring = ring;
        world.pads.push(pad);
        world.links.push({ from: pad.pos, to: pad.target });
      } else if (kind === 'portal') {
        const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
        const p = { x: a.x, y: a.y, z: a.z, yaw: a.yaw, fx, fz, rx: -fz, rz: fx };
        const colour = a.colour ?? 0x40e0ff;
        const alongX = Math.abs(fz) > 0.5; // opening spans x when facing along z
        // frame: two posts and a beam (solid), plus the glowing swirl (walk-through)
        const post = (o) => alongX ? addBox(a.x + o, a.z, 0.3, 0.5, 3, a.y, 'portalframe', 0, true)
                                   : addBox(a.x, a.z + o, 0.5, 0.3, 3, a.y, 'portalframe', 0, true);
        post(1.3); post(-1.3);
        if (alongX) addBox(a.x, a.z, 2.9, 0.5, 0.3, a.y + 3, 'portalframe', 0, true);
        else addBox(a.x, a.z, 0.5, 2.9, 0.3, a.y + 3, 'portalframe', 0, true);
        const face = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.9), new THREE.MeshBasicMaterial({
          map: swirl, color: colour, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        face.position.set(a.x, a.y + 1.5, a.z);
        face.rotation.y = a.yaw;
        level.add(face);
        const light = new THREE.PointLight(colour, 25, 9, 2);
        light.position.set(a.x + fx * 0.6, a.y + 1.6, a.z + fz * 0.6);
        level.add(light);
        (byPair[a.pair] ||= []).push(p);
        world.portals.push(p);
      } else if (kind === 'light') {
        const l = new THREE.PointLight(a.colour, a.intensity ?? 60, a.distance ?? 20, 2);
        l.position.set(a.x, a.y, a.z);
        level.add(l);
      } else if (kind === 'stairs') {
        world.waypoints.push(new THREE.Vector3(...a.bottom), new THREE.Vector3(...a.top));
      } else if (kind === 'power') {
        world.powers.push(new THREE.Vector3(a.x, a.y, a.z));
      }
    }

    // floor and perimeter, then the map itself
    addBox(0, 0, 64, 64, 1, -1, 'floor', 2, true).castShadow = false;
    const wh = t.wallHeight || 5;
    addBox(0, 30.5, 62, 1, wh, 0, 'wall', 2, true);
    addBox(0, -30.5, 62, 1, wh, 0, 'wall', 2, true);
    addBox(30.5, 0, 1, 62, wh, 0, 'wall', 2, true);
    addBox(-30.5, 0, 1, 62, wh, 0, 'wall', 2, true);
    map.build(b);

    // pair the teleporters up; each one's exit is just in front of its partner
    for (const [a, c] of Object.values(byPair)) {
      if (!c) continue;
      a.other = c; c.other = a;
      for (const [p, o] of [[a, c], [c, a]]) {
        world.links.push({ from: new THREE.Vector3(p.x, p.y, p.z), to: new THREE.Vector3(o.x + o.fx * 1.4, o.y, o.z + o.fz * 1.4) });
      }
    }

    sky.material.uniforms.top.value.setHex(t.sky[0]);
    sky.material.uniforms.bottom.value.setHex(t.sky[1]);
    scene.fog.color.setHex(t.fog);
    [scene.fog.near, scene.fog.far] = t.fogRange || [70, 260];
    sun.color.setHex(t.sun[0]); sun.intensity = t.sun[1];
    hemi.color.setHex(t.hemi[0]); hemi.groundColor.setHex(t.hemi[1]); hemi.intensity = t.hemi[2];
    skyline.children.forEach((m, i) => m.material.color.setHex(t.skyline[i % t.skyline.length]));

    world.playerSpawn.set(map.spawn.x, map.spawn.y || 0, map.spawn.z);
    world.spawnYaw = map.spawn.yaw;
    world.map = map;
  }

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

  // Animate pads and portals
  let clock = 0;
  function update(dt) {
    clock += dt;
    swirl.rotation = -clock * 2.2;
    for (const p of world.pads) {
      const k = (clock * 1.2 + p.pos.x) % 1;
      p.ring.scale.set(1 - k * 0.3, 0.4 + k, 1 - k * 0.3);
      p.ring.position.y = p.pos.y + 0.3 + k * 1.2;
      p.ring.material.opacity = 0.45 * (1 - k);
    }
  }

  // Jump pads and teleporters act on anything that moves: the player and the bots.
  // Returns 'pad' or 'portal' (with the exit portal) so the caller can play a sound or turn the camera.
  function applyFeatures(e, dt) {
    e.tpCd = (e.tpCd || 0) - dt;
    for (const pad of world.pads) {
      if (Math.hypot(e.pos.x - pad.pos.x, e.pos.z - pad.pos.z) < 1.1 && e.pos.y >= pad.pos.y - 0.05 && e.pos.y <= pad.pos.y + 0.5 && e.vel.y <= 0.5) {
        const dx = pad.target.x - pad.pos.x, dz = pad.target.z - pad.pos.z, dy = pad.target.y - pad.pos.y;
        const T = Math.min(1.5, Math.max(0.7, 0.55 + Math.hypot(dx, dz) / 14));
        e.pos.x = pad.pos.x; e.pos.z = pad.pos.z;
        e.vel.set(dx / T, (dy + 12 * T * T) / T, dz / T);
        e.grounded = false;
        e.padFlight = true; // no steering mid-air, so you land where the pad aims
        return { type: 'pad', pad };
      }
    }
    if (e.tpCd <= 0) {
      for (const p of world.portals) {
        if (!p.other) continue;
        const dx = e.pos.x - p.x, dz = e.pos.z - p.z;
        const f = dx * p.fx + dz * p.fz, r = dx * p.rx + dz * p.rz;
        if (Math.abs(f) < 0.45 && Math.abs(r) < 1.1 && e.pos.y >= p.y - 0.2 && e.pos.y < p.y + 2.5) {
          const o = p.other;
          const speed = Math.max(Math.hypot(e.vel.x, e.vel.z), 4);
          e.pos.set(o.x + o.fx * 1.4, o.y, o.z + o.fz * 1.4);
          e.vel.set(o.fx * speed, 0, o.fz * speed);
          e.tpCd = 1;
          return { type: 'portal', exit: o };
        }
      }
    }
    return null;
  }

  const world = {
    colliders, rayWorld, los, sky, load, update, applyFeatures, map: null,
    pads: [], portals: [], powers: [], links: [],
    playerSpawn: new THREE.Vector3(), spawnYaw: 0,
  };
  return world;
}

// The helpers a map's build(b) uses. `put` receives every block; the world makes meshes from them,
// drawPlan() just draws them.
function builder(put, extra = () => {}) {
  const b = {
    // jump pad at x,y,z that throws you to tx,ty,tz
    pad: (x, y, z, tx, ty, tz) => extra('pad', { x, y, z, tx, ty, tz }),
    // teleporter facing yaw (0 = facing -z); two portals with the same pair name are linked
    portal: (pair, x, y, z, yaw, colour) => extra('portal', { pair, x, y, z, yaw, colour }),
    light: (x, y, z, colour, intensity, distance) => extra('light', { x, y, z, colour, intensity, distance }),
    power: (x, y, z) => extra('power', { x, y, z }),
    box: (x, z, w, d, h, y = 0, colour = 'cream', tile = 2) => put(x, z, w, d, h, y, colour, tile, true),
    decor: (x, z, w, d, h, y = 0, colour = 'paint') => put(x, z, w, d, h, y, colour, 0, false),
    crate: (x, z, s = 1.2, y = 0, colour = 'crate') => put(x, z, s, s, s, y, colour, 0, true),
    // steps climbing to a platform edge at edgeZ (or edgeX); dir = +1/-1 is the way they run out from it
    // base = height the stairs start from (e.g. a ledge); steps are solid columns from the ground up
    // Also marks the bottom and top of each staircase as bot waypoints.
    stairsZ(x, edgeZ, dir, width, height, steps, depth, colour, base = 0) {
      for (let i = 0; i < steps; i++) b.box(x, edgeZ + dir * (steps - i - 0.5) * depth, width, depth, base + height * (i + 1) / steps, 0, colour, 1);
      extra('stairs', { bottom: [x, base, edgeZ + dir * (steps * depth + 0.7)], top: [x, base + height, edgeZ - dir * 0.8] });
    },
    stairsX(z, edgeX, dir, width, height, steps, depth, colour, base = 0) {
      for (let i = 0; i < steps; i++) b.box(edgeX + dir * (steps - i - 0.5) * depth, z, depth, width, base + height * (i + 1) / steps, 0, colour, 1);
      extra('stairs', { bottom: [edgeX + dir * (steps * depth + 0.7), base, z], top: [edgeX - dir * 0.8, base + height, z] });
    },
  };
  return b;
}

// A top-down picture of a map for the map picker, drawn from the same build(b) as the 3D level.
export function drawPlan(canvas, map) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, scale = W / 62;
  const hex = n => `#${n.toString(16).padStart(6, '0')}`;
  const shade = (n, k) => {
    const r = Math.min(255, (n >> 16 & 255) * k), gg = Math.min(255, (n >> 8 & 255) * k), bl = Math.min(255, (n & 255) * k);
    return `rgb(${r | 0},${gg | 0},${bl | 0})`;
  };
  const c = map.theme.colors;
  g.fillStyle = hex(c.floor); g.fillRect(0, 0, W, H);
  const rects = [];
  const marks = [];
  map.build(builder((x, z, w, d, h, y, colour) => rects.push({ x, z, w, d, top: y + h, colour }),
    (kind, a) => { if (kind === 'pad' || kind === 'portal' || kind === 'power') marks.push({ kind, ...a }); }));
  rects.sort((a, b) => a.top - b.top);
  for (const r of rects) {
    const px = (r.x - r.w / 2 + 31) * scale, pz = (r.z - r.d / 2 + 31) * scale;
    g.fillStyle = shade(c[r.colour] ?? 0x888888, 0.8 + Math.min(r.top, 9) * 0.04);
    g.fillRect(px, pz, r.w * scale, r.d * scale);
    if (r.top > 0.1) { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.strokeRect(px + 0.5, pz + 0.5, r.w * scale - 1, r.d * scale - 1); }
  }
  for (const m of marks) {
    g.fillStyle = m.kind === 'pad' ? '#3dff8a' : m.kind === 'portal' ? hex(m.colour ?? 0x40e0ff) : '#ffd23f';
    g.beginPath(); g.arc((m.x + 31) * scale, (m.z + 31) * scale, scale * 1.3, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = hex(c.wall); g.lineWidth = scale; g.strokeRect(scale / 2, scale / 2, W - scale, H - scale);
}
