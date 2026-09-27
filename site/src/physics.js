export const GRAVITY = 24;
export const STEP_HEIGHT = 0.45;
const EPS = 0.001;

// Entity: { pos (feet), vel, radius, height, grounded, blocked }
function overlaps(p, r, h, b) {
  return p.x + r > b.min.x && p.x - r < b.max.x &&
         p.z + r > b.min.z && p.z - r < b.max.z &&
         p.y + h > b.min.y && p.y < b.max.y;
}

export function collides(p, r, h, colliders) {
  for (const b of colliders) if (overlaps(p, r, h, b)) return b;
  return null;
}

// Moves an entity one axis at a time against axis-aligned boxes.
// Returns how far it stepped up this frame (for smoothing the camera).
export function moveEntity(e, dt, colliders) {
  e.blocked = false;
  let stepped = 0;
  const canStep = e.grounded || e.vel.y <= 0;

  for (const axis of ['x', 'z']) {
    const d = e.vel[axis] * dt;
    if (d === 0) continue;
    e.pos[axis] += d;
    for (const b of colliders) {
      if (!overlaps(e.pos, e.radius, e.height, b)) continue;
      const rise = b.max.y - e.pos.y;
      if (canStep && rise > 0 && rise <= STEP_HEIGHT) {
        const oldY = e.pos.y;
        e.pos.y = b.max.y;
        if (!collides(e.pos, e.radius, e.height, colliders)) { stepped += rise; continue; }
        e.pos.y = oldY;
      }
      e.pos[axis] = d > 0 ? b.min[axis] - e.radius - EPS : b.max[axis] + e.radius + EPS;
      e.vel[axis] = 0;
      e.blocked = true;
    }
  }

  e.vel.y -= GRAVITY * dt;
  e.pos.y += e.vel.y * dt;
  e.grounded = false;
  for (const b of colliders) {
    if (!overlaps(e.pos, e.radius, e.height, b)) continue;
    if (e.vel.y <= 0) { e.pos.y = b.max.y; e.grounded = true; }
    else e.pos.y = b.min.y - e.height - EPS;
    e.vel.y = 0;
  }
  return stepped;
}
