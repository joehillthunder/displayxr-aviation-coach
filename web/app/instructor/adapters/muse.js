// Muse instructor: a placeholder until the Muse API details are supplied. It has the same shape as
// the other adapters and calls the server's /api/muse route, which reports what is missing rather
// than guessing at an API. Fill in server/muse.mjs and this adapter will work unchanged as long as
// that route returns { text } or { tool_calls }.

export class MuseAdapter {
  constructor(coach, { endpoint = 'api/muse' } = {}) {
    this.coach = coach;
    this.endpoint = endpoint;
    this.name = 'muse';
    this.label = 'Muse (not configured)';
  }

  async send(text) {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Muse request failed (${res.status})`);
    for (const call of data.tool_calls || []) this.coach.run(call.name, call.arguments || {});
    return data.text || '';
  }
}
