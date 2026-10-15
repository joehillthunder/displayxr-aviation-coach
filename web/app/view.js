// Where the camera goes to look at a part. Pure maths, shared by the 3D stage and the tests (which
// check that every part is actually visible from its own fly-to view).

export const MIN_DIST = 0.55; // metres; nearest the camera (and the rig's convergence) may get
export const DEFAULT_FOCUS_DIST = 0.9;

/**
 * Orbit parameters { yaw, pitch, dist } that look at a part from its preferred side. The distance
 * is the part's own `focusDist`, else the training's `stage.focusDist`.
 */
export function focusView(part, stage = {}) {
  const d = part?.viewDir || [0.5, 0.5, 0.7];
  const n = Math.hypot(d[0], d[1], d[2]) || 1;
  return {
    yaw: Math.atan2(d[0] / n, d[2] / n),
    pitch: Math.asin(Math.max(-0.98, Math.min(0.98, d[1] / n))),
    dist: Math.max(MIN_DIST, part?.focusDist ?? stage.focusDist ?? DEFAULT_FOCUS_DIST),
  };
}

/** Camera position for an orbit around `target` ([x,y,z] or {x,y,z}). */
export function orbitPosition(target, { yaw, pitch, dist }) {
  const t = Array.isArray(target) ? { x: target[0], y: target[1], z: target[2] } : target;
  const cp = Math.cos(pitch);
  return [t.x + dist * cp * Math.sin(yaw), t.y + dist * Math.sin(pitch), t.z + dist * cp * Math.cos(yaw)];
}

/**
 * Stereo strength for a camera at `dist` metres. The rig's eyes are 63 mm apart at ipdFactor 1,
 * which is honest for a bench-top engine but nearly flat for a whole aircraft 12 m away. Scaling the
 * eye separation with distance shows any subject as if it were a model about `depthRef` metres from
 * the viewer, so a wing has as much depth as a spark plug. `gain` is the trainee's Depth slider.
 */
export function ipdFactorFor(dist, depthRef = 1.2, gain = 1) {
  return gain * Math.min(12, Math.max(1, dist / depthRef));
}
