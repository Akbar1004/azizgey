# Target Integrity OS

A working prototype of **Target International School's** all-in-one academic-integrity and
engagement ecosystem: randomised homework with embedded AI traps, automated teacher
pre-grading, a Socratic-only tutor, Target Coins and branch leaderboards, parent analytics,
30-second voice defense with voice-print matching, and a barge-in "Angry Mentor" voice
persona.

Everything runs locally with **no API keys** — the six modules are wired to a deterministic
engine and a live in-memory school, so every button changes real state. The realtime voice
layer is implemented with the browser's speech synthesis + dictation APIs and is structured
to be swapped for OpenAI Realtime / Vapi / LiveKit (see [Configuration](#configuration)).

```bash
npm install
npm run dev          # http://localhost:3000  (single port: Vite + API)
# or
npm run build && npm start
```

Node 22+ recommended. If the checkout has no `node_modules` yet (fresh clone, container
restart), run `npm ci` first — `npm start` alone will not install anything.

```bash
curl localhost:3000/health     # {"ok":true,...}
npm run snapshot               # refresh the offline fallback snapshot
```

---

## What is real, and what is simulated

Being precise matters more than being impressive, especially in an anti-cheating product.

| Area | In this prototype | In production |
| --- | --- | --- |
| AI-probability score | Explainable heuristic (12 weighted signals: generic phrasing, sentence rhythm, local grounding, formatting, punctuation polish, trap compliance…) | Same signal set + a model classifier, both surfaced to the teacher |
| Rubric grade | Deterministic rubric over depth, grounding, structure, mechanics | Same, with teacher override always available |
| Peer plagiarism | 6-word shingle Jaccard across submissions in the same assignment set | Scaled corpus index + web search |
| Socratic tutor | Server-enforced policy engine (refuses direct answers, 7-level hint ladder, log attached to submission) | LLM with the same policy contract and tool-side refusal guard |
| Voice defense | Real 30-second recording, real on-device acoustic fingerprint | Same + Whisper transcript and semantic check against the paragraph |
| Voice-print | Real on-device fingerprint (24 log-band energies + median pitch + ZCR), cosine + pitch comparison, threshold 0.80 | Speaker-embedding model (e.g. ECAPA-TDNN) behind a KMS vault |
| Angry Mentor | Local persona engine (intents, roasts, barge-in acks, 5-second quizzes), browser TTS and dictation | OpenAI Realtime / Vapi / LiveKit with semantic VAD, `interrupt_response: true` |
| Coins, approvals, reports | Real ledger, real state transitions, real Telegram message generation + delivery log | Postgres + job queue + Telegram Bot API |

No raw audio ever leaves the browser: only a 24-number vector is posted. See
[`server/voiceprint.js`](server/voiceprint.js).

---

## The six modules, and where they live

| # | Module | UI | Server |
| --- | --- | --- | --- |
| 1 | Teacher AI-assistant: 10 unique variants, pre-grading, one-click approval | `src/views/Studio.jsx`, `src/views/TeacherQueue.jsx` | `server/generator.js`, `server/detector.js` |
| 2 | Smart Tutor: Socratic only, hints logged | `src/views/Homework.jsx` (tutor panel) | `server/socratic.js` |
| 3 | Gamification: Target Coins, branch/class leaderboards, perks | `src/views/Rewards.jsx`, `src/views/Leaderboard.jsx` | `server/store.js` (`rewardItems`, `leaderboard`, `redeemPerk`) |
| 4 | Parent + leadership analytics: Telegram reports, weak-topic heat-map | `src/views/Parents.jsx`, `src/views/Analytics.jsx` | `server/store.js` (`parentReport`, `heatmap`) |
| 5 | Audio defense, plagiarism, Voice-Print consistency | `src/views/Homework.jsx` (defense panel), queue drawer | `server/voiceprint.js`, `server/detector.js` (`similarity`) |
| 6 | Angry Mentor with live barge-in, code-switching, mini-quizzes | `src/views/Mentor.jsx` | `server/mentor.js` |
| — | Master prompts + realtime session config | `src/views/Prompts.jsx` | `server/prompts.js` |

### 1. Teacher AI-assistant
`POST /api/teacher/generate` returns **10 variants** of one topic. Each variant gets its own
Tashkent scenario (Chorsu Bazaar, Kosmonavtlar metro, a Yandex ride on Amir Temur Avenue…),
role, banned-phrase list, structural rule, word range, voice-defense prompt and hidden
**AI-detection key**. Codes are unique per student (`TRG-11-ENG-S98G`), so a paste carries
its origin. Publishing replaces the active set and assigns a different variant to every
student.

`POST /api/submissions` returns in milliseconds (budget: 10 s):

* AI probability + band (`original` / `mixed` / `suspicious` / `likely-ai`)
* Every weighted signal, plus authorship counter-signals
* Embedded-trap compliance (scenario, classroom detail, banned phrases, structure, length)
* Specific grammar / logic / integrity issues
* Suggested grade with a 4-criteria rubric breakdown
* Peer overlap (6-word shingles) with the closest classmate

The teacher approves, adjusts the grade, or escalates in one click. Escalation reverses any
coins that had been queued.

### 2. Smart Tutor
Direct-answer requests ("just give me the answer", "yozib ber") are refused by design in
`server/socratic.js` — including Uzbek patterns. The tutor quotes the student's own sentence
back, then climbs a 7-level hint ladder. Every hint is stored in the submission metadata and
shown to the teacher; three or more hints re-targets the voice-defense question at the
assisted paragraph.

### 3. Gamification
Coins are issued only for verified work: on-time (+40), AI-free under 20% (+30), voice
defense passed (+25), Voice-Print matched (+10), no tutor hints (+10); mentor quizzes add
12–18. Coins settle on teacher approval and reverse on a flag. Leaderboards exist at branch,
class and student level across **Sergeli, Yunusobod, Qoraqamish, Tinchlik**; perks include
late-pass coupons, the Target hoodie, Spelling Bee / Zakovat priority, canteen vouchers and
library passes.

### 4. Parent & leadership analytics
`GET /api/parents/:id/report` builds the exact Telegram message (Markdown), including on-time
and AI-free rates, defense pass rate, coins, the outstanding action and one concrete thing a
parent can do tonight. Sending appends to an audited delivery log. The heat-map flags any
topic/class cell below 30% mastery and queues it for an intervention assignment.

### 5. Audio defense + Voice-Print
On submit, the server picks a real sentence from the student's second paragraph and builds one
of four oral questions. The student records 30 seconds; the browser computes a fingerprint
(24 log-spaced band energies, median pitch by autocorrelation, zero-crossing rate) and posts
**only the vector**. The server compares it with the baseline captured during mentor sessions:
`0.62 × spectral shape + 0.30 × pitch + 0.08 × energy`, threshold `0.80`, review band
`0.68–0.80`. A mismatch immediately holds the paper and notifies the coordinator.

### 6. Angry Mentor
A real full-duplex-feeling session in the browser: speech synthesis speaks, dictation listens
continuously, and **any speech while he is talking cancels synthesis instantly** and posts the
turn with `interrupted: true`, which triggers an in-character acknowledgement ("Oh, now you
suddenly have energy to talk?"). Echo guard ignores the mentor's own audio. The persona
code-switches when the student writes or speaks Uzbek, roasts procrastination and ChatGPT use
without severe profanity, and fires 5-second vocab/logic challenges for coins. The tool
contract and session config for a hosted realtime model are served at `GET /api/prompts`.

---

## 5-minute demo script

1. **Student → My homework.** Type a paragraph. Watch the AI signal, trap checklist and
   issues update live. Delete the Chorsu reference and see the scenario trap turn red.
2. **Ask the tutor "just give me the answer."** It refuses and asks a better question. Do it
   three times to see the escalation notice.
3. **Submit.** A question is generated from your own paragraph. You have no Voice-Print yet,
   so enrol for 12 seconds (or use *Simulate enrolment*), then record (or *Simulate: my
   voice* / *Simulate: friend's voice* to see the mismatch path).
4. **Switch to Teacher** (top-right). Open the review queue, inspect the report, the trap
   compliance and the detection key, then approve. Coins settle and the ledger updates.
5. **Switch to Director** for the weak-topic heat-map, then **Parent** for the exact Telegram
   message that would be delivered.
6. **Back to Student → Angry Mentor.** Start the session, enable the live mic and interrupt
   him mid-sentence. Answer a quiz for coins.

Restarting the server resets the school day. State is intentionally in-memory.

---

## Architecture

```
server/
  index.js        Express + Vite middleware (one port), CORS, /health, all JSON endpoints
  payloads.js     Shared payload builders — used by the live routes *and* the snapshot
  store.js        In-memory school: students, sets, submissions, ledger, heat-map, reports
  generator.js    Variant generation + trap and detection-key construction
  detector.js     Explainable authorship heuristic, rubric, issue detection, plagiarism
  socratic.js     Socratic-only tutor with refusal guards and hint ladder
  mentor.js       Persona engine: intents, barge-in, quizzes, coins
  voiceprint.js   Fingerprint comparison (centred cosine + pitch), thresholds
  prompts.js      Master prompt, assignment prompt, realtime prompt, session config
  seedTexts.js    Hand-written seed submissions (original, AI-like, copied, thin)
scripts/
  build-offline-snapshot.mjs   Writes src/offline/snapshot.json from the same builders
src/
  App.jsx         Shell, role switcher, hash routing, connect/retry/offline boot state
  api.js          Fetch wrapper: timeouts, typed failures, offline responder
  offline.js      Frozen-snapshot GET responder (lazy chunk, 0 KB when online)
  offline/        snapshot.json — generated, read-only demo school
  components/ConnectionError.jsx  Reason + diagnostics + retry + offline fallback
  components/ErrorBoundary.jsx    Render-crash guard (never a blank page)
  voice.jsx       TTS, dictation, fingerprint sampler, recorder
  views/          Overview, Homework, Mentor, Rewards, Leaderboard, TeacherQueue,
                  Studio, Analytics, Parents, Prompts
  components/ui   Cards, gauges, chips, drawer, toasts, highlight, format helpers
```

**Roles** are a UI convenience over one shared state: Student (`Aziz Karimov`, switchable to
any roster student), Teacher (`Malika Rasulova`), Director (`Kamola Ismoilova`), Parent
(`Dilbar Karimova`). Real deployments would put auth in front of the same APIs.

### API surface

```
GET  /health, /api/health                    liveness: ok, provider, uptime, counts (no-store, CORS)
GET  /api/bootstrap                          school, roster, viewer, live stats
GET  /api/teacher/overview|heatmap|sets      queue, topology, variant sets
POST /api/teacher/generate|publish           variant generation, activate a set
POST /api/teacher/submissions/:id/approve    grade + settle coins
POST /api/teacher/submissions/:id/flag       escalate + reverse coins
GET  /api/student/:id                        dashboard, assignment, submissions, ledger
POST /api/student/:id/analyze                live draft check
POST /api/tutor                              Socratic turn (policy enforced)
POST /api/submissions                        submit + full integrity report
GET  /api/submissions/:id/defense-question   generated oral question
POST /api/submissions/:id/defense            fingerprint comparison + verdict
POST /api/voiceprint/enroll|compare          baseline capture / consistency check
GET  /api/mentor/state, POST /api/mentor/turn
GET  /api/leaderboard, /api/rewards/:id, POST /api/rewards/redeem
GET  /api/parents, /api/parents/:id/report, POST /api/parents/:id/send
GET  /api/prompts                            the three prompts + realtime session config
```

---

## When the app says it cannot reach the server

The first screen used to be a dead end: one failed `/api/bootstrap` call rendered a permanent
"SERVER UNREACHABLE" panel with no reason, no retry and no data. That is fixed at both ends.

**Server.** `GET /health` and `GET /api/health` return a non-cached liveness document
(`ok`, `module`, `version`, `provider`, `demoMode`, `uptimeSeconds`, `startedAt`, counts).
Every API response carries `Access-Control-Allow-Origin`/`-Methods`/`-Headers` (reflected
`Origin` + `Vary: Origin`), `OPTIONS` is answered with `204`, and unmatched `/api/*` paths
return JSON 404s instead of the SPA's HTML. `npm start` no longer dies when `dist/` is
missing — it logs a warning and serves through the Vite middleware.

**Client.** `src/api.js` gives every request a 12 s timeout and a typed failure (`offline`,
`timeout`, `http-<status>`, `server`, `invalid-response`). The boot path retries three times
with backoff before showing `src/components/ConnectionError.jsx`, which states the specific
reason, runs live diagnostics against `/health` and `/api/bootstrap`, and offers:

* **Retry connection** — re-probes health and re-bootstraps in place; no page reload.
* **Continue in offline mode** — loads `src/offline/snapshot.json` (a frozen read-only copy of
  the demo school generated by `npm run snapshot` from the same payload builders as the API)
  so the dashboard, review queue, analytics and parent reports stay explorable. Mutations are
  refused with a clear "read-only" message and a **Reconnect** button in the banner. The
  snapshot is a lazy chunk: 0 KB on a normal online load.

A failed *refresh* after a successful boot no longer clears the screen — it keeps the last
loaded data and shows a "Live refresh failed / Reconnect" bar. A render crash is caught by
`ErrorBoundary` with a reload + "clear local drafts" escape hatch.

Typical causes, in order: the server process is not running (`npm run dev`), `node_modules`
is empty in a fresh container (`npm ci`), or the frontend bundle is older than the API.

---

## Configuration

The app auto-detects a hosted model but never requires one:

```bash
# .env (or export before `npm run dev`)
OPENAI_API_KEY=sk-...
```

With a key present, `GET /api/prompts` and the sidebar report `openai-realtime` as the
provider. `REALTIME_SESSION_CONFIG` in `server/prompts.js` is the exact object to POST when
opening a Realtime session: semantic VAD at high eagerness, `interrupt_response: true`, and
function tools for `award_coins`, `set_quiz`, `enroll_voiceprint`, `check_voiceprint` and
`escalate_integrity_flag`.

Speech features depend on the browser: Chrome/Edge support both synthesis and dictation;
Safari/Firefox may fall back to typing and simulated fingerprints. The UI states which paths
are available and never hides a fallback.

### Privacy and school-safety choices

* Raw audio never leaves the device — only 24 floats plus pitch/ZCR.
* Voice vectors are stored per student in-process for this demo; production should keep them
  in a KMS-backed vault with a 60-day re-enrolment cycle.
* The mentor is school-safe by construction: no severe profanity, no insults about family,
  body or ability, and a hard three-sentence cap.
* Every automated judgement is advisory. A teacher approves each grade, and flags preserve
  the audit trail rather than deleting work.

### Known limits

* The detector is a heuristic — it can be fooled by a careful paraphraser, which is exactly
  why the voice defense exists. Treat the score as one signal, not a verdict.
* Speech dictation is network-dependent in Chrome and unsupported in some browsers.
* No database, no auth, no persistence: restarting resets the day.
* The heat-map and branch figures are seeded demo data for the pilot cohort.
* The offline snapshot is frozen at `npm run snapshot` time, ships without detection keys or
  watermarks, and refuses writes — it keeps the UI reviewable, it does not replace the API.
