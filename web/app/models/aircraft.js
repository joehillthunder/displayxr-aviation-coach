// The built-in "trainer aircraft": a generic, unbranded single-engine high-wing airplane with fixed
// tricycle gear, at real-world scale (metres), parked on the ramp with chocks and tie-downs. It is
// the model for the preflight walk-around training; preflight/parts.json's anchors are measured on it.
//
// Frame: +z forward (the nose), +y up, +x toward the LEFT wing (the pilot's left). Origin on the
// ground under the cabin. Span 11 m, length 8.4 m.

import { makeKit } from './kit.js';

export function buildTrainerAircraft(THREE) {
  const root = new THREE.Group();
  root.name = 'trainer-aircraft';
  const { mat, part, mesh, box, cyl, tire, tube, sidePlate, loft, tagParts } = makeKit(THREE, root);

  const white = mat(0xe9ecef, { metalness: 0.15, roughness: 0.45 });
  const stripe = mat(0x1f4f8f, { metalness: 0.2, roughness: 0.45 });
  const dark = mat(0x2a2e33, { roughness: 0.7, metalness: 0.2 });
  const rubber = mat(0x151515, { roughness: 0.95, metalness: 0 });
  const steel = mat(0x9aa0a6, { metalness: 0.8, roughness: 0.3 });
  const glass = mat(0x1c3954, { metalness: 0.9, roughness: 0.08 });

  // ── fuselage (cabin to tail) and cowling ────────────────────────────────────────────────────
  const fuselage = new THREE.Group();
  fuselage.name = 'fuselage';
  root.add(fuselage);
  loft([
    { z: 1.9, w: 1.08, h: 1.02, y: 1.39 },
    { z: 1.3, w: 1.12, h: 1.4, y: 1.42 },
    { z: -0.6, w: 1.1, h: 1.38, y: 1.43 },
    { z: -1.4, w: 0.92, h: 1.0, y: 1.55 },
    { z: -3.0, w: 0.55, h: 0.6, y: 1.6 },
    { z: -4.7, w: 0.24, h: 0.32, y: 1.62 },
    { z: -5.05, w: 0.1, h: 0.2, y: 1.64 },
  ], white, fuselage);
  // cheat line and side windows (decoration)
  for (const s of [1, -1]) {
    box([0.01, 0.06, 4.4], stripe, fuselage, [s * 0.5, 1.2, -1.6], [0, s * 0.06, 0]);
    box([0.012, 0.42, 1.2], glass, fuselage, [s * 0.556, 1.82, 0.5]);
  }

  const cowling = part('cowling');
  loft([
    { z: 3.0, w: 0.5, h: 0.5, y: 1.3 },
    { z: 2.7, w: 0.92, h: 0.82, y: 1.3 },
    { z: 1.9, w: 1.08, h: 1.02, y: 1.39 },
  ], white, cowling);
  for (const s of [1, -1]) {
    for (const z of [2.05, 2.35, 2.62]) cyl(0.012, 0.01, steel, cowling, [s * 0.52, 1.36, z], 'x', 10); // fasteners
  }

  // ── windshield ──────────────────────────────────────────────────────────────────────────────
  const windshield = part('windshield');
  const ws = box([1.0, 0.012, 0.56], glass, windshield, [0, 2.045, 1.59]);
  ws.rotation.x = -Math.atan2(0.2, 0.52);

  // ── wing, struts, flaps and ailerons ────────────────────────────────────────────────────────
  const wings = part('wings');
  box([11, 0.15, 1.2], white, wings, [0, 2.17, 0.7]); // spar section, z 0.1..1.3
  cyl(0.075, 11, white, wings, [0, 2.17, 1.3], 'x', 20); // rounded leading edge
  for (const s of [1, -1]) box([0.22, 0.12, 0.3], white, wings, [s * 5.4, 2.17, -0.05]); // tip trailing edge

  const struts = part('wing_struts');
  for (const s of [1, -1]) {
    tube([[s * 0.5, 0.95, 0.7], [s * 2.6, 2.09, 0.7]], 0.035, steel, struts);
    box([0.12, 0.08, 0.12], steel, struts, [s * 2.6, 2.07, 0.7]); // wing attach fitting
  }

  const flaps = part('flaps');
  const ailerons = part('ailerons');
  for (const s of [1, -1]) {
    box([2.28, 0.09, 0.28], white, flaps, [s * 1.76, 2.17, -0.06]);
    box([2.28, 0.09, 0.28], white, ailerons, [s * 4.15, 2.17, -0.06]);
    for (const x of [3.4, 4.9]) box([0.04, 0.05, 0.08], steel, ailerons, [s * x, 2.11, 0.1]); // hinges
  }

  // ── fuel: caps on top of the wing, sump drains under it, strainer drain under the cowling, vent ─
  const caps = part('fuel_caps');
  const sumps = part('fuel_sumps');
  for (const s of [1, -1]) {
    cyl(0.05, 0.03, steel, caps, [s * 0.95, 2.258, 0.8]);
    cyl(0.018, 0.035, dark, caps, [s * 0.95, 2.285, 0.8]); // tab
    cyl(0.014, 0.04, steel, sumps, [s * 0.95, 2.077, 0.6]);
  }
  cyl(0.012, 0.07, steel, sumps, [0.12, 0.84, 2.15]); // fuel strainer quick drain
  box([0.06, 0.04, 0.06], dark, sumps, [0.12, 0.89, 2.15]);
  const vent = part('fuel_vent');
  tube([[2.3, 2.095, 0.75], [2.3, 1.98, 0.8], [2.3, 1.96, 0.97]], 0.012, steel, vent);

  // ── oil dipstick access door on the cowling ─────────────────────────────────────────────────
  const oil = part('oil_dipstick');
  const door = box([0.2, 0.012, 0.16], mat(0xd8dcdf), oil, [0, 1.82, 2.3]);
  door.rotation.x = -0.22;
  cyl(0.018, 0.05, mat(0xf2c200, { roughness: 0.4 }), oil, [0.04, 1.85, 2.3]);

  // ── propeller and spinner; induction air intake below them ──────────────────────────────────
  const prop = part('propeller');
  const blade = new THREE.BoxGeometry(0.11, 0.86, 0.02);
  blade.translate(0, 0.5, 0);
  for (const a of [0.5, 0.5 + Math.PI]) {
    const b = mesh(blade, mat(0x2b2b2b, { roughness: 0.5 }), prop, [0, 1.3, 3.16], [0, 0.25, a]);
    b.rotation.order = 'ZYX';
    const tip = mesh(new THREE.BoxGeometry(0.112, 0.07, 0.022).translate(0, 0.9, 0), mat(0xffd000), prop, [0, 1.3, 3.16], [0, 0.25, a]);
    tip.rotation.order = 'ZYX';
  }
  mesh(new THREE.ConeGeometry(0.15, 0.36, 32), mat(0xd0d4d8, { metalness: 0.7, roughness: 0.25 }), prop, [0, 1.3, 3.2], [Math.PI / 2, 0, 0]);
  cyl(0.15, 0.03, mat(0xd0d4d8), prop, [0, 1.3, 3.03], 'z', 32); // spinner bulkhead

  const intake = part('air_intake');
  box([0.26, 0.12, 0.06], dark, intake, [0, 1.0, 2.83]);
  box([0.22, 0.09, 0.012], mat(0xc9b38a, { roughness: 0.9 }), intake, [0, 1.0, 2.865]); // filter face

  // ── landing gear ────────────────────────────────────────────────────────────────────────────
  const mains = part('main_landing_gear');
  for (const s of [1, -1]) {
    tube([[s * 0.42, 0.78, 0.52], [s * 0.85, 0.45, 0.48], [s * 1.15, 0.25, 0.45]], 0.032, steel, mains);
    tire(0.17, 0.075, rubber, mains, [s * 1.25, 0.245, 0.45]);
    cyl(0.11, 0.13, mat(0xcfd3d6, { metalness: 0.6 }), mains, [s * 1.25, 0.245, 0.45], 'x');
    box([0.04, 0.06, 0.08], mat(0x8a2a1e), mains, [s * 1.17, 0.33, 0.38]); // brake caliper
  }
  const nose = part('nose_gear');
  cyl(0.045, 0.36, steel, nose, [0, 0.7, 2.45]); // oleo cylinder
  cyl(0.03, 0.18, mat(0xe0e6ec, { metalness: 0.95, roughness: 0.1 }), nose, [0, 0.45, 2.48]); // chrome piston
  box([0.17, 0.04, 0.08], steel, nose, [0, 0.38, 2.52]);
  for (const s of [1, -1]) box([0.02, 0.2, 0.06], steel, nose, [s * 0.075, 0.28, 2.55]);
  tire(0.12, 0.055, rubber, nose, [0, 0.175, 2.55]);
  cyl(0.02, 0.18, dark, nose, [0.07, 0.62, 2.4], 'z'); // shimmy damper

  // ── empennage: fin and stabilizer are airframe; elevator (with trim tab) and rudder are parts ─
  box([3.4, 0.07, 0.72], white, root, [0, 1.62, -4.2]); // horizontal stabilizer
  sidePlate([[-3.3, 1.75], [-4.6, 1.75], [-4.68, 2.92], [-4.2, 2.92]], 0.07, white, root); // vertical fin
  const elevator = part('elevator');
  box([3.4, 0.05, 0.38], white, elevator, [0, 1.62, -4.77]);
  box([0.5, 0.025, 0.1], stripe, elevator, [-0.7, 1.62, -5.01]); // trim tab
  const rudder = part('rudder');
  sidePlate([[-4.7, 1.62], [-5.12, 1.62], [-5.08, 2.96], [-4.72, 2.96]], 0.06, white, rudder);
  sidePlate([[-4.95, 2.6], [-5.1, 2.6], [-5.08, 2.96], [-4.95, 2.96]], 0.065, stripe, rudder);

  // ── ramp items: wheel chocks and tie-downs ──────────────────────────────────────────────────
  const chocks = part('chocks');
  const wedge = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.16, 0), new THREE.Vector2(0, 0.11)]);
  const wedgeGeo = new THREE.ExtrudeGeometry(wedge, { depth: 0.16, bevelEnabled: false });
  wedgeGeo.rotateY(-Math.PI / 2);
  wedgeGeo.translate(0.08, 0, 0);
  const chockMat = mat(0xffb020, { roughness: 0.8, metalness: 0 });
  for (const s of [1, -1]) {
    mesh(wedgeGeo, chockMat, chocks, [s * 1.25, 0, 0.45 + 0.25]);
    mesh(wedgeGeo, chockMat, chocks, [s * 1.25, 0, 0.45 - 0.25], [0, Math.PI, 0]);
  }
  const ties = part('tie_downs');
  const rope = mat(0xd9c27a, { roughness: 1, metalness: 0 });
  for (const s of [1, -1]) {
    tube([[s * 3.4, 2.07, 0.65], [s * 3.46, 1.0, 0.73], [s * 3.5, 0.03, 0.8]], 0.012, rope, ties);
    box([0.1, 0.03, 0.1], dark, ties, [s * 3.5, 0.015, 0.8]); // ramp ring
  }
  tube([[0, 1.46, -4.5], [0, 0.7, -4.55], [0, 0.03, -4.6]], 0.012, rope, ties);
  box([0.1, 0.03, 0.1], dark, ties, [0, 0.015, -4.6]);

  tagParts();
  return root;
}
