/**
 * Assignment Studio generator.
 * Produces 10 genuinely different variants of one topic — each with its own
 * Tashkent scenario, its own embedded AI-trap, its own voice-defense prompt and
 * its own hidden detection key. Students in the same class never receive the
 * same variant, which removes copy-paste value from the exercise.
 */

const SUBJECT_CODES = {
  English: 'ENG',
  'English Language': 'ENG',
  Business: 'BUS',
  'SAT Math': 'MATH',
  Mathematics: 'MATH',
  'Computer Science': 'CS',
  Science: 'SCI',
  Physics: 'PHY',
  History: 'HIS',
  Economics: 'ECO',
  IELTS: 'IELTS',
};

const SCENARIOS = [
  { id: 'chorsu', place: 'Chorsu Bazaar', hook: 'the spice traders who negotiate prices in three languages before 9 a.m.' },
  { id: 'metro', place: 'the Kosmonavtlar metro station', hook: 'the tile mosaics that turn a commute into a history lesson.' },
  { id: 'navruz', place: 'a Navruz family table', hook: 'the way sumalak is stirred for hours by three generations at once.' },
  { id: 'yandex', place: 'a Yandex Go ride on Amir Temur Avenue', hook: 'the driver switching between Uzbek, Russian and English to keep five-star ratings.' },
  { id: 'bazaar', place: 'the IT Park co-working floor', hook: 'a start-up team pitching the same idea in two languages to two different investors.' },
  { id: 'school', place: 'the Target Sergeli canteen at 12:40', hook: 'the queue that reorganises itself whenever the bell rings early.' },
  { id: 'football', place: 'a Bunyodkor stadium match', hook: 'the commentary that has to explain the same pass to a fan and a first-time visitor.' },
  { id: 'library', place: 'the second-floor library at Target Yunusobod', hook: 'the silent argument two students had over the last copy of the same book.' },
  { id: 'market', place: 'a Sunday trip to the Yangiobod electronics market', hook: 'the haggling ritual that starts with an insult and ends with tea.' },
  { id: 'family', place: 'a Qoraqamish family dinner', hook: 'the moment an uncle asks you to explain your homework in front of everyone.' },
];

const ROLES = [
  'a sceptical shopkeeper',
  'a first-year university student',
  'a school principal with five minutes to decide',
  'a journalist writing for a Tashkent youth magazine',
  'a grandparent who has never used a smartphone',
  'a start-up founder with no budget',
  'your own classmate who disagrees with you',
  'a customer-service manager handling complaints',
];

const BANNED_SETS = [
  ['furthermore', 'in conclusion', 'delve', 'multifaceted'],
  ['moreover', 'pivotal', 'in today’s fast-paced world', 'tapestry'],
  ['it is important to note', 'in summary', 'leverage', 'holistic'],
  ['firstly', 'secondly', 'lastly', 'plays a crucial role'],
  ['seamless', 'robust', 'paradigm', 'underscores'],
];

const STRUCTURAL_RULES = [
  { id: 'however', label: 'a sentence that starts with “However,”', re: '^\\s*However,', count: 1, mode: 'exact', trapText: 'Exactly one sentence in the whole response must begin with “However,” — no more, no fewer.' },
  { id: 'question', label: 'a genuine rhetorical question', re: '\\?', count: 1, mode: 'atleast', trapText: 'Include exactly one genuine question that you are actually trying to answer in the paragraph that follows it.' },
  { id: 'numbers', label: 'a sentence containing a specific number', re: '\\b\\d+', count: 2, mode: 'atleast', trapText: 'Use at least two specific numbers (prices, minutes, percentages) that you could defend out loud.' },
  { id: 'quote', label: 'a direct quote in quotation marks', re: '["“][^"”]{5,}["”]', count: 1, mode: 'atleast', trapText: 'Quote one exact sentence you heard or read today — in quotation marks — and say who said it.' },
  { id: 'nobullets', label: 'no bullet points or numbered lists', re: '^\\s*(?:[-*•]|\\d+[.)])\\s+', count: 0, mode: 'exact', trapText: 'Write in continuous prose: no bullet points, no numbered lists, no headings.' },
  { id: 'firstword', label: 'a paragraph beginning with “In class…”', re: '^\\s*In class|\\n\\s*In class', count: 1, mode: 'atleast', trapText: 'One paragraph must open with the exact words “In class…” and continue with a real example from today.' },
];

const STOPWORDS = new Set('compare compared comparing opening opened explain explained showing showed writing written asking asked answering argued arguing mentioned mentioning because before being between through during using used make made take taken gives given want wanted need needed like just really actually basically simply thing things something someone students student teacher teachers school schools'.split(' ').concat('about above after again against also although always another around because before being below between both could does doing down during each every from further have having here into itself just more most much must only other over same should some such than that their them then there these they this those through under until very were what when where which while with would your yours paragraph paragraphs sentence sentences example examples discussed discussion today lesson class winning opened price'.split(' ')));

const QUESTION_BANK = [
  (topic) => `In no more than four sentences, explain why ${topic} is useful outside an exam hall. Include one cause-and-effect chain (“because… which means…”).`,
  (topic) => `A classmate says: “${topic} is just vocabulary for teachers — nobody uses it.” Give their strongest argument, then dismantle it with one example from today’s lesson.`,
  (topic) => `Where does ${topic} break down? Describe one situation in which the rule or model stops working, and what a careful person should do instead.`,
  (topic) => `Choose the single most important idea in ${topic} and explain what you would lose if it were removed. Defend the choice against one alternative.`,
  (topic) => `Turn ${topic} into a decision: two options, one recommendation, three reasons. No fence-sitting.`,
  (topic) => `Explain ${topic} to someone who will forget it in ten minutes. Which detail do you sacrifice, and why is that the right sacrifice?`,
];

const DETECTION_GENERIC = [
  '“In today’s fast-paced world…” opening with no Tashkent anchor',
  'A definition dump of 3–5 textbook sentences with no example',
  '“On the one hand… on the other hand…” with no decision',
  '“In conclusion…” summary that repeats the introduction',
  'Invented statistics (“studies show 78% of students…”) with no source',
  'Zero reference to the classroom detail, the scenario or the student’s own seat',
  'Perfectly even 3–4 sentence paragraphs and zero first-person reasoning',
];

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const shuffle = (rng, arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const code4 = (rng) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => alphabet[Math.floor(rng() * alphabet.length)]).join('');
};

export function generateVariants({ subject = 'English', grade = 'Grade 11', topic = '', classDetail = '', lessonDate = new Date().toISOString().slice(0, 10) } = {}) {
  const cleanTopic = (topic || 'the core idea of the lesson').trim();
  const cleanDetail = (classDetail || '').trim();
  const baseSeed = seedFrom(`${subject}|${grade}|${cleanTopic}|${cleanDetail}|${lessonDate}`);
  const gradeNum = (grade.match(/\d+/) || ['11'])[0];
  const subjectCode = SUBJECT_CODES[subject] || subject.slice(0, 3).toUpperCase();
  const detailTokens = (() => {
    if (!cleanDetail) return [];
    const raw = cleanDetail.split(/[^A-Za-z0-9']+/).filter(Boolean);
    const seen = new Set();
    const scored = [];
    raw.forEach((w) => {
      const low = w.toLowerCase();
      if (low.length < 4 || STOPWORDS.has(low) || seen.has(low)) return;
      seen.add(low);
      const proper = /^[A-Z]/.test(w) ? 2.2 : 0;
      scored.push({ low, score: proper + low.length / 6 });
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, 8).map((t) => t.low);
  })();

  const questions = QUESTION_BANK.map((fn) => fn(cleanTopic));
  const variants = [];

  for (let i = 0; i < 10; i++) {
    const rng = mulberry32(baseSeed + i * 7919);
    const scenario = SCENARIOS[i % SCENARIOS.length];
    const role = pick(rng, ROLES);
    const banned = BANNED_SETS[i % BANNED_SETS.length];
    const structural = STRUCTURAL_RULES[(i + Math.floor(rng() * 3)) % STRUCTURAL_RULES.length];
    const qs = shuffle(rng, questions).slice(0, 3);
    const minWords = 180 + Math.floor(rng() * 5) * 20;
    const maxWords = minWords + 100 + Math.floor(rng() * 3) * 30;
    const code = `TRG-${gradeNum}-${subjectCode}-${code4(rng)}`;

    const anchorPhrase = cleanDetail
      ? `the specific example we discussed in class today (${cleanDetail.length > 90 ? cleanDetail.slice(0, 90) + '…' : cleanDetail})`
      : `one exact detail from today’s lesson (a phrase from the board, a number I wrote down, or something a classmate said)`;

    const constraintParts = [
      `Ground your answer in ${scenario.place}: ${scenario.hook} Use it as your running example rather than a decorative mention.`,
      `Reference ${anchorPhrase}. A generic answer that could have been written by anyone who never entered Room 214 does not count.`,
      `Write as if you are explaining this to ${role}. No audience-switching halfway.`,
      `Banned phrases — using any of them voids the submission: ${banned.map((b) => `“${b}”`).join(', ')}.`,
      structural.trapText,
      `Length: ${minWords}–${maxWords} words.`,
    ];

    const scenarioTokens = scenario.place
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 4 && !STOPWORDS.has(w));

    const traps = [
      {
        id: 'scenario',
        kind: 'scenario',
        label: `Scenario anchor — ${scenario.place}`,
        tokens: scenarioTokens.length ? scenarioTokens : ['tashkent'],
      },
      {
        id: 'class-detail',
        kind: 'classDetail',
        label: 'Classroom-specific reference',
        tokens: detailTokens.length ? detailTokens : [],
        value: detailTokens[0] || '',
      },
      { id: 'banned', kind: 'banned', label: `Banned phrase “${banned[0]}”`, value: banned[0] },
      { id: 'ban2', kind: 'banned', label: `Banned phrase “${banned[1]}”`, value: banned[1] },
      { id: 'length', kind: 'length', label: `Word count ${minWords}–${maxWords}`, min: minWords, max: maxWords },
      {
        id: 'structure',
        kind: 'structure',
        label: structural.label,
        re: structural.re,
        count: structural.count,
        mode: structural.mode,
      },
    ];
    if (detailTokens.length) traps.unshift({ id: 'keyword', kind: 'keyword', label: `Tashkent/class anchor “${detailTokens[0]}”`, value: detailTokens[0] });

    // Hidden watermark: a phrase the AI trap expects, which an external model
    // will never produce because it never saw the classroom detail.
    const watermark = `${code}-${scenario.id}`;

    variants.push({
      code,
      index: i + 1,
      subject,
      grade,
      topic: cleanTopic,
      lessonDate,
      scenarioId: scenario.id,
      title: `${cleanTopic} — ${scenario.place} edition`,
      objective: `Master ${cleanTopic} by applying it to a concrete Tashkent scenario, defending one interpretation under time pressure, and explaining your own reasoning out loud for 30 seconds.`,
      estimatedMinutes: 20 + Math.floor(rng() * 3) * 5,
      questions: qs,
      constraint: constraintParts,
      bannedPhrases: banned,
      traps,
      watermark,
      defensePrompt: `Open your answer to Question 2. In 30 seconds, explain out loud why you chose that example instead of the obvious one, and what you would change if your teacher disagreed. Speak in full sentences — your Voice-Print is matched against your Angry Mentor baseline.`,
      detectionKey: {
        expectedGenericPhrases: DETECTION_GENERIC.slice(0, 4 + Math.floor(rng() * 3)),
        structuralTemplate: `A generic model will produce a 4-paragraph essay: definition → two “on the one hand” paragraphs → “In conclusion”. It will use ${banned.map((b) => `“${b}”`).join(' / ')} because they are high-probability continuations.`,
        factualHallucinations: [
          `Invented Tashkent statistics about ${scenario.place} (footfall, revenue, “78% of residents”).`,
          `Fabricated quote attributed to “experts” or a made-up Target teacher.`,
          `Mentions of ${cleanDetail ? 'a different classroom example than the one recorded in the lesson log' : 'a generic “class discussion” that never happened'}.`,
          'Foreign examples (New York, London) substituted for the required Tashkent scenario.',
        ],
        trapExplanation: `The variant code ${code} is unique to one student. If the text arrives without the ${scenario.place} anchor, without the classroom detail, or with any banned phrase, the paper was generated externally.`,
        rubric: [
          '2 pts — Answers all three questions rather than restating the topic.',
          '2 pts — Uses the Tashkent scenario as a working example, with at least one concrete detail.',
          '1 pt — References today’s classroom detail accurately.',
          '1 pt — Obeys the structural constraint and word count.',
          '1 pt — No banned phrases; own sentence rhythm.',
          '1 pt — Causal reasoning (“because / which means”) rather than description.',
          '1 pt — Takes a position and defends it against a real alternative.',
          '1 pt — 30-second voice defense matches the written reasoning and the Voice-Print baseline.',
        ],
      },
      rubricTotal: 10,
      createdAt: new Date().toISOString(),
    });
  }
  return variants;
}

/** Compact, student-facing payload (detectionKey and watermark stripped). */
export function publicVariant(v) {
  const { detectionKey, watermark, ...rest } = v;
  return { ...rest, wordRange: (v.traps.find((t) => t.kind === 'length') || {}), hasDetectionKey: true };
}
