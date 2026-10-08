// The semantic layer is the whole source of truth for the instructor, so it gets checked like code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from './helpers.mjs';

const parts = (await readData('parts.json')).parts;
const procedures = (await readData('procedures.json')).procedures;
const sources = await readData('sources.json');
const partIds = new Set(parts.map((p) => p.id));

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

test('parts have unique ids, anchors and at least one source', () => {
  assert.equal(partIds.size, parts.length, 'duplicate part id');
  for (const p of parts) {
    assert.match(p.id, /^[a-z0-9_]+$/);
    assert.ok(p.name && p.description, `${p.id}: name and description`);
    assert.equal(p.anchor.length, 3, `${p.id}: anchor is [x,y,z]`);
    assert.ok(p.anchor.every(Number.isFinite), `${p.id}: anchor numbers`);
    assert.ok(p.sources.length > 0, `${p.id}: needs a source`);
    p.sources.forEach((s) => checkSource(s, p.id));
  }
});

test('the spec parts list is covered', () => {
  for (const id of ['cylinders', 'spark_plugs', 'ignition_harness', 'magnetos', 'oil_filter', 'oil_sump',
    'exhaust_system', 'induction_air_filter', 'engine_mounts', 'baffles', 'propeller', 'spinner']) {
    assert.ok(partIds.has(id), `missing part ${id}`);
  }
});

test('the four procedures exist', () => {
  const ids = procedures.map((p) => p.id);
  assert.deepEqual(ids.sort(), ['engine_nacelle_100h', 'oil_filter_inspection', 'propeller_inspection', 'spark_plug_inspection']);
});

test('every step references real parts and cites a source', () => {
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

test('the 100-hour walkthrough covers every engine-and-nacelle item in Appendix D (d)', () => {
  const cited = new Set(
    procedures.find((p) => p.id === 'engine_nacelle_100h').steps
      .flatMap((s) => s.sources).filter((s) => s.doc === 'cfr43d').map((s) => s.loc),
  );
  for (let i = 1; i <= 11; i++) {
    assert.ok(cited.has(`(d)(${i})`), `Appendix D (d)(${i}) not covered`);
  }
});
