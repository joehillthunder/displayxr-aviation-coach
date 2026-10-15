// The built-in "gear bench": a spring-steel main landing gear leg with its wheel, tire and disc brake
// (left), beside an oleo-strut nose gear with torque links and a shimmy damper (right), at real-world
// scale (metres). It is the model for the landing gear training; landing_gear/parts.json's anchors
// are measured on it.
//
// Frame: +x to the right as seen from the front of the bench, +y up, +z toward the viewer. The main
// gear is a left-side leg seen from the front: its wheel is outboard (-x), its brake inboard.
// Origin on the bench top; the tires stand on y = 0.

import { makeKit } from './kit.js';

export function buildGearBench(THREE) {
  const root = new THREE.Group();
  root.name = 'gear-bench';
  const { mat, part, box, cyl, tire, tube, tagParts } = makeKit(THREE, root);

  const steel = mat(0x8d949b, { metalness: 0.8, roughness: 0.35 });
  const paint = mat(0xd9dde1, { metalness: 0.2, roughness: 0.5 });
  const rubber = mat(0x161616, { roughness: 0.95, metalness: 0 });
  const chrome = mat(0xe3e8ee, { metalness: 0.95, roughness: 0.08 });
  const dark = mat(0x2a2e33, { roughness: 0.7, metalness: 0.2 });

  // ── main gear: attach fitting, spring-steel leg, wheel, tire, brake ─────────────────────────
  const attach = part('gear_attach');
  box([0.28, 0.16, 0.3], dark, attach, [-0.14, 0.86, 0]); // fuselage stub with the gear box
  for (const z of [-0.08, 0.08]) {
    for (const y of [0.82, 0.9]) cyl(0.012, 0.02, steel, attach, [-0.14, y, z + Math.sign(z) * 0.075], 'z', 6);
  }

  const leg = part('main_gear_leg');
  tube([[-0.22, 0.8, 0], [-0.38, 0.66, 0], [-0.56, 0.42, 0], [-0.66, 0.26, 0]], 0.028, paint, leg);
  box([0.05, 0.09, 0.09], steel, leg, [-0.67, 0.225, 0]); // axle flange

  const disc = part('brake_disc');
  cyl(0.095, 0.008, mat(0x9b9690, { metalness: 0.85, roughness: 0.45 }), disc, [-0.71, 0.225, 0], 'x', 36);

  const caliper = part('brake_caliper');
  box([0.05, 0.05, 0.07], mat(0x8a2a1e, { roughness: 0.5 }), caliper, [-0.705, 0.3, -0.06]);
  cyl(0.008, 0.06, steel, caliper, [-0.68, 0.3, -0.06], 'z', 8); // anchor bolt

  const line = part('brake_line');
  tube([[-0.682, 0.33, -0.08], [-0.62, 0.42, -0.05], [-0.5, 0.57, -0.045], [-0.34, 0.71, -0.045], [-0.22, 0.79, -0.05]], 0.0065, mat(0x1b1b1b, { roughness: 0.8 }), line);

  const wheel = part('main_wheel');
  cyl(0.1, 0.13, mat(0xc8cdd2, { metalness: 0.6, roughness: 0.35 }), wheel, [-0.8, 0.225, 0], 'x', 32);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    cyl(0.007, 0.012, steel, wheel, [-0.868, 0.225 + 0.065 * Math.sin(a), 0.065 * Math.cos(a)], 'x', 6); // tie bolts
  }
  cyl(0.006, 0.03, steel, wheel, [-0.86, 0.225 + 0.085, 0.03], 'x', 8); // valve stem

  const bearings = part('wheel_bearings');
  cyl(0.032, 0.03, mat(0xb8bec4, { metalness: 0.9, roughness: 0.2 }), bearings, [-0.875, 0.225, 0], 'x', 20); // hub cap
  cyl(0.016, 0.012, steel, bearings, [-0.895, 0.225, 0], 'x', 6); // axle nut

  const mainTire = part('main_tire');
  tire(0.15, 0.075, rubber, mainTire, [-0.8, 0.225, 0]);

  // ── nose gear: mount, oleo strut, torque links, shimmy damper, fork, tire ────────────────────
  box([0.22, 0.1, 0.22], dark, attach, [0.5, 1.0, 0]); // engine-mount stub (also an attachment)

  const strut = part('nose_strut');
  cyl(0.045, 0.4, steel, strut, [0.5, 0.75, 0]); // cylinder
  cyl(0.05, 0.03, steel, strut, [0.5, 0.56, 0]); // packing gland nut
  cyl(0.03, 0.2, chrome, strut, [0.5, 0.45, 0]); // exposed chrome piston
  cyl(0.008, 0.03, mat(0xd4a017), strut, [0.5, 0.965, 0.04], 'z', 8); // air valve

  const links = part('torque_links');
  const linkMat = mat(0x6f767d, { metalness: 0.7, roughness: 0.4 });
  const upper = box([0.03, 0.1, 0.018], linkMat, links, [0.5, 0.535, 0.085]);
  upper.rotation.x = 0.85;
  const lower = box([0.03, 0.1, 0.018], linkMat, links, [0.5, 0.445, 0.085]);
  lower.rotation.x = -0.85;
  cyl(0.012, 0.045, steel, links, [0.5, 0.49, 0.12], 'x', 10); // apex pin

  const damper = part('shimmy_damper');
  cyl(0.02, 0.2, dark, damper, [0.565, 0.7, -0.03], 'z');
  cyl(0.008, 0.08, chrome, damper, [0.565, 0.7, 0.1], 'z', 8);

  const fork = new THREE.Group();
  fork.name = 'fork';
  strut.add(fork);
  box([0.18, 0.04, 0.07], steel, fork, [0.5, 0.36, 0]);
  for (const s of [1, -1]) box([0.02, 0.2, 0.05], steel, fork, [0.5 + s * 0.08, 0.26, 0]);

  const noseTire = part('nose_tire');
  tire(0.12, 0.055, rubber, noseTire, [0.5, 0.175, 0]);
  cyl(0.075, 0.1, mat(0xc8cdd2, { metalness: 0.6 }), noseTire, [0.5, 0.175, 0], 'x', 28);

  tagParts();
  return root;
}
