import * as THREE from 'three';
import { STEP_HEIGHT } from './physics.js';

// Waypoints for bots, on every level of the map (ground, platforms, rooftops, ledges).
// Two waypoints are linked when a bot could walk from one to the other: stepping up stairs,
// dropping off ledges (one way), not through walls. Jump pads and teleporters add one-way links.
// Call nav.rebuild() after the world loads a map.
const R = 0.4, H = 1.8;
const GRID = 3;

export function buildNav(world) {
  const { colliders } = world;
  let nodes = [], adj = [];

  const inXZ = (b, x, z, pad = 0) => x > b.min.x - pad && x < b.max.x + pad && z > b.min.z - pad && z < b.max.z + pad;

  // Highest surface under a bot's feet at x,z that it could be standing on from height y
  // (it can step up STEP_HEIGHT). Its feet cover a small area, so edges between steps don't count as gaps.
  const FEET = 0.3;
  function groundBelow(list, x, z, y) {
    let g = -Infinity;
    for (const b of list) if (inXZ(b, x, z, FEET) && b.max.y <= y + STEP_HEIGHT + 1e-3 && b.max.y > g) g = b.max.y;
    return g;
  }
  // Is a bot standing at x,y,z pushed into something it can't step onto?
  function blockedAt(list, x, y, z) {
    for (const b of list) {
      if (inXZ(b, x, z, R) && b.max.y > y + STEP_HEIGHT + 1e-3 && b.min.y < y + H) return true;
    }
    return false;
  }
  // Colliders near the line from a to b, so each walk check only looks at a handful of boxes
  function near(a, b) {
    const x0 = Math.min(a.x, b.x) - R - 0.1, x1 = Math.max(a.x, b.x) + R + 0.1;
    const z0 = Math.min(a.z, b.z) - R - 0.1, z1 = Math.max(a.z, b.z) + R + 0.1;
    return colliders.filter(c => c.max.x > x0 && c.min.x < x1 && c.max.z > z0 && c.min.z < z1);
  }

  // Can a bot walk in a straight line from a to b (following the ground, stepping up, dropping down)?
  function walk(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    const list = near(a, b);
    const n = Math.max(1, Math.ceil(len / 0.5));
    let y = a.y;
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = a.x + dx * t, z = a.z + dz * t;
      y = groundBelow(list, x, z, y);
      if (y === -Infinity || blockedAt(list, x, y, z)) return false;
    }
    return Math.abs(y - b.y) < 0.35;
  }

  function rebuild() {
    // candidate waypoints: every surface under each grid point that a bot fits on
    const cand = [];
    for (let x = -27; x <= 27; x += GRID) {
      for (let z = -27; z <= 27; z += GRID) {
        const tops = new Set([0]);
        for (const b of colliders) if (inXZ(b, x, z) && b.max.y > 0) tops.add(+b.max.y.toFixed(3));
        for (const y of tops) {
          const list = colliders.filter(b => inXZ(b, x, z, R + 0.1));
          if (groundBelow(list, x, z, y) === y && !blockedAt(list, x, y, z)) cand.push(new THREE.Vector3(x, y, z));
        }
      }
    }
    // the bottom and top of every staircase (the grid is too coarse to find narrow stairs by itself)
    for (const w of world.waypoints || []) cand.push(w.clone());
    // jump pads and teleporters: their start and end points become waypoints with a one-way link
    const links = (world.links || []).map(l => {
      const a = cand.push(l.from.clone()) - 1, b = cand.push(l.to.clone()) - 1;
      return [a, b];
    });

    const out = cand.map(() => []);
    for (let i = 0; i < cand.length; i++) {
      for (let j = 0; j < cand.length; j++) {
        if (i === j) continue;
        const a = cand[i], b = cand[j];
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d > 9 || b.y - a.y > 6.5 || a.y - b.y > 10) continue; // walk() decides; this just skips hopeless pairs
        if (walk(a, b)) out[i].push([j, d + Math.max(0, b.y - a.y)]);
      }
    }
    for (const [a, b] of links) out[a].push([b, 1]);

    // keep only waypoints that belong to the main connected area (reachable from, and able
    // to get back to, the player's spawn), so bots never spawn somewhere they can't leave
    const sp = world.playerSpawn;
    let root = 0, best = Infinity;
    cand.forEach((p, i) => { const d = p.distanceToSquared(sp); if (d < best) { best = d; root = i; } });
    const fwd = reach(root, out);
    const inn = cand.map(() => []);
    out.forEach((es, i) => es.forEach(([j]) => inn[j].push([i])));
    const back = reach(root, inn);
    const keep = cand.map((_, i) => fwd[i] && back[i]);
    const index = new Map();
    nodes = [];
    cand.forEach((p, i) => { if (keep[i]) { index.set(i, nodes.length); nodes.push(p); } });
    adj = nodes.map(() => []);
    out.forEach((es, i) => {
      if (!keep[i]) return;
      for (const [j, c] of es) if (keep[j]) adj[index.get(i)].push([index.get(j), c]);
    });
  }

  function reach(root, edges) {
    const seen = new Uint8Array(edges.length);
    const stack = [root];
    seen[root] = 1;
    while (stack.length) {
      const i = stack.pop();
      for (const [j] of edges[i]) if (!seen[j]) { seen[j] = 1; stack.push(j); }
    }
    return seen;
  }

  function nearest(pos) {
    const order = nodes.map((n, i) => [n.distanceToSquared(pos), i]).sort((x, y) => x[0] - y[0]);
    for (let k = 0; k < Math.min(10, order.length); k++) {
      if (walk(pos, nodes[order[k][1]])) return order[k][1];
    }
    return order[0][1];
  }

  function findPath(from, to) {
    if (Math.hypot(to.x - from.x, to.z - from.z) < 12 && walk(from, to)) return [to.clone()];
    const s = nearest(from), t = nearest(to), n = nodes.length;
    const g = new Float32Array(n).fill(Infinity), f = new Float32Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
    const open = [s];
    g[s] = 0; f[s] = nodes[s].distanceTo(nodes[t]);
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open[bi];
      if (cur === t) break;
      open.splice(bi, 1);
      closed[cur] = 1;
      for (const [nb, cost] of adj[cur]) {
        if (closed[nb]) continue;
        const ng = g[cur] + cost;
        if (ng < g[nb]) {
          if (g[nb] === Infinity) open.push(nb);
          g[nb] = ng; f[nb] = ng + nodes[nb].distanceTo(nodes[t]); came[nb] = cur;
        }
      }
    }
    if (s !== t && came[t] === -1) return [];
    const path = [];
    for (let c = t; c !== -1; c = came[c]) path.unshift(nodes[c].clone());
    if (walk(path[path.length - 1], to)) path.push(to.clone());
    return path;
  }

  function randomPath(from) {
    const far = nodes.filter(n => n.distanceTo(from) > 10);
    const target = far[Math.random() * far.length | 0] || nodes[0];
    return findPath(from, target);
  }

  return { get nodes() { return nodes; }, rebuild, findPath, randomPath, walk };
}
