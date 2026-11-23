/**
 * Endpoint payload builders.
 * Kept separate from the HTTP layer so the offline snapshot generator
 * (scripts/build-offline-snapshot.mjs) produces byte-identical shapes to the
 * live API. One source of truth, no drift between online and fallback data.
 */
import {
  school, teacher, students, parents, SETTINGS, currentSet, getStudent, getSet,
  studentDashboard, submissions, assignmentSets, ledger, redemptions, perks,
  overviewStats, heatmap, leaderboard, parentReport, audit, mentorSessions,
} from './store.js';
import { publicVariant } from './generator.js';
import { similarity } from './detector.js';
import { tutorLog } from './socratic.js';
import {
  MASTER_SYSTEM_PROMPT, ASSIGNMENT_GENERATOR_PROMPT, REALTIME_VOICE_PROMPT,
  REALTIME_SESSION_CONFIG, REAL_ADAPTER_NOTE,
} from './prompts.js';

export function healthPayload() {
  return {
    ok: true,
    module: 'integrity-os',
    version: '1.0.0',
    provider: SETTINGS.modelProvider,
    demoMode: SETTINGS.demoMode,
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    counts: {
      students: students.length,
      assignments: assignmentSets.length,
      submissions: submissions.length,
      pending: submissions.filter((s) => s.status === 'pending').length,
      mentorSessions: mentorSessions.size,
    },
  };
}

export function bootstrapPayload(studentId = 'aziz') {
  const student = getStudent(studentId);
  const set = currentSet();
  return {
    school,
    teacher,
    settings: SETTINGS,
    viewer: student ? { id: student.id, name: student.name, role: 'student', avatar: student.avatar, coins: student.coins } : null,
    roster: students.map((s) => ({ id: s.id, name: s.name, avatar: s.avatar, tone: s.tone, branchId: s.branchId, className: s.className, section: s.section, coins: s.coins })),
    parents: parents.map((p) => ({ id: p.id, name: p.name, childId: p.childId, childName: p.childName, telegram: p.telegram })),
    set: { id: set.id, title: set.title, topic: set.topic, dueAt: set.dueAt, status: set.status, variantCount: set.variants.length },
    stats: overviewStats(),
  };
}

export function teacherOverviewPayload() {
  return {
    stats: overviewStats(),
    heatmap: heatmap(),
    leaderboard: leaderboard(),
    queue: submissions.slice().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)),
    sets: assignmentSets.map((s) => ({ id: s.id, title: s.title, dueAt: s.dueAt, status: s.status, variants: s.variants.length, lessonDate: s.lessonDate })),
    teacher,
    audit: audit.slice(0, 12),
  };
}

export function teacherSubmissionPayload(id) {
  const sub = submissions.find((s) => s.id === id);
  if (!sub) return null;
  const set = getSet(sub.setId);
  const variant = set?.variants.find((v) => v.code === sub.variantCode);
  return {
    submission: sub,
    variant,
    tutorLog: tutorLog(sub.studentId),
    peers: submissions
      .filter((s) => s.setId === sub.setId && s.studentId !== sub.studentId)
      .map((s) => ({ id: s.id, name: s.studentName, similarity: similarity(sub.text, s.text) })),
  };
}

export function setsPayload({ includeKeys = true } = {}) {
  return {
    sets: assignmentSets.map((s) => ({
      ...s,
      variants: s.variants.map((v) => (includeKeys ? v : publicVariant(v))),
    })),
    activeId: currentSet().id,
  };
}

export function rewardsPayload(studentId) {
  const student = getStudent(studentId);
  if (!student) return null;
  return {
    student,
    perks,
    redemptions: redemptions.filter((r) => r.studentId === student.id),
    ledger: ledger.filter((l) => l.studentId === student.id).slice(0, 20),
  };
}

export function promptsPayload() {
  return {
    master: MASTER_SYSTEM_PROMPT,
    assignment: ASSIGNMENT_GENERATOR_PROMPT,
    realtime: REALTIME_VOICE_PROMPT,
    sessionConfig: REALTIME_SESSION_CONFIG,
    adapterNote: REAL_ADAPTER_NOTE,
    provider: SETTINGS.modelProvider,
    demoMode: SETTINGS.demoMode,
  };
}

export function studentsPayload() {
  return Object.fromEntries(students.map((s) => [s.id, studentDashboard(s.id)]));
}

export function parentReportsPayload() {
  return Object.fromEntries(parents.map((p) => [p.id, parentReport(p.id)]));
}
