// OpenAI Realtime voice instructor over WebRTC. The server mints a short-lived client secret with
// the instructions and tools already in the session config (server/server.mjs, GET
// /api/openai/session), so neither the API key nor the system prompt passes through the page.
//
// Grounding caveat, stated plainly: speech is generated and played by the service, so the guard can
// only check the transcript after the fact (it is shown grounded or flagged in the chat). The
// instructions carry the same "answer only from the material" rules as every other adapter.

const REALTIME_CALLS = 'https://api.openai.com/v1/realtime/calls';

export class OpenAIRealtimeAdapter {
  constructor(coach, { endpoint = 'api/openai/session', onReply } = {}) {
    this.coach = coach;
    this.endpoint = endpoint;
    this.onReply = onReply; // (rawText) => void, for replies the trainee spoke rather than typed
    this.name = 'openai';
    this.label = 'OpenAI Realtime (voice)';
    this.pending = null;
  }

  async connect() {
    if (this.pc) return;
    const res = await fetch(this.endpoint);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `session request failed (${res.status})`);

    const pc = new RTCPeerConnection();
    this.audio = document.createElement('audio');
    this.audio.autoplay = true;
    pc.ontrack = (e) => (this.audio.srcObject = e.streams[0]);
    this.mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    pc.addTrack(this.mic.getTracks()[0]);

    const dc = pc.createDataChannel('oai-events');
    dc.addEventListener('message', (e) => this.onEvent(JSON.parse(e.data)));
    const opened = new Promise((resolve) => dc.addEventListener('open', resolve, { once: true }));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const sdp = await fetch(REALTIME_CALLS, {
      method: 'POST',
      body: offer.sdp,
      headers: { Authorization: `Bearer ${data.value}`, 'Content-Type': 'application/sdp' },
    });
    if (!sdp.ok) throw new Error(`realtime call failed (${sdp.status})`);
    await pc.setRemoteDescription({ type: 'answer', sdp: await sdp.text() });
    await opened;
    this.pc = pc;
    this.dc = dc;
  }

  /** Typed input goes into the same voice session; the reply is spoken and returned as text. */
  async send(text) {
    await this.connect();
    const reply = new Promise((resolve) => (this.pending = resolve));
    this.dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
    }));
    this.dc.send(JSON.stringify({ type: 'response.create' }));
    return reply;
  }

  setMicEnabled(on) {
    for (const t of this.mic?.getTracks() || []) t.enabled = on;
  }

  onEvent(ev) {
    if (ev.type !== 'response.done') return;
    const output = ev.response?.output || [];
    const calls = output.filter((o) => o.type === 'function_call');
    if (calls.length) {
      for (const call of calls) {
        let args = {};
        try {
          args = JSON.parse(call.arguments || '{}');
        } catch {
          args = {};
        }
        const out = this.coach.run(call.name, args);
        this.dc.send(JSON.stringify({
          type: 'conversation.item.create',
          item: { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(out) },
        }));
      }
      this.dc.send(JSON.stringify({ type: 'response.create' }));
      return;
    }
    const said = output
      .filter((o) => o.type === 'message')
      .flatMap((o) => o.content || [])
      .map((c) => c.transcript || c.text || '')
      .join(' ')
      .trim();
    if (!said) return;
    if (this.pending) {
      this.pending(said);
      this.pending = null;
    } else {
      this.onReply?.(said); // the trainee spoke instead of typing
    }
  }

  close() {
    this.mic?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.pc = this.dc = this.mic = null;
  }
}
