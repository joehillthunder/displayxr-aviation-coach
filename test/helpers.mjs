import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Knowledge } from '../web/app/instructor/knowledge.js';
import { Coach } from '../web/app/instructor/session.js';
import { Instructor } from '../web/app/instructor/instructor.js';
import { MockAdapter } from '../web/app/instructor/adapters/mock.js';

export const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'data');

export const readData = async (f) => JSON.parse(await readFile(join(dataDir, f), 'utf8'));

export const loadKnowledge = () => Knowledge.load(readData, '');

/** A coach with a recording stage, plus a mock-backed instructor. */
export async function mockRig() {
  const k = await loadKnowledge();
  const log = [];
  const stage = {
    focusPart: (id) => log.push(['focus', id]),
    highlightPart: (ids) => log.push(['highlight', ids]),
    showProcedure: (p, i) => log.push(['procedure', p?.id, i]),
    showSources: (lines) => log.push(['sources', lines.length]),
    showQuiz: (q) => log.push(['quiz', q]),
  };
  const coach = new Coach(k, stage);
  return { k, coach, log, instructor: new Instructor(coach, new MockAdapter(coach)) };
}
