import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SETTINGS, currentSet, getStudent, createSubmission, addDefense, approveSubmission,
  flagSubmission, redeemPerk, leaderboard, heatmap, parentReport, studentDashboard,
  addCoins, students,
} from './store.js';
import { generateVariants } from './generator.js';
import { analyzeText } from './detector.js';
import { tutorTurn, tutorLog } from './socratic.js';
import { mentorTurn, mentorState } from './mentor.js';
import { compareVoiceprints, MATCH_THRESHOLD } from './voiceprint.js';
import {
  healthPayload, bootstrapPayload, teacherOverviewPayload, teacherSubmissionPayload,
  setsPayload, rewardsPayload, promptsPayload,
} from './payloads.js';
import { parents, submissions, assignmentSets, audit, telegramLog, teacher } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));

/**
 * CORS + cache policy.
 * The preview proxy and any separate frontend origin are allowed; credentials are
 * not used, so reflecting the Origin (with Vary) is safe and keeps a LAN demo working.
 * API responses are never cached, so a stale "server unreachable" cannot survive a retry.
 */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.path.startsWith('/api') || req.path === '/health') res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ------------------------------------------------------------------ health */
const health = (_req, res) => res.json(healthPayload());
app.get('/health', health);
app.get('/api/health', health);

/* ------------------------------------------------------------------ meta */
app.get('/api/bootstrap', (req, res) => {
  res.json(bootstrapPayload(req.query.studentId || 'aziz'));
});

/* ------------------------------------------------------------------ teacher */
app.get('/api/teacher/overview', (_req, res) => {
  res.json(teacherOverviewPayload());
});

app.get('/api/teacher/submissions', (req, res) => {
  const status = req.query.status;
  const rows = submissions
    .filter((s) => !status || status === 'all' || s.status === status)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json({ rows });
});

app.get('/api/teacher/submissions/:id', (req, res) => {
  const payload = teacherSubmissionPayload(req.params.id);
  if (!payload) return res.status(404).json({ error: `Submission ${req.params.id} not found.` });
  res.json(payload);
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
app.get('/api/teacher/sets', (_req, res) => res.json(setsPayload({ includeKeys: true })));

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
    text: `${teacher.name} published “${topic}” — ${variants.length} unique variants assigned across ${new Set(students.map((st) => st.section)).size} sections.`,
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
  const set = setId ? assignmentSets.find((s) => s.id === setId) : currentSet();
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
  if (!sub) return res.status(404).json({ error: `Submission ${req.params.id} not found.` });
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
  if (!sub) return res.status(404).json({ error: `Submission ${req.params.id} not found.` });
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
  res.json({ summary: mentorState(studentId), sessionClosed: true });
});

/* ------------------------------------------------------------------ rewards */
app.get('/api/leaderboard', (_req, res) => res.json(leaderboard()));

app.get('/api/rewards/:studentId', (req, res) => {
  const payload = rewardsPayload(req.params.studentId);
  if (!payload) return res.status(404).json({ error: 'Unknown student' });
  res.json(payload);
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
app.get('/api/parents/telegram-log', (_req, res) => res.json({ log: telegramLog }));
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

/* ------------------------------------------------------------------ prompts */
app.get('/api/prompts', (_req, res) => res.json(promptsPayload()));

app.get('/api/audit', (_req, res) => res.json({ audit: audit.slice(0, 40) }));

/* ------------------------------------------------------------------ fallbacks */
// Explicit JSON 404 for the API so a typo'd route never returns the SPA HTML
// (which the client would treat as a malformed response).
app.use('/api', (req, res) => {
  res.status(404).json({
    error: `No API route for ${req.method} ${req.originalUrl}`,
    hint: 'Check server/index.js. GET /health reports server status.',
  });
});

const isProd = process.env.NODE_ENV === 'production';
const dist = path.resolve(__dirname, '../dist');
const hasBuild = fs.existsSync(path.join(dist, 'index.html'));

if (isProd && hasBuild) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  if (isProd) {
    console.warn('[boot] dist/index.html is missing — falling back to the Vite middleware so the app still loads.');
    console.warn('[boot] Run `npm run build` for the optimised production bundle.');
  }
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false, host: '0.0.0.0', allowedHosts: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.use((err, req, res, _next) => {
  console.error('[api]', req.method, req.originalUrl, err);
  res.status(err.status || 500).json({
    error: err.message || 'Unexpected server error',
    path: req.originalUrl,
    kind: 'server-error',
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`◈ Target Integrity OS · http://0.0.0.0:${PORT}`);
  console.log(`  health  GET /health · provider=${SETTINGS.modelProvider} · static=${isProd && hasBuild ? 'dist' : 'vite'}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`\n[boot] ${signal} received — closing server`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}

