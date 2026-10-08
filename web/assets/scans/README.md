# Your engine-bay scan goes here

The coach shows a phone-captured Gaussian splat of a real engine bay when one is listed in
`manifest.json`. Until then it falls back to the built-in trainer engine.

## Add a scan

1. Capture the engine bay with a phone splat app (walk a slow loop around the open cowling, with even
   light and no people in frame) and export it as `.sog`, `.ply` or `.spz`.
2. Copy the file into this folder, e.g. `engine-bay.sog`.
3. List it in `manifest.json` and make it active:

   ```json
   {
     "active": "my-engine-bay",
     "scans": [
       {
         "id": "my-engine-bay",
         "label": "Engine bay scan (phone capture)",
         "file": "engine-bay.sog",
         "type": "splat",
         "transform": { "position": [0, 0, 0], "rotationDeg": [0, 0, 0], "scale": 1 },
         "anchors": "my-engine-bay.anchors.json"
       }
     ]
   }
   ```

   `transform` places the capture in the engine frame the anchors use: metres, +y up, +z toward the
   propeller, origin at the middle of the crankcase. A glTF works the same way with `"type": "gltf"`.
   `?asset=trainer` in the URL forces the built-in engine; `?scan=<url>` loads any splat directly.

4. Open the page, press **K** (or **Calibrate**), pick each part and click where its label should sit.
   Anchors save in your browser as you go; **Export JSON** downloads `my-engine-bay.anchors.json`.
   Put that file here and commit it with the manifest.

Add a line for the scan to [`../LICENSES.md`](../LICENSES.md). Large scans are git-ignored by default
(see `.gitignore`); commit one deliberately, or use Git LFS, if you want it on GitHub Pages.
