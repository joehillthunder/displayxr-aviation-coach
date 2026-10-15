# 3D Aviation Coach

**A glasses-free 3D aviation trainer with four lessons: an AI instructor flies the view to each part
and walks a trainee through an engine 100-hour inspection, a preflight walk-around, a landing gear
inspection and the flight-control cables, on a Leia display or in 2D in any browser.**

> [!WARNING]
> **Training demo only. Not approved maintenance data.** Follow the aircraft, engine and propeller
> manufacturers' maintenance instructions, and work under a certificated mechanic. Nothing here is
> authorization to perform maintenance.

> **Demo GIF: placeholder.** Record it on a Leia display and save it as `docs/demo.gif`, then replace
> this note with `![3D Maintenance Coach demo](docs/demo.gif)`. A phone video of the display shows the
> depth; a screen capture would only show the flat 2D view.

**Live (2D, mock instructor):** https://joehillthunder.github.io/displayxr-aviation-coach/

## The trainings

Pick one in the **Training** menu, or link straight to it with `?training=<id>`.

| Training | `?training=` | 3D model | Procedures | Sources |
|---|---|---|---|---|
| Engine 100-hour inspection | `engine` (default) | Opposed four-cylinder engine on a stand (or your scan) | 100-hour engine and nacelle, spark plugs, oil and filter, propeller | 14 CFR 43 App. D (d), (h); FAA-H-8083-32B |
| Preflight walk-around | `preflight` | A whole high-wing trainer on the ramp, with chocks and tie-downs | Preflight walk-around (13 steps), fuel quantity and contamination check | FAA-H-8083-3C Ch. 2 |
| Landing gear, wheels and brakes | `landing_gear` | Spring-steel main gear with disc brake beside an oleo nose gear | 100-hour landing gear inspection (every App. D (e) item), wheel, tire and brake check | 14 CFR 43 App. D (e); FAA-H-8083-31B Ch. 13 |
| Empennage and flight-control cables | `flight_controls` | Tail section with see-through skin, so cables, pulleys and turnbuckles show | 100-hour empennage and flight control inspection, cable/pulley/turnbuckle check | 14 CFR 43 App. D (c)(5), (g); FAA-H-8083-31B Ch. 2 |

Every training uses the same instructor, tools, grounding guard, quiz and adapters. Each one is a
folder of JSON (`web/data/<id>/parts.json` and `procedures.json`), a built-in model in
`web/app/models/`, and an entry in `web/data/trainings.json` (camera home, floor, zoom range,
depth). To add a lesson, add those three things; the tests then check its citations and fly every
fly-to view against the model.

## What it shows

- **Real-scale subjects in glasses-free 3D.** An engine (or your phone scan of one), a whole airplane,
  a landing gear bench and a tail section, woven by the
  [DisplayXR inline-3D SDK](https://github.com/DisplayXR/displayxr-web) (1.45.1). The instructor flies a
  camera rig from part to part with `setViewRig`, converging just behind the part it is talking about
  so it floats slightly out of the glass.
- **Depth that holds up at any size.** The eye separation scales with viewing distance, so a whole
  airplane 13 m away has as much depth as a spark plug up close, and a **Depth** slider on the stage
  tunes it per display. The SDK's depth cursor rises to the part under the pointer instead of being
  drawn behind it.
- **An AI instructor with tools, not just a chat box.** `focus_part`, `highlight_part`, `next_step`,
  `prev_step`, `explain_step`, `quiz_me` and `show_source` drive the 3D view, the checklist and the
  citations.
- **Grounded answers.** The instructor answers only from `parts.json` and `procedures.json`. Every
  reply must cite the material, a guard replaces uncited claims with *"That's not in the training
  material."*, and specific values (torques, gaps, intervals) are always deferred to the manufacturer.
- **Ten procedures with sources.** Across the four trainings, every step cites its Appendix D item or
  its FAA handbook chapter and page (FAA-H-8083-32B Powerplant, -31B Airframe, -3C Airplane Flying
  Handbook). The engine and landing gear walkthroughs cover every item of Appendix D (d) and (e).
- **Trainee and quiz modes.** Guided step-by-step, or "find the part": the instructor names a part
  and the trainee clicks it on the model.
- **Crisp 2D over woven 3D.** Part labels, the step checklist, the source citation and a progress
  bar are ordinary DOM over the woven canvas.
- **Field mode.** A local small model and the browser's own speech, with no internet.

## Hardware

| | |
|---|---|
| 3D display | A Leia SR display (laptop or monitor) with the DisplayXR runtime |
| Browser | [DisplayXR Browser](https://github.com/DisplayXR/displayxr-browser/releases) for woven 3D; any modern browser for 2D |
| OS | Windows 10/11 (the DisplayXR stack is Windows) |
| Optional | A mic for voice; [Ollama](https://ollama.com/) for offline mode; an Anthropic or OpenAI key for the live instructors |

Without a 3D display, everything runs in 2D, including the AI instructor, the quiz and calibration.

## Quick start (2 minutes, mock mode, no keys)

```bat
git clone https://github.com/joehillthunder/displayxr-aviation-coach
cd displayxr-aviation-coach
setup-windows.bat
```

`setup-windows.bat` installs Node.js LTS with winget if it is missing, runs `npm install` (which copies
three.js, Spark and the DisplayXR SDK into `web/vendor/`, so nothing loads from a CDN), creates `.env`
from `.env.example`, runs the tests in mock mode, then starts the server and opens
<http://localhost:8080/>. Open the same URL in the DisplayXR Browser for 3D.

Then try:

1. **Procedure → Spark plug inspection**, then **Next step**. The view flies to each part.
2. Ask *"where are the magnetos?"*, then *"what is the torque for the propeller bolts?"* (it won't give
   one, and it tells you which step covers it).
3. Switch to **Quiz** and click the part it names.
4. **Training → Preflight walk-around** and step around the airplane, or try *"where is the fuel vent?"*.

Prefer the terminal? `npm run mock` is the same instructor as a CLI (`npm run mock -- --training preflight`
for another lesson). On macOS or Linux, `npm install && npm start`.

## Architecture

```mermaid
flowchart LR
  subgraph Data["Training material (committed JSON)"]
    P[parts.json<br/>id, name, 3D anchor,<br/>description, FAA source]
    R[procedures.json<br/>ordered steps tied to part ids,<br/>each citing its source]
    S[sources.json<br/>14 CFR 43 App. D,<br/>FAA-H-8083-32B]
  end

  subgraph Browser["Browser: web/"]
    K[Knowledge<br/>index + search]
    C[Coach<br/>tools + state]
    G{Grounding guard<br/>cite or decline}
    A[Adapter]
    UI[Panel<br/>checklist, progress,<br/>citations, chat, quiz]
    SC[Scene3D<br/>three.js]
    SDK[DisplayXR inline-3D SDK<br/>addScene + setViewRig]
  end

  subgraph Server["Local server: server/ (127.0.0.1, holds keys)"]
    API["/api/claude<br/>/api/openai/session<br/>/api/local<br/>/api/muse"]
  end

  P & R & S --> K --> C
  A -- tool calls --> C
  C -- focus / highlight --> SC --> SDK --> D[(Leia display<br/>woven 3D)]
  SC -. no 3D display .-> F[(2D canvas)]
  C --> UI
  A -- reply --> G --> UI
  A <--> API
  API <--> CL[Claude API] & OA[OpenAI Realtime] & LM[Local model<br/>Ollama] & MU[Muse]
  M[Mock adapter<br/>no keys, no network] --> C
```

- **One coach, many adapters.** Every adapter (`web/app/instructor/adapters/`) calls the same tool
  implementations (`session.js`), and every reply goes through the same guard (`Coach.ground`). Tests
  (`test/`) run all four procedures end to end in mock mode, check the guard against invented
  answers and invented citations, and raycast the real trainer engine to prove every fly-to view
  actually shows its part.
- **The server builds the prompt.** The system prompt and tool schemas are generated on the server from
  the committed data (`tools.js`), one set per training, never accepted from the page: the page only
  names the training, and an unknown id is refused. Keys live only in `.env`.
- **Camera rig, metre scale.** Every model is authored in metres. The rig's eye separation is scaled
  by distance (`ipdFactorFor` in `view.js`) so each subject reads like a model about a metre away;
  convergence follows the focused part and never comes nearer than 0.55 m (the runtime's comfort
  rule). The eyes hang off the app camera (the SDK's attach pattern), so fly-to has no stereo lag.

## Adapters

Pick one in the **Instructor** menu (or `?ai=claude` etc.). Unconfigured ones are greyed out.

| Adapter | Needs | Notes |
|---|---|---|
| Mock | nothing | Rule-based, deterministic, offline. Default, and the only one on GitHub Pages. |
| Claude | `ANTHROPIC_API_KEY` | One Messages API turn per request on `claude-opus-5-5` (`CLAUDE_MODEL`, `CLAUDE_EFFORT`), with server-side refusal fallback. The browser runs the tools and keeps the history append-only. |
| OpenAI Realtime (voice) | `OPENAI_API_KEY` | WebRTC speech-to-speech. The server mints a short-lived client secret with the instructions and tools preset. Because the audio is generated by the service, the guard can only check the transcript after it has been spoken. |
| Offline (local model) | Ollama running (`ollama pull qwen3:8b`) | Any OpenAI-compatible endpoint (`LOCAL_LLM_URL`, `LOCAL_LLM_MODEL`). Same tools and guard; no internet. |
| Muse | API details | **Stub.** `server/server.mjs` → `POST /api/muse` returns 501 until the Muse endpoint, auth and tool-call format are filled in. |

**Offline / field mode:** run the local model, choose *Offline (local model)*, and tick *Read replies
aloud* (the browser's speech synthesis uses the OS voices, which work offline). Browser speech
*recognition* in Chrome and Edge needs the network, so in a disconnected hangar type your questions.

## Your scan

Scans apply to the engine training. Drop a phone-captured splat of a real engine bay into `web/assets/scans/`, list it in
`manifest.json`, then press **K** (Calibrate) and click the model to place each part's anchor.
Step by step: [`web/assets/scans/README.md`](web/assets/scans/README.md). Asset licenses:
[`web/assets/LICENSES.md`](web/assets/LICENSES.md).

## Repository map

```
web/                  the static app (deployed to GitHub Pages)
  data/trainings.json the lessons: model, camera home, floor, zoom range, depth
  data/<training>/    parts.json, procedures.json  <- the training material
  data/sources.json   the FAA documents every training cites
  app/scene.js        DisplayXR camera rig, depth, fly-to, highlight, picking, label projection
  app/models/         built-in models: engine, aircraft, gear bench, empennage (+ shared kit)
  app/instructor/     knowledge, coach + grounding guard, tool schema, adapters
  assets/scans/       your scan + manifest + calibrated anchors
server/server.mjs     local server: static files + keyed API proxies (127.0.0.1 only)
cli/coach.mjs         mock instructor in the terminal
test/                 data integrity, grounding, mock end to end, fly-to sight lines (node --test)
scripts/format-data.mjs  pretty-prints training JSON the way it is committed
```

## Glasses-free 3D for MRO and flight-school training

*For simulation and training partners.*

Maintenance training has a spatial problem. A trainee has to learn where things are on an engine (which
magneto feeds which plug, what the baffles do, where an exhaust crack hides) and today that knowledge
comes from flat pictures in a manual or from scarce time on a real aircraft. Headsets fix the depth but
isolate the trainee from the instructor, the manual and the classroom, and they don't suit a shared
bench or a quick refresher between jobs.

A glasses-free 3D display at a training station sits in between:

- **Depth without gear.** The engine has real depth on an ordinary desk-sized screen. Nothing to put
  on, clean or charge, and an instructor can stand behind the trainee and see the same thing.
- **3D and 2D together.** Checklists, citations and labels stay crisp 2D over the woven 3D, so the
  procedure and the part are in one view, and the same app runs in 2D on any classroom PC.
- **An instructor that shows, not tells.** The AI moves the view to the part it is talking about,
  quizzes by pointing, and cites the regulation or handbook section for every step.
- **Grounded and auditable.** Content lives in plain JSON your training department owns. The model may
  only answer from it, and the tests fail if a step loses its source.
- **Your own aircraft.** Swap the trainer engine for a phone scan of your own fleet's engine bay and
  re-anchor the parts in minutes, with no 3D artist.
- **Works disconnected.** A local model and on-device speech cover a hangar with no network.

Natural fits: Part 147 AMT schools, flight-school maintenance departments, MRO onboarding and recurrent
training, and simulator centres that want a bench-top companion to full procedures trainers. To pilot
this with your curriculum (your procedures, your scans, your hardware), open an issue.

## License

Code: [Apache-2.0](LICENSE). Assets keep their own licenses: [`web/assets/LICENSES.md`](web/assets/LICENSES.md).
Procedure text is paraphrased from public FAA material (14 CFR Part 43 Appendix D; FAA-H-8083-32B) for
training; no manufacturer manual text, logos or product branding are included.
