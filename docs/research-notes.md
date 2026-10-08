# Research notes (verified 2026-10-07)

## DisplayXR SDK (github.com/DisplayXR/displayxr-web @ 77d4a5e, @displayxr/inline3d 1.37.1, Apache-2.0)
- Plan: three.js scene via `wall.addScene(canvas, onFrame, { viewRig })`, camera rig from
  `cameraRigFromCamera(THREE, appCam, { convergence, attach: true })`, `handle.setViewRig(...)` every
  frame (attach pattern: eyes parented under appCam, `setLocalFromView`). Pattern: samples/camera-rig.
- Author at METRE scale; keep convergence >= ~0.5 m (comfort = diopters x 0.5 <= 1).
- Fly-to = tween appCam position/target; convergence = distance to focused part.
- 2D/3D toggle: `wall.setStereoEnabled(bool)`, gate with `inline3dDisplayModesSupported()` (samples/display-modes).
- Fallback: `if (!wall.supported)` run a mono rAF loop (camera-rig sample `onMonoFrame`).
- Woven canvas rules: one createInline3D per document; renderer.setPixelRatio(1); 2:1 backing store in 3D;
  validate views before clear; no CSS effects / backdrop-filter on overlays over the canvas.
- Splat: Spark `SplatMesh` + `SparkRenderer` in the same three scene (samples/model `mixedSpark`).
- Vendor for offline: inline3d.js + inline3d-undock.js + inline3d-mode-switch.js + inline3d-three.js; three@0.180.0; vendor/draco.

## 14 CFR Part 43 Appendix D (eCFR, public domain)
- (a) open plates/cowling, clean aircraft and engine before inspecting.
- (d) engine & nacelle group: (1) leaks, (2) studs/nuts, (3) internal: compression, metal on screens/sump plugs,
  (4) engine mount, (5) vibration dampeners, (6) engine controls, (7) lines/hoses/clamps, (8) exhaust stacks,
  (9) accessories mounting, (10) all systems, (11) cowling.
- (h) propeller group: (1) assembly cracks/nicks/binds/oil leakage, (2) bolts torque/safetying, (3) anti-icing, (4) controls.

## FAA-H-8083-32B AMT Powerplant (faa.gov chapter PDFs; cite chapter + page)
- Ch 3: Induction inspection & maintenance 3-4 (cracks/leaks, security, air filter check/clean);
  exhaust maintenance & inspection 3-22..3-24 (gray/sooty streaks = leak; cracks at welds/clamps; heat exchanger CO hazard).
- Ch 4: ignition maint. & inspection 4-26; spark plug fouling 4-33..4-35; removal 4-35..4-36 (pull lead straight,
  keep plugs in numbered tray); reconditioning/visual 4-36; pre-install checks 4-37..4-38 (round wire gap gauge,
  new gasket, antiseize on first threads only, finger-start then torque); harness 4-7, 4-33; magneto breaker/dielectric 4-39..4-41.
- Ch 6: oil screens 6-15..6-16 (metal particles); oil & filter change, filter content inspection 6-17;
  cooling maintenance 6-34; cowling 6-36; fin inspection 6-36; baffle & deflector inspection 6-36..6-37.
- Ch 7: propeller inspection & maintenance 7-20 (25/50/100 h visual list incl. spinner screws); wood/metal/aluminum/composite 7-21; tracking 7-22.
- Ch 10: magneto (ignition operational) check 10-26..10-27; cylinder compression tests / differential tester 10-39..10-40.

## Smithsonian 3D (3d.si.edu, CC0-filtered search for engine/aircraft/propeller/cylinder/magneto)
- Only CC0 aircraft 3D model with a piston engine: 1903 Wright Flyer, nasm_A19610048000,
  https://3d.si.edu/object/3d/1903-wright-flyer:d8c62e5e-4ebc-11ea-b77f-2e728ce88125
  "Restrictions & Rights: CC0", "Metadata Usage: CC0" (checked on record page).
  GLB: https://3d-api.si.edu/content/document/3d_package:d8c62e5e-4ebc-11ea-b77f-2e728ce88125/resources/1903WrightFlyer-100k-2048_std_draco.glb
  (630,156 bytes, Draco, cm scale). No CORS header, so it would have to be committed rather than hotlinked. Not bundled.
- Packard DR-980 (nasm_A19710893000) is CC0 but has images only, no 3D model.
- No CC0 opposed-engine 3D model found, so the default fallback is a procedural unbranded opposed-4 trainer engine (own code, Apache-2.0).

## Open items
- "Muse" adapter: API details still needed; it ships as a stub (`POST /api/muse` returns 501).
- Wright Flyer GLB: CC0 and recorded in web/assets/LICENSES.md, but not bundled (wrong engine type for these lessons).
