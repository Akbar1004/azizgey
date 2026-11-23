import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  school, teacher, students, parents, perks, submissions, assignmentSets, ledger, redemptions,
  SETTINGS, currentSet, getStudent, getSet, studentAssignment, createSubmission, addDefense,
  approveSubmission, flagSubmission, addCoins, redeemPerk, leaderboard, heatmap, parentReport,
  overviewStats, studentDashboard, audit, telegramLog, mentorSessions,
} from './store.js';
import { generateVariants, publicVariant } from './generator.js';
import { analyzeText, similarity } from './detector.js';
import { tutorTurn, tutorLog } from './socratic.js';
import { mentorTurn, mentorState } from './mentor.js';
import { compareVoiceprints, MATCH_THRESHOLD } from './voiceprint.js';
import { MASTER_SYSTEM_PROMPT, ASSIGNMENT_GENERATOR_PROMPT, REALTIME_VOICE_PROMPT, REALTIME_SESSION_CONFIG, REAL_ADAPTER_NOTE } from './prompts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const app = express();
app.use(express.json({ limit: '8mb' }));

app.disable('x-powered-by');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ------------------------------------------------------------------ meta */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, module: 'integrity-os', provider: SETTINGS.modelProvider, uptime: Math.round(process.uptime()) });
});

app.get('/api/bootstrap', (req, res) => {
  const studentId = req.query.studentId || 'aziz';
  const student = getStudent(studentId);
  res.json({
    school,
    teacher,
    settings: SETTINGS,
    viewer: student ? { id: student.id, name: student.name, role: 'student', avatar: student.avatar, coins: student.coins } : null,
    roster: students.map((s) => ({ id: s.id, name: s.name, avatar: s.avatar, tone: s.tone, branchId: s.branchId, className: s.className, section: s.section, coins: s.coins })),
    parents: parents.map((p) => ({ id: p.id, name: p.name, childId: p.childId, childName: p.childName, telegram: p.telegram })),
    set: (() => { const s = currentSet(); return { id: s.id, title: s.title, topic: s.topic, dueAt: s.dueAt, status: s.status, variantCount: s.variants.length }; })(),
    stats: overviewStats(),
  });
});

/* ------------------------------------------------------------------ teacher */
app.get('/api/teacher/overview', (_req, res) => {
  res.json({
    stats: overviewStats(),
    heatmap: heatmap(),
    leaderboard: leaderboard(),
    queue: submissions.slice().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)),
    sets: assignmentSets.map((s) => ({ id: s.id, title: s.title, dueAt: s.dueAt, status: s.status, variants: s.variants.length, lessonDate: s.lessonDate })),
    teacher,
    audit: audit.slice(0, 12),
  });
});

app.get('/api/teacher/submissions', (req, res) => {
  const status = req.query.status;
  const rows = submissions
    .filter((s) => !status || status === 'all' || s.status === status)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json({ rows });
});

app.get('/api/teacher/submissions/:id', (req, res) => {
  const sub = submissions.find((s) => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submission not found' });
  const set = getSet(sub.setId);
  const variant = set?.variants.find((v) => v.code === sub.variantCode);
  res.json({ submission: sub, variant, tutorLog: tutorLog(sub.studentId), peers: submissions.filter((s) => s.setId === sub.setId && s.studentId !== sub.studentId).map((s) => ({ id: s.id, name: s.studentName, similarity: similarity(sub.text, s.text) })) });
});

app.post('/api/teacher/submissions/:id/approve', (req, res) => {
  const sub = approveSubmission(req.params.id, { grade: req.body.grade, note: req.body.note });
  res.json({ submission: sub, student: getStudent(sub.studentId) });
});

app.post('/api/teacher/submissions/:id/flag', (req, res) => {
  const sub = flagSubmission(req.params.id, { reason: req.body.reason });
  res.json({ submission: sub, student: getStudent(sub.studentId) });
});

app.get('/api/teacher/heatmap', (_req, res) => res.json(heatmap()));

app.get('/api/teacher/sets', (_req, res) => {
  res.json({
    sets: assignmentSets.map((s) => ({
      ...s,
      variants: s.variants.map((v) => v),
    })),
    activeId: currentSet().id,
  });
});

app.post('/api/teacher/generate', (req, res) => {
  const { subject, grade, topic, classDetail } = req.body || {};
  if (!topic || !String(topic).trim()) return res.status(400).json({ error: 'A lesson topic is required.' });
  const variants = generateVariants({ subject, grade, topic, classDetail, lessonDate: new Date().toISOString().slice(0, 10) });
  res.json({ variants, generatedAt: new Date().toISOString(), seed: { subject, grade, topic, classDetail } });
});

app.post('/api/teacher/publish', (req, res) => {
  const { subject, grade, topic, classDetail, dueInDays = 1 } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'A lesson topic is required to publish.' });
  assignmentSets.forEach((s) => { if (s.status === 'active') s.status = 'locked'; });
  const variants = generateVariants({ subject, grade, topic, classDetail, lessonDate: new Date().toISOString().slice(0, 10) });
  const set = {
    id: `SET-${Date.now()}`,
    title: topic,
    subject,
    grade,
    topic,
    classDetail,
    lessonDate: new Date().toISOString().slice(0, 10),
    dueAt: new Date(Date.now() + dueInDays * 86400000).toISOString(),
    status: 'active',
    createdBy: teacher.id,
    variants,
  };
  assignmentSets.push(set);
  audit.unshift({
    id: `A-${Date.now()}-pub`,
    at: new Date().toISOString(),
    kind: 'system',
    text: `${teacher.name} published “${topic}” — ${variants.length} unique variants assigned across ${new Set(students.map((s) => s.section)).size} sections.`,
  });
  res.json({ set, activeId: set.id });
});

/* ------------------------------------------------------------------ student */
app.get('/api/student/:id', (req, res) => {
  try {
    res.json(studentDashboard(req.params.id));
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

app.post('/api/student/:id/analyze', (req, res) => {
  const { text = '', setId } = req.body || {};
  const student = getStudent(req.params.id);
  if (!student) return res.status(404).json({ error: 'Unknown student' });
  const set = setId ? getSet(setId) : currentSet();
  const variant = set.variants[student.variantIndex % set.variants.length];
  if (!text.trim()) return res.json({ empty: true });
  const report = analyzeText(text, variant);
  const existing = submissions.find((s) => s.studentId === student.id && s.setId === set.id);
  res.json({
    report,
    gate: {
      aiFree: report.aiProbability <= SETTINGS.aiFreeThreshold,
      trapsPassed: report.traps.filter((t) => t.pass).length,
      trapsTotal: report.traps.length,
      eligibleForCoins: report.aiProbability <= SETTINGS.aiFreeThreshold && report.traps.every((t) => t.pass),
      alreadySubmitted: existing ? existing.id : null,
    },
    budgetMs: SETTINGS.processingBudgetMs,
  });
});

app.post('/api/tutor', (req, res) => {
  const { studentId = 'aziz', variantCode, message = '', history = [], questionIndex = 0 } = req.body || {};
  const student = getStudent(studentId);
  if (!student) return res.status(404).json({ error: 'Unknown student' });
  const set = currentSet();
  const variant = set.variants.find((v) => v.code === variantCode) || set.variants[student.variantIndex % set.variants.length];
  res.json(tutorTurn({ studentId, variant, message, history, questionIndex }));
});

app.post('/api/submissions', (req, res) => {
  const { studentId = 'aziz', text = '', hintsUsed = 0, secondsSpent = 0 } = req.body || {};
  if (!text.trim() || text.trim().split(/\s+/).length < 25) {
    return res.status(400).json({ error: 'Write at least 25 words before submitting — the voice defense needs something to defend.' });
  }
  try {
    const sub = createSubmission({ studentId, text, hintsUsed, secondsSpent });
    res.json({ submission: sub, reward: sub.coins, student: getStudent(studentId) });
  } catch (e) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

app.get('/api/submissions/:id/defense-question', (req, res) => {
  const sub = submissions.find((s) => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submission not found' });
  const paragraphs = sub.text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.split(/\s+/).length > 12);
  const sentences = sub.text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length > 8);
  const target = paragraphs[Math.min(1, paragraphs.length - 1)] || sentences[0] || sub.text.slice(0, 140);
  const snippet = target.length > 170 ? target.slice(0, 170).trim() + '…' : target;
  const templates = [
    `In your own paragraph you wrote: “${snippet}” — without reading it back, explain why you chose that specific detail instead of a more obvious one.`,
    `You wrote: “${snippet}” — what would you change if your teacher said this paragraph proved nothing?`,
    `Focus on this line of yours: “${snippet}” — what were you trying to make the reader feel, and which word does that job?`,
    `You wrote: “${snippet}” — if a classmate disagreed with this sentence, what would their best objection be?`,
  ];
  const question = templates[(sub.text.length + sub.id.length) % templates.length];
  res.json({
    question,
    seconds: SETTINGS.defenseSeconds,
    snippet,
    needsEnrollment: !getStudent(sub.studentId)?.voiceprint,
    voiceprintThreshold: MATCH_THRESHOLD,
    baseline: getStudent(sub.studentId)?.voiceprint ? 'enrolled' : 'missing',
  });
});

app.post('/api/submissions/:id/defense', (req, res) => {
  const sub = submissions.find((s) => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submission not found' });
  const student = getStudent(sub.studentId);
  const { fingerprint, durationS = 0, transcriptQuality = 'clear', question, simulated = false } = req.body || {};
  if (!fingerprint) return res.status(400).json({ error: 'No acoustic fingerprint supplied.' });
  if (!student.voiceprint) {
    return res.status(409).json({
      error: 'Voice-Print baseline missing. Enrol in a 12-second Mentor session before the 30-second defense.',
      needsEnrollment: true,
    });
  }
  const vp = compareVoiceprints(student.voiceprint, fingerprint, SETTINGS.voiceMatchThreshold);
  const updated = addDefense(sub.id, {
    question,
    durationS: Number(durationS) || 0,
    similarityScore: vp.similarity,
    voiceprint: { ...vp, simulated },
    transcriptQuality,
  });
  res.json({ submission: updated, voiceprint: vp, simulated, seconds: SETTINGS.defenseSeconds, student });
});

/* ------------------------------------------------------------------ voiceprint */
app.post('/api/voiceprint/enroll', (req, res) => {
  const { studentId, fingerprint, simulated = false } = req.body || {};
  const student = getStudent(studentId);
  if (!student) return res.status(404).json({ error: 'Unknown student' });
  if (!fingerprint || !Array.isArray(fingerprint.bands) || fingerprint.bands.length < 8) {
    return res.status(400).json({ error: 'Fingerprint too weak. Record at least 10 seconds of continuous speech.' });
  }
  const seconds = Number(fingerprint.durationS) || 0;
  if (seconds < 6) return res.status(400).json({ error: `Only ${Math.round(seconds)}s captured. Speak for at least 10 seconds.` });
  const firstTime = !student.voiceprint;
  student.voiceprint = {
    bands: fingerprint.bands.slice(0, 24),
    pitch: Number(fingerprint.pitch) || 0,
    zcr: Number(fingerprint.zcr) || 0,
    durationS: seconds,
    enrolledAt: new Date().toISOString(),
    quality: Number(fingerprint.quality) || 0.8,
    simulated: !!simulated,
  };
  let coins = 0;
  if (firstTime) {
    addCoins(studentId, 25, 'Voice-Print enrolment bonus');
    coins = 25;
  }
  res.json({ student: { ...student, coins: student.coins }, voiceprintEnrolled: true, coins, firstTime, simulated });
});

app.post('/api/voiceprint/compare', (req, res) => {
  const { studentId, fingerprint } = req.body || {};
  const student = getStudent(studentId);
  if (!student) return res.status(404).json({ error: 'Unknown student' });
  if (!student.voiceprint) return res.status(409).json({ error: 'No baseline yet', needsEnrollment: true });
  res.json({ voiceprint: compareVoiceprints(student.voiceprint, fingerprint, SETTINGS.voiceMatchThreshold), threshold: SETTINGS.voiceMatchThreshold });
});

/* ------------------------------------------------------------------ mentor */
app.get('/api/mentor/state', (req, res) => {
  res.json(mentorState(req.query.studentId || 'aziz'));
});

app.post('/api/mentor/turn', (req, res) => {
  const { studentId = 'aziz', text = '', interrupted = false, event = null } = req.body || {};
  const student = getStudent(studentId);
  if (!student) return res.status(404).json({ error: 'Unknown student' });
  res.json(mentorTurn({ studentId, text, interrupted, event }));
});

app.post('/api/mentor/end', (req, res) => {
  const { studentId = 'aziz' } = req.body || {};
  const st = mentorSessions.get(studentId);
  res.json({ summary: mentorState(studentId), sessionClosed: !!st });
});

/* ------------------------------------------------------------------ rewards */
app.get('/api/leaderboard', (_req, res) => res.json(leaderboard()));

app.get('/api/rewards/:studentId', (req, res) => {
  const student = getStudent(req.params.studentId);
  if (!student) return res.status(404).json({ error: 'Unknown student' });
  res.json({
    student,
    perks,
    redemptions: redemptions.filter((r) => r.studentId === student.id),
    ledger: ledger.filter((l) => l.studentId === student.id).slice(0, 20),
  });
});

app.post('/api/rewards/redeem', (req, res) => {
  const { studentId = 'aziz', perkId } = req.body || {};
  try {
    const out = redeemPerk(studentId, perkId);
    res.json({ ...out, student: getStudent(studentId) });
  } catch (e) {
    res.status(e.status || 400).json({ error: e.message, student: getStudent(studentId) });
  }
});

/* ------------------------------------------------------------------ parents */
app.get('/api/parents', (_req, res) => res.json({ parents }));
app.get('/api/parents/:id/report', (req, res) => {
  try {
    res.json(parentReport(req.params.id));
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});
app.post('/api/parents/:id/send', (req, res) => {
  try {
    const report = parentReport(req.params.id);
    const entry = { id: `TG-${Date.now()}`, parentId: req.params.id, at: new Date().toISOString(), status: 'delivered', preview: report.message.slice(0, 120) };
    telegramLog.unshift(entry);
    audit.unshift({ id: `A-${Date.now()}-tg`, at: entry.at, kind: 'system', text: `Weekly report delivered to ${report.parent.name} via Telegram (${report.parent.telegram}).` });
    res.json({ delivery: entry, report });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});
app.get('/api/parents/telegram-log', (_req, res) => res.json({ log: telegramLog }));

/* ------------------------------------------------------------------ prompts */
app.get('/api/prompts', (_req, res) => {
  res.json({
    master: MASTER_SYSTEM_PROMPT,
    assignment: ASSIGNMENT_GENERATOR_PROMPT,
    realtime: REALTIME_VOICE_PROMPT,
    sessionConfig: REALTIME_SESSION_CONFIG,
    adapterNote: REAL_ADAPTER_NOTE,
    provider: SETTINGS.modelProvider,
    demoMode: SETTINGS.demoMode,
  });
});

app.get('/api/audit', (_req, res) => res.json({ audit: audit.slice(0, 40) }));

/* ------------------------------------------------------------------ frontend */
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  const dist = path.resolve(__dirname, '../dist');
  app.use(express.static(dist, { index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false, host: '0.0.0.0', allowedHosts: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.use((err, _req, res, _next) => {
  console.error('[api]', err);
  res.status(err.status || 500).json({ error: err.message || 'Unexpected server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`◈ Target Integrity OS · http://0.0.0.0:${PORT} · provider=${SETTINGS.modelProvider}`);
});
