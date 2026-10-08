#!/usr/bin/env node
// Mock-mode instructor in the terminal: the same coach, tools and grounding as the 3D page, with a
// text stage instead of the woven scene. No keys, no network.
//
//   npm run mock                      interactive
//   echo "start spark plug inspection" | npm run mock     scripted (one line per turn)

import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Knowledge } from '../web/app/instructor/knowledge.js';
import { Coach } from '../web/app/instructor/session.js';
import { Instructor } from '../web/app/instructor/instructor.js';
import { MockAdapter } from '../web/app/instructor/adapters/mock.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'web', 'data');
const dim = (s) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s);

const k = await Knowledge.load(async (f) => JSON.parse(await readFile(join(dataDir, f), 'utf8')), '');
const stage = {
  focusPart: (id) => console.log(dim(`  [camera] fly to ${k.part(id).name}`)),
  highlightPart: (ids) => ids.length && console.log(dim(`  [highlight] ${ids.map((id) => k.part(id).name).join(', ')}`)),
  showProcedure: (p, i) => p && console.log(dim(`  [checklist] ${p.title}: step ${i + 1}/${p.steps.length}`)),
  showSources: (lines) => console.log(dim(`  [source] ${lines.map((l) => l.text).join(' | ')}`)),
  showQuiz: (q) => q && console.log(dim(`  [quiz] ${q}  (type: pick <part id>)`)),
};
const coach = new Coach(k, stage);
const instructor = new Instructor(coach, new MockAdapter(coach));

console.log('3D Maintenance Coach (mock CLI). TRAINING DEMO ONLY, not approved maintenance data.');
console.log('Type "help". "pick <part id>" answers a quiz by part id. Ctrl+C to quit.\n');

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
const prompt = () => process.stdin.isTTY && rl.prompt();
rl.setPrompt('trainee> ');
prompt();
for await (const line of rl) {
  const text = line.trim();
  if (!text) { prompt(); continue; }
  if (!process.stdin.isTTY) console.log(`trainee> ${text}`);
  const pick = /^pick\s+(\S+)/i.exec(text);
  const reply = pick ? instructor.pick(pick[1]) || { text: 'No quiz question is open. Say "quiz me".', citations: [] } : await instructor.ask(text);
  const cites = reply.citations?.length ? dim(`  (${reply.citations.map((c) => `${c.kind}:${c.ref}`).join(', ')})`) : '';
  console.log(`coach> ${reply.text}${cites}\n`);
  prompt();
}
