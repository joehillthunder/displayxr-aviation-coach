// Mock instructor: no network, no keys, deterministic apart from quiz order. It understands a small
// set of intents and answers only by quoting the material through the same tools the LLM adapters
// use, so mock mode exercises the whole pipeline (tools, stage, grounding) end to end.

import { NOT_IN_MATERIAL, tokens } from '../knowledge.js';

// Fixed UI text written here, not generated, so it skips the grounding guard.
const ui = (text) => ({ text, trusted: true });

// Short commands. "explain" only matches as a command on its own: "why use a round gauge?" is a
// question for the material, not a request to repeat the current step.
const INTENTS = [
  ['help', /^(help|\?|what can (you|i) (do|say)|commands)\b/],
  ['quiz', /\b(quiz me|test me|quiz)\b/],
  ['next', /^(next|continue|done|ok(ay)?|go on|got it|ready|complete[d]?)( next)?( step)?[.!]?$|\bnext step\b/],
  ['prev', /^(back|previous|prev|go back|last step)\b|\bprevious step\b|\bstep back\b/],
  ['source', /\b(source|sources|cite|citation|reference|where does (that|this) come from)\b/],
  ['explain', /^(explain|why|more|details?|repeat|say (that )?again|explain (this|the) step|what('s| is) this step)[?.!]?$/],
  ['start', /\b(start|begin|walk me through|let'?s do|teach me|do the)\b/],
  ['list', /\b(procedures|what (can|should) (i|we) learn|lessons)\b/],
];

// Questions after a number the material deliberately does not carry.
const WANTS_VALUE = /\b(torque|how (much|many|tight|often|long)|what (value|setting|limit|interval|pressure)|limits?|intervals?|psi|inch[- ]?pounds?|foot[- ]?pounds?|specs?|specification|clearance|gap)\b/;

// A free question is answered only when the best passage covers most of what was asked.
const MIN_SCORE = 0.9;
const MIN_COVERAGE = 0.6;

/** Content words of `text` not accounted for by any of `names` (or by "where/show/find" wording). */
function leftover(text, names) {
  const known = new Set(tokens(names.join(' ').replace(/_/g, ' ')));
  return tokens(text).filter((t) => !known.has(t) && !/^(where|show|find|look|see|inspection|inspect)$/.test(t));
}

export class MockAdapter {
  constructor(coach) {
    this.coach = coach;
    this.name = 'mock';
    this.label = 'Mock instructor (offline, no keys)';
  }

  async send(input) {
    const c = this.coach;
    const k = c.k;
    const text = String(input || '').toLowerCase().trim();
    const intent = INTENTS.find(([, re]) => re.test(text))?.[0];
    const part = k.findPart(text);
    const proc = k.findProcedure(text);

    // An open quiz question takes a spoken answer too ("the magneto").
    if (c.quiz && part && intent !== 'quiz') return c.answerQuiz(part.id).text;

    if (intent === 'help') return ui(this.help());
    if (intent === 'list') return ui(this.listProcedures());
    if (intent === 'quiz') {
      const r = c.run('quiz_me');
      return ui(`${r.quiz} Click it on the model.`);
    }
    // Saying just a procedure's name ("oil and filter") starts it; a question that mentions oil does not.
    const bareProc = proc && leftover(text, [proc.title, proc.id, ...(proc.aliases || [])]).length <= 1;
    if (intent === 'start' || (bareProc && !part && !c.proc && !WANTS_VALUE.test(text))) {
      if (!proc) return ui(`Which one? ${this.listProcedures()}`);
      return this.stepReply(c.run('start_procedure', { id: proc.id }), true);
    }
    if (intent === 'next') {
      const r = c.run('next_step');
      if (r.error) return ui(`Pick a procedure first. ${this.listProcedures()}`);
      if (r.done) return ui(`That completes the ${r.procedure.toLowerCase()}. Say "quiz me" to check yourself, or pick another procedure.`);
      return this.stepReply(r);
    }
    if (intent === 'prev') {
      const r = c.run('prev_step');
      if (r.error) return ui(`Pick a procedure first. ${this.listProcedures()}`);
      return (r.first ? 'This is the first step. ' : '') + this.stepReply(r);
    }
    if (intent === 'explain') {
      const r = c.run('explain_step');
      if (r.error) return part ? this.partReply(part) : ui(`Pick a procedure first. ${this.listProcedures()}`);
      return `${r.title}. ${r.text} Check yourself: ${r.check} Sources: ${r.sources.join('; ')}. ${r.cite}`;
    }
    if (intent === 'source') {
      const r = c.run('show_source');
      if (r.error) return ui('Pick a step or a part first, then ask for the source.');
      const cite = c.step ? `[step:${c.proc.id}/${c.step.id}]` : `[part:${c.focus}]`;
      return `Sources: ${r.sources.join('; ')}. ${cite}`;
    }
    if (WANTS_VALUE.test(text)) return this.noValues(text, part);

    // "where is X", "show me X", or just "X": a bare part reference flies to it.
    if (part && leftover(text, [part.name, part.id, ...(part.aliases || [])]).length <= 1) return this.partReply(part);

    const hit = this.bestPassage(text);
    if (hit) {
      c.stage.highlightPart?.(hit.parts);
      c.stage.focusPart?.(hit.parts[0]);
      return `${hit.text} [${hit.kind}:${hit.ref}]`;
    }
    if (part) return this.partReply(part);
    return `${NOT_IN_MATERIAL} Check the engine manufacturer's manual or ask a certificated mechanic.`;
  }

  bestPassage(text) {
    const q = [...new Set(tokens(text))];
    const hits = this.coach.k.search(text, 5);
    // Prefer the active procedure's own steps when scores are close.
    const active = this.coach.proc?.id;
    for (const h of hits) if (active && h.ref.startsWith(`${active}/`)) h.score *= 1.15;
    hits.sort((a, b) => b.score - a.score);
    const h = hits[0];
    if (!h) return null;
    const coverage = q.filter((t) => h.terms.has(t)).length / q.length;
    return h.score >= MIN_SCORE && coverage >= MIN_COVERAGE ? h : null;
  }

  /** The material says what to check, never the number: name the step, decline the value. */
  noValues(text, part) {
    const q = [...new Set(tokens(text))].filter((t) => !WANTS_VALUE.test(t));
    const hits = this.coach.k.search(text, 5).filter((h) => h.kind === 'step' && (!part || h.parts.includes(part.id)));
    const h = hits.find((x) => q.length && q.filter((t) => x.terms.has(t)).length / q.length >= 0.5);
    if (!h) return `${NOT_IN_MATERIAL} Specific values come from the manufacturer's data.`;
    this.coach.stage.highlightPart?.(h.parts);
    this.coach.stage.focusPart?.(h.parts[0]);
    return (
      `${NOT_IN_MATERIAL} It covers what to check, not the values: "${h.text.split(':')[0]}" [${h.kind}:${h.ref}]. ` +
      `The number comes from the aircraft, engine or propeller manufacturer's data.`
    );
  }

  partReply(part) {
    this.coach.run('focus_part', { id: part.id });
    return `${part.name}, highlighted. ${part.description} [part:${part.id}]`;
  }

  stepReply(r, first = false) {
    const lead = first ? `${r.procedure}, ${r.of} steps. ` : '';
    return `${lead}Step ${r.step} of ${r.of}: ${r.title}. ${r.text} ${r.cite}`;
  }

  listProcedures() {
    return `I can walk you through: ${this.coach.k.procedures.map((p) => p.title.toLowerCase()).join('; ')}.`;
  }

  help() {
    return (
      'Say "start spark plug inspection" (or the 100-hour, oil and filter, or propeller inspection), ' +
      'then "next", "back", "explain" or "source". Name a part ("where are the magnetos?") to fly to it, ' +
      'or say "quiz me" and click the part I name.'
    );
  }
}
