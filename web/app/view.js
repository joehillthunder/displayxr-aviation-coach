// Where the camera goes to look at a part. Pure maths, shared by the 3D stage and the tests (which
// check that every part is actually visible from its own fly-to view).

export const MIN_DIST = 0.55; // metres; nearest the camera (and the rig's convergence) may get
export const FOCUS_DIST = { default: 0.9, propeller: 2.3 };

/** Orbit parameters { yaw, pitch, dist } that look at a part from its preferred side. */
export function focusView(part) {
  const d = part?.viewDir || [0.5, 0.5, 0.7];
  const n = Math.hypot(d[0], d[1], d[2]) || 1;
  return {
    yaw: Math.atan2(d[0] / n, d[2] / n),
    pitch: Math.asin(Math.max(-0.98, Math.min(0.98, d[1] / n))),
    dist: Math.max(MIN_DIST, FOCUS_DIST[part?.id] ?? FOCUS_DIST.default),
  };
}

/** Camera position for an orbit around `target` ([x,y,z] or {x,y,z}). */
export function orbitPosition(target, { yaw, pitch, dist }) {
  const t = Array.isArray(target) ? { x: target[0], y: target[1], z: target[2] } : target;
  const cp = Math.cos(pitch);
  return [t.x + dist * cp * Math.sin(yaw), t.y + dist * Math.sin(pitch), t.z + dist * cp * Math.cos(yaw)];
}
