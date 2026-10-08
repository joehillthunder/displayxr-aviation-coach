// Copy the browser dependencies out of node_modules into web/vendor/ so the web app runs with no
// CDN at all: on GitHub Pages, on a training station, and in a hangar with no network.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'web', 'vendor');

if (!existsSync(join(nm, 'three'))) {
  console.log('[vendor] node_modules missing; run `npm install` first');
  process.exit(0);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const copies = [
  // three.js: the module build and the loaders the app uses (GLTFLoader pulls in BufferGeometryUtils).
  ['three/build', 'three/build'],
  ['three/examples/jsm/loaders/GLTFLoader.js', 'three/examples/jsm/loaders/GLTFLoader.js'],
  ['three/examples/jsm/loaders/DRACOLoader.js', 'three/examples/jsm/loaders/DRACOLoader.js'],
  ['three/examples/jsm/utils/BufferGeometryUtils.js', 'three/examples/jsm/utils/BufferGeometryUtils.js'],
  ['three/examples/jsm/postprocessing/Pass.js', 'three/examples/jsm/postprocessing/Pass.js'], // Spark imports it
  ['three/examples/jsm/libs/draco/gltf', 'draco'],
  ['three/LICENSE', 'three/LICENSE'],
  // DisplayXR inline-3D SDK: the core and the three.js glue, with the modules they import.
  ['@displayxr/inline3d/js', 'inline3d/js'],
  ['@displayxr/inline3d/LICENSE', 'inline3d/LICENSE'],
  // Spark, for the phone-captured Gaussian splat.
  ['@sparkjsdev/spark/dist', 'spark/dist'],
  ['@sparkjsdev/spark/LICENSE', 'spark/LICENSE'],
];

for (const [from, to] of copies) {
  const src = join(nm, from);
  if (!existsSync(src)) {
    console.warn(`[vendor] skipped ${from} (not found)`);
    continue;
  }
  cpSync(src, join(out, to), { recursive: true });
}
console.log(`[vendor] browser dependencies copied to ${out}`);
