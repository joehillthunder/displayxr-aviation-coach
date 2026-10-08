// The built-in "trainer engine": a generic, unbranded horizontally opposed four-cylinder engine made
// from primitives, at real-world scale (metres). It is the fallback asset when no scan is present,
// and it is what parts.json's default anchors are measured on. Every part is its own group tagged
// with userData.partId, so highlighting and picking are exact.
//
// Frame (matches parts.json): +x engine right (seen from the front), +y up, +z forward (propeller).

export function buildTrainerEngine(THREE) {
  const root = new THREE.Group();
  root.name = 'trainer-engine';

  const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35, ...opts });
  const C = {
    case: 0x8a8f96, // cast aluminum
    barrel: 0x5b6067,
    head: 0x9aa0a6,
    plug: 0xe8e2d0,
    lead: 0x2f6fb3,
    mag: 0x3b3f45,
    filter: 0xd4a017,
    sump: 0x7d838a,
    exhaust: 0x7a5a45,
    intake: 0x4d5560,
    airbox: 0x2e3338,
    mount: 0x2a6e4a,
    rubber: 0x161616,
    baffle: 0xb7bcc2,
    prop: 0x2b2b2b,
    tip: 0xd9d9d9,
    spinner: 0xc8cdd2,
  };

  const part = (id) => {
    const g = new THREE.Group();
    g.name = id;
    g.userData.partId = id;
    root.add(g);
    return g;
  };
  const mesh = (geo, material, parent, pos = [0, 0, 0], rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(...pos);
    m.rotation.set(...rot);
    parent.add(m);
    return m;
  };
  // A tube along a polyline, for leads, pipes and mount struts.
  const tube = (points, radius, material, parent) => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.2);
    return mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 10), radius, 10, false), material, parent);
  };

  // ── crankcase and accessory case ────────────────────────────────────────────────────────────
  const crank = part('crankcase');
  mesh(new THREE.BoxGeometry(0.26, 0.26, 0.82), mat(C.case), crank, [0, 0, -0.02]);
  mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.08, 24), mat(C.case), crank, [0, 0, 0.42], [Math.PI / 2, 0, 0]); // nose
  mesh(new THREE.BoxGeometry(0.32, 0.24, 0.06), mat(C.case), crank, [0, 0.02, -0.45]); // accessory case
  const studMat = mat(0x6a6e73, { metalness: 0.8 });
  for (const z of [-0.33, -0.12, 0.09, 0.3]) {
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 8), studMat, crank, [0, 0.14, z]); // case-half bolts
  }

  // ── cylinders: right bank staggered forward of the left, as on a real opposed engine ─────────
  const cyl = part('cylinders');
  const cylZ = { right: [0.17, -0.12], left: [0.1, -0.19] };
  const heads = []; // [x, z] of each head, for plugs, leads, exhaust and intakes
  const finBarrel = new THREE.CylinderGeometry(0.068, 0.068, 0.006, 28);
  for (const side of ['right', 'left']) {
    const s = side === 'right' ? 1 : -1;
    for (const z of cylZ[side]) {
      const g = new THREE.Group();
      g.position.set(0, 0, z);
      cyl.add(g);
      // barrel along x with cooling fins
      mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.2, 24), mat(C.barrel), g, [s * 0.23, 0, 0], [0, 0, Math.PI / 2]);
      for (let i = 0; i < 9; i++) mesh(finBarrel, mat(C.barrel), g, [s * (0.15 + i * 0.019), 0, 0], [0, 0, Math.PI / 2]);
      // head: a finned block at the outer end
      mesh(new THREE.BoxGeometry(0.1, 0.14, 0.14), mat(C.head), g, [s * 0.38, 0, 0]);
      for (let i = 0; i < 6; i++) mesh(new THREE.BoxGeometry(0.004, 0.16, 0.16), mat(C.head), g, [s * (0.34 + i * 0.016), 0, 0]);
      // hold-down nuts at the base flange
      for (const [dy, dz] of [[0.05, 0.05], [-0.05, 0.05], [0.05, -0.05], [-0.05, -0.05]]) {
        mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.014, 6), studMat, g, [s * 0.14, dy, dz], [0, 0, Math.PI / 2]);
      }
      heads.push({ s, z });
    }
  }

  // ── spark plugs: top and bottom of every head ─────────────────────────────────────────────────
  const plugs = part('spark_plugs');
  for (const { s, z } of heads) {
    for (const dy of [1, -1]) {
      mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 12), mat(C.plug, { roughness: 0.3, metalness: 0.1 }), plugs, [s * 0.37, dy * 0.095, z]);
      mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.015, 6), mat(0x9b9b9b, { metalness: 0.9 }), plugs, [s * 0.37, dy * 0.073, z]);
    }
  }

  // ── magnetos on the accessory case ──────────────────────────────────────────────────────────
  const mags = part('magnetos');
  for (const s of [1, -1]) {
    mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.11, 20), mat(C.mag), mags, [s * 0.09, 0.13, -0.53], [Math.PI / 2, 0, 0]);
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20), mat(0x55595f), mags, [s * 0.09, 0.13, -0.6], [Math.PI / 2, 0, 0]); // distributor cap
  }

  // ── ignition harness: each magneto feeds one plug in every cylinder ───────────────────────────
  const harness = part('ignition_harness');
  const leadMat = mat(C.lead, { roughness: 0.7, metalness: 0.1 });
  for (const { s, z } of heads) {
    for (const [mag, dy] of [[1, 1], [-1, -1]]) {
      const mx = mag * 0.09;
      const end = [s * 0.37, dy * 0.12, z];
      tube([[mx, 0.13, -0.62], [mx * 1.4, 0.2, -0.55], [s * 0.2, dy > 0 ? 0.17 : -0.17, (z - 0.55) / 2], [s * 0.33, dy * 0.15, z], end], 0.0055, leadMat, harness);
    }
  }

  // ── oil filter (spin-on canister, rear) and oil sump (below) ─────────────────────────────────
  const filter = part('oil_filter');
  mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.13, 24), mat(C.filter, { roughness: 0.4 }), filter, [0, 0.02, -0.55], [Math.PI / 2, 0, 0]);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.015, 6), mat(0x8c6b00), filter, [0, 0.02, -0.623], [Math.PI / 2, 0, 0]); // wrench pad

  const sump = part('oil_sump');
  mesh(new THREE.BoxGeometry(0.22, 0.1, 0.5), mat(C.sump), sump, [0, -0.18, -0.02]);
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 6), studMat, sump, [0, -0.24, 0.12]); // drain plug

  // ── exhaust: down-stacks into a collector and a muffler with heat shroud ─────────────────────
  const exhaust = part('exhaust_system');
  const pipe = mat(C.exhaust, { roughness: 0.8, metalness: 0.5 });
  for (const { s, z } of heads) {
    tube([[s * 0.38, -0.07, z], [s * 0.38, -0.16, z], [s * 0.3, -0.25, z + 0.05], [s * 0.18, -0.29, 0.06]], 0.018, pipe, exhaust);
  }
  mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.28, 20), pipe, exhaust, [0.12, -0.32, 0.06], [0, 0, Math.PI / 2]);
  mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.2, 20, 1, true), mat(0xa9adb2, { side: THREE.DoubleSide }), exhaust, [0.12, -0.32, 0.06], [0, 0, Math.PI / 2]);
  tube([[0.26, -0.32, 0.06], [0.33, -0.36, -0.1], [0.33, -0.4, -0.35]], 0.02, pipe, exhaust); // tailpipe

  // ── induction: filtered air box at the front, runners up to each cylinder ────────────────────
  const intake = part('induction_air_filter');
  mesh(new THREE.BoxGeometry(0.2, 0.1, 0.12), mat(C.airbox), intake, [0, -0.3, 0.37]);
  mesh(new THREE.BoxGeometry(0.16, 0.012, 0.09), mat(0xc9b38a, { roughness: 0.9 }), intake, [0, -0.244, 0.37]); // filter element face
  tube([[0, -0.3, 0.3], [0, -0.27, 0.15], [0, -0.25, 0.0]], 0.03, mat(C.intake), intake); // plenum feed
  for (const { s, z } of heads) {
    tube([[0, -0.25, 0.0], [s * 0.15, -0.2, z], [s * 0.32, -0.08, z]], 0.014, mat(C.intake), intake);
  }

  // ── engine mount: tube frame to the firewall through rubber isolators ────────────────────────
  const mount = part('engine_mounts');
  const strut = mat(C.mount, { roughness: 0.6, metalness: 0.2 });
  const iso = [[0.19, 0.12], [-0.19, 0.12], [0.19, -0.12], [-0.19, -0.12]];
  for (const [x, y] of iso) {
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.035, 16), mat(C.rubber, { roughness: 0.95, metalness: 0 }), mount, [x, y, -0.5], [Math.PI / 2, 0, 0]);
    tube([[x, y, -0.52], [x * 1.25, y * 1.4, -0.68], [x * 1.4, y * 1.6, -0.8]], 0.011, strut, mount);
  }
  tube([[0.27, 0.19, -0.8], [-0.27, 0.19, -0.8]], 0.011, strut, mount);
  tube([[0.27, -0.19, -0.8], [-0.27, -0.19, -0.8]], 0.011, strut, mount);
  const firewall = mesh(new THREE.PlaneGeometry(1.1, 0.8), mat(0x3a3d42, { metalness: 0.6, side: THREE.DoubleSide }), root, [0, 0, -0.82]);
  firewall.name = 'firewall';

  // ── baffles over and around the cylinders ────────────────────────────────────────────────────
  const baffles = part('baffles');
  const sheet = mat(C.baffle, { metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide });
  for (const s of [1, -1]) {
    // Inter-cylinder deflectors and the outboard and front walls; the fins stay visible between them.
    for (const z of [0.035, -0.155]) mesh(new THREE.BoxGeometry(0.22, 0.1, 0.004), sheet, baffles, [s * 0.28, 0.07, z + (s > 0 ? 0 : -0.07)]);
    mesh(new THREE.BoxGeometry(0.004, 0.16, 0.5), sheet, baffles, [s * 0.445, 0.04, -0.01]); // outboard wall
    mesh(new THREE.BoxGeometry(0.3, 0.06, 0.004), sheet, baffles, [s * 0.3, 0.12, 0.25]); // front wall
    // rubber air seal along the top edge of the outboard wall
    mesh(new THREE.BoxGeometry(0.03, 0.012, 0.5), mat(0x7a2f1d, { roughness: 1, metalness: 0 }), baffles, [s * 0.43, 0.125, -0.01]);
  }

  // ── propeller and spinner ────────────────────────────────────────────────────────────────────
  const prop = part('propeller');
  const blade = new THREE.BoxGeometry(0.11, 0.85, 0.018);
  blade.translate(0, 0.47, 0);
  for (const a of [0, Math.PI]) {
    const b = mesh(blade, mat(C.prop, { roughness: 0.5 }), prop, [0, 0, 0.5], [0, 0.25, a]);
    b.rotation.order = 'ZYX';
    const tip = mesh(new THREE.BoxGeometry(0.112, 0.07, 0.02), mat(C.tip), prop, [0, 0, 0.5], [0, 0.25, a]);
    tip.geometry.translate(0, 0.86, 0);
    tip.rotation.order = 'ZYX';
  }
  mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 20), mat(0x4a4d52), prop, [0, 0, 0.48], [Math.PI / 2, 0, 0]); // hub

  const spinner = part('spinner');
  const cone = mesh(new THREE.ConeGeometry(0.09, 0.2, 32), mat(C.spinner, { metalness: 0.7, roughness: 0.25 }), spinner, [0, 0, 0.6], [Math.PI / 2, 0, 0]);
  cone.name = 'spinner-dome';
  mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.02, 32), mat(C.spinner), spinner, [0, 0, 0.5], [Math.PI / 2, 0, 0]); // bulkhead

  // Tag every mesh with its part so a raycast hit resolves to a part id directly.
  root.traverse((o) => {
    if (o.isMesh) {
      let p = o;
      while (p && !p.userData.partId) p = p.parent;
      o.userData.partId = p?.userData.partId || null;
    }
  });
  return root;
}
