// Wiring: training material -> coach -> instructor adapter, with the 3D stage and the panel as the
// coach's "stage". Runs the same in the DisplayXR Browser (woven 3D) and in any other browser (2D).

import { Knowledge, NOT_IN_MATERIAL } from './instructor/knowledge.js';
import { Coach } from './instructor/session.js';
import { Instructor } from './instructor/instructor.js';
import { MockAdapter } from './instructor/adapters/mock.js';
import { ClaudeAdapter } from './instructor/adapters/claude.js';
import { LocalAdapter } from './instructor/adapters/local.js';
import { MuseAdapter } from './instructor/adapters/muse.js';
import { OpenAIRealtimeAdapter } from './instructor/adapters/openai-realtime.js';
import { Scene3D } from './scene.js';
import { Calibrator, loadDraft } from './calibrate.js';
import { canListen, listenOnce, speak, stopSpeaking } from './voice.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const k = await Knowledge.load((f) => fetch(f).then((r) => {
  if (!r.ok) throw new Error(`${f}: ${r.status}`);
  return r.json();
}));

// ── 3D stage ────────────────────────────────────────────────────────────────────────────────
const scene = new Scene3D($('view'), k);
const asset = await loadAsset();
const session = await scene.start();
session.firstWoven.then(() => $('poster').setAttribute('hidden', '')); // cut, never fade
setStatus();

async function loadAsset() {
  const want = params.get('asset');
  const scanUrl = params.get('scan');
  try {
    if (scanUrl) {
      // A stable id from the file name, so calibrated anchors survive a reload.
      const base = scanUrl.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
      const id = `scan-${base.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()}`;
      return useAnchors(await loadByType({ id, file: scanUrl, label: scanUrl }, scanUrl));
    }
    if (want !== 'trainer') {
      const manifest = await fetch('assets/scans/manifest.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const scan = manifest?.scans?.find((s) => s.id === (want || manifest.active));
      if (scan) {
        const loaded = await loadByType(scan, new URL(scan.file, new URL('assets/scans/', location.href)).href);
        const fileAnchors = scan.anchors
          ? await fetch(new URL(scan.anchors, new URL('assets/scans/', location.href))).then((r) => r.json()).then((j) => j.anchors).catch(() => null)
          : null;
        return useAnchors(loaded, fileAnchors);
      }
    }
  } catch (err) {
    console.warn('[coach] asset failed to load, using the trainer engine:', err);
    addMessage('system', `Could not load the scan (${err.message}); showing the built-in trainer engine.`);
  }
  return useAnchors(scene.loadTrainerEngine());
}

function loadByType(entry, url) {
  const type = entry.type || (/\.(glb|gltf)$/i.test(url) ? 'gltf' : 'splat');
  const opts = { id: entry.id, label: entry.label, transform: entry.transform };
  return type === 'gltf' ? scene.loadGLTF(url, opts) : scene.loadSplat(url, opts);
}

/** Draft (calibration in this browser) > anchors file > parts.json. */
function useAnchors(loaded, fileAnchors = null) {
  scene.setAnchors(loadDraft(loaded.id) || fileAnchors);
  return loaded;
}

function setStatus() {
  const mode = scene.woven
    ? `<b class="ok">glasses-free 3D</b> · camera rig${scene.stereo ? '' : ' · display in 2D'}`
    : '2D view (open in the DisplayXR Browser on a 3D display for glasses-free 3D)';
  $('status').innerHTML = `${mode} · ${asset.label}`;
  const btn = $('stereo');
  btn.disabled = !scene.displayModesSupported;
  btn.textContent = scene.displayModesSupported ? (scene.stereo ? 'Switch to 2D' : 'Switch to 3D') : '2D only';
  btn.title = scene.displayModesSupported ? 'Switch the display between glasses-free 3D and 2D' : 'No 3D display detected in this browser';
}
scene.on('modechange', setStatus);
$('stereo').addEventListener('click', async () => {
  $('stereo').disabled = true;
  try {
    await scene.setStereo(!scene.stereo);
  } catch (err) {
    addMessage('system', `Display mode change refused: ${err.message}`);
  }
  setStatus();
});

// ── labels: 2D overlays that track the 3D anchors ────────────────────────────────────────────
const labelEls = new Map();
let showLabels = true;
for (const p of k.parts) {
  const el = document.createElement('div');
  el.className = 'label';
  el.textContent = p.name;
  $('labels').appendChild(el);
  labelEls.set(p.id, el);
}
const hiddenBehind = new Set();
let frameNo = 0;
scene.on('frame', () => {
  const on = new Set(scene.highlighted);
  if (frameNo++ % 8 === 0) {
    hiddenBehind.clear();
    for (const id of labelEls.keys()) if (!on.has(id) && scene.occluded(id)) hiddenBehind.add(id);
  }
  for (const [id, el] of labelEls) {
    const a = scene.anchors.get(id);
    const wanted = on.has(id) || (showLabels && !hiddenBehind.has(id));
    const s = a && wanted && !coach.quiz ? scene.project(a) : null;
    if (!s) {
      el.hidden = true;
      continue;
    }
    el.hidden = false;
    el.style.left = `${s.x}px`;
    el.style.top = `${s.y}px`;
    el.classList.toggle('on', on.has(id));
    el.style.zIndex = on.has(id) ? 2 : 1;
  }
});
$('labelsToggle').addEventListener('click', (e) => {
  showLabels = !showLabels;
  e.currentTarget.setAttribute('aria-pressed', String(showLabels));
});
$('home').addEventListener('click', () => scene.home());

// ── the coach and its stage ──────────────────────────────────────────────────────────────────
const coach = new Coach(k, {
  focusPart: (id) => scene.focusPart(id),
  highlightPart: (ids) => scene.highlight(ids),
  showProcedure: renderProcedure,
  showSources: renderSources,
  showQuiz: (q) => {
    $('quizBanner').hidden = !q;
    $('quizBanner').textContent = q || '';
  },
});

function renderProcedure(proc, index) {
  $('checklist').innerHTML = '';
  if (!proc) return;
  $('procedure').value = proc.id;
  proc.steps.forEach((s, i) => {
    const li = document.createElement('li');
    li.textContent = s.title;
    li.className = i < index ? 'done' : i === index ? 'current' : '';
    li.addEventListener('click', () => {
      coach.proc = proc;
      coach._goto(i);
      announceStep();
    });
    $('checklist').appendChild(li);
  });
  const s = proc.steps[index];
  $('stepTitle').textContent = `${index + 1}. ${s.title}`;
  $('stepText').textContent = s.text;
  $('stepCheck').hidden = false;
  $('stepCheck').textContent = `Check yourself: ${s.check}`;
  $('progressText').textContent = `${proc.title} · step ${index + 1} of ${proc.steps.length}`;
  $('progressFill').style.width = `${((index + 1) / proc.steps.length) * 100}%`;
}

function renderSources(lines) {
  $('sources').innerHTML = '';
  for (const l of lines) {
    const li = document.createElement('li');
    if (l.url) {
      const a = document.createElement('a');
      a.href = l.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = l.text;
      li.appendChild(a);
    } else {
      li.textContent = l.text;
    }
    $('sources').appendChild(li);
  }
}

// ── instructor adapters ──────────────────────────────────────────────────────────────────────
const serverConfig = await fetch('api/config').then((r) => (r.ok ? r.json() : null)).catch(() => null);
const ADAPTERS = {
  mock: { make: () => new MockAdapter(coach), label: 'Mock (no keys)', available: true },
  claude: { make: () => new ClaudeAdapter(coach), label: 'Claude', available: !!serverConfig?.claude },
  openai: {
    make: () => new OpenAIRealtimeAdapter(coach, { onReply: (t) => showReply(instructor.finish(t)) }),
    label: 'OpenAI Realtime (voice)',
    available: !!serverConfig?.openai,
  },
  muse: { make: () => new MuseAdapter(coach), label: 'Muse', available: !!serverConfig?.muse },
  local: { make: () => new LocalAdapter(coach), label: 'Offline (local model)', available: !!serverConfig?.local },
};
for (const [id, a] of Object.entries(ADAPTERS)) {
  const opt = new Option(a.available ? a.label : `${a.label} (unavailable)`, id);
  opt.disabled = !a.available;
  $('adapter').add(opt);
}
const startAdapter = ADAPTERS[params.get('ai')]?.available ? params.get('ai') : 'mock';
$('adapter').value = startAdapter;
const instructor = new Instructor(coach, ADAPTERS[startAdapter].make());
$('adapter').addEventListener('change', (e) => {
  instructor.setAdapter(ADAPTERS[e.target.value].make());
  addMessage('system', `Instructor: ${ADAPTERS[e.target.value].label}.`);
});
if (!serverConfig) addMessage('system', 'Static hosting: the mock instructor is active. Run the local server (setup-windows.bat) for Claude, OpenAI voice, Muse or a local model.');

// ── chat ─────────────────────────────────────────────────────────────────────────────────────
function addMessage(who, text, extra = {}) {
  const div = document.createElement('div');
  div.className = `msg ${who}${extra.refused ? ' refused' : ''}`;
  div.textContent = text;
  if (extra.citations?.length) {
    const row = document.createElement('div');
    row.className = 'cites';
    for (const c of extra.citations) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = citeLabel(c);
      b.title = 'Show this in the model';
      b.addEventListener('click', () => {
        if (c.kind === 'part') coach.run('focus_part', { id: c.ref });
        else {
          const [procId, stepId] = c.ref.split('/');
          coach.proc = k.procedure(procId);
          coach._goto(coach.proc.steps.findIndex((s) => s.id === stepId));
        }
      });
      row.appendChild(b);
    }
    div.appendChild(row);
  }
  $('log').appendChild(div);
  $('log').scrollTop = $('log').scrollHeight;
}

function citeLabel(c) {
  if (c.kind === 'part') return k.part(c.ref).name;
  const [procId, stepId] = c.ref.split('/');
  const proc = k.procedure(procId);
  const i = proc.steps.findIndex((s) => s.id === stepId);
  return `${proc.title}, step ${i + 1}`;
}

function showReply(r) {
  addMessage('coach', r.text, r);
  if (r.blocked) console.info('[coach] grounding guard replaced an uncited reply:', r.original);
  if ($('speak').checked && instructor.adapter.name !== 'openai') speak(r.text);
}

async function ask(text) {
  if (!text.trim()) return;
  addMessage('you', text);
  stopSpeaking();
  try {
    showReply(await instructor.ask(text));
  } catch (err) {
    addMessage('system', `${instructor.adapter.label}: ${err.message}`);
  }
}

function announceStep() {
  const r = coach.run('explain_step');
  if (!r.error) showReply(instructor.finish(`Step ${r.step} of ${r.of}: ${r.title}. ${r.text} ${r.cite}`));
}

$('ask').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('question').value;
  $('question').value = '';
  ask(q);
});
$('next').addEventListener('click', () => ask('next'));
$('prev').addEventListener('click', () => ask('back'));
$('explain').addEventListener('click', () => ask('explain'));
$('quizMe').addEventListener('click', () => ask('quiz me'));

$('mic').disabled = !canListen() && !ADAPTERS.openai.available;
$('mic').addEventListener('click', async () => {
  const btn = $('mic');
  if (instructor.adapter.name === 'openai') {
    // Realtime voice: the mic is a live stream; the button connects and toggles it.
    const on = btn.getAttribute('aria-pressed') !== 'true';
    try {
      if (on) await instructor.adapter.connect();
      instructor.adapter.setMicEnabled(on);
      btn.setAttribute('aria-pressed', String(on));
    } catch (err) {
      addMessage('system', `Voice: ${err.message}`);
    }
    return;
  }
  btn.setAttribute('aria-pressed', 'true');
  try {
    const heard = await listenOnce();
    if (heard) await ask(heard);
  } catch (err) {
    addMessage('system', `${err.message}. Type your question instead.`);
  } finally {
    btn.setAttribute('aria-pressed', 'false');
  }
});

// ── procedures and modes ─────────────────────────────────────────────────────────────────────
$('procedure').add(new Option('Choose…', ''));
for (const p of k.procedures) $('procedure').add(new Option(p.title, p.id));
$('procedure').addEventListener('change', (e) => {
  if (!e.target.value) return;
  coach.run('start_procedure', { id: e.target.value });
  announceStep();
});

function setMode(mode) {
  coach.setMode(mode);
  $('modeTrainee').setAttribute('aria-pressed', String(mode === 'trainee'));
  $('modeQuiz').setAttribute('aria-pressed', String(mode === 'quiz'));
  if (mode === 'quiz') ask('quiz me');
}
$('modeTrainee').addEventListener('click', () => setMode('trainee'));
$('modeQuiz').addEventListener('click', () => setMode('quiz'));

function updateScore() {
  const { asked, correct } = coach.score;
  $('scoreText').textContent = asked ? `quiz ${correct}/${asked}` : '';
}

// ── clicks on the model: quiz answers, calibration, or "what is this?" ───────────────────────
const calibrator = new Calibrator({ scene, knowledge: k, dialog: $('calibration'), stageEl: $('stage') });
$('calibrate').addEventListener('click', () => calibrator.setActive(!calibrator.active));
addEventListener('keydown', (e) => {
  if ((e.key === 'k' || e.key === 'K') && document.activeElement?.tagName !== 'INPUT') calibrator.setActive(!calibrator.active);
});

scene.on('pick', (pick) => {
  if (calibrator.active) return calibrator.place(pick);
  if (coach.quiz) {
    if (!pick.partId) return addMessage('system', 'Click on a part of the engine.');
    const r = instructor.pick(pick.partId);
    addMessage('you', `(clicked ${k.part(pick.partId).name.toLowerCase()})`);
    showReply(r);
    updateScore();
    if (coach.mode === 'quiz') setTimeout(() => ask('quiz me'), 1800);
    return;
  }
  if (pick.partId) {
    const r = coach.run('highlight_part', { id: pick.partId });
    showReply(instructor.finish(`${r.part.name}. ${r.part.description} ${r.part.cite}`));
  }
});

// ── first run ────────────────────────────────────────────────────────────────────────────────
addMessage('coach', 'Welcome to the training station. Pick a procedure above, ask about any part, or say "quiz me". This is a training demo, not approved maintenance data.');
console.log('[coach] ready:', { asset: asset.id, woven: scene.woven, adapters: Object.keys(ADAPTERS).filter((a) => ADAPTERS[a].available), notInMaterial: NOT_IN_MATERIAL });
window.__coach = { coach, scene, instructor, k }; // debug / harness hook
