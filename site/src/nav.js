import * as THREE from 'three';
import { collides } from './physics.js';

// Waypoint grid over the ground floor, linked where a bot can walk in a straight line.
export function buildNav(world) {
  const { colliders, rayWorld } = world;
  const nodes = [];
  for (let x = -27; x <= 27; x += 3) {
    for (let z = -27; z <= 27; z += 3) {
      const p = new THREE.Vector3(x, 0, z);
      if (!collides(p, 0.75, 1.9, colliders)) nodes.push(p);
    }
  }

  const dir = new THREE.Vector3(), a = new THREE.Vector3(), side = new THREE.Vector3();
  function clear(from, to) {
    dir.subVectors(to, from); dir.y = 0;
    const len = dir.length();
    if (len < 1e-3) return true;
    dir.divideScalar(len);
    side.set(-dir.z, 0, dir.x);
    for (const h of [0.55, 1.5]) {
      for (const off of [-0.45, 0, 0.45]) {
        a.copy(from).addScaledVector(side, off);
        a.y = from.y + h;
        if (rayWorld(a, dir, len)) return false;
      }
    }
    return true;
  }

  const adj = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = nodes[i].distanceTo(nodes[j]);
      if (d <= 6.5 && clear(nodes[i], nodes[j])) { adj[i].push([j, d]); adj[j].push([i, d]); }
    }
  }

  function nearest(pos) {
    const order = nodes.map((n, i) => [n.distanceToSquared(pos), i]).sort((x, y) => x[0] - y[0]);
    for (let k = 0; k < Math.min(10, order.length); k++) {
      if (clear(pos, nodes[order[k][1]])) return order[k][1];
    }
    return order[0][1];
  }

  function findPath(from, to) {
    if (clear(from, to)) return [to.clone()];
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
    if (clear(path[path.length - 1], to)) path.push(to.clone());
    return path;
  }

  function randomPath(from) {
    const far = nodes.filter(n => n.distanceTo(from) > 10);
    const target = far[Math.random() * far.length | 0] || nodes[0];
    return findPath(from, target);
  }

  return { nodes, findPath, randomPath };
}
