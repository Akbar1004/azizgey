/**
 * Generates src/offline/snapshot.json — a frozen, read-only copy of the demo
 * school used by the "Continue in offline mode" fallback when the API cannot be
 * reached. Detection keys and watermarks are stripped so the snapshot is safe to
 * ship in the client bundle.
 *
 * Usage: npm run snapshot
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bootstrapPayload, teacherOverviewPayload, setsPayload, rewardsPayload,
  promptsPayload, studentsPayload, parentReportsPayload,
} from '../server/payloads.js';
import { students, parents, assignmentSets, audit, leaderboard, heatmap } from '../server/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.resolve(__dirname, '../src/offline/snapshot.json');

const activeSet = assignmentSets.filter((s) => s.status === 'active').slice(-1);

const snapshot = {
  __meta: {
    version: 1,
    capturedAt: new Date().toISOString(),
    note: 'Frozen read-only demo snapshot. Actions are disabled until the API reconnects.',
    schoolDays: 'pilot cohort · Term 2 · Week 12',
  },
  bootstrap: bootstrapPayload('aziz'),
  students: studentsPayload(),
  teacherOverview: teacherOverviewPayload(),
  leaderboard: leaderboard(),
  heatmap: heatmap(),
  parents: parents.map((p) => ({ id: p.id, name: p.name, childId: p.childId, childName: p.childName, telegram: p.telegram })),
  parentReports: parentReportsPayload(),
  prompts: promptsPayload(),
  rewards: Object.fromEntries(students.map((s) => [s.id, rewardsPayload(s.id)])),
  sets: { ...setsPayload({ includeKeys: false }), sets: setsPayload({ includeKeys: false }).sets.filter((s) => activeSet.some((a) => a.id === s.id)) },
  audit: audit.slice(0, 40),
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(snapshot));
const kb = (fs.statSync(outFile).size / 1024).toFixed(1);
console.log(`Wrote ${path.relative(process.cwd(), outFile)} (${kb} KB)`);
console.log(`  students=${Object.keys(snapshot.students).length} submissions=${snapshot.teacherOverview.queue.length} parents=${snapshot.parents.length}`);
