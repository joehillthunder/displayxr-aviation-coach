# Asset and third-party licenses

The code in this repository is Apache-2.0 (see [`LICENSE`](../../LICENSE)). Assets keep their own
licenses, recorded here. **Add a row before you add any asset**, and do not add one whose license
you cannot confirm.

## 3D assets

| Asset | Where it is used | Source | License | Verified |
|---|---|---|---|---|
| Trainer engine (procedural opposed-four) | Default fallback model, `web/app/trainer-engine.js` | Written for this repo from three.js primitives | Apache-2.0 (this repo) | n/a |
| Your engine-bay scan | `web/assets/scans/` (placeholder: no scan committed yet) | Your own phone capture | Yours; state it here when you add it | |

### Smithsonian 3D candidates (CC0)

Searched on [3d.si.edu](https://3d.si.edu/) with the **Open Access (CC0)** filter on 2026-10-07 for
*engine*, *aircraft*, *airplane*, *propeller*, *cylinder* and *magneto*. The only CC0 aircraft 3D model
with a piston engine:

| Object | Record | 3D package | License (as shown on the record page) |
|---|---|---|---|
| 1903 Wright Flyer, NASM A19610048000 | <https://3d.si.edu/object/3d/1903-wright-flyer:d8c62e5e-4ebc-11ea-b77f-2e728ce88125> | `https://3d-api.si.edu/content/document/3d_package:d8c62e5e-4ebc-11ea-b77f-2e728ce88125/resources/1903WrightFlyer-100k-2048_std_draco.glb` (630 KB, Draco, cm scale) | Restrictions & Rights: **CC0**; Metadata Usage: **CC0** |

**Not bundled.** Its engine is a horizontal inline four driving pusher propellers through chains, so
it cannot illustrate an opposed engine's spark plugs, oil filter or spinner. The server sends no CORS
header, so the deployed page cannot load it from the Smithsonian directly. To use it as a museum
showcase anyway, download the GLB, place it in `web/assets/scans/`, add a manifest entry with
`"type": "gltf"`, and calibrate whichever anchors make sense.

Also checked: the Packard DR-980 radial diesel (NASM A19710893000) is CC0, but its record carries
images only, with no 3D model. No CC0 horizontally opposed engine model was found. Sketchfab, TurboSquid
and GrabCAD were not used.

## Vendored libraries (copied into `web/vendor/` by `npm install`; not committed)

| Library | Version | License |
|---|---|---|
| [`@displayxr/inline3d`](https://github.com/DisplayXR/displayxr-web) | 1.37.1 | Apache-2.0 |
| [three.js](https://threejs.org/) (core, GLTFLoader, DRACOLoader, Pass) | 0.180.0 | MIT |
| Draco decoder (via three.js `libs/draco/gltf`) | as shipped with three 0.180.0 | Apache-2.0 |
| [Spark](https://sparkjs.dev/) (`@sparkjsdev/spark`) | 2.1.0 | MIT |
| [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript) (server only) | 0.132.x | MIT |

## Training material

Procedure text is paraphrased for training from public FAA material: 14 CFR Part 43 Appendix D
([eCFR](https://www.ecfr.gov/current/title-14/part-43/appendix-Appendix%20D%20to%20Part%2043)) and
FAA-H-8083-32B, *Aviation Maintenance Technician Handbook: Powerplant*
([FAA](https://www.faa.gov/regulationspolicies/handbooksmanuals/aviation/faa-h-8083-32b-aviation-maintenance-technician)).
No manufacturer manual text is included.
