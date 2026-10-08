// The training material: parts.json, procedures.json and sources.json, indexed for lookup.
// Runs unchanged in the browser and in Node (the CLI and the tests), so it touches no DOM and no fs.

export const NOT_IN_MATERIAL = "That's not in the training material.";

const STOP = new Set(
  ('a an the and or of to in on for is are was be it its this that these those what which who how why ' +
    'when where do does did can could should would i me my you your we our us at by with from as into ' +
    'about tell show explain please there here than then so if not no yes any some each').split(' '),
);

export function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

// Crude plural folding, enough for "plugs"/"plug", "magnetos"/"magneto", "bolts"/"bolt".
function stem(t) {
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.length > 3 && t.endsWith('es') && !t.endsWith('ses')) return t.slice(0, -1);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

export class Knowledge {
  constructor({ parts, procedures, sources }) {
    this.parts = parts.parts;
    this.procedures = procedures.procedures;
    this.sources = sources;
    this.partById = new Map(this.parts.map((p) => [p.id, p]));
    this.procById = new Map(this.procedures.map((p) => [p.id, p]));
    this._docs = this._buildIndex();
  }

  /** Load the three JSON files with whatever fetcher the host has (fetch in the browser, fs in Node). */
  static async load(readJson, base = 'data/') {
    const [parts, procedures, sources] = await Promise.all(
      ['parts.json', 'procedures.json', 'sources.json'].map((f) => readJson(base + f)),
    );
    return new Knowledge({ parts, procedures, sources });
  }

  part(id) {
    return this.partById.get(id) || null;
  }

  procedure(id) {
    return this.procById.get(id) || null;
  }

  /** The part a phrase names, by id, name or alias; longest match wins ("spark plug" over "plug"). */
  findPart(text) {
    const hay = ` ${normalize(text)} `;
    let best = null;
    let bestLen = 0;
    for (const p of this.parts) {
      for (const name of [p.id.replace(/_/g, ' '), p.name, ...(p.aliases || [])]) {
        const n = normalize(name);
        if (n && hay.includes(` ${n} `) && n.length > bestLen) {
          best = p;
          bestLen = n.length;
        }
      }
    }
    return best;
  }

  findProcedure(text) {
    const hay = ` ${normalize(text)} `;
    let best = null;
    let bestLen = 0;
    for (const p of this.procedures) {
      for (const name of [p.id.replace(/_/g, ' '), p.title, ...(p.aliases || [])]) {
        const n = normalize(name);
        if (n && hay.includes(` ${n} `) && n.length > bestLen) {
          best = p;
          bestLen = n.length;
        }
      }
    }
    return best;
  }

  /**
   * Ranked passages for a free-text question. A passage is a part description or a procedure step.
   * Score = matched query terms weighted by rarity, normalized by the number of query terms, so a
   * question about something the material never mentions scores near zero.
   */
  search(query, limit = 3) {
    const q = [...new Set(tokens(query))];
    if (!q.length) return [];
    const scored = [];
    for (const d of this._docs) {
      let s = 0;
      for (const t of q) if (d.terms.has(t)) s += this._idf.get(t) || 0;
      if (s > 0) scored.push({ ...d, score: s / q.length });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  /** One citation as display text: "14 CFR 43 App. D (d)(4)" or "FAA-H-8083-32B Ch. 4, p. 4-36 (Spark Plug Removal)". */
  formatSource(src) {
    const doc = this.sources.documents[src.doc];
    if (!doc) return String(src.doc);
    if (src.doc === 'cfr43d') return `${doc.short} ${src.loc}`;
    return `${doc.short} Ch. ${src.ch}, p. ${src.page}${src.section ? ` (${src.section})` : ''}`;
  }

  sourceUrl(src) {
    const doc = this.sources.documents[src.doc];
    if (!doc) return null;
    if (src.ch && doc.chapters?.[src.ch]) return doc.chapters[src.ch].url;
    return doc.url;
  }

  /** Is this a citation token the material actually contains? Tokens: [part:id] [step:proc/step] */
  validCitation(kind, ref) {
    if (kind === 'part') return this.partById.has(ref);
    if (kind === 'step') {
      const [procId, stepId] = ref.split('/');
      return !!this.procById.get(procId)?.steps.some((s) => s.id === stepId);
    }
    return false;
  }

  /** The whole training material as compact text, for an LLM system prompt. Stable order (cacheable). */
  materialText() {
    const lines = ['# PARTS'];
    for (const p of this.parts) {
      lines.push(
        `[part:${p.id}] ${p.name} (also: ${(p.aliases || []).join(', ')}). ${p.description} ` +
          `Sources: ${p.sources.map((s) => this.formatSource(s)).join('; ')}.`,
      );
    }
    lines.push('', '# PROCEDURES');
    for (const pr of this.procedures) {
      lines.push(`## ${pr.title} (id ${pr.id}): ${pr.summary}`);
      pr.steps.forEach((s, i) => {
        lines.push(
          `[step:${pr.id}/${s.id}] Step ${i + 1}. ${s.title}: ${s.text} Parts: ${s.parts.join(', ')}. ` +
            `Check question: ${s.check} Expected answer: ${s.answer} ` +
            `Sources: ${s.sources.map((x) => this.formatSource(x)).join('; ')}.`,
        );
      });
    }
    return lines.join('\n');
  }

  _buildIndex() {
    const docs = [];
    for (const p of this.parts) {
      const text = `${p.name}. ${p.description}`;
      docs.push({
        kind: 'part',
        ref: p.id,
        text,
        parts: [p.id],
        sources: p.sources,
        terms: new Set(tokens(`${p.name} ${(p.aliases || []).join(' ')} ${p.description}`)),
      });
    }
    for (const pr of this.procedures) {
      for (const s of pr.steps) {
        docs.push({
          kind: 'step',
          ref: `${pr.id}/${s.id}`,
          text: `${s.title}: ${s.text}`,
          parts: s.parts,
          sources: s.sources,
          terms: new Set(
            tokens(`${pr.title} ${(pr.aliases || []).join(' ')} ${s.title} ${s.text} ${s.check} ${s.answer} ${s.parts.map((id) => this.part(id)?.name || '').join(' ')}`),
          ),
        });
      }
    }
    const df = new Map();
    for (const d of docs) for (const t of d.terms) df.set(t, (df.get(t) || 0) + 1);
    this._idf = new Map([...df].map(([t, n]) => [t, Math.log(1 + docs.length / n)]));
    return docs;
  }
}

function normalize(s) {
  return tokens(s).join(' ');
}
