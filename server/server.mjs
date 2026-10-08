#!/usr/bin/env node
// Local server for the training station: serves web/ and is the only place API keys live.
// Binds to 127.0.0.1, so keys never sit behind a LAN-reachable endpoint. Every key is optional;
// with none set the page runs the mock instructor.
//
//   GET  /api/config           which adapters are usable
//   POST /api/claude           one Claude Messages API turn   { messages } -> { content, stop_reason }
//   GET  /api/openai/session   a short-lived OpenAI Realtime client secret, session preconfigured
//   POST /api/local            one OpenAI-compatible chat turn on a local model (offline mode)
//   POST /api/muse             Muse: not configured yet (501 with what is needed)

import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { Knowledge } from '../web/app/instructor/knowledge.js';
import { systemPrompt, toolDefs } from '../web/app/instructor/tools.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));

const env = (k, d = '') => (process.env[k] || d).trim();
const PORT = Number(env('PORT', '8080'));
const WEB = join(root, 'web');

// The prompt and tools are built HERE from the committed data, never accepted from the page.
const k = await Knowledge.load(async (f) => JSON.parse(await readFile(join(WEB, 'data', f), 'utf8')), '');
const SYSTEM = systemPrompt(k);
const TOOLS = toolDefs(k);

const claude = env('ANTHROPIC_API_KEY') ? new Anthropic() : null;
const CLAUDE_MODEL = env('CLAUDE_MODEL', 'claude-opus-5-5');
const CLAUDE_EFFORT = env('CLAUDE_EFFORT', 'low');
const CLAUDE_TOOLS = TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: { ...t.parameters, required: t.parameters.required || [] },
  strict: true,
}));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.sog': 'application/octet-stream',
  '.ply': 'application/octet-stream', '.spz': 'application/octet-stream', '.md': 'text/markdown; charset=utf-8',
};

const routes = {
  'GET /api/config': async () => ({
    claude: !!claude,
    claudeModel: claude ? CLAUDE_MODEL : null,
    openai: !!env('OPENAI_API_KEY'),
    muse: false, // see POST /api/muse
    local: await localReachable(),
  }),

  'POST /api/claude': async (body) => {
    if (!claude) throw httpError(503, 'Claude is not configured: set ANTHROPIC_API_KEY in .env');
    const messages = validMessages(body?.messages);
    const response = await claude.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: CLAUDE_TOOLS,
      messages,
      output_config: { effort: CLAUDE_EFFORT },
      // A declined request is re-run server-side on the recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    return { content: response.content, stop_reason: response.stop_reason, model: response.model };
  },

  'GET /api/openai/session': async () => {
    const key = env('OPENAI_API_KEY');
    if (!key) throw httpError(503, 'OpenAI Realtime is not configured: set OPENAI_API_KEY in .env');
    const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: env('OPENAI_REALTIME_MODEL', 'gpt-realtime-2.1'),
          instructions: SYSTEM,
          tools: TOOLS.map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters })),
          tool_choice: 'auto',
          audio: { output: { voice: env('OPENAI_REALTIME_VOICE', 'marin') } },
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw httpError(502, `OpenAI client secret request failed: ${data?.error?.message || res.status}`);
    return { value: data.value };
  },

  'POST /api/local': async (body) => {
    const url = env('LOCAL_LLM_URL', 'http://localhost:11434/v1/chat/completions');
    const messages = Array.isArray(body?.messages) ? body.messages.slice(-60) : [];
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local' },
      body: JSON.stringify({
        model: env('LOCAL_LLM_MODEL', 'qwen3:8b'),
        messages: [{ role: 'system', content: SYSTEM }, ...messages],
        tools: TOOLS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
      }),
    }).catch((err) => {
      throw httpError(503, `local model not reachable at ${url} (${err.message}). Start Ollama, or set LOCAL_LLM_URL.`);
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw httpError(502, `local model error: ${data?.error?.message || data?.error || res.status}`);
    return { message: data.choices?.[0]?.message || { role: 'assistant', content: '' } };
  },

  'POST /api/muse': async () => {
    throw httpError(501, 'Muse is not configured yet: its API details (endpoint, auth, request and tool-call format) are needed. See README > Adapters.');
  },
};

async function localReachable() {
  const url = env('LOCAL_LLM_URL', 'http://localhost:11434/v1/chat/completions');
  try {
    const models = new URL('models', url.replace(/chat\/completions\/?$/, ''));
    const res = await fetch(models, { signal: AbortSignal.timeout(800) });
    return res.ok;
  } catch {
    return false;
  }
}

function validMessages(m) {
  if (!Array.isArray(m) || !m.length || m.length > 120) throw httpError(400, 'messages must be a non-empty array');
  for (const x of m) if (!x || !['user', 'assistant'].includes(x.role)) throw httpError(400, 'messages may only hold user and assistant turns');
  return m;
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 2_000_000) throw httpError(413, 'request too large');
    chunks.push(c);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
}

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = normalize(join(WEB, rel));
  if (!file.startsWith(WEB + sep) && file !== WEB) return send(res, 403, 'forbidden');
  try {
    const s = await stat(file);
    if (s.isDirectory()) return serveStatic(req, res, `${pathname}/`);
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch {
    send(res, 404, 'not found');
  }
}

function send(res, status, body) {
  const json = typeof body !== 'string';
  res.writeHead(status, { 'Content-Type': json ? 'application/json' : 'text/plain; charset=utf-8' });
  res.end(json ? JSON.stringify(body) : body);
}

const server = createServer(async (req, res) => {
  let pathname;
  try {
    pathname = new URL(req.url.replace(/^\/+/, '/'), 'http://localhost').pathname;
  } catch {
    return send(res, 400, 'bad request');
  }
  const route = routes[`${req.method} ${pathname}`];
  if (!route) {
    if (pathname.startsWith('/api/')) return send(res, 404, { error: 'no such endpoint' });
    return serveStatic(req, res, pathname);
  }
  try {
    send(res, 200, await route(req.method === 'POST' ? await readBody(req) : null));
  } catch (err) {
    const status = err.status || (err instanceof Anthropic.APIError ? 502 : 500);
    if (status >= 500) console.error(`[server] ${pathname}:`, err.message);
    send(res, status, { error: err.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`3D Maintenance Coach on http://localhost:${PORT}/`);
  console.log(`  instructors: mock${claude ? ', claude' : ''}${env('OPENAI_API_KEY') ? ', openai' : ''} (+ local model if Ollama is running)`);
  console.log('  Training demo only, not approved maintenance data.');
});
