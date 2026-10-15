# CLAUDE.md

3D Aviation Coach: a glasses-free 3D aviation trainer. An AI instructor flies a camera to each part of a
real-scale model and walks a trainee through FAA-sourced procedures. On a Leia display in the
DisplayXR Browser the view is woven 3D; in any other browser it is 2D. It is a static web app in
`web/`, plus an optional local server that holds the API keys. Live:
https://joehillthunder.github.io/displayxr-aviation-coach/

## Commands

```bash
npm install          # also copies three.js, Spark and the DisplayXR SDK into web/vendor/ (postinstall)
npm test             # node --test test/*.test.mjs — data, grounding, mock end to end, fly-to sight lines
npm start            # local server on http://localhost:8080 (static files + /api/*)
npm run mock -- --training preflight   # the mock instructor in the terminal
npm run vendor       # re-copy web/vendor/ if it is missing (it is gitignored)
node scripts/format-data.mjs web/data/<id>/*.json   # format training JSON the committed way
```

The page needs `web/vendor/`. Without it the module graph fails silently and the page sits on
"Loading the model…". Serve it over HTTP (`npm start`), not from `file://`.

## Layout

- `web/data/trainings.json`: the lessons. Each one has `id`, `model`, `asset`, `subject` (goes into the AI prompt) and `stage`
  (camera `home`, `floorY`, `floorRadius`, `focusDist`, `maxDist`, `depthRef`). `default` is the lesson that loads without
  `?training=`.
- `web/data/<id>/parts.json` and `procedures.json`: one training's material. `web/data/sources.json` is shared.
- `web/app/models/`: the built-in procedural models (`engine`, `aircraft`, `gear`, `empennage`), the shared `kit.js` and the
  registry `index.js`.
- `web/app/scene.js`: the DisplayXR camera rig, depth, fly-to, highlight, picking and label projection.
- `web/app/view.js`: pure camera maths (`focusView`, `orbitPosition`, `ipdFactorFor`), shared with the tests.
- `web/app/instructor/`:
  - `knowledge.js` loads and searches the material.
  - `session.js` is the Coach: the tools, plus the grounding guard `ground()`.
  - `tools.js` holds the tool schemas and the system prompt.
  - `adapters/` holds mock, claude, openai-realtime, local and muse.
- `server/server.mjs`: binds 127.0.0.1 and builds the prompt and tools for each training from the committed data.
- `cli/coach.mjs`, `test/`, `docs/research-notes.md` (the verified source pages).

## Adding or changing a training

1. Add an entry to `web/data/trainings.json`.
2. Write `web/data/<id>/parts.json` and `procedures.json`.
3. If the training needs a new model, add `web/app/models/<model>.js` and register it in `models/index.js`. Every part is a
   group from `kit.part(id)`, and the builder must call `tagParts()` last.
4. Run `npm test`. For every training it checks that:
   - each part has geometry
   - each anchor sits on or near its part
   - each fly-to view reaches its part on at least 6 of 9 sight lines
   - every citation is well-formed
   - every part is taught by some step
   - procedure ids are unique across trainings
   - the mock instructor can walk every procedure and find every part by name

When a fly-to test fails, adjust the part's `anchor`, `viewDir` or `focusDist`, or move geometry that blocks the view. Never
loosen the test. Meshes with `userData.seeThrough` (the tailcone skin) never block a view or a pick.

## Rules for the training material

- **Cite only what you have read.** Every part and step needs a source: a 14 CFR 43 App. D locator such as `(e)(7)` or `(g)`,
  or a handbook chapter and page (`"page": "13-36"`).
  - Page numbers are the printed footer labels in the FAA PDFs, not the table of contents, which is off by one in places.
  - Record new sources in `docs/research-notes.md`.
  - If a handbook does not cover an item, leave the item out. The preflight lesson has no pitot tube or stall warning for
    this reason.
- **No numbers the material does not carry.** No torques, pressures, limits or intervals: point to the manufacturer. The mock
  instructor and the grounding guard decline value questions, and the guard blocks uncited replies that contain numbers.
- **Paraphrase the FAA text; never copy manufacturer manuals or branding.** Every model is generic and unbranded.
- The "training demo only" banner and wording stay.

## 3D / DisplayXR rules

- **Woven canvas.**
  - Use one `createInline3D` per document, which is why switching trainings reloads the page.
  - Keep `renderer.setPixelRatio(1)` and a double-width backing store in 3D.
  - Validate views before clearing.
  - Put no CSS effects (filter, opacity, backdrop-filter, blend modes) on the canvas or on overlays above it.
  - The poster cuts away; it never fades.
- **Camera rig, attach pattern.** The eye cameras hang off `scene.cam`.
  - Convergence = `max(0.55 m, dist × POP)`.
  - `ipdFactor = ipdFactorFor(dist, stage.depthRef, depthGain)` scales eye separation with distance. A Depth slider (0–2)
    sets `depthGain`.
  - Keep convergence at or beyond 0.55 m (comfort).
- Models are authored in **metres** in each model's own frame; each `parts.json` states its frame.
- Depth tuning has not yet been verified on a Leia panel. Check changes to `POP`, `depthRef` or `ipdFactorFor` in the
  DisplayXR Browser.

## Code conventions

- Plain ES modules, no build step, no framework. The same modules run in the browser and in Node (tests, CLI, server), so
  `knowledge.js`, `session.js`, `tools.js`, `view.js` and `models/` must not touch the DOM or `fs`.
- Two-space indent, single quotes, semicolons, trailing commas.
- Comment density matches the surrounding code: a short header on each file explaining why, and terse inline notes.
- Keys live only in `.env` (see `.env.example`) and reach the server only. The browser never sends a prompt or tool schema;
  it sends only a training id, and the server refuses unknown ids.

## Deploy

- **Deploy:** a push to `main` runs `.github/workflows/pages.yml`, which does `npm ci`, then `npm test`, then deploys `web/`
  to Pages. A failing test blocks the deploy.
- **Other branches and PRs:** these run `ci.yml`.
- **Releases:** releases are GitHub Releases tagged `vX.Y.Z`. Bump `package.json` with
  `npm version X.Y.Z --no-git-tag-version`, then commit and tag.
