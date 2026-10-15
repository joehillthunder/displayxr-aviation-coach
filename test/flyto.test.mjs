// When the instructor flies to a part, the trainee must actually see it. This builds each training's
// real model in Node (three.js needs no WebGL to raycast), puts the camera where focusPart() would,
// and casts rays at points around the part's anchor: most must reach the part itself. See-through
// skins don't count as blocking, as on the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MODELS, solidHits } from '../web/app/models/index.js';
import { focusView, orbitPosition } from '../web/app/view.js';
import { readData, trainings } from './helpers.mjs';

const OFFSETS = [[0, 0, 0], [0.03, 0, 0], [-0.03, 0, 0], [0, 0.03, 0], [0, -0.03, 0], [0, 0, 0.03], [0, 0, -0.03], [0.02, 0.02, 0], [-0.02, -0.02, 0]];
const ray = new THREE.Raycaster();

for (const t of trainings) {
  const parts = (await readData(`${t.id}/parts.json`)).parts;
  const model = MODELS[t.model](THREE);
  model.updateMatrixWorld(true);

  const clearRays = (part) => {
    const cam = new THREE.Vector3(...orbitPosition(part.anchor, focusView(part, t.stage)));
    let clear = 0;
    for (const o of OFFSETS) {
      const p = new THREE.Vector3(part.anchor[0] + o[0], part.anchor[1] + o[1], part.anchor[2] + o[2]);
      const dir = p.clone().sub(cam);
      const dist = dir.length();
      ray.set(cam, dir.normalize());
      ray.far = dist - 0.03;
      const hit = solidHits(ray.intersectObject(model, true))[0];
      if (!hit || hit.object.userData.partId === part.id) clear++;
    }
    return { clear, cam };
  };

  test(`${t.id}: every part has geometry on the model`, () => {
    const ids = new Set();
    model.traverse((o) => o.isMesh && o.userData.partId && ids.add(o.userData.partId));
    for (const p of parts) assert.ok(ids.has(p.id), `no mesh tagged ${p.id}`);
  });

  test(`${t.id}: every part's anchor sits on or near its geometry`, () => {
    for (const p of parts) {
      const box = new THREE.Box3();
      model.traverse((o) => o.isMesh && o.userData.partId === p.id && box.expandByObject(o));
      assert.ok(box.expandByScalar(0.06).containsPoint(new THREE.Vector3(...p.anchor)), `${p.id}: anchor is away from the part`);
    }
  });

  for (const part of parts) {
    test(`${t.id}: fly-to shows the ${part.name.toLowerCase()}`, () => {
      const { clear, cam } = clearRays(part);
      assert.ok(clear >= 6, `${part.id}: only ${clear}/9 sight lines reach the part`);
      assert.ok(cam.y > t.stage.floorY + 0.05, `${part.id}: camera is under the floor`);
    });
  }
}
