// Mock mode end to end: trainee text in, grounded reply and stage actions out, with no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mockRig, trainings } from './helpers.mjs';
import { NOT_IN_MATERIAL } from '../web/app/instructor/knowledge.js';

for (const t of trainings) test(`${t.id}: walks every procedure from first to last step`, async () => {
  const { k, coach, instructor, log } = await mockRig(t.id);
  for (const proc of k.procedures) {
    let r = await instructor.ask(`start ${proc.title}`);
    assert.equal(coach.proc.id, proc.id, `started ${proc.id}`);
    assert.equal(coach.index, 0);
    assert.deepEqual(r.citations, [{ kind: 'step', ref: `${proc.id}/${proc.steps[0].id}` }]);
    for (let i = 1; i < proc.steps.length; i++) {
      r = await instructor.ask('next');
      assert.equal(coach.index, i);
      assert.ok(!r.blocked, `step ${i} reply grounded`);
      assert.ok(r.text.includes(proc.steps[i].title), `reply names step ${i}`);
      // the stage flew to the step's first part and highlighted all of its parts
      assert.ok(log.some(([a, id]) => a === 'focus' && id === proc.steps[i].parts[0]));
    }
    r = await instructor.ask('next');
    assert.match(r.text, /completes/);
    r = await instructor.ask('back');
    assert.equal(coach.index, proc.steps.length - 2);
  }
});

test('explain and source answer from the current step', async () => {
  const { coach, instructor, log } = await mockRig();
  await instructor.ask('start propeller inspection');
  await instructor.ask('next');
  const ex = await instructor.ask('explain');
  assert.ok(ex.text.includes(coach.step.check));
  const src = await instructor.ask('where does that come from?');
  assert.match(src.text, /FAA-H-8083-32B Ch\. 7/);
  assert.ok(log.some(([a]) => a === 'sources'));
});

test('naming a part flies to it', async () => {
  const { instructor, log } = await mockRig();
  for (const [q, id] of [['where are the magnetos?', 'magnetos'], ['show me the spinner', 'spinner'], ['oil sump', 'oil_sump']]) {
    const r = await instructor.ask(q);
    assert.deepEqual(r.citations, [{ kind: 'part', ref: id }], q);
    assert.deepEqual(log.at(-1), ['highlight', [id]], q);
    assert.ok(log.some(([a, x]) => a === 'focus' && x === id), q);
  }
});

test('says "not in the training material" for anything outside it', async () => {
  const { instructor } = await mockRig();
  for (const q of ['what is the capital of France', 'how do I fix a flat tire?', 'what oil grade should I use in winter']) {
    const r = await instructor.ask(q);
    assert.ok(r.text.startsWith(NOT_IN_MATERIAL), `${q} -> ${r.text}`);
  }
});

test('declines values the material does not carry, but points to the step', async () => {
  const { instructor } = await mockRig();
  const r = await instructor.ask('what is the torque for the propeller bolts?');
  assert.ok(r.text.startsWith(NOT_IN_MATERIAL));
  assert.deepEqual(r.citations, [{ kind: 'step', ref: 'propeller_inspection/p5' }]);
  assert.doesNotMatch(r.text, /\d+\s*(in|ft)[- ]?(lb|pound)/i);
});

test('answers a covered free question from the matching step', async () => {
  const { instructor } = await mockRig();
  const r = await instructor.ask('why use a round wire gauge');
  assert.deepEqual(r.citations, [{ kind: 'step', ref: 'spark_plug_inspection/s7' }]);
});

test('quiz: names a part, scores a click, reveals the answer', async () => {
  const { coach, instructor, log } = await mockRig();
  await instructor.ask('quiz me');
  const target = coach.quiz.partId;
  const wrong = coach.k.parts.find((p) => p.id !== target).id;
  let r = instructor.pick(wrong);
  assert.equal(r.correct, false);
  assert.ok(log.some(([a, id]) => a === 'focus' && id === target), 'reveals the right part');
  await instructor.ask('quiz me');
  r = instructor.pick(coach.quiz.partId);
  assert.equal(r.correct, true);
  assert.deepEqual(r.score, { asked: 2, correct: 1 });
  assert.equal(instructor.pick('oil_filter'), null, 'no open question');
});

for (const t of trainings) {
  test(`${t.id}: every part can be found by name, and help names this lesson`, async () => {
    const { k, instructor, log } = await mockRig(t.id);
    for (const p of k.parts) {
      const r = await instructor.ask(`where is the ${p.name.toLowerCase()}`);
      assert.deepEqual(r.citations, [{ kind: 'part', ref: p.id }], p.name);
      assert.ok(log.some(([a, x]) => a === 'focus' && x === p.id), p.name);
    }
    const help = await instructor.ask('help');
    assert.ok(help.text.includes(k.procedures[0].title.toLowerCase()));
  });

  test(`${t.id}: the quiz names parts of this lesson`, async () => {
    const { k, coach, instructor } = await mockRig(t.id);
    await instructor.ask('quiz me');
    assert.ok(k.part(coach.quiz.partId));
    assert.equal(instructor.pick(coach.quiz.partId).correct, true);
  });
}
