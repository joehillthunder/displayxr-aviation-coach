// The 3D stage: one persistent canvas, woven by the DisplayXR inline-3D SDK when the browser and
// display support it and rendered as ordinary 2D otherwise.
//
// Why a CAMERA rig: the trainee works around a real-size engine and the instructor flies the view
// from part to part, so the viewpoint is state this app owns (docs/authoring-inline-3d.md, "Which
// rig"). The scene is authored in metres, so the rig's literal 63 mm eye separation is the right
// depth, and convergence follows the focused part so it sits on the glass. Convergence never goes
// nearer than MIN_DIST (comfort: diopters x 0.5 <= 1 keeps it past 0.5 m).
//
// The eyes are parented under the app camera and the rig is sent identity-posed every frame (the
// attach pattern), so a flying camera has no one-frame stereo lag.

import * as THREE from 'three';
import { createInline3D, inline3dViewRigSupported, inline3dDisplayModesSupported } from '@displayxr/inline3d';
import { EyeCamera, cameraRigFromCamera } from '@displayxr/inline3d/three';
import { buildTrainerEngine } from './trainer-engine.js';

const MIN_DIST = 0.55; // metres; nearest the camera (and convergence) may get to its target
const MAX_DIST = 4.2;
const FLY_MS = 1100;
const HOME = { target: [0, -0.02, -0.02], yaw: 0.65, pitch: 0.32, dist: 2.25 };
const ACCENT = new THREE.Color(0xffb020);

export class Scene3D {
  constructor(canvas, knowledge) {
    this.canvas = canvas;
    this.k = knowledge;
    this.assetId = 'trainer-engine';
    this.anchors = new Map(); // partId -> THREE.Vector3 for the loaded asset
    this.partMeshes = new Map(); // partId -> [meshes]  (trainer engine and tagged glTFs)
    this.highlighted = [];
    this.listeners = { frame: [], pick: [], modechange: [] };
    this.woven = false;
    this.stereo = true;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
    // pixelRatio MUST be 1: layer.getViewport() reports backing-store pixels, and three would
    // multiply them again. The backing store is sized in device pixels by hand (sizeToCanvas).
    this.renderer.setPixelRatio(1);
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14171c);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2622, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1.5, 2.5, 2);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fb8ff, 0.6);
    rim.position.set(-2, 1, -1.5);
    this.scene.add(rim);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 64),
      new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.95, metalness: 0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.62;
    this.scene.add(floor);

    this.content = new THREE.Group(); // the loaded asset lives here
    this.scene.add(this.content);
    this.markers = new THREE.Group(); // highlight rings at anchors (work on any asset, splats too)
    this.scene.add(this.markers);

    // The app camera is IN the scene: the eye cameras hang off it (attach pattern), and three only
    // updates a parented camera through a scene traversal.
    this.cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 50);
    this.scene.add(this.cam);
    this.eyes = [new EyeCamera(THREE), new EyeCamera(THREE)];
    this.rigScratch = {};

    this.orbit = { target: new THREE.Vector3(...HOME.target), yaw: HOME.yaw, pitch: HOME.pitch, dist: HOME.dist };
    this.fly = null;
    this.placeCamera();
    this.bindPointer();
    window.addEventListener('resize', () => this.sizeToCanvas());
    this.ringTexture = makeRingTexture();
  }

  on(type, cb) {
    this.listeners[type].push(cb);
    return () => (this.listeners[type] = this.listeners[type].filter((f) => f !== cb));
  }

  emit(type, ...args) {
    for (const cb of this.listeners[type]) cb(...args);
  }

  // ── session ──────────────────────────────────────────────────────────────────────────────────
  async start() {
    this.sizeToCanvas();
    this.orbit.dist = this.homeDist();
    this.wall = await createInline3D({ lazy: false });
    if (!this.wall.supported) {
      this.woven = false;
      this.monoLoop();
      return { woven: false, firstWoven: Promise.resolve({ woven: false }) };
    }
    this.woven = true;
    this.sizeToCanvas();
    this.setAttached(true);
    // The first rig goes in at construction so the very first located frame is already ours.
    this.handle = this.wall.addScene(this.canvas, (views, layer) => this.xrFrame(views, layer), {
      viewRig: this.currentRig(),
    });
    this.wall.on?.('renderingmodechange', (e) => {
      this.stereo = e.viewCount !== 1;
      this.emit('modechange', this.stereo);
    });
    window.addEventListener('pagehide', () => this.wall?.close());
    console.log('[coach] inline-3D woven; setViewRig supported =', inline3dViewRigSupported());
    return { woven: true, firstWoven: this.handle.firstWoven };
  }

  get displayModesSupported() {
    return this.woven && inline3dDisplayModesSupported();
  }

  /** 2D/3D lens toggle (the display-modes sample's pattern). Resolves once forwarded. */
  async setStereo(on) {
    if (!this.displayModesSupported) return false;
    await this.wall.setStereoEnabled(on);
    this.stereo = on;
    this.emit('modechange', on);
    return true;
  }

  setAttached(on) {
    for (const eye of this.eyes) {
      if (on && eye.camera.parent !== this.cam) this.cam.add(eye.camera);
      else if (!on && eye.camera.parent) eye.camera.parent.remove(eye.camera);
    }
  }

  currentRig() {
    return cameraRigFromCamera(THREE, this.cam, {
      convergence: Math.max(MIN_DIST, this.orbit.dist),
      attach: true,
      out: this.rigScratch,
    });
  }

  sizeToCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round((this.canvas.clientWidth || 960) * dpr));
    const h = Math.max(1, Math.round((this.canvas.clientHeight || 540) * dpr));
    // Woven: a DOUBLE-WIDTH side-by-side store (left eye | right eye) in the same CSS box.
    this.renderer.setSize(this.woven ? w * 2 : w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }

  xrFrame(views, layer) {
    // Validate BEFORE clearing: a short view list or a missing viewport on a loaded frame must not
    // become a dark tile.
    if (!views || views.length < 2 || !layer) return;
    const vps = views.map((v) => layer.getViewport(v));
    if (vps.some((vp) => !vp || vp.width <= 0 || vp.height <= 0)) return;
    this.tick();
    this.handle.setViewRig(this.currentRig());
    this.scene.updateMatrixWorld();
    const r = this.renderer;
    r.clear();
    r.setScissorTest(true);
    for (let i = 0; i < 2; i++) {
      const vp = vps[i];
      r.setViewport(vp.x, vp.y, vp.width, vp.height);
      r.setScissor(vp.x, vp.y, vp.width, vp.height);
      this.eyes[i].setLocalFromView(views[i]);
      r.render(this.scene, this.eyes[i].camera);
    }
    r.setScissorTest(false);
    this.emit('frame');
  }

  monoLoop() {
    const loop = () => {
      requestAnimationFrame(loop);
      this.tick();
      const r = this.renderer;
      const size = r.getSize(new THREE.Vector2());
      r.clear();
      r.setViewport(0, 0, size.x, size.y);
      r.render(this.scene, this.cam);
      this.emit('frame');
    };
    requestAnimationFrame(loop);
  }

  // ── camera ───────────────────────────────────────────────────────────────────────────────────
  placeCamera() {
    const { target, yaw, pitch, dist } = this.orbit;
    const cp = Math.cos(pitch);
    this.cam.position.set(target.x + dist * cp * Math.sin(yaw), target.y + dist * Math.sin(pitch), target.z + dist * cp * Math.cos(yaw));
    this.cam.lookAt(target);
  }

  tick() {
    const now = performance.now();
    if (this.fly) {
      const t = Math.min(1, (now - this.fly.t0) / FLY_MS);
      const e = t * t * t * (t * (t * 6 - 15) + 10); // smootherstep
      const { from, to } = this.fly;
      this.orbit.target.lerpVectors(from.target, to.target, e);
      this.orbit.yaw = from.yaw + shortestAngle(from.yaw, to.yaw) * e;
      this.orbit.pitch = from.pitch + (to.pitch - from.pitch) * e;
      // Pull back mid-flight so a long hop reads as a move, not a cut.
      const arc = Math.sin(Math.PI * e) * Math.min(0.5, from.target.distanceTo(to.target) * 0.6);
      this.orbit.dist = from.dist + (to.dist - from.dist) * e + arc;
      if (t >= 1) this.fly = null;
    }
    this.placeCamera();
    // Pulse the highlight.
    const pulse = 0.55 + 0.45 * Math.sin(now / 260);
    for (const m of this.highlightMats || []) m.emissiveIntensity = pulse;
    for (const s of this.markers.children) {
      s.material.opacity = 0.5 + 0.5 * pulse;
      s.scale.setScalar(s.userData.size * (0.9 + 0.2 * pulse));
    }
  }

  flyTo({ target, yaw, pitch, dist }) {
    this.fly = {
      t0: performance.now(),
      from: { target: this.orbit.target.clone(), yaw: this.orbit.yaw, pitch: this.orbit.pitch, dist: this.orbit.dist },
      to: {
        target: target.clone(),
        yaw: yaw ?? this.orbit.yaw,
        pitch: clamp(pitch ?? this.orbit.pitch, -1.2, 1.35),
        dist: clamp(dist ?? this.orbit.dist, MIN_DIST, MAX_DIST),
      },
    };
  }

  home() {
    this.flyTo({ target: new THREE.Vector3(...HOME.target), yaw: HOME.yaw, pitch: HOME.pitch, dist: this.homeDist() });
  }

  /** Far enough that the whole engine (about 2 m with the propeller) fits a tall canvas too. */
  homeDist() {
    return clamp(HOME.dist / Math.min(1, this.cam.aspect * 1.25), HOME.dist, MAX_DIST);
  }

  /** Fly to a part: look at its anchor from its preferred side, close enough to read it. */
  focusPart(id) {
    const a = this.anchors.get(id);
    if (!a) return false;
    const part = this.k.part(id);
    const dir = new THREE.Vector3(...(part?.viewDir || [0.5, 0.5, 0.7])).normalize();
    this.flyTo({
      target: a,
      yaw: Math.atan2(dir.x, dir.z),
      pitch: Math.asin(clamp(dir.y, -0.98, 0.98)),
      dist: part?.id === 'propeller' ? 1.6 : 0.9,
    });
    return true;
  }

  highlight(ids) {
    for (const m of this.highlightMats || []) {
      m.emissive.copy(m.userData.baseEmissive);
      m.emissiveIntensity = 1;
    }
    this.highlightMats = [];
    this.markers.clear();
    this.highlighted = ids.slice();
    for (const id of ids) {
      for (const mesh of this.partMeshes.get(id) || []) {
        const m = mesh.material;
        m.userData.baseEmissive ??= m.emissive.clone();
        m.emissive.copy(ACCENT);
        this.highlightMats.push(m);
      }
      const a = this.anchors.get(id);
      if (a) {
        const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.ringTexture, depthTest: false, transparent: true }));
        ring.position.copy(a);
        ring.userData.size = 0.07;
        ring.renderOrder = 10;
        this.markers.add(ring);
      }
    }
  }

  // ── assets ───────────────────────────────────────────────────────────────────────────────────
  clearContent() {
    this.content.clear();
    this.partMeshes.clear();
    this.highlight([]);
  }

  loadTrainerEngine() {
    this.clearContent();
    const engine = buildTrainerEngine(THREE);
    engine.traverse((o) => {
      if (o.isMesh && o.userData.partId) {
        o.material = o.material.clone(); // per-part highlight
        if (!this.partMeshes.has(o.userData.partId)) this.partMeshes.set(o.userData.partId, []);
        this.partMeshes.get(o.userData.partId).push(o);
      }
    });
    this.content.add(engine);
    this.assetId = 'trainer-engine';
    this.setAnchors(null);
    return { id: this.assetId, label: 'Trainer engine (built-in)' };
  }

  /** A glTF/GLB. Meshes or nodes named after a part id (e.g. "oil_filter") become pickable parts. */
  async loadGLTF(url, { id, label, transform } = {}) {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath(new URL('../vendor/draco/', import.meta.url).href);
    loader.setDRACOLoader(draco);
    const gltf = await loader.loadAsync(url);
    this.clearContent();
    const root = gltf.scene;
    applyTransform(root, transform) || fitToEngineSize(root);
    root.traverse((o) => {
      let p = o;
      while (p && !this.k.part(p.name)) p = p.parent;
      if (o.isMesh && p) {
        o.userData.partId = p.name;
        o.material = o.material.clone();
        if (!this.partMeshes.has(p.name)) this.partMeshes.set(p.name, []);
        this.partMeshes.get(p.name).push(o);
      }
    });
    this.content.add(root);
    this.assetId = id || 'gltf';
    return { id: this.assetId, label: label || url };
  }

  /** A phone-captured Gaussian splat (.sog / .ply / .spz) through Spark, in the same scene. */
  async loadSplat(url, { id, label, transform } = {}) {
    const { SparkRenderer, SplatMesh } = await import('@sparkjsdev/spark');
    this.clearContent();
    if (!this.spark) {
      this.spark = new SparkRenderer({ renderer: this.renderer, minSortIntervalMs: 16 });
      this.scene.add(this.spark);
    }
    const splat = new SplatMesh({ url });
    splat.quaternion.set(1, 0, 0, 0); // most captures are exported Y-down; three is Y-up
    await splat.initialized;
    const holder = new THREE.Group();
    holder.add(splat);
    applyTransform(holder, transform);
    this.content.add(holder);
    this.assetId = id || 'splat';
    return { id: this.assetId, label: label || url };
  }

  /** Anchors for the current asset: per-asset overrides (calibration) over parts.json defaults. */
  setAnchors(overrides) {
    this.anchors.clear();
    for (const p of this.k.parts) {
      const xyz = overrides?.[p.id] || p.anchors?.[this.assetId] || (this.assetId === 'trainer-engine' ? p.anchor : null);
      if (xyz) this.anchors.set(p.id, new THREE.Vector3(...xyz));
    }
  }

  // ── picking and projection ─────────────────────────────────────────────────────────────────
  /** CSS-pixel position of a world point on the canvas, or null when behind the camera. */
  project(v) {
    const p = v.clone().project(this.cam);
    if (p.z > 1 || p.z < -1) return null;
    const r = this.canvas.getBoundingClientRect();
    return { x: ((p.x + 1) / 2) * r.width, y: ((1 - p.y) / 2) * r.height, depth: p.z };
  }

  /**
   * Is this part's anchor hidden behind other geometry from the app camera? Labels use it so the
   * overlay doesn't name things the trainee can't see. Cheap: one ray per label, a few times a second.
   */
  occluded(id) {
    const a = this.anchors.get(id);
    if (!a || this.partMeshes.size === 0) return false; // splats: no meshes to test against
    const dir = a.clone().sub(this.cam.position);
    const dist = dir.length();
    this._ray ??= new THREE.Raycaster();
    this._ray.set(this.cam.position, dir.normalize());
    this._ray.far = dist - 0.03;
    const hit = this._ray.intersectObject(this.content, true)[0];
    return !!hit && hit.object.userData.partId !== id;
  }

  /** What is under a client-space point: { partId, point } (point is null when nothing is hit). */
  pick(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.cam);
    let hit = null;
    try {
      hit = ray.intersectObject(this.content, true).find((h) => h.object.visible) || null;
    } catch {
      hit = null; // an object without raycast support
    }
    let partId = hit?.object?.userData?.partId || null;
    // No segmented mesh (a splat or an untagged glTF): take the nearest anchor on screen.
    if (!partId) {
      let best = 48; // px
      for (const [id, a] of this.anchors) {
        const s = this.project(a);
        if (!s) continue;
        const d = Math.hypot(s.x - (clientX - r.left), s.y - (clientY - r.top));
        if (d < best) [best, partId] = [d, id];
      }
    }
    const point = hit ? hit.point.clone() : ray.ray.at(this.orbit.dist, new THREE.Vector3());
    return { partId, point, onSurface: !!hit };
  }

  bindPointer() {
    const c = this.canvas;
    let drag = null;
    c.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false };
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 4) drag.moved = true;
      if (drag.moved) {
        this.fly = null;
        this.orbit.yaw -= dx * 0.006;
        this.orbit.pitch = clamp(this.orbit.pitch + dy * 0.005, -1.2, 1.35);
      }
      drag.x = e.clientX;
      drag.y = e.clientY;
    });
    const end = (e) => {
      if (drag && !drag.moved && e.type === 'pointerup') this.emit('pick', this.pick(e.clientX, e.clientY), e);
      drag = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.fly = null;
      this.orbit.dist = clamp(this.orbit.dist * Math.exp(e.deltaY * 0.001), MIN_DIST, MAX_DIST);
    }, { passive: false });
  }
}

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

function shortestAngle(a, b) {
  return ((((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
}

/** Position/rotation(deg)/scale from a manifest entry. Returns false when there is none. */
function applyTransform(obj, t) {
  if (!t) return false;
  if (t.position) obj.position.set(...t.position);
  if (t.rotationDeg) obj.rotation.set(...t.rotationDeg.map((d) => (d * Math.PI) / 180));
  if (t.scale != null) obj.scale.setScalar(t.scale);
  return true;
}

/** Scale an unknown glTF so its largest dimension is about the size of a light-aircraft engine bay. */
function fitToEngineSize(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const k = 1.6 / Math.max(size.x, size.y, size.z, 1e-6);
  obj.scale.setScalar(k);
  const c = box.getCenter(new THREE.Vector3()).multiplyScalar(k);
  obj.position.sub(c);
}

function makeRingTexture() {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  g.strokeStyle = '#ffb020';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2 - 10, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#ffb020';
  g.beginPath();
  g.arc(s / 2, s / 2, 8, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
