// Offline instructor: a small model on this machine behind any OpenAI-compatible chat endpoint
// (Ollama by default), reached through the local server so the page has no CORS setup to do.
// Same tools, same grounding guard, no internet: what a hangar or a field kit would run.

const MAX_TOOL_ROUNDS = 6;

export class LocalAdapter {
  constructor(coach, { endpoint = 'api/local' } = {}) {
    this.coach = coach;
    this.endpoint = endpoint;
    this.name = 'local';
    this.label = 'Offline (local model)';
    this.messages = [];
  }

  async send(text) {
    this.messages.push({ role: 'user', content: text });
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: this.messages }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.messages.pop();
        throw new Error(data.error || `local model request failed (${res.status})`);
      }
      const msg = data.message;
      this.messages.push(msg);
      const calls = msg.tool_calls || [];
      if (!calls.length) return msg.content || '';
      for (const call of calls) {
        let args = {};
        try {
          args = JSON.parse(call.function?.arguments || '{}');
        } catch {
          args = {};
        }
        const out = this.coach.run(call.function?.name, args);
        this.messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(out) });
      }
    }
    return { text: 'I lost track there. Ask me again?', trusted: true };
  }

  close() {
    this.messages = [];
  }
}
