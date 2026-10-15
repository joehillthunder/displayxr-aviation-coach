// The built-in "trainer empennage": the tail section of a light airplane, cut off aft of the cabin
// and set on a stand, at real-world scale (metres). The tailcone skin is see-through so the control
// cables, pulleys, turnbuckles and trim actuator inside it are visible. It is the model for the
// flight-control training; flight_controls/parts.json's anchors are measured on it.
//
// Frame: +z forward (toward the cabin), +y up, +x toward the airplane's left. Origin on the floor
// under the cut. See-through meshes carry userData.seeThrough: they never block a pick, a label
// or a fly-to view.

import { makeKit } from './kit.js';

export function buildTrainerEmpennage(THREE) {
  const root = new THREE.Group();
  root.name = 'trainer-empennage';
  const { mat, part, box, cyl, tube, sidePlate, loft, tagParts } = makeKit(THREE, root);

  const white = mat(0xe9ecef, { metalness: 0.15, roughness: 0.45 });
  const stripe = mat(0x1f4f8f, { metalness: 0.2, roughness: 0.45 });
  const steel = mat(0x9aa0a6, { metalness: 0.8, roughness: 0.3 });
  const cableMat = mat(0xd0d6dc, { metalness: 0.9, roughness: 0.25, emissive: 0x202830 });
  const brass = mat(0xc9a43a, { metalness: 0.85, roughness: 0.3 });
  const dark = mat(0x2a2e33, { roughness: 0.7, metalness: 0.2 });

  // ── see-through tailcone skin, bulkheads and stand ──────────────────────────────────────────
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xcfe0ff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, roughness: 0.3, metalness: 0,
  });
  const sections = [
    { z: 1.0, w: 0.95, h: 1.05, y: 1.15 },
    { z: -0.5, w: 0.7, h: 0.8, y: 1.25 },
    { z: -2.0, w: 0.42, h: 0.5, y: 1.35 },
    { z: -3.1, w: 0.18, h: 0.26, y: 1.42 },
    { z: -3.3, w: 0.08, h: 0.16, y: 1.44 },
  ];
  const skin = loft(sections, skinMat);
  skin.userData.seeThrough = true;
  skin.renderOrder = 5;
  // bulkhead rings drawn as thin outlines
  const ringMat = mat(0x7d8a99, { metalness: 0.5, roughness: 0.5 });
  for (const s of [sections[0], { z: 0.25, w: 0.83, h: 0.93, y: 1.2 }, sections[1], { z: -1.25, w: 0.56, h: 0.65, y: 1.3 }, sections[2]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 40), ringMat);
    ring.position.set(0, s.y, s.z);
    ring.scale.set(s.w / 2, s.h / 2, 1);
    ring.userData.seeThrough = true;
    root.add(ring);
  }
  box([0.5, 0.04, 0.4], dark, root, [0, 0.02, 0.5]); // stand base
  cyl(0.03, 0.62, steel, root, [0, 0.33, 0.5]); // stand post (top meets the skin bottom)

  // ── stabilizer, elevator, trim tab ──────────────────────────────────────────────────────────
  const hstab = part('horizontal_stabilizer');
  box([3.4, 0.07, 0.7], white, hstab, [0, 1.4, -2.4]);
  cyl(0.035, 3.4, white, hstab, [0, 1.4, -2.05], 'x', 16); // leading edge

  const elevator = part('elevator');
  box([3.4, 0.05, 0.4], white, elevator, [0, 1.4, -2.97]);
  for (const s of [1, -1]) box([0.3, 0.052, 0.18], stripe, elevator, [s * 1.5, 1.4, -3.06]);

  const tab = part('trim_tab');
  box([0.5, 0.025, 0.1], mat(0xffb020, { roughness: 0.6, metalness: 0.2 }), tab, [-0.65, 1.4, -3.225]);
  box([0.015, 0.05, 0.03], steel, tab, [-0.65, 1.43, -3.19]); // tab horn

  // ── fin and rudder ──────────────────────────────────────────────────────────────────────────
  const fin = part('vertical_fin');
  sidePlate([[-1.75, 1.55], [-2.75, 1.55], [-2.85, 2.6], [-2.35, 2.6]], 0.06, white, fin);

  const rudder = part('rudder');
  sidePlate([[-2.87, 1.48], [-3.25, 1.48], [-3.2, 2.65], [-2.87, 2.65]], 0.05, white, rudder);
  sidePlate([[-2.95, 2.3], [-3.22, 2.3], [-3.2, 2.65], [-2.95, 2.65]], 0.055, stripe, rudder);

  // ── hinges ──────────────────────────────────────────────────────────────────────────────────
  const hinges = part('hinges');
  for (const x of [-1.3, -0.5, 0.5, 1.3]) box([0.04, 0.06, 0.06], steel, hinges, [x, 1.4, -2.77]);
  for (const y of [1.75, 2.15, 2.5]) box([0.07, 0.04, 0.05], steel, hinges, [0, y, -2.87]);

  // ── control horns: elevator horn below the elevator, rudder horns either side of the rudder ──
  const horns = part('control_horns');
  box([0.02, 0.17, 0.08], steel, horns, [0, 1.29, -2.86]); // elevator horn, down into the tailcone
  for (const s of [1, -1]) box([0.14, 0.03, 0.05], steel, horns, [s * 0.1, 1.53, -2.95]); // rudder horns

  // ── cables: elevator up/down from the horn, rudder left/right from the horns ─────────────────
  // Each runs forward through a pulley at the mid bulkhead and a turnbuckle near the cabin.
  const cables = part('control_cables');
  const pulleys = part('pulleys');
  const turnbuckles = part('turnbuckles');
  const runs = [
    { from: [0.0, 1.22, -2.86], pulley: [0.04, 0.95, -1.0], end: [0.06, 0.78, 1.0] }, // elevator
    { from: [0.0, 1.36, -2.86], pulley: [-0.04, 1.02, -1.0], end: [-0.06, 0.86, 1.0] }, // elevator
    { from: [0.17, 1.53, -2.95], pulley: [0.17, 1.0, -1.0], end: [0.27, 0.75, 1.0] }, // rudder (left)
    { from: [-0.17, 1.53, -2.95], pulley: [-0.17, 1.0, -1.0], end: [-0.27, 0.75, 1.0] }, // rudder (right)
  ];
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  for (const r of runs) {
    tube([r.from, r.pulley], 0.006, cableMat, cables, 0);
    tube([r.pulley, r.end], 0.006, cableMat, cables, 0);
    const p = cyl(0.04, 0.016, steel, pulleys, [r.pulley[0], r.pulley[1] - 0.04, r.pulley[2]], 'x', 24);
    p.userData.size = 0.04;
    box([0.03, 0.1, 0.02], dark, pulleys, [r.pulley[0], r.pulley[1] - 0.09, r.pulley[2]]); // bracket
    const tb = lerp(r.pulley, r.end, 0.75);
    const dir = new THREE.Vector3(...r.end).sub(new THREE.Vector3(...r.pulley)).normalize();
    const body = cyl(0.014, 0.1, brass, turnbuckles, tb, 'y', 12);
    body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }

  // ── elevator trim: actuator in the tailcone, push rod to the tab ────────────────────────────
  const trim = part('trim_actuator');
  cyl(0.025, 0.14, dark, trim, [-0.08, 1.22, -1.8]);
  cyl(0.008, 0.1, steel, trim, [-0.08, 1.32, -1.8]); // jackscrew
  tube([[-0.08, 1.37, -1.8], [-0.4, 1.45, -2.4], [-0.65, 1.44, -3.19]], 0.007, steel, trim); // push rod to the tab horn

  tagParts();
  return root;
}
