// Small helpers the built-in training models share: parts as tagged groups, primitives placed in
// one call, tubes along polylines, and lofted fuselage skins. Everything is in metres.

export function makeKit(THREE, root) {
  const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35, ...opts });

  /** A part: a group whose meshes all resolve to `id` when picked or highlighted. */
  const part = (id) => {
    const g = new THREE.Group();
    g.name = id;
    g.userData.partId = id;
    root.add(g);
    return g;
  };

  const mesh = (geo, material, parent = root, pos = [0, 0, 0], rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(...pos);
    m.rotation.set(...rot);
    parent.add(m);
    return m;
  };

  const box = (size, material, parent, pos, rot) => mesh(new THREE.BoxGeometry(...size), material, parent, pos, rot);

  /** A cylinder whose axis runs along 'x', 'y' or 'z'. */
  const cyl = (r, len, material, parent, pos, axis = 'y', seg = 24) => {
    const rot = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    return mesh(new THREE.CylinderGeometry(r, r, len, seg), material, parent, pos, rot);
  };

  /** A tire: a torus whose axle runs along x. */
  const tire = (R, r, material, parent, pos) => mesh(new THREE.TorusGeometry(R, r, 16, 40), material, parent, pos, [0, Math.PI / 2, 0]);

  const tube = (points, radius, material, parent = root, tension = 0.2) => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', tension);
    return mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 12), radius, 10, false), material, parent);
  };

  /**
   * A flat plate from a polygon in the z/y plane (side view), `thickness` across x, centred on x.
   * For fins and rudders.
   */
  const sidePlate = (zy, thickness, material, parent, x = 0) => {
    const shape = new THREE.Shape(zy.map(([z, y]) => new THREE.Vector2(z, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geo.rotateY(-Math.PI / 2); // shape x -> world z, extrusion -> world -x
    geo.translate(x + thickness / 2, 0, 0);
    return mesh(geo, material, parent);
  };

  /**
   * A fuselage skin lofted through rounded-rectangle sections { z, w, h, y } (superellipse,
   * exponent 4), with both ends closed.
   */
  const loft = (sections, material, parent = root, ring = 28) => {
    const pos = [];
    const idx = [];
    for (const s of sections) {
      for (let i = 0; i < ring; i++) {
        const a = (i / ring) * Math.PI * 2;
        const c = Math.cos(a);
        const n = Math.sin(a);
        pos.push((s.w / 2) * Math.sign(c) * Math.abs(c) ** 0.5, s.y + (s.h / 2) * Math.sign(n) * Math.abs(n) ** 0.5, s.z);
      }
    }
    for (let k = 0; k < sections.length - 1; k++) {
      for (let i = 0; i < ring; i++) {
        const a = k * ring + i;
        const b = k * ring + ((i + 1) % ring);
        const c = a + ring;
        const d = b + ring;
        if (sections[k].z > sections[k + 1].z) idx.push(a, c, b, b, c, d);
        else idx.push(a, b, c, b, d, c);
      }
    }
    // end caps
    for (const [k, flip] of [[0, false], [sections.length - 1, true]]) {
      const s = sections[k];
      const centre = pos.length / 3;
      pos.push(0, s.y, s.z);
      const first = sections[0].z > sections[sections.length - 1].z;
      for (let i = 0; i < ring; i++) {
        const a = k * ring + i;
        const b = k * ring + ((i + 1) % ring);
        if (flip !== first) idx.push(centre, b, a);
        else idx.push(centre, a, b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return mesh(geo, material, parent);
  };

  /** Tag every mesh with its part, so a raycast hit resolves to a part id directly. */
  const tagParts = () => {
    root.traverse((o) => {
      if (o.isMesh) {
        let p = o;
        while (p && !p.userData.partId) p = p.parent;
        o.userData.partId = p?.userData.partId || null;
      }
    });
  };

  return { mat, part, mesh, box, cyl, tire, tube, sidePlate, loft, tagParts };
}
