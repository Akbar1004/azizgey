/**
 * In-memory demo school. Everything the UI shows is computed from this store, so
 * approving a submission, earning coins or enrolling a Voice-Print is real state,
 * not a mock animation. Restarting the server resets the school day.
 */
import { generateVariants, publicVariant } from './generator.js';
import { analyzeText, similarity } from './detector.js';
import { DILNOZA_TEXT, JAVOHIR_TEXT, SARDOR_TEXT, MADINA_TEXT, BEKZOD_TEXT, AZIZ_HISTORY_1, AZIZ_HISTORY_2 } from './seedTexts.js';
import { MATCH_THRESHOLD } from './voiceprint.js';

const DAY = 86400000;
const NOW = Date.now();
const iso = (offsetDays, hour = 17, minute = 0) => {
  const d = new Date(NOW + offsetDays * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

export const SETTINGS = {
  aiFreeThreshold: 20,
  voiceMatchThreshold: MATCH_THRESHOLD,
  voiceReviewBand: 0.12,
  maxHintsBeforeFlag: 3,
  defenseSeconds: 30,
  enrollmentSeconds: 12,
  processingBudgetMs: 10000,
  demoMode: !process.env.OPENAI_API_KEY,
  modelProvider: process.env.OPENAI_API_KEY ? 'openai-realtime' : 'local-persona-engine',
};

export const school = {
  name: 'Target International School',
  term: '2025–26 · Term 2',
  week: 'Week 12',
  today: new Date(NOW).toISOString().slice(0, 10),
  branches: [
    { id: 'sergeli', name: 'Sergeli', students: 742, opened: 2018, accent: '#5eead4' },
    { id: 'yunusobod', name: 'Yunusobod', students: 688, opened: 2020, accent: '#a78bfa' },
    { id: 'qoraqamish', name: 'Qoraqamish', students: 611, opened: 2021, accent: '#fbbf24' },
    { id: 'tinchlik', name: 'Tinchlik', students: 534, opened: 2023, accent: '#fb7185' },
  ],
};

export const teacher = {
  id: 't-malika',
  name: 'Malika Rasulova',
  subject: 'English',
  role: 'Academic Integrity Lead',
  classes: ['11-A English', '11-B English', '10-A English'],
  avatar: 'MR',
};

export const students = [
  {
    id: 'aziz',
    name: 'Aziz Karimov',
    firstName: 'Aziz',
    branchId: 'sergeli',
    className: '11-A',
    section: '11-A English',
    grade: 'Grade 11',
    coins: 340,
    xp: 1240,
    streak: 6,
    avatar: 'AK',
    tone: 'mint',
    variantIndex: 3,
    voiceprint: null,
    joined: '2024',
    targetUniversity: 'Westminster International University in Tashkent',
  },
  { id: 'dilnoza', name: 'Dilnoza Rahimova', firstName: 'Dilnoza', branchId: 'yunusobod', className: '11-A', section: '11-A English', grade: 'Grade 11', coins: 512, xp: 1810, streak: 11, avatar: 'DR', tone: 'violet', variantIndex: 0, voiceprint: { bands: Array.from({ length: 24 }, (_, i) => Math.sin(i * 1.7) * 0.3 + 0.35), pitch: 214, zcr: 0.061, durationS: 12 }, joined: '2023' },
  { id: 'javohir', name: 'Javohir Tursunov', firstName: 'Javohir', branchId: 'sergeli', className: '11-A', section: '11-A English', grade: 'Grade 11', coins: 128, xp: 640, streak: 0, avatar: 'JT', tone: 'amber', variantIndex: 1, voiceprint: { bands: Array.from({ length: 24 }, (_, i) => Math.cos(i * 0.9) * 0.4 + 0.3), pitch: 128, zcr: 0.048, durationS: 12 }, joined: '2024' },
  { id: 'madina', name: 'Madina Yusupova', firstName: 'Madina', branchId: 'qoraqamish', className: '11-B', section: '11-B English', grade: 'Grade 11', coins: 264, xp: 980, streak: 3, avatar: 'MY', tone: 'rose', variantIndex: 2, voiceprint: { bands: Array.from({ length: 24 }, (_, i) => Math.sin(i * 0.6 + 1) * 0.28 + 0.32), pitch: 198, zcr: 0.058, durationS: 12 }, joined: '2024' },
  { id: 'sardor', name: 'Sardor Aliev', firstName: 'Sardor', branchId: 'tinchlik', className: '11-A', section: '11-A English', grade: 'Grade 11', coins: 96, xp: 520, streak: 1, avatar: 'SA', tone: 'mint', variantIndex: 4, voiceprint: { bands: Array.from({ length: 24 }, (_, i) => Math.cos(i * 1.3 + 2) * 0.3 + 0.3), pitch: 145, zcr: 0.052, durationS: 12 }, joined: '2025' },
  { id: 'bekzod', name: 'Bekzod Nazarov', firstName: 'Bekzod', branchId: 'sergeli', className: '11-A', section: '11-A English', grade: 'Grade 11', coins: 401, xp: 1520, streak: 7, avatar: 'BN', tone: 'violet', variantIndex: 5, voiceprint: { bands: Array.from({ length: 24 }, (_, i) => Math.sin(i * 2.1 + 0.5) * 0.26 + 0.34), pitch: 117, zcr: 0.045, durationS: 12 }, joined: '2023' },
  { id: 'nilufar', name: 'Nilufar Qodirova', firstName: 'Nilufar', branchId: 'yunusobod', className: '11-B', section: '11-B English', grade: 'Grade 11', coins: 468, xp: 1702, streak: 9, avatar: 'NQ', tone: 'amber', variantIndex: 6, voiceprint: null, joined: '2023' },
  { id: 'timur', name: 'Timur Sattorov', firstName: 'Timur', branchId: 'tinchlik', className: '11-B', section: '11-B English', grade: 'Grade 11', coins: 302, xp: 1130, streak: 4, avatar: 'TS', tone: 'rose', variantIndex: 7, voiceprint: null, joined: '2024' },
];

export const parents = [
  { id: 'p-dilbar', name: 'Dilbar Karimova', childId: 'aziz', childName: 'Aziz Karimov', telegram: '@dilbar_k', language: 'uz-en', weeklyOptIn: true },
  { id: 'p-rustam', name: 'Rustam Rahimov', childId: 'dilnoza', childName: 'Dilnoza Rahimova', telegram: '@rustam_r', language: 'en', weeklyOptIn: true },
];

const SEED_TOPIC = {
  subject: 'English',
  grade: 'Grade 11',
  topic: 'Persuasive paragraph structure',
  classDetail:
    'We compared two paragraphs about the Chorsu Bazaar price negotiation; the winning paragraph opened with a question.',
  lessonDate: '2026-11-23',
};
const HISTORY_TOPIC = {
  subject: 'English',
  grade: 'Grade 11',
  topic: 'Conditional sentences (Type 3)',
  classDetail: 'We rewrote three regrets from the novel as third conditionals, starting with the sentence about the missed train.',
  lessonDate: '2026-11-16',
};

export const assignmentSets = [
  {
    id: 'SET-HIST',
    title: HISTORY_TOPIC.topic,
    subject: HISTORY_TOPIC.subject,
    grade: HISTORY_TOPIC.grade,
    topic: HISTORY_TOPIC.topic,
    classDetail: HISTORY_TOPIC.classDetail,
    lessonDate: HISTORY_TOPIC.lessonDate,
    dueAt: iso(-7, 18),
    status: 'closed',
    createdBy: teacher.id,
    variants: generateVariants(HISTORY_TOPIC),
  },
  {
    id: 'SET-ACTIVE',
    title: SEED_TOPIC.topic,
    subject: SEED_TOPIC.subject,
    grade: SEED_TOPIC.grade,
    topic: SEED_TOPIC.topic,
    classDetail: SEED_TOPIC.classDetail,
    lessonDate: SEED_TOPIC.lessonDate,
    dueAt: iso(1, 18),
    status: 'active',
    createdBy: teacher.id,
    variants: generateVariants(SEED_TOPIC),
  },
];

export const activeSet = assignmentSets[1];
export const historySet = assignmentSets[0];

/** The set students are currently working on (publishing replaces this). */
export function currentSet() {
  return [...assignmentSets].reverse().find((s) => s.status === 'active') || assignmentSets[assignmentSets.length - 1];
}

const findVariant = (set, index) => set.variants[index % set.variants.length];

let submissionSeq = 1041;

function buildSubmission({ studentId, setId, variantIndex, text, submittedAt, onTime, hintsUsed = 0, status = 'pending', grade = null, defense = null, teacherNote = '' }) {
  const student = students.find((s) => s.id === studentId);
  const set = assignmentSets.find((x) => x.id === setId);
  const variant = findVariant(set, variantIndex);
  const report = analyzeText(text, variant, {
    questionKeywords: ['question', 'bazaar', 'chorsu', 'audience', 'regret', 'conditional', 'evidence', 'bazaar'],
  });
  const peers = submissions.filter((s) => s.setId === setId && s.studentId !== studentId);
  let plagiarism = { maxSimilarity: 0, peerId: null, peerName: null };
  peers.forEach((p) => {
    const sim = similarity(text, p.text);
    if (sim > plagiarism.maxSimilarity) {
      plagiarism = { maxSimilarity: Number(sim.toFixed(3)), peerId: p.studentId, peerName: students.find((s) => s.id === p.studentId)?.name };
    }
  });
  const id = `SUB-${submissionSeq++}`;
  return {
    id,
    studentId,
    studentName: student?.name || 'Unknown',
    branchId: student?.branchId,
    className: student?.className,
    setId,
    setTitle: set.title,
    variantCode: variant.code,
    scenario: variant.title,
    text,
    submittedAt,
    onTime,
    hintsUsed,
    status,
    grade,
    teacherNote,
    report,
    plagiarism,
    defense,
    coins: [],
    reviewedAt: null,
  };
}

export const submissions = [];

const seed = [
  {
    studentId: 'dilnoza', setId: 'SET-ACTIVE', variantIndex: 0, text: DILNOZA_TEXT,
    submittedAt: iso(-1, 16), onTime: true, hintsUsed: 0,
    defense: { question: 'In paragraph 2 you describe the customer choosing the longer-lasting screen. Why did you keep that specific detail instead of summarising the sale?', durationS: 28, verdict: 'match', similarity: 0.91, voiceprint: { verdict: 'match', similarity: 0.93, threshold: 0.8 }, transcriptQuality: 'clear' },
  },
  {
    studentId: 'javohir', setId: 'SET-ACTIVE', variantIndex: 1, text: JAVOHIR_TEXT,
    submittedAt: iso(-1, 20), onTime: false, hintsUsed: 4,
    status: 'pending',
    defense: { question: 'You claim 78% of readers are more engaged by rhetorical questions. Where did that number come from, and can you defend the paragraph in your own words?', durationS: 22, verdict: 'mismatch', similarity: 0.54, voiceprint: { verdict: 'mismatch', similarity: 0.58, threshold: 0.8 }, transcriptQuality: 'hesitant' },
  },
  {
    studentId: 'sardor', setId: 'SET-ACTIVE', variantIndex: 4, text: SARDOR_TEXT,
    submittedAt: iso(0, 9), onTime: true, hintsUsed: 2, status: 'flagged',
    defense: { question: 'Explain why the winning paragraph in class opened with a question, using your own words rather than the text.', durationS: 18, verdict: 'mismatch', similarity: 0.44, voiceprint: { verdict: 'mismatch', similarity: 0.41, threshold: 0.8 }, transcriptQuality: 'flat' },
  },
  {
    studentId: 'madina', setId: 'SET-ACTIVE', variantIndex: 2, text: MADINA_TEXT,
    submittedAt: iso(0, 12), onTime: true, hintsUsed: 3,
    defense: { question: 'Which classroom example did you mean when you wrote “I forgot the exact words”? Describe it now.', durationS: 11, verdict: 'review', similarity: 0.74, voiceprint: { verdict: 'review', similarity: 0.74, threshold: 0.8 }, transcriptQuality: 'short' },
  },
  {
    studentId: 'bekzod', setId: 'SET-ACTIVE', variantIndex: 5, text: BEKZOD_TEXT,
    submittedAt: iso(-2, 15), onTime: true, hintsUsed: 1, status: 'approved',
    grade: 86,
    defense: { question: 'Why did you include the spare-parts seller if he contradicts your main claim?', durationS: 26, verdict: 'match', similarity: 0.88, voiceprint: { verdict: 'match', similarity: 0.9, threshold: 0.8 }, transcriptQuality: 'clear' },
    teacherNote: 'Counter-example used deliberately — good. Approved at 86.',
  },
  {
    studentId: 'aziz', setId: 'SET-HIST', variantIndex: 3, text: AZIZ_HISTORY_1,
    submittedAt: iso(-6, 17), onTime: true, hintsUsed: 0, status: 'approved', grade: 88,
    defense: { question: 'You say the train sentence had more “weight” than the football one. What makes a regret heavier?', durationS: 27, verdict: 'match', similarity: 0.89, voiceprint: { verdict: 'match', similarity: 0.87, threshold: 0.8 }, transcriptQuality: 'clear' },
    teacherNote: 'Strong personal anchor. Approved at 88.',
  },
  {
    studentId: 'aziz', setId: 'SET-HIST', variantIndex: 7, text: AZIZ_HISTORY_2,
    submittedAt: iso(-4, 18), onTime: true, hintsUsed: 1, status: 'approved', grade: 82,
    defense: { question: 'You were wrong about the two paragraphs on the board. What evidence changed your mind?', durationS: 24, verdict: 'match', similarity: 0.86, voiceprint: { verdict: 'match', similarity: 0.84, threshold: 0.8 }, transcriptQuality: 'clear' },
    teacherNote: 'Reflective, original. Approved at 82.',
  },
];

seed.forEach((s) => {
  const sub = buildSubmission(s);
  sub.status = s.status || 'pending';
  sub.grade = s.grade ?? null;
  sub.teacherNote = s.teacherNote || '';
  sub.reviewedAt = s.status === 'approved' ? s.submittedAt : null;
  sub.coins = rewardItems(sub);
  submissions.push(sub);
});

export function rewardItems(sub) {
  const items = [];
  if (!sub) return items;
  if (sub.onTime) items.push({ id: 'ontime', label: 'On-time submission', coins: 40 });
  if (sub.report && sub.report.aiProbability <= SETTINGS.aiFreeThreshold) items.push({ id: 'aifree', label: 'AI-free verified (<20%)', coins: 30 });
  if (sub.defense && sub.defense.verdict === 'match') items.push({ id: 'defense', label: 'Voice defense passed', coins: 25 });
  if (sub.defense && sub.defense.voiceprint && sub.defense.voiceprint.verdict === 'match') items.push({ id: 'voiceprint', label: 'Voice-Print matched', coins: 10 });
  if ((sub.hintsUsed || 0) === 0) items.push({ id: 'nohints', label: 'No tutor hints used', coins: 10 });
  return items;
}

// Recompute seeded rewards now that rewardItems exists.
submissions.forEach((s) => { s.coins = rewardItems(s); });



export const perks = [
  { id: 'late-pass', name: 'Late-Pass Coupon', cost: 120, icon: 'ticket', stock: 34, description: 'One 24-hour homework extension, no questions asked.', category: 'Academic' },
  { id: 'hoodie', name: 'Target Hoodie', cost: 450, icon: 'shirt', stock: 12, description: 'Navy heavyweight hoodie with the Target crest.', category: 'Merch' },
  { id: 'spelling-bee', name: 'Spelling Bee Priority Slot', cost: 300, icon: 'mic', stock: 8, description: 'Choose your heat in the school Spelling Bee.', category: 'Competition' },
  { id: 'zakovat', name: 'Zakovat Team Priority', cost: 260, icon: 'brain', stock: 10, description: 'Guaranteed seat on a Zakovat team for the branch final.', category: 'Competition' },
  { id: 'canteen', name: 'Canteen Voucher', cost: 80, icon: 'coffee', stock: 60, description: 'Free osh and compot at the Sergeli canteen.', category: 'Campus' },
  { id: 'library', name: 'Library Quiet Room Pass', cost: 60, icon: 'book', stock: 25, description: 'Reserved desk in the second-floor quiet room for a week.', category: 'Campus' },
];

export const redemptions = [
  { id: 'R-221', studentId: 'aziz', perkId: 'canteen', at: iso(-5, 13), cost: 80, status: 'collected' },
];

export const ledger = [
  { id: 'L-1', studentId: 'aziz', amount: 64, reason: 'Approved homework · Conditional sentences', at: iso(-6, 18) },
  { id: 'L-2', studentId: 'aziz', amount: 15, reason: 'Angry Mentor mini-quiz · “ubiquitous”', at: iso(-5, 16) },
  { id: 'L-3', studentId: 'aziz', amount: -80, reason: 'Redeemed · Canteen Voucher', at: iso(-5, 13) },
  { id: 'L-4', studentId: 'aziz', amount: 56, reason: 'Approved homework · Source evaluation', at: iso(-4, 19) },
  { id: 'L-5', studentId: 'aziz', amount: 20, reason: 'Angry Mentor streak · 5 days', at: iso(-3, 17) },
  { id: 'L-6', studentId: 'aziz', amount: 25, reason: 'Voice-Print enrolment bonus', at: iso(-2, 17) },
];

export const mastery = [
  { topic: 'Persuasive paragraph structure', subject: 'English', cells: { '11-A English': 74, '11-B English': 58, '10-A English': 41, '11-A Math': null, '11-A Business': 66 } },
  { topic: 'Conditional sentences (Type 3)', subject: 'English', cells: { '11-A English': 81, '11-B English': 63, '10-A English': 52, '11-A Math': null, '11-A Business': 58 } },
  { topic: 'Source evaluation & AI tells', subject: 'English', cells: { '11-A English': 69, '11-B English': 27, '10-A English': 34, '11-A Math': null, '11-A Business': 44 } },
  { topic: 'Quadratic factoring', subject: 'Math', cells: { '11-A English': null, '11-B English': null, '10-A English': null, '11-A Math': 24, '11-A Business': null } },
  { topic: 'Break-even analysis', subject: 'Business', cells: { '11-A English': null, '11-B English': null, '10-A English': null, '11-A Math': null, '11-A Business': 29 } },
  { topic: 'Figurative language in poetry', subject: 'English', cells: { '11-A English': 62, '11-B English': 46, '10-A English': 21, '11-A Math': null, '11-A Business': 38 } },
];

export const classBoard = [
  { id: '11-A-sergeli', label: '11-A', branchId: 'sergeli', baseCoins: 4820, members: ['aziz', 'javohir', 'bekzod'] },
  { id: '11-B-yunusobod', label: '11-B', branchId: 'yunusobod', baseCoins: 5410, members: ['nilufar','dilnoza'] },
  { id: '11-A-qoraqamish', label: '11-A', branchId: 'qoraqamish', baseCoins: 4310, members: ['madina'] },
  { id: '11-A-tinchlik', label: '11-A', branchId: 'tinchlik', baseCoins: 3960, members: ['sardor', 'timur'] },
];

export const branchBases = {
  sergeli: { coins: 18420, aiFree: 91, onTime: 88, defense: 94 },
  yunusobod: { coins: 17640, aiFree: 88, onTime: 85, defense: 92 },
  qoraqamish: { coins: 15980, aiFree: 84, onTime: 82, defense: 89 },
  tinchlik: { coins: 14210, aiFree: 79, onTime: 77, defense: 85 },
};

export const audit = [
  { id: 'A-1', at: iso(0, 9, 12), kind: 'block', studentId: 'sardor', text: 'Sardor Aliev — 94% text overlap with Dilnoza Rahimova. Voice-Print mismatch (41%). Escalated to coordinator.' },
  { id: 'A-2', at: iso(-1, 20, 34), kind: 'flag', studentId: 'javohir', text: 'Javohir Tursunov — AI probability 78%, 4 tutor hints, defense failed. Teacher review requested.' },
  { id: 'A-3', at: iso(-1, 16, 2), kind: 'pass', studentId: 'dilnoza', text: 'Dilnoza Rahimova — 8% AI, Voice-Print 93%, +105 coins pending approval.' },
  { id: 'A-4', at: iso(-2, 15, 41), kind: 'pass', studentId: 'bekzod', text: 'Bekzod Nazarov — approved at 86 after 26-second defense.' },
  { id: 'A-5', at: iso(0, 8, 5), kind: 'system', text: 'Weekly Telegram reports queued for 2 parents · heat-map refresh 11:55.' },
];

export const mentorSessions = new Map();
export const tutorSessions = new Map();
export const telegramLog = [];

export function getStudent(id) {
  return students.find((s) => s.id === id) || null;
}

export function getSet(id) {
  return assignmentSets.find((s) => s.id === id) || null;
}

export function studentAssignment(studentId) {
  const student = getStudent(studentId);
  if (!student) return null;
  const set = currentSet();
  const variant = set.variants[student.variantIndex % set.variants.length];
  const mySubmission = submissions.find((s) => s.studentId === studentId && s.setId === set.id);
  const peersCount = students.filter((s) => s.section === student.section).length;
  return {
    set: { id: set.id, title: set.title, topic: set.topic, subject: set.subject, dueAt: set.dueAt, status: set.status, classDetail: set.classDetail },
    variant: publicVariant(variant),
    submission: mySubmission || null,
    classmates: peersCount,
    uniqueVariantCount: set.variants.length,
  };
}

export function createSubmission({ studentId, setId = 'SET-ACTIVE', text, hintsUsed = 0, secondsSpent = 0 }) {
  const student = getStudent(studentId);
  if (!student) throw new Error('Unknown student');
  const set = getSet(setId);
  if (!set) throw new Error('Unknown assignment set');
  if (submissions.some((s) => s.studentId === studentId && s.setId === setId)) {
    const err = new Error('You have already submitted this assignment. A 30-second voice defense is required to revise.');
    err.status = 409;
    throw err;
  }
  const now = new Date();
  const onTime = now.getTime() <= new Date(set.dueAt).getTime();
  const sub = buildSubmission({ studentId, setId, variantIndex: student.variantIndex, text, submittedAt: now.toISOString(), onTime, hintsUsed, status: 'pending' });
  sub.secondsSpent = secondsSpent;
  sub.coins = rewardItems(sub);
  submissions.push(sub);
  audit.unshift({
    id: `A-${Date.now()}`,
    at: now.toISOString(),
    kind: sub.report.aiProbability >= 45 ? 'flag' : 'pass',
    studentId,
    text: `${student.name} submitted ${sub.variantCode} — ${sub.report.aiProbability}% AI, ${sub.report.metrics.wordCount} words, ${hintsUsed} tutor hints. Pending 30-second voice defense.`,
  });
  return sub;
}

export function addDefense(submissionId, { question, durationS, similarityScore, voiceprint, transcriptQuality = 'clear' }) {
  const sub = submissions.find((s) => s.id === submissionId);
  if (!sub) throw new Error('Unknown submission');
  sub.defense = {
    question: question || sub.defense?.question,
    durationS,
    verdict: similarityScore >= SETTINGS.voiceMatchThreshold ? 'match' : similarityScore >= SETTINGS.voiceMatchThreshold - SETTINGS.voiceReviewBand ? 'review' : 'mismatch',
    similarity: similarityScore ?? null,
    voiceprint: voiceprint || null,
    transcriptQuality,
    at: new Date().toISOString(),
  };
  sub.coins = rewardItems(sub);
  if (sub.defense.voiceprint && sub.defense.voiceprint.verdict === 'mismatch') {
    sub.status = 'flagged';
    audit.unshift({
      id: `A-${Date.now()}-vp`,
      at: new Date().toISOString(),
      kind: 'flag',
      studentId: sub.studentId,
      text: `${sub.studentName} — Voice-Print mismatch (${Math.round((sub.defense.voiceprint.similarity || 0) * 100)}%) on ${sub.variantCode}. Submission held for coordinator review.`,
    });
  }
  return sub;
}

export function approveSubmission(id, { grade, note = '', teacherId = teacher.id } = {}) {
  const sub = submissions.find((s) => s.id === id);
  if (!sub) throw new Error('Unknown submission');
  if (sub.defense && sub.defense.voiceprint && sub.defense.voiceprint.verdict === 'mismatch' && !grade) {
    const err = new Error('Voice-Print mismatch: a grade can still be published, but the authorship flag stays on the record.');
    err.status = 409;
    throw err;
  }
  sub.status = 'approved';
  sub.grade = grade ?? sub.report.grade.total;
  sub.teacherNote = note || sub.teacherNote;
  sub.reviewedAt = new Date().toISOString();
  sub.reviewedBy = teacherId;
  const total = sub.coins.reduce((a, c) => a + c.coins, 0);
  if (total > 0 && !sub.coinsSettled) {
    sub.coinsSettled = true;
    addCoins(sub.studentId, total, `Approved homework · ${sub.setTitle}`);
  }
  audit.unshift({
    id: `A-${Date.now()}-ap`,
    at: new Date().toISOString(),
    kind: 'pass',
    studentId: sub.studentId,
    text: `${sub.studentName} approved at ${sub.grade}/100 by ${teacher.name} (${sub.report.aiProbability}% AI signal, defense ${sub.defense?.verdict || 'missing'}).`,
  });
  return sub;
}

export function flagSubmission(id, { reason, teacherId = teacher.id } = {}) {
  const sub = submissions.find((s) => s.id === id);
  if (!sub) throw new Error('Unknown submission');
  sub.status = 'flagged';
  sub.teacherNote = reason || sub.teacherNote;
  sub.reviewedAt = new Date().toISOString();
  sub.reviewedBy = teacherId;
  if (sub.coinsSettled) {
    const total = sub.coins.reduce((a, c) => a + c.coins, 0);
    addCoins(sub.studentId, -total, `Coins reversed · integrity flag on ${sub.setTitle}`);
    sub.coinsSettled = false;
  }
  audit.unshift({
    id: `A-${Date.now()}-fl`,
    at: new Date().toISOString(),
    kind: 'block',
    studentId: sub.studentId,
    text: `${sub.studentName} flagged by ${teacher.name}: ${reason || 'authorship not verified'}.`,
  });
  return sub;
}

export function addCoins(studentId, amount, reason) {
  const student = getStudent(studentId);
  if (!student) return null;
  student.coins = Math.max(0, student.coins + amount);
  if (amount > 0) student.xp += Math.round(amount * 1.5);
  const entry = { id: `L-${Date.now()}-${Math.floor(Math.random() * 999)}`, studentId, amount, reason, at: new Date().toISOString() };
  ledger.unshift(entry);
  return entry;
}

export function redeemPerk(studentId, perkId) {
  const student = getStudent(studentId);
  const perk = perks.find((p) => p.id === perkId);
  if (!student || !perk) throw new Error('Unknown student or perk');
  if (student.coins < perk.cost) {
    const err = new Error(`Not enough Target Coins — you need ${perk.cost - student.coins} more.`);
    err.status = 400;
    throw err;
  }
  if (perk.stock <= 0) {
    const err = new Error('This perk is out of stock this term.');
    err.status = 400;
    throw err;
  }
  student.coins -= perk.cost;
  perk.stock -= 1;
  const redemption = { id: `R-${Date.now()}`, studentId, perkId, at: new Date().toISOString(), cost: perk.cost, status: 'issued' };
  redemptions.unshift(redemption);
  ledger.unshift({ id: `L-${Date.now()}-r`, studentId, amount: -perk.cost, reason: `Redeemed · ${perk.name}`, at: redemption.at });
  return { redemption, perk, balance: student.coins };
}

export function leaderboard() {
  const branchRows = school.branches.map((b) => {
    const base = branchBases[b.id];
    const live = students.filter((s) => s.branchId === b.id).reduce((a, s) => a + s.coins, 0);
    return {
      id: b.id,
      name: b.name,
      accent: b.accent,
      students: b.students,
      coins: base.coins + live,
      aiFree: base.aiFree,
      onTime: base.onTime,
      defense: base.defense,
    };
  }).sort((a, b) => b.coins - a.coins);

  const classRows = classBoard.map((c) => {
    const live = c.members.map((id) => getStudent(id)?.coins || 0).reduce((a, b) => a + b, 0);
    return {
      id: c.id,
      label: `${c.label} · ${school.branches.find((b) => b.id === c.branchId)?.name}`,
      branchId: c.branchId,
      coins: c.baseCoins + live,
      aiFree: 72 + (c.baseCoins % 17),
      members: c.members.length,
    };
  }).sort((a, b) => b.coins - a.coins);

  const studentRows = students
    .map((s) => ({
      id: s.id,
      name: s.name,
      avatar: s.avatar,
      tone: s.tone,
      branchId: s.branchId,
      branchName: school.branches.find((b) => b.id === s.branchId)?.name,
      className: s.className,
      coins: s.coins,
      xp: s.xp,
      streak: s.streak,
    }))
    .sort((a, b) => b.coins - a.coins);

  return { branches: branchRows, classes: classRows, students: studentRows };
}

export function heatmap() {
  const classes = ['11-A English', '11-B English', '10-A English', '11-A Math', '11-A Business'];
  const weak = [];
  const rows = mastery.map((row) => {
    const cells = classes.map((c) => {
      const value = row.cells[c] ?? null;
      if (value !== null && value < 30) weak.push({ topic: row.topic, subject: row.subject, className: c, mastery: value });
      return { className: c, value };
    });
    const values = cells.map((c) => c.value).filter((v) => v !== null);
    const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
    return { topic: row.topic, subject: row.subject, cells, avg };
  });
  return { classes, rows, weak };
}

export function parentReport(parentId) {
  const parent = parents.find((p) => p.id === parentId);
  if (!parent) throw new Error('Unknown parent');
  const child = getStudent(parent.childId);
  const mine = submissions.filter((s) => s.studentId === child.id);
  const weekAgo = NOW - 7 * DAY;
  const recent = mine.filter((s) => new Date(s.submittedAt).getTime() >= weekAgo);
  const graded = mine.filter((s) => s.status === 'approved');
  const aiFree = mine.length ? Math.round((mine.filter((s) => s.report.aiProbability <= SETTINGS.aiFreeThreshold).length / mine.length) * 100) : 0;
  const onTime = mine.length ? Math.round((mine.filter((s) => s.onTime).length / mine.length) * 100) : 0;
  const defense = mine.filter((s) => s.defense).length
    ? Math.round((mine.filter((s) => s.defense?.verdict === 'match').length / mine.filter((s) => s.defense).length) * 100)
    : 0;
  const avgGrade = graded.length ? Math.round(graded.reduce((a, s) => a + (s.grade || 0), 0) / graded.length) : null;
  const pending = mine.find((s) => s.status === 'pending' && !s.defense);
  return {
    parent,
    child: { id: child.id, name: child.name, branchId: child.branchId, className: child.className, coins: child.coins, streak: child.streak, xp: child.xp },
    stats: { aiFree, onTime, defense, avgGrade, submissions: mine.length, graded: graded.length, recent: recent.length },
    pending: pending || null,
    weakTopics: heatmap().weak.filter((w) => w.className === child.section),
    message: buildTelegramMessage(parent, child, { aiFree, onTime, defense, avgGrade, pending, recent }),
  };
}

function buildTelegramMessage(parent, child, s) {
  const lines = [];
  lines.push(`🎯 *Target International School* — weekly integrity report`);
  lines.push(`Student: *${child.name}* · ${child.className} · ${school.branches.find((b) => b.id === child.branchId)?.name} branch`);
  lines.push('');
  lines.push(`✅ On-time submissions: *${s.onTime}%*`);
  lines.push(`🤖 AI-free work: *${s.aiFree}%*`);
  lines.push(`🎙 Voice-defense pass rate: *${s.defense}%*`);
  if (s.avgGrade !== null) lines.push(`📘 Approved average: *${s.avgGrade}/100*`);
  lines.push(`🪙 Target Coins balance: *${child.coins}* (streak ${child.streak} days)`);
  lines.push('');
  if (s.pending) {
    lines.push(`⚠️ Action needed tonight: the 30-second voice defense for “${s.pending.setTitle}” is still missing. The written part is saved.`);
  } else {
    lines.push(`🎉 No outstanding integrity checks this week.`);
  }
  lines.push('');
  lines.push(`How to help: ask ${child.firstName || child.name.split(' ')[0]} to explain one paragraph out loud in 30 seconds — that is exactly what the school checks.`);
  lines.push('');
  lines.push(`_This message is generated automatically every Sunday 18:00 and reviewed by the Academic Integrity Lead._`);
  return lines.join('\n');
}

export function overviewStats() {
  const pending = submissions.filter((s) => s.status === 'pending');
  const flagged = submissions.filter((s) => s.status === 'flagged');
  const avgAi = submissions.length
    ? Math.round(submissions.reduce((a, s) => a + s.report.aiProbability, 0) / submissions.length)
    : 0;
  const defenseRate = submissions.filter((s) => s.defense).length
    ? Math.round((submissions.filter((s) => s.defense?.verdict === 'match').length / submissions.filter((s) => s.defense).length) * 100)
    : 0;
  return {
    pending: pending.length,
    flagged: flagged.length,
    totalSubmissions: submissions.length,
    avgAi,
    defenseRate,
    coinsThisWeek: ledger.filter((l) => l.amount > 0).reduce((a, l) => a + l.amount, 0),
    studentsTracked: students.length,
    variants: currentSet().variants.length,
    weakTopics: heatmap().weak.length,
    audit: audit.slice(0, 8),
  };
}

export function studentDashboard(studentId) {
  const student = getStudent(studentId);
  if (!student) throw new Error('Unknown student');
  const mine = submissions
    .filter((s) => s.studentId === studentId)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  const myLedger = ledger.filter((l) => l.studentId === studentId).slice(0, 8);
  const board = leaderboard();
  const myRank = board.students.findIndex((s) => s.id === studentId) + 1;
  const assignment = studentAssignment(studentId);
  return {
    student: { ...student, voiceprintEnrolled: !!student.voiceprint },
    assignment,
    submissions: mine,
    ledger: myLedger,
    rank: myRank,
    cohort: board.students.length,
    rankClass: board.classes.findIndex((c) => c.id.includes(student.className) && c.branchId === student.branchId) + 1,
    perks,
    redemptions: redemptions.filter((r) => r.studentId === studentId),
    settings: { aiFreeThreshold: SETTINGS.aiFreeThreshold, defenseSeconds: SETTINGS.defenseSeconds, enrollmentSeconds: SETTINGS.enrollmentSeconds, voiceMatchThreshold: SETTINGS.voiceMatchThreshold },
  };
}

// Make the seeded audit trail quote the real overlap figure.
// Make the seeded audit trail quote the real overlap figure.
const sardorSub = submissions.find((s) => s.studentId === 'sardor');
const dilnozaSub = submissions.find((s) => s.studentId === 'dilnoza');
if (sardorSub && dilnozaSub) {
  const overlap = Math.round(similarity(sardorSub.text, dilnozaSub.text) * 100);
  const a1 = audit.find((a) => a.id === 'A-1');
  if (a1) a1.text = `Sardor Aliev — ${overlap}% 6-gram overlap with Dilnoza Rahimova. Scenario trap failed, Voice-Print mismatch (41%). Escalated to coordinator.`;
}
