// The coach: procedure state, quiz state, the tool implementations every adapter calls, and the
// grounding guard every adapter's reply passes through. The 3D page and the CLI each supply a
// `stage` that renders what the coach decides; every stage method is optional.
//
//   stage.focusPart(id)                  fly the camera to a part
//   stage.highlightPart(ids[])           highlight these parts ([] clears)
//   stage.showProcedure(proc, index)     checklist + progress (proc null clears)
//   stage.showSources(lines[])           citation panel: [{ text, url }]
//   stage.showQuiz(prompt | null)        quiz banner

import { NOT_IN_MATERIAL } from './knowledge.js';

const CITE = /\[(part|step):([a-z0-9_]+(?:\/[a-z0-9_]+)?)\]/g;

// Replies longer than this must cite the material; shorter ones ("Good. Next step.") need not.
const MAX_UNCITED_WORDS = 14;

export class Coach {
  constructor(knowledge, stage = {}) {
    this.k = knowledge;
    this.stage = stage;
    this.mode = 'trainee'; // 'trainee' | 'quiz'
    this.proc = null;
    this.index = -1;
    this.quiz = null; // { partId, prompt }
    this.lastQuizPart = null;
    this.focus = null; // last part focused, for show_source when no step is active
    this.score = { asked: 0, correct: 0 };
  }

  get step() {
    return this.proc && this.index >= 0 ? this.proc.steps[this.index] : null;
  }

  setMode(mode) {
    this.mode = mode === 'quiz' ? 'quiz' : 'trainee';
    if (this.mode === 'trainee') {
      this.quiz = null;
      this.stage.showQuiz?.(null);
    }
    return { mode: this.mode };
  }

  /** Run one tool by name. Returns a plain object: it goes back to an LLM as the tool result. */
  run(name, args = {}) {
    const fn = this.tools[name];
    if (!fn) return { error: `unknown tool ${name}` };
    try {
      return fn.call(this, args || {});
    } catch (err) {
      return { error: String(err?.message || err) };
    }
  }

  tools = {
    start_procedure({ id }) {
      const proc = this.k.procedure(id);
      if (!proc) return { error: `no procedure ${id}`, procedures: this.k.procedures.map((p) => p.id) };
      this.proc = proc;
      return this._goto(0);
    },

    focus_part({ id }) {
      const part = this.k.part(id);
      if (!part) return { error: `no part ${id}` };
      this.focus = id;
      this.stage.focusPart?.(id);
      this.stage.highlightPart?.([id]);
      return { part: partInfo(this.k, part) };
    },

    highlight_part({ id }) {
      const part = this.k.part(id);
      if (!part) return { error: `no part ${id}` };
      this.focus = id;
      this.stage.highlightPart?.([id]);
      return { part: partInfo(this.k, part) };
    },

    next_step() {
      if (!this.proc) return { error: 'no procedure is active; call start_procedure first' };
      if (this.index >= this.proc.steps.length - 1) {
        return { done: true, procedure: this.proc.title, message: 'That was the last step.' };
      }
      return this._goto(this.index + 1);
    },

    prev_step() {
      if (!this.proc) return { error: 'no procedure is active; call start_procedure first' };
      if (this.index <= 0) return { first: true, ...this._stepInfo() };
      return this._goto(this.index - 1);
    },

    explain_step() {
      if (!this.step) return { error: 'no step is active' };
      return this._stepInfo();
    },

    quiz_me() {
      // Prefer the parts the trainee is working on; otherwise any part.
      const all = this.k.parts.map((p) => p.id);
      const pool = this.step && this.step.parts.length > 1 ? this.step.parts : all;
      const others = pool.filter((id) => id !== this.lastQuizPart);
      const from = others.length ? others : pool;
      const partId = from[Math.floor(Math.random() * from.length)];
      this.lastQuizPart = partId;
      const part = this.k.part(partId);
      this.quiz = { partId, prompt: `Find the ${part.name.toLowerCase()}.` };
      this.score.asked++;
      this.stage.highlightPart?.([]);
      this.stage.showQuiz?.(this.quiz.prompt);
      return { quiz: this.quiz.prompt, waitingFor: 'the trainee to click a part on the model' };
    },

    show_source() {
      const refs = this.step ? this.step.sources : this.focus ? this.k.part(this.focus).sources : null;
      if (!refs) return { error: 'no step or part is active' };
      const lines = refs.map((s) => ({ text: this.k.formatSource(s), url: this.k.sourceUrl(s) }));
      this.stage.showSources?.(lines);
      return { sources: lines.map((l) => l.text) };
    },
  };

  /** The trainee clicked (or named) a part while a quiz question was open. */
  answerQuiz(partId) {
    if (!this.quiz) return null;
    const expected = this.k.part(this.quiz.partId);
    const correct = partId === this.quiz.partId;
    if (correct) this.score.correct++;
    this.quiz = null;
    this.stage.showQuiz?.(null);
    this.stage.focusPart?.(expected.id);
    this.stage.highlightPart?.([expected.id]);
    const picked = this.k.part(partId);
    return {
      correct,
      expected: expected.id,
      picked: picked?.id || null,
      text: correct
        ? `Correct: ${expected.name.toLowerCase()}. ${expected.description} [part:${expected.id}]`
        : `Not quite${picked ? `: you picked the ${picked.name.toLowerCase()}` : ''}. Now highlighted: ${expected.name.toLowerCase()}. ${expected.description} [part:${expected.id}]`,
      score: { ...this.score },
    };
  }

  /**
   * The grounding guard. Every adapter's reply goes through here before the trainee sees or hears
   * it. Citations that do not exist are stripped; a substantive reply with no valid citation is
   * replaced by the not-in-material line, because an uncited claim is exactly what an LLM invents.
   */
  ground(reply) {
    const text = String(reply || '').trim();
    const citations = [];
    const seen = new Set();
    let invented = false;
    for (const m of text.matchAll(CITE)) {
      const key = `${m[1]}:${m[2]}`;
      if (!this.k.validCitation(m[1], m[2])) invented = true;
      else if (!seen.has(key)) {
        seen.add(key);
        citations.push({ kind: m[1], ref: m[2] });
      }
    }
    const spoken = text.replace(CITE, '').replace(/\s+([.,;:!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
    const refused = spoken.includes(NOT_IN_MATERIAL);
    const words = spoken.split(/\s+/).filter(Boolean).length;
    // Uncited text may only be a short acknowledgement: no numbers (a number is a claim) and no
    // made-up citation (an attempt to look grounded).
    const uncitedOk = words <= MAX_UNCITED_WORDS && !/\d/.test(spoken) && !invented;
    if (!refused && citations.length === 0 && !uncitedOk) {
      return { text: NOT_IN_MATERIAL, citations: [], refused: true, blocked: true, original: text };
    }
    return { text: spoken, citations, refused, blocked: false };
  }

  _goto(i) {
    this.index = i;
    this.quiz = null;
    this.stage.showQuiz?.(null);
    const step = this.step;
    this.stage.showProcedure?.(this.proc, i);
    this.stage.highlightPart?.(step.parts);
    this.stage.focusPart?.(step.parts[0]);
    this.focus = step.parts[0];
    this.stage.showSources?.(step.sources.map((s) => ({ text: this.k.formatSource(s), url: this.k.sourceUrl(s) })));
    return this._stepInfo();
  }

  _stepInfo() {
    const s = this.step;
    return {
      procedure: this.proc.title,
      procedureId: this.proc.id,
      step: this.index + 1,
      of: this.proc.steps.length,
      cite: `[step:${this.proc.id}/${s.id}]`,
      title: s.title,
      text: s.text,
      parts: s.parts.map((id) => this.k.part(id).name),
      check: s.check,
      expectedAnswer: s.answer,
      sources: s.sources.map((x) => this.k.formatSource(x)),
    };
  }
}

function partInfo(k, p) {
  return { id: p.id, cite: `[part:${p.id}]`, name: p.name, description: p.description, sources: p.sources.map((s) => k.formatSource(s)) };
}
