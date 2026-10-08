// Claude instructor. The browser owns the conversation and runs the tools (they move the 3D view);
// the local server owns the API key, the system prompt and the tool definitions, and makes one
// Messages API call per turn (server/server.mjs, POST /api/claude).
//
// Each response's content is appended to the history UNCHANGED, thinking and fallback blocks
// included: the conversation is append-only, which is what the model's preserved thinking needs.

const MAX_TOOL_ROUNDS = 8;

export class ClaudeAdapter {
  constructor(coach, { endpoint = 'api/claude' } = {}) {
    this.coach = coach;
    this.endpoint = endpoint;
    this.name = 'claude';
    this.label = 'Claude';
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
        this.messages.pop(); // keep history valid for the next try
        throw new Error(data.error || `Claude request failed (${res.status})`);
      }
      this.messages.push({ role: 'assistant', content: data.content });

      if (data.stop_reason === 'refusal') return { text: "I can't help with that one here.", trusted: true };
      const uses = data.content.filter((b) => b.type === 'tool_use');
      const said = data.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
      if (data.stop_reason !== 'tool_use' || uses.length === 0) return said;

      // Run every tool call of this turn, then return ALL results in one user message.
      const results = uses.map((u) => {
        const out = this.coach.run(u.name, u.input);
        return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out), ...(out.error ? { is_error: true } : {}) };
      });
      this.messages.push({ role: 'user', content: results });
    }
    return { text: 'I lost track there. Ask me again?', trusted: true };
  }

  close() {
    this.messages = [];
  }
}
