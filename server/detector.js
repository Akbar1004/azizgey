/**
 * Integrity Engine
 * ------------------------------------------------------------------
 * A transparent, deterministic authorship heuristic. It is NOT a claim of
 * forensic certainty: every signal is surfaced to the teacher with its weight so
 * a human makes the final call. The scoring model is intentionally explainable
 * (used for teacher training and for reproducible demos).
 */

const AI_TELLS = [
  { re: /\bdelve[sd]?\b/gi, label: '"delve into"', w: 1.2 },
  { re: /\bin today'?s (fast-paced|modern|ever-changing|digital) world\b/gi, label: '"in today\'s fast-paced world"', w: 2.2 },
  { re: /\bfurthermore\b/gi, label: '"furthermore" connector', w: 1 },
  { re: /\bmoreover\b/gi, label: '"moreover" connector', w: 1 },
  { re: /\bin conclusion\b/gi, label: '"in conclusion" formula', w: 1.6 },
  { re: /\bit is (important|worth|crucial) (to note|noting)\b/gi, label: '"it is important to note"', w: 1.6 },
  { re: /\b(multifaceted|tapestry|pivotal|underscor(?:es|ing)|testament to|paradigm|holistic|seamless(?:ly)?|robust|nuanced)\b/gi, label: 'essay-mill vocabulary', w: 1.1 },
  { re: /\bplays? a (crucial|vital|significant|key|fundamental) role\b/gi, label: '"plays a crucial role"', w: 1.8 },
  { re: /\bnot only\b[^.]{0,90}\bbut also\b/gi, label: '"not only … but also" scaffold', w: 1.2 },
  { re: /\b(firstly|secondly|thirdly|lastly)\b/gi, label: 'numbered essay scaffolding', w: 0.9 },
  { re: /\bin summary\b/gi, label: '"in summary" wrap-up', w: 0.8 },
  { re: /\b(as an ai|language model|i cannot browse)\b/gi, label: 'model self-reference', w: 3 },
  { re: /\bleverag(?:e|ing)\b/gi, label: '"leverage"', w: 0.8 },
  { re: /\bembark(?:ing)? on a journey\b/gi, label: '"embark on a journey"', w: 1.5 },
];

const LOCAL_MARKERS =
  /\b(tashkent|toshent|target international|sergeli|yunusobod|qoraqamish|tinchlik|chilonzor|mirzo ulug|amir temur|registan|registon|navruz|bazaar|bozor|metro|mahalla|so'?m|sum\b|uzbek|uzbekistan|o'?zbek)\b/gi;

const REASONING_MARKERS = /\b(because|since|therefore|which means|that'?s why|however|but|instead|for example|for instance|so that|the reason)\b/gi;

const HEDGE_CLAIMS = /\b(research (shows|suggests)|studies (show|have shown)|scientists (say|believe)|experts agree|statistics prove|it is widely known)\b/gi;

const splitSentences = (t) =>
  t
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);

const wordsOf = (t) => (t.match(/[A-Za-z0-9'’\-]+/g) || []).filter(Boolean);

const stdev = (a) => {
  if (a.length < 2) return 0;
  const m = a.reduce((x, y) => x + y, 0) / a.length;
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length);
};

const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

/** Simple deterministic hash used for a tiny stable jitter. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function countMatches(text, re) {
  const m = text.match(re);
  return m ? m.length : 0;
}

function trapResults(text, assignment) {
  if (!assignment || !assignment.traps) return [];
  const words = wordsOf(text);
  return assignment.traps.map((trap) => {
    let pass = false;
    let detail = '';
    switch (trap.kind) {
      case 'keyword': {
        const hit = new RegExp(trap.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text);
        pass = hit;
        detail = hit ? `Found “${trap.value}”` : `Missing required reference “${trap.value}”`;
        break;
      }
      case 'banned': {
        const hit = new RegExp(`\\b${trap.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
        pass = !hit;
        detail = hit ? `Banned phrase “${trap.value}” used` : `Avoided banned phrase “${trap.value}”`;
        break;
      }
      case 'length': {
        pass = words.length >= trap.min && words.length <= trap.max;
        detail = `${words.length} words (target ${trap.min}–${trap.max})`;
        break;
      }
      case 'structure': {
        const n = countMatches(text, new RegExp(trap.re, 'gim'));
        pass = trap.mode === 'exact' ? n === trap.count : n >= trap.count;
        detail = `${n} × ${trap.label} (needs ${trap.mode === 'exact' ? 'exactly ' : 'at least '}${trap.count})`;
        break;
      }
      case 'scenario': {
        const tokens = (trap.tokens || []).filter((x) => x.length > 3);
        const hits = tokens.filter((tok) => text.toLowerCase().includes(tok.toLowerCase()));
        pass = hits.length >= 1;
        detail = hits.length ? `Scenario grounded in “${hits[0]}”` : `Missing the required scenario (${tokens.join(' / ')})`;
        break;
      }
      case 'classDetail': {
        const tokens = (trap.tokens || []).filter((x) => x.length > 3);
        const hits = tokens.filter((tok) => text.toLowerCase().includes(tok.toLowerCase()));
        pass = hits.length >= Math.min(2, tokens.length);
        detail = hits.length ? `Classroom context: ${hits.slice(0, 3).join(', ')}` : 'No classroom detail referenced';
        break;
      }
      default:
        pass = true;
    }
    return { ...trap, pass, detail };
  });
}

export function analyzeText(text, assignment = null, opts = {}) {
  const started = performance.now();
  const clean = (text || '').trim();
  const words = wordsOf(clean);
  const wordCount = words.length;
  const sentences = splitSentences(clean);
  const lengths = sentences.map((s) => wordsOf(s).length).filter((n) => n > 0);
  const meanLen = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const sd = stdev(lengths);
  const burstiness = meanLen ? sd / meanLen : 0;
  const paragraphs = clean.split(/\n\s*\n/).map((p) => wordsOf(p).length).filter((n) => n > 0);
  const paraCv = paragraphs.length > 1 ? stdev(paragraphs) / (paragraphs.reduce((a, b) => a + b, 0) / paragraphs.length) : 0;
  const uniq = new Set(words.map((w) => w.toLowerCase()));
  const ttr = wordCount ? uniq.size / wordCount : 0;
  const lower = clean.toLowerCase();

  // Tell hits with positions so the UI can highlight them.
  const tells = [];
  AI_TELLS.forEach((t) => {
    const re = new RegExp(t.re.source, 'gi');
    let m;
    while ((m = re.exec(clean)) !== null && tells.length < 60) {
      tells.push({ phrase: m[0], label: t.label, index: m.index, w: t.w });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  });
  const tellWeight = tells.reduce((a, b) => a + b.w, 0);
  const tellDensity = wordCount ? tellWeight / (wordCount / 100) : 0;

  const localHits = countMatches(clean, LOCAL_MARKERS);
  const firstPerson = countMatches(clean, /\b(i|my|me|mine)\b/gi);
  const reasoning = countMatches(clean, REASONING_MARKERS);
  const hedges = countMatches(clean, HEDGE_CLAIMS);
  const digits = countMatches(clean, /\b\d+([.,]\d+)?(%| ?so'?m| ?sum| ?minutes?| ?people| ?students?)?\b/gi);
  const quotes = countMatches(clean, /["“][^"”]{4,}["”]/g);
  const properNouns = (clean.match(/(?<![.!?]\s)(?<!^)\b[A-Z][a-z]{2,}/g) || []).length;
  const openerRepetition = (() => {
    const openers = sentences.map((s) => (wordsOf(s)[0] || '').toLowerCase()).filter(Boolean);
    if (!openers.length) return 0;
    const counts = {};
    openers.forEach((o) => (counts[o] = (counts[o] || 0) + 1));
    return Math.max(...Object.values(counts)) / openers.length;
  })();
  const evenness =
    lengths.length > 2
      ? lengths.filter((l) => Math.abs(l - meanLen) <= meanLen * 0.18).length / lengths.length
      : 0.5;
  const listyLines = (clean.match(/^\s*(?:[-*•]|\d+[.)])\s+/gm) || []).length;
  const headings = (clean.match(/^\s*(?:#{1,3}\s|\*\*[^*]+\*\*\s*:?$)/gm) || []).length;
  const emDashes = countMatches(clean, /—/g);
  const semicolons = countMatches(clean, /;/g);
  const italicsOrBold = countMatches(clean, /\*\*[^*]+\*\*|__[^_]+__/g);

  const traps = trapResults(clean, assignment);
  const trapFails = traps.filter((t) => !t.pass);
  const trapScore = traps.length ? traps.filter((t) => t.pass).length / traps.length : null;

  // ---- signals (0..1 severity, each with a display weight) ----
  const signals = [];
  const push = (id, label, value, weight, detail) => {
    if (value > 0.02) signals.push({ id, label, value: clamp(value), weight, detail });
  };

  push(
    'generic',
    'Generic essay phrasing',
    clamp(tellDensity / 6 + tells.length / 14),
    24,
    tells.length ? `${tells.length} tell-tale phrase${tells.length > 1 ? 's' : ''} (${[...new Set(tells.map((t) => t.label))].slice(0, 3).join(', ')}${tells.length > 3 ? '…' : ''})` : 'No essay-mill phrasing detected'
  );
  push(
    'evenness',
    'Machine-even sentence rhythm',
    clamp((0.42 - burstiness) / 0.42) * 0.65 + evenness * 0.35,
    20,
    `burstiness ${burstiness.toFixed(2)} · ${Math.round(evenness * 100)}% of sentences within ±18% of ${Math.round(meanLen)} words`
  );
  push(
    'local',
    'No local / classroom grounding',
    localHits === 0 ? 1 : localHits === 1 ? 0.45 : 0,
    16,
    localHits ? `${localHits} local reference${localHits > 1 ? 's' : ''} found` : 'Nothing Tashkent- or classroom-specific'
  );
  push(
    'uniformity',
    'Uniform paragraph blocks',
    paragraphs.length > 1 ? clamp((0.55 - paraCv) / 0.55) * 0.7 : 0.25,
    9,
    `${paragraphs.length} paragraph${paragraphs.length === 1 ? '' : 's'}${paragraphs.length > 1 ? ` · size spread ${Math.round(paraCv * 100)}%` : ''}`
  );
  push(
    'person',
    'Missing first-person reasoning',
    clamp(1 - firstPerson / Math.max(6, wordCount / 45)),
    8,
    firstPerson ? `${firstPerson} first-person reference${firstPerson > 1 ? 's' : ''}` : 'No personal reasoning voice'
  );
  push(
    'format',
    'Pre-formatted answer shell',
    clamp((listyLines + headings * 2 + italicsOrBold) / 6),
    7,
    `${listyLines} list line${listyLines === 1 ? '' : 's'} · ${headings} heading${headings === 1 ? '' : 's'}`
  );
  push(
    'punct',
    'Symmetric punctuation polish',
    clamp((emDashes + semicolons) / Math.max(1, wordCount / 120)),
    6,
    `${emDashes} em dash${emDashes === 1 ? '' : 'es'} · ${semicolons} semicolon${semicolons === 1 ? '' : 's'}`
  );
  push(
    'openers',
    'Repeated sentence openers',
    clamp((openerRepetition - 0.28) / 0.35),
    6,
    openerRepetition ? `${Math.round(openerRepetition * 100)}% of sentences start the same way` : 'Varied openers'
  );
  push(
    'hedging',
    'Uncited authority claims',
    clamp(hedges / 3),
    4,
    hedges ? `${hedges} unsourced “experts say” claim${hedges > 1 ? 's' : ''}` : 'No unsourced authority claims'
  );
  if (trapFails.length) {
    push(
      'traps',
      'Failed embedded AI-trap constraints',
      clamp(trapFails.length / Math.max(1, traps.length) + 0.25),
      0,
      `${trapFails.length} of ${traps.length} trap${traps.length === 1 ? '' : 's'} failed`
    );
  }

  // Counter-signals that push the score down.
  const counters = [];
  const cpush = (id, label, value, detail) => {
    if (value > 0.05) counters.push({ id, label, value: clamp(value), detail });
  };
  cpush('local', 'Concrete local grounding', clamp(localHits / 3), localHits ? `${localHits} Tashkent/classroom anchor${localHits > 1 ? 's' : ''}` : '');
  cpush('personal', 'Personal reasoning voice', clamp(firstPerson / 8), firstPerson ? `${firstPerson} first-person markers` : '');
  cpush('detail', 'Specific factual detail', clamp((digits + quotes + properNouns / 2) / 8), `${digits} numbers · ${quotes} quotes · ${Math.round(properNouns / 2)} proper nouns`);
  cpush('rhythm', 'Irregular human rhythm', burstiness > 0.42 ? clamp((burstiness - 0.42) / 0.5) : 0, `burstiness ${burstiness.toFixed(2)}`);
  cpush('reasoning', 'Causal reasoning', clamp(reasoning / 7), `${reasoning} causal connectors`);
  cpush('traps', 'Completed trap constraints', trapScore ? trapScore : 0, traps.length ? `${traps.filter((t) => t.pass).length}/${traps.length} traps passed` : '');

  const weightSum = signals.reduce((a, s) => a + s.weight, 0) || 1;
  let raw = signals.reduce((a, s) => a + s.value * s.weight, 0) / weightSum;
  raw += trapFails.length * 0.045;
  const counterBoost = counters.reduce((a, c) => a + c.value * 0.035, 0);
  raw = clamp(raw - counterBoost);
  const jitter = ((hash(clean.slice(0, 240)) % 100) / 100 - 0.5) * 0.02;
  const aiProbability = Math.round(clamp(raw + jitter, 0.03, 0.97) * 100);
  const band =
    aiProbability >= 70 ? 'likely-ai' : aiProbability >= 45 ? 'suspicious' : aiProbability >= 20 ? 'mixed' : 'original';

  // ---- mechanical / logical issues ----
  const issues = [];
  sentences.forEach((s) => {
    const n = wordsOf(s).length;
    if (n > 38) {
      issues.push({
        kind: 'grammar',
        severity: 2,
        quote: s.slice(0, 120) + (s.length > 120 ? '…' : ''),
        note: `Run-on sentence (${n} words). Split it into two or three sentences.`,
      });
    }
  });
  if (clean && !/[.!?]["”']?\s*$/.test(clean)) {
    issues.push({ kind: 'grammar', severity: 1, quote: clean.slice(-70), note: 'The submission does not end with punctuation.' });
  }
  if (/\s{2,}/.test(clean)) {
    issues.push({ kind: 'grammar', severity: 1, quote: 'double spaces', note: 'Double spaces detected — tidy the spacing before publishing.' });
  }
  if (/\b(i)\b/.test(clean)) {
    issues.push({ kind: 'grammar', severity: 1, quote: 'lowercase “i”', note: 'The pronoun “I” must be capitalised.' });
  }
  const dup = clean.match(/\b(\w{3,})\s+\1\b/i);
  if (dup) issues.push({ kind: 'grammar', severity: 1, quote: dup[0], note: 'Accidental word repetition.' });
  const veryCount = countMatches(clean, /\bvery\b/gi);
  if (veryCount >= 2) issues.push({ kind: 'style', severity: 1, quote: 'very ×' + veryCount, note: 'Replace “very + adjective” with a stronger single adjective.' });
  if (hedges) {
    issues.push({
      kind: 'logic',
      severity: 2,
      quote: clean.match(HEDGE_CLAIMS)?.[0] || 'authority claim',
      note: 'Unsourced authority claim. Name the study, the class source or drop the claim.',
    });
  }
  if (/\balways\b/i.test(clean) && /\bnever\b/i.test(clean)) {
    issues.push({ kind: 'logic', severity: 1, quote: 'always … never', note: 'Absolute language on both sides — check for an overgeneralisation.' });
  }
  trapFails.forEach((t) => {
    issues.push({ kind: 'integrity', severity: 3, quote: t.label, note: `Embedded requirement not met — ${t.detail}.` });
  });
  if (wordCount > 0 && wordCount < 40) {
    issues.push({ kind: 'structure', severity: 2, quote: `${wordCount} words`, note: 'Too thin for a graded response — the reasoning cannot be verified.' });
  }
  if (aiProbability >= 45) {
    issues.push({
      kind: 'integrity',
      severity: 3,
      quote: 'authorship signal',
      note: `Generic phrasing is ${aiProbability}% consistent with unedited AI output. Request a 30-second voice defense before grading.`,
    });
  }

  // ---- rubric grade ----
  const questionKeywords = opts.questionKeywords || [];
  const coverage = questionKeywords.length
    ? questionKeywords.filter((k) => lower.includes(k.toLowerCase())).length / questionKeywords.length
    : 0.65;
  const depth = clamp(wordCount / 220) * 0.35 + clamp(reasoning / 8) * 0.35 + coverage * 0.3;
  const grounding = trapScore === null ? 0.6 : trapScore;
  const structure =
    clamp(paragraphs.length / 3) * 0.4 +
    (wordCount >= 120 && wordCount <= 420 ? 0.35 : 0.12) +
    clamp((meanLen > 0 ? 1 - Math.abs(meanLen - 18) / 30 : 0)) * 0.25;
  const mechanics =
    clamp(1 - issues.filter((i) => i.kind === 'grammar').length / 6) * 0.5 +
    clamp(1 - aiProbability / 100) * 0.5;
  const criteria = [
    { id: 'depth', label: 'Analytical depth', score: Math.round(depth * 25), max: 25, comment: depth > 0.72 ? 'Sustained reasoning with causal links.' : 'Mostly description; add “because / which means” chains.' },
    { id: 'grounding', label: 'Local & classroom grounding', score: Math.round(grounding * 25), max: 25, comment: trapScore === 1 ? 'All embedded constraints satisfied.' : 'Missing specific classroom or Tashkent anchors.' },
    { id: 'structure', label: 'Structure & clarity', score: Math.round(structure * 25), max: 25, comment: structure > 0.75 ? 'Clean paragraph architecture.' : 'Rebalance paragraph lengths and sentence size.' },
    { id: 'voice', label: 'Own voice & mechanics', score: Math.round(mechanics * 25), max: 25, comment: aiProbability > 45 ? 'Authorship signals require a voice defense.' : 'Reads as the student’s own voice.' },
  ];
  const total = criteria.reduce((a, c) => a + c.score, 0);
  const letter = total >= 90 ? 'A' : total >= 82 ? 'A-' : total >= 74 ? 'B+' : total >= 66 ? 'B' : total >= 58 ? 'C+' : total >= 50 ? 'C' : 'Redo';

  const elapsedMs = Math.max(1, Math.round(performance.now() - started));

  return {
    aiProbability,
    originality: 100 - aiProbability,
    band,
    verdict:
      band === 'likely-ai'
        ? 'Likely AI-generated — voice defense required before grading.'
        : band === 'suspicious'
          ? 'Suspicious ownership signals — verify with the student.'
          : band === 'mixed'
            ? 'Human revision visible, some generic stretches.'
            : 'Consistent with the student’s own writing profile.',
    signals: signals.sort((a, b) => b.value * b.weight - a.value * a.weight),
    counters,
    tells: tells.sort((a, b) => a.index - b.index),
    traps,
    issues,
    metrics: {
      wordCount,
      sentences: sentences.length,
      meanSentenceLength: Number(meanLen.toFixed(1)),
      burstiness: Number(burstiness.toFixed(2)),
      lexicalDiversity: Number((ttr * 100).toFixed(0)),
      paragraphs: paragraphs.length,
      localHits,
      firstPerson,
      reasoning,
      elapsedMs,
    },
    grade: { total, letter, criteria },
  };
}

/** 6-word shingle Jaccard similarity, used for peer-copy detection. */
export function similarity(a, b) {
  const shingles = (t) => {
    const w = (t || '').toLowerCase().replace(/[^a-z0-9\s']/g, '').split(/\s+/).filter(Boolean);
    const s = new Set();
    for (let i = 0; i + 5 < w.length; i++) s.add(w.slice(i, i + 6).join(' '));
    return s;
  };
  const A = shingles(a);
  const B = shingles(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((x) => { if (B.has(x)) inter++; });
  return inter / (A.size + B.size - inter);
}
