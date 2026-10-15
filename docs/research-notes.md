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

## Added 2026-10-14: sources for the preflight, landing gear and flight controls trainings
Page numbers are the printed footer labels, checked in the PDFs (not the tables of contents, which
differ by a page in places).
- 14 CFR 43 App. D (eCFR): (c) cabin and cockpit, (c)(3) windows and windshields, (c)(5) flight and
  engine controls (improper installation, improper operation); (e)(1)-(10) landing gear group; (f) wing
  and center section and (g) empennage have no numbered items.
- FAA-H-8083-3C Airplane Flying Handbook (2021), Ch. 2 Ground Operations
  (https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/03_afh_ch2.pdf):
  cabin items 2-5; outer wing surfaces and tail section 2-6..2-7; fuel quantity, stains, contamination 2-9;
  sumps, strainer, vent, oil dipstick, caps 2-10; landing gear, tires, brakes, cowling 2-11; spinner,
  propeller, inside the cowling, air filter 2-12; chocks with the engine running 2-17; flight controls
  full range in the before-takeoff check 2-21; chocks, tie-downs 2-23. Pitot tube, static ports and
  stall warning are not walk-around items in this chapter, so the preflight training leaves them out.
- FAA-H-8083-31B AMT Airframe (2023), one PDF
  (https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/FAA-H-8083-31B_Aviation_Maintenance_Technician_Handbook.pdf):
  Ch. 13: leaf-type spring gear 13-6; shock struts 13-7; torque links 13-9; servicing shock struts
  13-12..13-13; shimmy dampers 13-30, piston type 13-32; wheel inspection and axle nut torque 13-36;
  wheel bearing inspection 13-38; tie bolts 13-41; brake inspection, lining wear 13-66..13-67; brake
  damage (warped discs) 13-72; tire inflation 13-78..13-79; tread 13-79; sidewalls 13-83.
  Ch. 2: static balance 2-36; cable inspection and rag test, pulleys 2-41; pulleys, fairleads 2-42;
  pulley wear patterns 2-43; turnbuckles, push rods, tension regulators 2-44; cable tension 2-50;
  travel, stops, trim tabs, checking and safetying 2-52; cotter pins and self-locking nuts 2-55.
