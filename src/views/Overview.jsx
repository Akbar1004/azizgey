import React from 'react';
import {
  ArrowRight, BadgeCheck, BarChart3, BookOpen, Bot, Coins, Flame, Mic, ShieldAlert, ShieldCheck,
  Sparkles, TrendingUp, Trophy, Users, Zap, Clock, AlertTriangle, CheckCircle2, Send,
} from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { useData } from '../hooks.js';
import {
  Avatar, Bar, Card, CardHead, Chip, Gauge, KPI, Sparkline, Spinner, TelegramText, aiBandLabel,
  aiTone, dueLabel, initialsOf, timeAgo,
} from '../components/ui.jsx';

const MODULES = [
  { icon: ClipboardIcon, label: 'Pre-grading' },
  { icon: Bot, label: 'Socratic tutor' },
  { icon: Coins, label: 'Target Coins' },
  { icon: Send, label: 'Telegram reports' },
  { icon: Mic, label: 'Voice-Print' },
  { icon: Flame, label: 'Realtime barge-in' },
];

function ClipboardIcon(props) {
  return <BadgeCheck {...props} />;
}

export default function Overview() {
  const { role, navigate, studentId } = useApp();
  if (role === 'student') return <StudentOverview navigate={navigate} studentId={studentId} />;
  if (role === 'parent') return <ParentOverview navigate={navigate} />;
  return <StaffOverview role={role} navigate={navigate} />;
}

/* ------------------------------------------------------------------ student */
function StudentOverview({ navigate, studentId }) {
  const { data, error } = useData(() => api.student(studentId), [studentId]);
  if (error) return <ErrorCard message={error} />;
  if (!data) return <LoadingCard />;

  const { student, assignment, submissions, rank, cohort, ledger, settings } = data;
  const aiFree = submissions.length
    ? Math.round((submissions.filter((s) => s.report.aiProbability <= settings.aiFreeThreshold).length / submissions.length) * 100)
    : 100;
  const pending = submissions.find((s) => s.status === 'pending' || s.status === 'flagged');
  const needsDefense = pending && !pending.defense;
  const trend = submissions.length ? submissions.map((s) => s.report.aiProbability).reverse() : [8];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row tight" style={{ marginBottom: 8 }}>
            <Chip tone="mint dot">{student.className} · {student.branchId}</Chip>
            <Chip plain>{data.perks.length} perks live</Chip>
            {student.voiceprintEnrolled ? <Chip tone="violet"><Mic size={12} /> Voice-Print enrolled</Chip> : <Chip tone="amber"><Mic size={12} /> Voice-Print missing</Chip>}
          </div>
          <h1>Salom, {student.firstName}. Your streak is {student.streak} days.</h1>
          <p className="sub">
            {needsDefense
              ? 'Your written work is in. One thing left: the 30-second voice defense below — no defense, no coins.'
              : 'Everything on the integrity side is clear. Finish tonight’s variant and bank the coins.'}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate('mentor')}><Flame size={15} /> Angry Mentor</button>
          <button className="btn primary" onClick={() => navigate('homework')}>Open homework <ArrowRight size={15} /></button>
        </div>
      </div>

      <div className="grid g4">
        <KPI label="Target Coins" value={student.coins} sub={`${ledger.length} recent ledger entries`} tone="amber" icon={<Coins size={13} />} />
        <KPI label="Class rank" value={`#${rank}`} unit={` / ${cohort}`} sub="Live across the whole cohort" tone="mint" icon={<Trophy size={13} />} />
        <KPI label="AI-free rate" value={aiFree} unit="%" sub="All submitted work this term" tone="violet" icon={<ShieldCheck size={13} />} />
        <KPI label="XP" value={student.xp} sub={`${student.streak}-day submission streak`} icon={<Zap size={13} />} />
      </div>

      <div className="split">
        <div className="stack">
          {needsDefense && (
            <div className="notice rose" style={{ alignItems: 'center' }}>
              <AlertTriangle size={16} />
              <div style={{ flex: 1 }}>
                <b>Voice defense pending.</b> {pending.report.aiProbability}% AI signal on “{pending.setTitle}”. Record 30 seconds explaining your own paragraph to release the coins.
              </div>
              <button className="btn small danger" onClick={() => navigate('homework')}>Record now</button>
            </div>
          )}

          <Card>
            <CardHead
              title="Tonight's assignment"
              sub={assignment.set.topic}
              icon={<BookOpen size={16} />}
              right={<><Chip tone="amber"><Clock size={12} /> {dueLabel(assignment.set.dueAt)}</Chip></>}
            />
            <div className="card-body stack">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: 20 }}>{assignment.variant.title}</h2>
                  <p className="small muted" style={{ marginTop: 5 }}>{assignment.variant.objective}</p>
                </div>
                <div className="nowrap" style={{ textAlign: 'right' }}>
                  <div className="mono muted" style={{ fontSize: 10 }}>VARIANT</div>
                  <div className="mono" style={{ color: 'var(--mint)', fontSize: 13 }}>{assignment.variant.code}</div>
                </div>
              </div>

              <div className="row tight">
                <Chip tone="mint">Unique to you · {assignment.classmates} classmates hold different variants</Chip>
                <Chip>{assignment.variant.estimatedMinutes} min</Chip>
                <Chip>{assignment.variant.wordRange?.min}–{assignment.variant.wordRange?.max} words</Chip>
              </div>

              <div className="divider" />
              <div className="stack" style={{ gap: 8 }}>
                {assignment.variant.questions.map((q, i) => (
                  <div key={i} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                    <span className="mono muted" style={{ marginTop: 2 }}>Q{i + 1}</span>
                    <p className="small dim">{q}</p>
                  </div>
                ))}
              </div>

              <div className="notice mint">
                <Sparkles size={14} />
                <span>
                  <b>Embedded trap.</b> The moment this prompt is pasted into an external AI, the answer exposes itself — your variant code, your Tashkent scenario and the classroom detail never reach that model.
                </span>
              </div>

              <div className="row">
                <button className="btn primary" onClick={() => navigate('homework')}>
                  {assignment.submission ? 'View submission' : 'Start writing'} <ArrowRight size={15} />
                </button>
                <span className="xs muted">Draft check, Socratic tutor and voice defense inside.</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead
              title="Integrity trail"
              sub="Every submission, its AI signal and the voice check"
              icon={<ShieldCheck size={16} />}
              right={<button className="btn ghost small" onClick={() => navigate('homework')}>Open <ArrowRight size={13} /></button>}
            />
            <div className="card-body flush">
              {submissions.length === 0 ? (
                <div className="empty"><ShieldCheck /><b>No submissions yet</b><p>Your first voice-verified submission starts the trail.</p></div>
              ) : (
                <table className="table">
                  <thead>
                    <tr><th>Assignment</th><th>AI signal</th><th>Defense</th><th>Grade</th><th>Coins</th><th /></tr>
                  </thead>
                  <tbody>
                    {submissions.slice(0, 4).map((s) => (
                      <tr key={s.id} className="clickable" onClick={() => navigate('homework')}>
                        <td>
                          <b style={{ fontSize: 12.5 }}>{s.setTitle}</b>
                          <div className="xs muted">{timeAgo(s.submittedAt)} · {s.variantCode}</div>
                        </td>
                        <td><Chip tone={aiTone(s.report.aiProbability)}>{s.report.aiProbability}% {aiBandLabel(s.report.band)}</Chip></td>
                        <td>
                          {s.defense ? (
                            <Chip tone={s.defense.voiceprint?.verdict === 'match' ? 'mint' : s.defense.voiceprint?.verdict === 'review' ? 'amber' : 'rose'}>
                              {s.defense.voiceprint?.verdict === 'match' ? 'Passed' : s.defense.voiceprint?.verdict === 'review' ? 'Review' : 'Mismatch'}
                            </Chip>
                          ) : <Chip tone="amber">Awaiting</Chip>}
                        </td>
                        <td className="mono">{s.status === 'approved' ? `${s.grade}/100` : '—'}</td>
                        <td className="mono" style={{ color: 'var(--amber)' }}>+{s.coins.reduce((a, c) => a + c.coins, 0)}</td>
                        <td><ArrowRight size={13} className="muted" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHead title="AI signal trend" sub="Lower is better — your own voice" icon={<TrendingUp size={16} />} />
            <div className="card-body">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 32, lineHeight: 1 }}>
                    {submissions.length ? submissions[0].report.aiProbability : '—'}<span className="muted" style={{ fontSize: 15 }}>%</span>
                  </div>
                  <div className="xs muted">latest submission</div>
                </div>
                <Gauge value={100 - (submissions.length ? submissions[0].report.aiProbability : 8)} label="Originality" size="sm" />
              </div>
              <div style={{ marginTop: 12 }}><Sparkline points={trend} color="var(--mint)" height={46} /></div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
                <span className="xs muted">oldest</span>
                <span className="xs muted">latest</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="Mentor is online" sub="Barge-in enabled · coins per quiz" icon={<Flame size={16} />} />
            <div className="card-body stack" style={{ gap: 10 }}>
              <div className="bubble tutor" style={{ maxWidth: '100%' }}>
                “{student.streak} days in a row? Look at you pretending to be organised. Ten-second challenge for coins — tap in.”
              </div>
              <button className="btn primary wide" onClick={() => navigate('mentor')}>Talk to the Angry Mentor</button>
              <div className="row tight">
                <Chip tone="mint dot">Barge-in ready</Chip>
                <Chip tone="violet">Passive Voice-Print</Chip>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="60-second tour" sub="Everything here is live state, not a video" icon={<Sparkles size={16} />} />
            <div className="card-body stack" style={{ gap: 10 }}>
              {[
                ['Write a draft', 'The live check scores AI signal and trap compliance as you type.'],
                ['Ask the tutor for the answer', 'It refuses — then asks you a better question.'],
                ['Submit, then defend it', 'A question is generated from your paragraph; record 30 s (or simulate).'],
                ['Switch to Teacher and approve', 'That releases the Target Coins and closes the loop.'],
              ].map(([t, d], i) => (
                <div className="step" key={t} style={{ padding: '4px 0' }}>
                  <span className="step-num">{i + 1}</span>
                  <div><b>{t}</b><p>{d}</p></div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title="Coin ledger" sub="Latest movements" icon={<Coins size={16} />} right={<button className="btn ghost tiny" onClick={() => navigate('rewards')}>Redeem</button>} />
            <div className="card-body flush">
              <div className="audit" style={{ padding: '4px 16px 10px' }}>
                {ledger.slice(0, 5).map((l) => (
                  <div className="audit-item" key={l.id}>
                    <div className="audit-dot pass" style={{ background: l.amount > 0 ? 'var(--mint)' : 'var(--amber)', boxShadow: 'none' }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12 }}>{l.reason}</p>
                      <span className="xs muted">{timeAgo(l.at)}</span>
                    </div>
                    <b className="mono" style={{ color: l.amount > 0 ? 'var(--mint)' : 'var(--amber)' }}>{l.amount > 0 ? '+' : ''}{l.amount}</b>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ModuleStrip />
    </>
  );
}

/* ------------------------------------------------------------------ staff */
function StaffOverview({ role, navigate }) {
  const { data, error } = useData(() => api.teacherOverview(), []);
  if (error) return <ErrorCard message={error} />;
  if (!data) return <LoadingCard />;

  const { stats, heatmap, leaderboard, queue, audit } = data;
  const isDirector = role === 'director';
  const pending = queue.filter((s) => s.status === 'pending');
  const flagged = queue.filter((s) => s.status === 'flagged');
  const weakest = [...heatmap.rows].filter((r) => r.avg !== null).sort((a, b) => a.avg - b.avg).slice(0, 3);
  const branchTop = leaderboard.branches[0];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row tight" style={{ marginBottom: 8 }}>
            <Chip tone="mint dot">All 6 modules live</Chip>
            <Chip plain>Term 2 · Week 12</Chip>
            <Chip plain>{data.sets.find((s) => s.status === 'active')?.variants ?? 10} variants assigned</Chip>
          </div>
          <h1>{isDirector ? 'School-wide integrity picture' : 'Good afternoon, Malika.'}</h1>
          <p className="sub">
            {isDirector
              ? `Four branches, ${stats.studentsTracked} students tracked in the pilot cohort. ${stats.weakTopics} topics sit below the 30% mastery line and need an intervention this week.`
              : `${pending.length} papers are waiting on your one-click approval. The queue below is sorted by integrity risk, not by submission time.`}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate('analytics')}><BarChartIcon /> {isDirector ? 'Weak-topic heat-map' : 'Analytics'}</button>
          <button className="btn primary" onClick={() => navigate(isDirector ? 'analytics' : 'queue')}>
            {isDirector ? 'Review interventions' : 'Open review queue'} <ArrowRight size={15} />
          </button>
        </div>
      </div>

      <div className="grid g4">
        <KPI label="Awaiting review" value={pending.length} sub={`${stats.totalSubmissions} submitted this cycle`} tone="amber" icon={<Clock size={13} />} />
        <KPI label="Avg AI signal" value={stats.avgAi} unit="%" sub="Across every live submission" tone={stats.avgAi > 45 ? 'rose' : 'violet'} icon={<Bot size={13} />} />
        <KPI label="Defense pass rate" value={stats.defenseRate} unit="%" sub="Voice-Print + speech check" tone="mint" icon={<Mic size={13} />} />
        <KPI label="Escalations" value={stats.flagged} sub="Voice mismatch or copy overlap" tone="rose" icon={<ShieldAlert size={13} />} />
      </div>

      <div className="split">
        <div className="stack">
          <Card>
            <CardHead
              title="Integrity queue"
              sub="Sorted by risk · AI signal, overlap and voice check together"
              icon={<ShieldCheck size={16} />}
              right={<button className="btn ghost small" onClick={() => navigate('queue')}>View all <ArrowRight size={13} /></button>}
            />
            <div className="card-body flush">
              <table className="table">
                <thead><tr><th>Student</th><th>Variant</th><th>AI</th><th>Copy</th><th>Voice</th><th>Status</th></tr></thead>
                <tbody>
                  {[...queue].sort((a, b) => b.report.aiProbability - a.report.aiProbability).slice(0, 5).map((s) => (
                    <tr key={s.id} className="clickable" onClick={() => navigate('queue')}>
                      <td>
                        <div className="row tight">
                          <Avatar initials={initialsOf(s.studentName)} tone="mint" />
                          <div>
                            <b style={{ fontSize: 12.5 }}>{s.studentName}</b>
                            <div className="xs muted">{s.className} · {timeAgo(s.submittedAt)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="mono xs">{s.variantCode}</td>
                      <td><Chip tone={aiTone(s.report.aiProbability)}>{s.report.aiProbability}%</Chip></td>
                      <td className="mono xs" style={{ color: s.plagiarism.maxSimilarity > 0.5 ? 'var(--rose)' : 'var(--muted)' }}>{Math.round(s.plagiarism.maxSimilarity * 100)}%</td>
                      <td>
                        <Chip tone={s.defense?.verdict === 'match' ? 'mint' : s.defense?.verdict === 'review' ? 'amber' : s.defense ? 'rose' : 'plain'}>
                          {s.defense ? `${Math.round((s.defense.similarity || 0) * 100)}%` : 'none'}
                        </Chip>
                      </td>
                      <td><Chip tone={s.status === 'approved' ? 'mint' : s.status === 'flagged' ? 'rose' : 'amber'}>{s.status}</Chip></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHead
              title="Weak-topic heat-map"
              sub="Red cells are below the 30% mastery threshold"
              icon={<BarChartIcon />}
              right={<button className="btn ghost small" onClick={() => navigate('analytics')}>Expand</button>}
            />
            <div className="card-body">
              <div className="heatmap" style={{ gridTemplateColumns: `minmax(150px, 1.4fr) repeat(${heatmap.classes.length}, minmax(62px, 1fr))` }}>
                <div />
                {heatmap.classes.map((c) => <div className="hm-head" key={c}>{c.replace(' English', '')}</div>)}
                {heatmap.rows.map((row) => (
                  <React.Fragment key={row.topic}>
                    <div className="hm-row-label">{row.topic}</div>
                    {row.cells.map((cell) => (
                      <div
                        key={cell.className}
                        className={`hm-cell ${cell.value === null ? 'empty' : cell.value < 30 ? 'weak' : ''}`}
                        style={cell.value === null ? undefined : {
                          background: `rgba(${cell.value < 30 ? '251,113,133' : cell.value < 60 ? '251,191,36' : '94,234,212'},${0.09 + (cell.value / 100) * 0.38})`,
                          color: cell.value < 30 ? '#ffc2cc' : cell.value < 60 ? '#ffe6b0' : '#c9fff5',
                        }}
                        title={`${row.topic} · ${cell.className}: ${cell.value ?? 'not taught'}% mastery`}
                      >
                        {cell.value === null ? '–' : `${cell.value}%`}
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
                <span className="legend"><i style={{ background: 'rgba(251,113,133,0.5)' }} /> &lt;30%</span>
                <span className="legend"><i style={{ background: 'rgba(251,191,36,0.5)' }} /> 30–59%</span>
                <span className="legend"><i style={{ background: 'rgba(94,234,212,0.5)' }} /> 60%+</span>
                <span className="legend"><i style={{ background: 'rgba(255,255,255,0.06)' }} /> not taught</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="Weakest topics this week" sub="Suggested intervention from the mastery model" icon={<AlertTriangle size={16} />} />
            <div className="card-body stack" style={{ gap: 10 }}>
              {weakest.map((r) => (
                <div key={r.topic} className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 12.5 }}>{r.topic}</b>
                    <div className="xs muted">{r.subject} · class average {r.avg}%</div>
                  </div>
                  <div style={{ flex: '0 0 140px' }}><Bar value={r.avg} tone={r.avg < 30 ? 'rose' : 'amber'} /></div>
                  <button className="btn tiny" onClick={() => navigate(isDirector ? 'analytics' : 'studio')}>Assign intervention</button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHead title={isDirector ? 'Branch standings' : 'Branch leaderboard'} sub="Live Target Coins" icon={<Trophy size={16} />} />
            <div className="card-body stack" style={{ gap: 10 }}>
              {leaderboard.branches.map((b, i) => (
                <div key={b.id}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="row tight">
                      <span className={`medal g${i + 1}`}>{i + 1}</span>
                      <b style={{ fontSize: 12.5 }}>{b.name}</b>
                    </span>
                    <span className="mono" style={{ color: 'var(--amber)' }}>{b.coins.toLocaleString()}</span>
                  </div>
                  <div style={{ marginTop: 5 }}><Bar value={(b.coins / branchTop.coins) * 100} tone={i === 0 ? '' : 'violet'} height={5} /></div>
                </div>
              ))}
              <button className="btn ghost small" onClick={() => navigate('leaderboard')}>Full leaderboard <ArrowRight size={13} /></button>
            </div>
          </Card>

          <Card>
            <CardHead title="Integrity feed" sub="Append-only audit trail" icon={<ShieldAlert size={16} />} />
            <div className="card-body" style={{ paddingTop: 6 }}>
              <div className="audit">
                {audit.slice(0, 6).map((a) => (
                  <div className="audit-item" key={a.id}>
                    <span className={`audit-dot ${a.kind}`} />
                    <p style={{ flex: 1 }}>{a.text}</p>
                    <time>{timeAgo(a.at)}</time>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="Module health" sub="Every layer reporting in" icon={<Zap size={16} />} />
            <div className="card-body stack" style={{ gap: 9 }}>
              {[
                ['Pre-grading under 10 s', 'ok', `${stats.totalSubmissions} reports`],
                ['Socratic policy', 'ok', 'direct answers blocked'],
                ['Voice-Print consistency', 'ok', 'threshold 0.80'],
                ['Barge-in pipeline', 'ok', 'local · <300 ms'],
                ['Telegram delivery', 'ok', 'Sunday 18:00'],
              ].map(([label, , note]) => (
                <div className="row" style={{ justifyContent: 'space-between' }} key={label}>
                  <span className="row tight small"><CheckCircle2 size={13} style={{ color: 'var(--mint)' }} /> {label}</span>
                  <span className="xs muted">{note}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <ModuleStrip />
    </>
  );
}

/* ------------------------------------------------------------------ parent */
function ParentOverview({ navigate }) {
  const { parentId } = useApp();
  const { data, error } = useData(() => api.parentReport(parentId), [parentId]);
  if (error) return <ErrorCard message={error} />;
  if (!data) return <LoadingCard />;
  const { child, stats, message, pending } = data;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row tight" style={{ marginBottom: 8 }}>
            <Chip tone="mint dot">Telegram connected</Chip>
            <Chip plain>{data.parent.telegram}</Chip>
          </div>
          <h1>{child.name.split(' ')[0]}'s week at Target</h1>
          <p className="sub">Automated every Sunday 18:00. Reviewed by the Academic Integrity Lead before delivery.</p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => navigate('parents')}>Open weekly report <ArrowRight size={15} /></button>
        </div>
      </div>

      <div className="grid g4">
        <KPI label="On-time" value={stats.onTime} unit="%" sub={`${stats.submissions} graded submissions`} tone="mint" icon={<Clock size={13} />} />
        <KPI label="AI-free" value={stats.aiFree} unit="%" sub="Below 20% AI signal" tone="violet" icon={<ShieldCheck size={13} />} />
        <KPI label="Voice defense" value={stats.defense} unit="%" sub="passed on first attempt" tone="amber" icon={<Mic size={13} />} />
        <KPI label="Coins" value={child.coins} sub={`${child.streak}-day streak`} tone="amber" icon={<Coins size={13} />} />
      </div>

      <div className="split">
        <Card>
          <CardHead title="This week's Telegram message" sub="Exactly what lands on your phone" icon={<Send size={16} />} />
          <div className="card-body">
            <div className="telegram">
              <div className="telegram-hd">
                <Avatar initials="TS" />
                <div>
                  <b style={{ fontSize: 12.5 }}>Target International School</b>
                  <div className="xs muted">integrity bot · @target_integrity_bot</div>
                </div>
              </div>
              <div className="telegram-body">
                <div className="tg-bubble">
                  <TelegramText text={message} />
                  <div className="tg-time">18:00 <CheckCircle2 size={11} /></div>
                </div>
              </div>
            </div>
            {pending && (
              <div className="notice amber" style={{ marginTop: 12 }}>
                <AlertTriangle size={14} />
                <span><b>Tonight’s action:</b> the 30-second voice defense for “{pending.setTitle}” is still open.</span>
              </div>
            )}
          </div>
        </Card>

        <div className="stack">
          <Card>
            <CardHead title="What the school checks" sub="Three layers, all explainable" icon={<ShieldCheck size={16} />} />
            <div className="card-body stack" style={{ gap: 11 }}>
              {[
                ['Written work', 'AI-pattern scan + peer overlap + embedded trap compliance.'],
                ['Voice defense', '30 seconds on your child’s own paragraph, recorded the moment they submit.'],
                ['Voice-Print', 'The recording is matched to the voice profile captured in mentor sessions.'],
              ].map(([t, d], i) => (
                <div className="step" key={t} style={{ padding: '6px 0' }}>
                  <span className="step-num done">{i + 1}</span>
                  <div><b>{t}</b><p>{d}</p></div>
                </div>
              ))}
              <div className="notice mint">
                <Bot size={14} />
                <span>Only non-reversible acoustic vectors are stored — never the audio itself. Raw recordings stay on your child’s device.</span>
              </div>
            </div>
          </Card>
          <Card>
            <CardHead title="Recent graded work" sub="What the teacher approved" icon={<BadgeCheck size={16} />} />
            <div className="card-body flush">
              <div style={{ padding: '12px 16px' }} className="stack">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small">Approved average</span>
                  <b className="mono">{stats.avgGrade ?? '—'}/100</b>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small">Graded this term</span>
                  <b className="mono">{stats.graded}</b>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small">Weak topics flagged</span>
                  <b className="mono" style={{ color: data.weakTopics.length ? 'var(--rose)' : 'var(--mint)' }}>{data.weakTopics.length}</b>
                </div>
                <Bar value={stats.avgGrade || 0} />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ shared */
function ModuleStrip() {
  return (
    <Card className="soft">
      <div className="card-body" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="xs muted" style={{ letterSpacing: '0.14em', textTransform: 'uppercase' }}>6 modules online</span>
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <span key={m.label} className="row tight xs" style={{ color: 'var(--text-2)' }}>
              <Icon size={13} style={{ color: 'var(--mint)' }} /> {m.label}
            </span>
          );
        })}
        <span className="row tight xs" style={{ marginLeft: 'auto', color: 'var(--muted)' }}>
          <ShieldCheck size={13} /> Advisory by design · teacher approves every grade
        </span>
      </div>
    </Card>
  );
}

function BarChartIcon() {
  return <BarChart3 size={16} />;
}

function LoadingCard() {
  return (
    <Card>
      <div className="card-body" style={{ display: 'grid', placeItems: 'center', gap: 10, minHeight: 220 }}>
        <Spinner size={20} />
        <span className="xs muted">Loading live school data…</span>
      </div>
    </Card>
  );
}

function ErrorCard({ message }) {
  return (
    <Card>
      <div className="card-body">
        <div className="notice rose"><AlertTriangle size={15} /><span>{message}</span></div>
      </div>
    </Card>
  );
}
