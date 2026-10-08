// When the instructor flies to a part, the trainee must actually see it. This builds the real
// trainer engine in Node (three.js needs no WebGL to raycast), puts the camera where focusPart()
// would, and casts rays at points around the part's anchor: most must reach the part itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildTrainerEngine } from '../web/app/trainer-engine.js';
import { focusView, orbitPosition } from '../web/app/view.js';
import { readData } from './helpers.mjs';

const parts = (await readData('parts.json')).parts;
const engine = buildTrainerEngine(THREE);
engine.updateMatrixWorld(true);
const FLOOR_Y = -1.05; // web/app/scene.js

const OFFSETS = [[0, 0, 0], [0.03, 0, 0], [-0.03, 0, 0], [0, 0.03, 0], [0, -0.03, 0], [0, 0, 0.03], [0, 0, -0.03], [0.02, 0.02, 0], [-0.02, -0.02, 0]];
const ray = new THREE.Raycaster();

function clearRays(part) {
  const cam = new THREE.Vector3(...orbitPosition(part.anchor, focusView(part)));
  let clear = 0;
  for (const o of OFFSETS) {
    const t = new THREE.Vector3(part.anchor[0] + o[0], part.anchor[1] + o[1], part.anchor[2] + o[2]);
    const dir = t.clone().sub(cam);
    const dist = dir.length();
    ray.set(cam, dir.normalize());
    ray.far = dist - 0.03;
    const hit = ray.intersectObject(engine, true)[0];
    if (!hit || hit.object.userData.partId === part.id) clear++;
  }
  return { clear, cam };
}

test('every part has geometry on the trainer engine', () => {
  const ids = new Set();
  engine.traverse((o) => o.isMesh && o.userData.partId && ids.add(o.userData.partId));
  for (const p of parts) assert.ok(ids.has(p.id), `no mesh tagged ${p.id}`);
});

for (const part of parts) {
  test(`fly-to shows the ${part.name.toLowerCase()}`, () => {
    const { clear, cam } = clearRays(part);
    assert.ok(clear >= 6, `${part.id}: only ${clear}/9 sight lines reach the part`);
    assert.ok(cam.y > FLOOR_Y + 0.05, `${part.id}: camera is under the floor`);
  });
}
