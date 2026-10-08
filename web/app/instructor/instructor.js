// One entry point for every adapter: ask(text) -> a grounded reply. Adapters return either a
// string (generated, so it is grounded) or { text, trusted: true } for fixed UI text they wrote
// themselves (help, menus). Model output is never marked trusted.

export class Instructor {
  constructor(coach, adapter) {
    this.coach = coach;
    this.adapter = adapter;
  }

  setAdapter(adapter) {
    this.adapter?.close?.();
    this.adapter = adapter;
  }

  async ask(text) {
    const raw = await this.adapter.send(text);
    return this.finish(raw);
  }

  /** Ground one reply (also used for replies that arrive by event, such as realtime voice). */
  finish(raw) {
    if (raw && typeof raw === 'object' && raw.trusted) {
      return { text: raw.text, citations: [], refused: false, blocked: false, trusted: true };
    }
    return this.coach.ground(typeof raw === 'string' ? raw : raw?.text);
  }

  /** A quiz answer from a click on the model. */
  pick(partId) {
    const r = this.coach.answerQuiz(partId);
    return r ? { ...this.coach.ground(r.text), correct: r.correct, score: r.score } : null;
  }
}
