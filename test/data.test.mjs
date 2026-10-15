// The semantic layer is the whole source of truth for the instructor, so it gets checked like code:
// every training in trainings.json, then what each lesson has to cover.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData, trainings } from './helpers.mjs';
import { MODELS } from '../web/app/models/index.js';

const sources = await readData('sources.json');
const data = {};
for (const t of trainings) {
  data[t.id] = { parts: (await readData(`${t.id}/parts.json`)).parts, procedures: (await readData(`${t.id}/procedures.json`)).procedures };
}

function checkSource(s, where) {
  const doc = sources.documents[s.doc];
  assert.ok(doc, `${where}: unknown source doc ${s.doc}`);
  if (s.doc === 'cfr43d') {
    assert.match(s.loc, /^\([a-j]\)(\(\d+\))?$/, `${where}: bad Appendix D locator ${s.loc}`);
  } else {
    assert.ok(doc.chapters[s.ch], `${where}: unknown handbook chapter ${s.ch}`);
    assert.match(s.page, new RegExp(`^${s.ch}-\\d+$`), `${where}: page ${s.page} not in chapter ${s.ch}`);
  }
}

test('the catalog: unique ids, a known model, a stage, and a default that exists', async () => {
  const catalog = await readData('trainings.json');
  const ids = new Set(trainings.map((t) => t.id));
  assert.equal(ids.size, trainings.length, 'duplicate training id');
  assert.ok(ids.has(catalog.default), 'default training exists');
  for (const t of trainings) {
    assert.ok(MODELS[t.model], `${t.id}: unknown model ${t.model}`);
    assert.ok(t.title && t.subject && t.asset, `${t.id}: title, subject, asset`);
    const s = t.stage;
    assert.equal(s.home.target.length, 3, `${t.id}: home target`);
    assert.ok(s.home.dist <= s.maxDist, `${t.id}: home inside maxDist`);
    for (const k of ['floorY', 'floorRadius', 'focusDist', 'maxDist', 'depthRef']) assert.ok(Number.isFinite(s[k]), `${t.id}: stage.${k}`);
  }
});

for (const t of trainings) {
  const { parts, procedures } = data[t.id];
  const partIds = new Set(parts.map((p) => p.id));

  test(`${t.id}: parts have unique ids, anchors and at least one source`, () => {
    assert.equal(partIds.size, parts.length, 'duplicate part id');
    assert.ok(parts.length >= 8, 'enough parts to teach and quiz');
    for (const p of parts) {
      assert.match(p.id, /^[a-z0-9_]+$/);
      assert.ok(p.name && p.description, `${p.id}: name and description`);
      assert.equal(p.anchor.length, 3, `${p.id}: anchor is [x,y,z]`);
      assert.ok(p.anchor.every(Number.isFinite), `${p.id}: anchor numbers`);
      assert.ok(p.sources.length > 0, `${p.id}: needs a source`);
      p.sources.forEach((s) => checkSource(s, p.id));
    }
  });

  test(`${t.id}: every step references real parts and cites a source`, () => {
    assert.ok(procedures.length >= 2, 'at least two procedures');
    for (const pr of procedures) {
      const stepIds = new Set();
      for (const s of pr.steps) {
        const where = `${pr.id}/${s.id}`;
        assert.ok(!stepIds.has(s.id), `${where}: duplicate step id`);
        stepIds.add(s.id);
        assert.ok(s.title && s.text && s.check && s.answer, `${where}: title, text, check, answer`);
        assert.ok(s.parts.length > 0, `${where}: tied to at least one part`);
        for (const id of s.parts) assert.ok(partIds.has(id), `${where}: unknown part ${id}`);
        assert.ok(s.sources.length > 0, `${where}: needs a source`);
        s.sources.forEach((x) => checkSource(x, where));
      }
    }
  });

  test(`${t.id}: every part is taught by some step`, () => {
    const taught = new Set(procedures.flatMap((pr) => pr.steps.flatMap((s) => s.parts)));
    for (const id of partIds) assert.ok(taught.has(id), `${id} is never part of a step`);
  });
}

test('procedure ids are unique across trainings', () => {
  const seen = new Map();
  for (const t of trainings) {
    for (const pr of data[t.id].procedures) {
      assert.ok(!seen.has(pr.id), `procedure ${pr.id} in ${t.id} and ${seen.get(pr.id)}`);
      seen.set(pr.id, t.id);
    }
  }
});

test('engine: the spec parts list is covered', () => {
  const ids = new Set(data.engine.parts.map((p) => p.id));
  for (const id of ['cylinders', 'spark_plugs', 'ignition_harness', 'magnetos', 'oil_filter', 'oil_sump',
    'exhaust_system', 'induction_air_filter', 'engine_mounts', 'baffles', 'propeller', 'spinner']) {
    assert.ok(ids.has(id), `missing part ${id}`);
  }
});

test('engine: the four procedures exist', () => {
  const ids = data.engine.procedures.map((p) => p.id);
  assert.deepEqual(ids.sort(), ['engine_nacelle_100h', 'oil_filter_inspection', 'propeller_inspection', 'spark_plug_inspection']);
});

/** Appendix D locators a procedure cites. */
const cited = (training, procId) => new Set(
  data[training].procedures.find((p) => p.id === procId).steps
    .flatMap((s) => s.sources).filter((s) => s.doc === 'cfr43d').map((s) => s.loc),
);

test('engine: the 100-hour walkthrough covers every engine-and-nacelle item in Appendix D (d)', () => {
  const c = cited('engine', 'engine_nacelle_100h');
  for (let i = 1; i <= 11; i++) assert.ok(c.has(`(d)(${i})`), `Appendix D (d)(${i}) not covered`);
});

test('landing gear: the 100-hour walkthrough covers every landing gear item in Appendix D (e)', () => {
  const c = cited('landing_gear', 'landing_gear_100h');
  for (let i = 1; i <= 10; i++) assert.ok(c.has(`(e)(${i})`), `Appendix D (e)(${i}) not covered`);
});

test('flight controls: the empennage walkthrough cites Appendix D (g) and the flight controls item (c)(5)', () => {
  const c = cited('flight_controls', 'empennage_100h');
  assert.ok(c.has('(g)') && c.has('(c)(5)'));
});

test('preflight: the walk-around follows the handbook around the airplane (fuel, oil, gear, propeller)', () => {
  const pages = new Set(data.preflight.procedures.find((p) => p.id === 'preflight_walkaround').steps
    .flatMap((s) => s.sources).filter((s) => s.doc === 'afh').map((s) => s.page));
  for (const p of ['2-5', '2-6', '2-9', '2-10', '2-11', '2-12']) assert.ok(pages.has(p), `AFH p. ${p} not covered`);
});
