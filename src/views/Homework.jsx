import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowRight, BookOpen, CheckCircle2, ChevronRight, Clock, Flame, Info, Lock,
  MessageCircle, Mic, Send, ShieldCheck, Sparkles, Target, XCircle, Loader2, Coins, Radio,
} from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { useData, useLocalState } from '../hooks.js';
import {
  Avatar, Bar, Card, CardHead, Chip, Gauge, HighlightedText, Spinner, aiBandLabel, aiTone,
  dueLabel, fmtTime, timeAgo,
} from '../components/ui.jsx';
import { Recorder } from '../voice.jsx';

export default function Homework() {
  const { studentId, settings, toast, navigate } = useApp();
  const [kick, setKick] = useState(0);
  const { data, error } = useData(() => api.student(studentId), [studentId, kick]);
  const reload = useCallback(() => setKick((k) => k + 1), []);

  if (error) return <Card><div className="card-body"><div className="notice rose"><AlertTriangle size={15} />{error}</div></div></Card>;
  if (!data) return <Card><div className="card-body" style={{ display: 'grid', placeItems: 'center', minHeight: 240 }}><Spinner size={20} /></div></Card>;

  const { assignment, student } = data;
  const submission = assignment.submission;
  const variant = assignment.variant;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row tight" style={{ marginBottom: 8 }}>
            <Chip tone="mint">{variant.code}</Chip>
            <Chip tone="amber"><Clock size={12} /> {dueLabel(assignment.set.dueAt)}</Chip>
            <Chip plain>{assignment.classmates - 1} classmates · all different variants</Chip>
          </div>
          <h1>{variant.title}</h1>
          <p className="sub">{variant.objective}</p>
        </div>
        <div className="page-actions">
          {submission && <Chip tone={submission.status === 'approved' ? 'mint' : submission.status === 'flagged' ? 'rose' : 'amber'} dot>{submission.status}</Chip>}
          <button className="btn" onClick={() => navigate('mentor')}><Flame size={15} /> Mentor</button>
        </div>
      </div>

      {submission ? (
        <SubmissionView submission={submission} student={student} settings={settings} toast={toast} reload={reload} />
      ) : (
        <WriteView variant={variant} student={student} settings={settings} toast={toast} reload={reload} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ write */
function WriteView({ variant, student, settings, toast, reload }) {
  const [draft, setDraft] = useLocalState(`target-draft:${variant.code}`, '');
  const [live, setLive] = useState(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hints, setHints] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef(Date.now());

  const wordCount = useMemo(() => (draft.trim() ? draft.trim().split(/\s+/).length : 0), [draft]);

  useEffect(() => {
    const t = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!draft.trim() || wordCount < 12) { setLive(null); return; }
    setChecking(true);
    const handle = setTimeout(async () => {
      try {
        const res = await api.analyze(student.id, { text: draft });
        setLive(res);
      } catch { /* keep previous result */ }
      setChecking(false);
    }, 650);
    return () => { clearTimeout(handle); setChecking(false); };
  }, [draft, wordCount, student.id]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await api.submit({ studentId: student.id, text: draft, hintsUsed: hints, secondsSpent: seconds });
      toast({
        tone: res.submission.report.aiProbability >= 45 ? 'amber' : 'mint',
        title: `Submitted · ${res.submission.report.aiProbability}% AI signal`,
        body: 'Now the 30-second voice defense — this is what unlocks the coins.',
      });
      reload();
    } catch (e) {
      toast({ tone: 'rose', title: 'Submission blocked', body: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const report = live?.report;
  const gate = live?.gate;

  return (
    <div className="split">
      <div className="stack">
        <BriefCard variant={variant} />
        <Card>
          <CardHead title="Embedded integrity checks" sub="Live as you write — nothing is hidden" icon={<ShieldCheck size={16} />} />
          <div className="card-body stack" style={{ gap: 12 }}>
            {report ? (
              <>
                <div className="trap-list">
                  {report.traps.map((t) => (
                    <div key={t.id} className={`trap ${t.pass ? 'pass' : 'fail'}`}>
                      <span className="t-ico">{t.pass ? <CheckCircle2 size={13} style={{ color: 'var(--mint)' }} /> : <XCircle size={13} style={{ color: 'var(--rose)' }} />}</span>
                      <div><b>{t.label}</b><span>{t.detail}</span></div>
                    </div>
                  ))}
                </div>
                {report.issues.slice(0, 3).map((iss, i) => (
                  <div className="issue" key={i}>
                    <span className={`i-kind ${iss.kind}`}>{iss.kind}</span>
                    <div><p><q>{iss.quote}</q> — {iss.note}</p></div>
                  </div>
                ))}
                {gate?.eligibleForCoins && (
                  <div className="notice mint"><Sparkles size={14} /><span><b>Coin-eligible draft.</b> Traps complete and AI signal under {settings.aiFreeThreshold}%. Submit before the deadline.</span></div>
                )}
              </>
            ) : (
              <div className="empty" style={{ padding: '18px 6px' }}>
                <ShieldCheck />
                <b>Start writing to see the checks</b>
                <p>Word count, trap compliance and the AI-signal estimate update as you type.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="stack">
        <Card>
          <CardHead
            title="Your answer"
            sub={`${variant.wordRange?.min}–${variant.wordRange?.max} words · variant ${variant.code}`}
            icon={<BookOpen size={16} />}
            right={checking ? <span className="row tight xs muted"><Spinner size={12} /> checking</span> : report ? <Chip tone={aiTone(report.aiProbability)}>{report.aiProbability}% AI</Chip> : <Chip plain>draft check</Chip>}
          />
          <div className="card-body stack">
            <div className="editor-wrap">
              <textarea
                className="editor live"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write your answer here. Ground it in your Tashkent scenario and today’s classroom detail, in your own rhythm."
                spellCheck
              />
              <div className="editor-foot">
                <span>{wordCount} words</span>
                <span>·</span>
                <span>{Math.min(99, Math.round((seconds / 60)))} min in editor</span>
                <span style={{ marginLeft: 'auto' }} />
                {report && <span className="mono" style={{ fontSize: 10.5 }}>{report.metrics.elapsedMs} ms check</span>}
              </div>
            </div>

            {report && (
              <div className="stack" style={{ gap: 7 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="xs muted">Originality estimate</span>
                  <span className="xs" style={{ color: `var(--${aiTone(report.aiProbability)})` }}>{report.verdict}</span>
                </div>
                <Bar value={report.originality} tone={aiTone(report.aiProbability) === 'mint' ? '' : aiTone(report.aiProbability)} />
              </div>
            )}

            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="hintline">
                {gate
                  ? `${gate.trapsPassed}/${gate.trapsTotal} embedded constraints met`
                  : 'At least 25 words are required to submit.'}
              </span>
              <button className="btn primary" disabled={submitting || wordCount < 25} onClick={submit}>
                {submitting ? <><Spinner size={14} /> Analysing…</> : <>Submit for voice defense <ArrowRight size={15} /></>}
              </button>
            </div>
            <div className="xs muted">
              Submission locks your text and immediately generates one oral question from your own paragraph. You will have {settings.defenseSeconds} seconds to record.
            </div>
          </div>
        </Card>

        <TutorPanel variant={variant} student={student} onHints={setHints} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ brief */
function BriefCard({ variant }) {
  const [tab, setTab] = useState('questions');
  return (
    <Card>
      <CardHead
        title="Assignment brief"
        sub={`${variant.subject} · ${variant.grade} · ${variant.estimatedMinutes} min`}
        icon={<Target size={16} />}
        right={<Chip tone="mint">{variant.code}</Chip>}
      />
      <div className="card-body stack">
        <div className="tabs">
          <button className={tab === 'questions' ? 'active' : ''} onClick={() => setTab('questions')}>Questions</button>
          <button className={tab === 'rules' ? 'active' : ''} onClick={() => setTab('rules')}>Rules & traps</button>
          <button className={tab === 'defense' ? 'active' : ''} onClick={() => setTab('defense')}>Voice defense</button>
        </div>

        {tab === 'questions' && (
          <div className="stack" style={{ gap: 14 }}>
            {variant.questions.map((q, i) => (
              <div key={i} className="stack" style={{ gap: 5 }}>
                <span className="mono muted" style={{ fontSize: 10.5 }}>PART 1 · QUESTION {i + 1}</span>
                <p className="small dim">{q}</p>
              </div>
            ))}
            <div className="notice mint">
              <Info size={14} />
              <span>This prompt is one of {10} randomised variants. Your classmates received different scenarios, banned phrases and structural rules.</span>
            </div>
          </div>
        )}

        {tab === 'rules' && (
          <div className="stack" style={{ gap: 10 }}>
            {variant.constraint.map((c, i) => (
              <div key={i} className="row" style={{ alignItems: 'flex-start', gap: 9 }}>
                <span className="step-num" style={{ width: 21, height: 21, fontSize: 10 }}>{i + 1}</span>
                <p className="small dim">{c}</p>
              </div>
            ))}
            <div className="divider" />
            <div className="row tight">
              <span className="xs muted">Banned:</span>
              {variant.bannedPhrases.map((b) => <Chip key={b} tone="rose">{b}</Chip>)}
            </div>
            <div className="xs muted">Trap codes are unique to your account ({variant.code}). If this brief appears in an external tool, the answer will miss every anchor.</div>
          </div>
        )}

        {tab === 'defense' && (
          <div className="stack" style={{ gap: 10 }}>
            <div className="row tight"><Chip tone="violet"><Mic size={12} /> Part 3</Chip><Chip>30 seconds</Chip><Chip>Voice-Print matched</Chip></div>
            <p className="small dim">{variant.defensePrompt}</p>
            <div className="notice amber"><Lock size={14} /><span>The oral question is generated from <b>your</b> paragraph the moment you submit — it cannot be prepared in advance.</span></div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ tutor */
const STARTERS = [
  'I am stuck on question 1.',
  'Is my Chorsu example good enough?',
  'Can you just give me the answer?',
];

function TutorPanel({ variant, student, onHints }) {
  const [messages, setMessages] = useState([
    { role: 'tutor', text: 'I am your Smart Tutor. I will not write a single sentence for you — that is the point. Tell me which question is hurting and I will ask you the question that unlocks it.', meta: 'Socratic only' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [hints, setHints] = useState(0);
  const scroller = useRef(null);

  useEffect(() => {
    scroller.current?.scrollTo?.({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text = input) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput('');
    const history = messages.filter((m) => m.role !== 'sys').map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: 'me', text: msg }]);
    setBusy(true);
    try {
      const res = await api.tutor({ studentId: student.id, variantCode: variant.code, message: msg, history });
      setMessages((m) => [...m, {
        role: 'tutor',
        text: res.reply,
        meta: res.hint ? `Hint ${res.hintsUsed} · ${res.hint.label}` : 'Socratic policy',
        refusal: res.refusal,
      }]);
      setHints(res.hintsUsed);
      onHints?.(res.hintsUsed);
    } catch (e) {
      setMessages((m) => [...m, { role: 'sys', text: e.message }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHead
        title="Smart Tutor"
        sub="Socratic method enforced server-side — no direct answers, ever"
        icon={<MessageCircle size={16} />}
        right={<Chip tone={hints >= 3 ? 'amber' : 'violet'}>{hints} hint{hints === 1 ? '' : 's'} logged</Chip>}
      />
      <div className="card-body stack">
        <div className="chat" ref={scroller}>
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role === 'me' ? 'me' : m.role === 'sys' ? 'sys' : 'tutor'}`}>
              {m.text}
              {m.meta && m.role === 'tutor' && (
                <div className="b-meta">
                  {m.refusal ? <Lock size={10} /> : <Sparkles size={10} />} {m.meta}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="bubble tutor"><span className="typing"><i /><i /><i /></span></div>}
        </div>
        <div className="row tight">
          {STARTERS.map((s) => (
            <button key={s} className="btn tiny ghost" onClick={() => send(s)} disabled={busy}>{s}</button>
          ))}
        </div>
        <div className="composer">
          <input
            className="input"
            value={input}
            placeholder="Ask for help — not for the answer."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          />
          <button className="btn primary" onClick={() => send()} disabled={busy || !input.trim()}><Send size={15} /></button>
        </div>
        <div className="xs muted">Every exchange is attached to your submission. Three or more hints moves the voice-defense question to the assisted paragraph.</div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ submitted */
function SubmissionView({ submission, student, settings, toast, reload }) {
  const report = submission.report;
  const totalCoins = submission.coins.reduce((a, c) => a + c.coins, 0);

  return (
    <div className="stack">
      <Card>
        <CardHead
          title="Integrity report"
          sub={`${submission.id} · submitted ${timeAgo(submission.submittedAt)} · ${submission.onTime ? 'on time' : 'late'}`}
          icon={<ShieldCheck size={16} />}
          right={<Chip tone={submission.status === 'approved' ? 'mint' : submission.status === 'flagged' ? 'rose' : 'amber'} dot>{submission.status === 'approved' ? `Approved · ${submission.grade}/100` : submission.status === 'flagged' ? 'Held for review' : 'Teacher approval pending'}</Chip>}
        />
        <div className="card-body">
          <div className="split" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr)' }}>
            <div className="stack" style={{ alignItems: 'center', gap: 10 }}>
              <Gauge value={report.aiProbability} label="AI signal" tone={aiTone(report.aiProbability)} />
              <Chip tone={aiTone(report.aiProbability)}>{aiBandLabel(report.band)}</Chip>
              <p className="xs muted center" style={{ maxWidth: 240 }}>{report.verdict}</p>
              <div className="row tight" style={{ justifyContent: 'center' }}>
                <Chip plain>{report.metrics.wordCount} words</Chip>
                <Chip plain>{report.traps.filter((t) => t.pass).length}/{report.traps.length} traps</Chip>
              </div>
            </div>

            <div className="stack" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small dim">Why this score</span>
                <span className="xs muted">weighted, explainable</span>
              </div>
              {report.signals.slice(0, 4).map((s) => (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 10, alignItems: 'center' }}>
                  <div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <b style={{ fontSize: 12 }}>{s.label}</b>
                      <span className="mono xs muted">{Math.round(s.value * 100)}</span>
                    </div>
                    <div className="xs muted" style={{ marginTop: 1 }}>{s.detail}</div>
                  </div>
                  <Bar value={s.value * 100} tone={aiTone(report.aiProbability) === 'mint' ? 'violet' : 'rose'} height={5} />
                </div>
              ))}
              {report.counters.length > 0 && (
                <div className="row tight">
                  {report.counters.slice(0, 3).map((c) => <Chip key={c.id} tone="mint">− {c.label}</Chip>)}
                </div>
              )}
              <div className="divider" />
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small">Suggested grade</span>
                <b className="mono" style={{ fontSize: 15 }}>{report.grade.total}/100 · {report.grade.letter}</b>
              </div>
              <Bar value={report.grade.total} tone={report.grade.total >= 75 ? '' : report.grade.total >= 55 ? 'amber' : 'rose'} />
              <div className="xs muted">Grade is advisory until Ms. Rasulova approves it with one click.</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="split">
        <div className="stack">
          <DefensePanel submission={submission} student={student} settings={settings} toast={toast} onChanged={reload} />

          <Card>
            <CardHead title="Your submitted text" sub="Highlighted spans are the phrasing that raised the AI signal" icon={<BookOpen size={16} />} />
            <div className="card-body">
              <HighlightedText text={submission.text} tells={report.tells} />
            </div>
          </Card>

          <Card>
            <CardHead title="What the teacher will see" sub="Nothing is hidden from you" icon={<Info size={16} />} />
            <div className="card-body stack" style={{ gap: 8 }}>
              {report.traps.map((t) => (
                <div key={t.id} className={`trap ${t.pass ? 'pass' : 'fail'}`}>
                  <span className="t-ico">{t.pass ? <CheckCircle2 size={13} style={{ color: 'var(--mint)' }} /> : <XCircle size={13} style={{ color: 'var(--rose)' }} />}</span>
                  <div><b>{t.label}</b><span>{t.detail}</span></div>
                </div>
              ))}
              {report.issues.length > 0 && (
                <div className="stack" style={{ gap: 6, marginTop: 4 }}>
                  {report.issues.map((iss, i) => (
                    <div className="issue" key={i}>
                      <span className={`i-kind ${iss.kind}`}>{iss.kind}</span>
                      <div><p><q>{iss.quote}</q> — {iss.note}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHead title="Coins on this submission" sub="Released when the teacher approves" icon={<Coins size={16} />} />
            <div className="card-body stack" style={{ gap: 9 }}>
              {submission.coins.map((c) => (
                <div className="row" style={{ justifyContent: 'space-between' }} key={c.id}>
                  <span className="small dim">{c.label}</span>
                  <b className="mono" style={{ color: 'var(--mint)' }}>+{c.coins}</b>
                </div>
              ))}
              {submission.coins.length === 0 && <div className="xs muted">No coins on this one — the integrity checks were not all passed.</div>}
              <div className="divider" />
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b className="small">Total</b>
                <b className="mono" style={{ color: 'var(--amber)', fontSize: 16 }}>+{totalCoins}</b>
              </div>
              {submission.status !== 'approved' && totalCoins > 0 && (
                <div className="notice amber"><Clock size={14} /><span>Held until approval. <b>Demo tip:</b> switch to the Teacher role to approve this paper and release the coins.</span></div>
              )}
              {submission.status === 'approved' && <Chip tone="mint"><CheckCircle2 size={12} /> Coins settled · {student.coins} balance</Chip>}
            </div>
          </Card>

          <Card>
            <CardHead title="Tutor log" sub={`${submission.hintsUsed} hints recorded on this submission`} icon={<MessageCircle size={16} />} />
            <div className="card-body">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small dim">Scaffolding level</span>
                <Chip tone={submission.hintsUsed >= settings.maxHintsBeforeFlag ? 'amber' : 'mint'}>{submission.hintsUsed >= settings.maxHintsBeforeFlag ? 'Heavily assisted' : submission.hintsUsed ? 'Lightly assisted' : 'Independent'}</Chip>
              </div>
              <p className="xs muted" style={{ marginTop: 8 }}>
                {submission.hintsUsed >= settings.maxHintsBeforeFlag
                  ? 'Because you used three or more hints, the defense question focuses on the assisted paragraph.'
                  : 'The tutor never supplied wording. All sentences are yours.'}
              </p>
            </div>
          </Card>

          <Card>
            <CardHead title="Next" sub="Keep the streak alive" icon={<Flame size={16} />} />
            <div className="card-body stack" style={{ gap: 8 }}>
              <button className="btn wide" onClick={() => (window.location.hash = 'mentor')}>Debrief with the mentor</button>
              <button className="btn ghost wide" onClick={() => (window.location.hash = 'rewards')}>Spend your coins</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ defense */
function DefensePanel({ submission, student, settings, toast, onChanged }) {
  const [question, setQuestion] = useState(submission.defense?.question || null);
  const [meta, setMeta] = useState(null);
  const [needsEnrollment, setNeedsEnrollment] = useState(!student.voiceprintEnrolled);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(submission.defense || null);
  const [enrolling, setEnrolling] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [localBaseline, setLocalBaseline] = useState(null);

  useEffect(() => {
    if (question) return;
    api.defenseQuestion(submission.id).then((r) => {
      setQuestion(r.question);
      setMeta(r);
      setNeedsEnrollment(r.needsEnrollment);
    }).catch(() => {});
  }, [submission.id, question]);

  const enroll = async ({ fingerprint, simulated, label }) => {
    setBusy(true);
    try {
      const res = await api.enroll({ studentId: student.id, fingerprint, simulated });
      setLocalBaseline(res.student?.voiceprint || fingerprint);
      setNeedsEnrollment(false);
      setEnrolling(false);
      toast({ tone: 'mint', title: 'Voice-Print enrolled', body: `${res.coins > 0 ? `+${res.coins} coins · ` : ''}Baseline stored as a 24-band vector on this device.` });
      onChanged?.();
    } catch (e) {
      toast({ tone: 'rose', title: 'Enrolment failed', body: e.message });
    } finally {
      setBusy(false);
    }
  };

  const sendDefense = async ({ fingerprint, durationS, simulated, label }) => {
    setBusy(true);
    try {
      const res = await api.defense(submission.id, { fingerprint, durationS, transcriptQuality: 'clear', question: question || meta?.question, simulated });
      setResult(res.submission.defense);
      setShowRecorder(false);
      const vp = res.voiceprint;
      toast({
        tone: vp.verdict === 'match' ? 'mint' : vp.verdict === 'review' ? 'amber' : 'rose',
        title: vp.verdict === 'match' ? `Voice-Print matched · ${Math.round(vp.similarity * 100)}%` : vp.verdict === 'review' ? `Borderline match · ${Math.round(vp.similarity * 100)}%` : `Voice-Print mismatch · ${Math.round(vp.similarity * 100)}%`,
        body: simulated ? 'Simulated fingerprint (demo mode) — no microphone used.' : vp.detail,
      });
      onChanged?.();
    } catch (e) {
      if (e.data?.needsEnrollment) {
        setNeedsEnrollment(true);
        toast({ tone: 'amber', title: 'Enrol your Voice-Print first', body: e.message });
      } else {
        toast({ tone: 'rose', title: 'Defense rejected', body: e.message });
      }
    } finally {
      setBusy(false);
    }
  };

  const baseline = localBaseline || student.voiceprint || null;

  return (
    <Card>
      <CardHead
        title="30-second voice defense"
        sub="One oral question generated from your own text"
        icon={<Mic size={16} />}
        right={result ? (
          <Chip tone={result.voiceprint?.verdict === 'match' ? 'mint' : result.voiceprint?.verdict === 'review' ? 'amber' : 'rose'} dot>
            {result.voiceprint?.verdict === 'match' ? 'Verified' : result.voiceprint?.verdict === 'review' ? 'Review' : 'Mismatch'}
          </Chip>
        ) : <Chip tone="amber">Required</Chip>}
      />
      <div className="card-body stack" style={{ gap: 14 }}>
        <div className="notice" style={{ borderColor: 'rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.07)' }}>
          <Radio size={15} style={{ color: 'var(--violet)' }} />
          <span><b>Question {result ? 'asked' : meta?.baseline === 'missing' ? 'ready' : 'generated'}:</b> {question || 'Generating from your paragraph…'}</span>
        </div>

        {result ? (
          <div className="stack" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 16 }}>
              <Gauge value={Math.round((result.voiceprint?.similarity ?? result.similarity ?? 0) * 100)} label="Voice match" tone={result.voiceprint?.verdict === 'match' ? 'mint' : result.voiceprint?.verdict === 'review' ? 'amber' : 'rose'} size="sm" />
              <div className="stack" style={{ gap: 6, flex: 1 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small dim">Speaker consistency</span>
                  <Chip tone={result.voiceprint?.verdict === 'match' ? 'mint' : result.voiceprint?.verdict === 'review' ? 'amber' : 'rose'}>
                    {result.voiceprint?.verdict === 'match' ? 'Same speaker' : result.voiceprint?.verdict === 'review' ? 'Needs review' : 'Different speaker'}
                  </Chip>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small dim">Recording length</span>
                  <span className="mono xs">{Math.round(result.durationS || 0)}s / {settings.defenseSeconds}s</span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small dim">Threshold</span>
                  <span className="mono xs">{Math.round((result.voiceprint?.threshold || settings.voiceMatchThreshold) * 100)}%</span>
                </div>
                {result.voiceprint?.simulated && <Chip tone="amber">Simulated fingerprint</Chip>}
              </div>
            </div>
            {result.voiceprint?.components && (
              <div className="grid g3" style={{ gap: 8 }}>
                {[['Spectral', result.voiceprint.components.spectral], ['Pitch', result.voiceprint.components.pitch], ['Energy', result.voiceprint.components.energy]].map(([label, v]) => (
                  <div key={label} className="card soft pad" style={{ padding: '9px 11px' }}>
                    <div className="xs muted">{label} match</div>
                    <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
                      <b className="mono" style={{ fontSize: 13 }}>{Math.round(v * 100)}%</b>
                      <div style={{ width: 52 }}><Bar value={v * 100} height={4} tone={v > 0.8 ? '' : 'amber'} /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="notice" style={{ borderColor: result.voiceprint?.verdict === 'match' ? 'rgba(94,234,212,0.28)' : 'rgba(251,113,133,0.32)', background: result.voiceprint?.verdict === 'match' ? 'rgba(94,234,212,0.06)' : 'rgba(251,113,133,0.07)' }}>
              <ShieldCheck size={15} />
              <span>
                {result.voiceprint?.verdict === 'match'
                  ? 'Authorship verified. Coins are queued for teacher approval and the flag is cleared.'
                  : result.voiceprint?.verdict === 'review'
                    ? 'Borderline fingerprint — probably your device or room changed. A teacher will listen before deciding.'
                    : 'The fingerprint does not match your enrolled baseline. The paper is held; a teacher has been notified.'}
              </span>
            </div>
            {result.voiceprint?.simulated && <div className="xs muted">Demo note: this verdict used a simulated fingerprint so the flow works without a microphone.</div>}
          </div>
        ) : needsEnrollment ? (
          <div className="stack" style={{ gap: 12 }}>
            <div className="notice amber"><AlertTriangle size={15} /><span><b>Voice-Print baseline missing.</b> The defense compares your 30 seconds against the profile captured during mentor sessions. Record 12 seconds now to enrol — you get +25 coins.</span></div>
            {enrolling ? (
              <Recorder
                seconds={settings.enrollmentSeconds}
                title="Enrol Voice-Print"
                hint="Read anything natural — this only captures an acoustic fingerprint, never words."
                busy={busy}
                onDone={(payload) => enroll(payload)}
                simulateOptions={[
                  { label: 'Simulate enrolment', mode: 'match', baseline: null },
                ]}
              />
            ) : (
              <button className="btn primary" onClick={() => setEnrolling(true)}><Mic size={15} /> Enrol my Voice-Print (12 s)</button>
            )}
          </div>
        ) : showRecorder ? (
          <Recorder
            seconds={settings.defenseSeconds}
            title="Record your explanation"
            hint="Speak in full sentences. Fingerprint extracts locally; only the vector is sent."
            busy={busy}
            onDone={(payload) => sendDefense(payload)}
            simulateOptions={[
              { label: 'Simulate: my voice', mode: 'match', baseline },
              { label: "Simulate: friend's voice", mode: 'impostor', baseline },
            ]}
          />
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            <div className="row tight">
              <Chip tone="mint"><Mic size={12} /> Baseline enrolled</Chip>
              <Chip>{settings.defenseSeconds}s window</Chip>
              <Chip>{Math.round(settings.voiceMatchThreshold * 100)}% match threshold</Chip>
            </div>
            <button className="btn primary" onClick={() => setShowRecorder(true)} disabled={!question}>
              <Mic size={15} /> Start 30-second defense
            </button>
            <div className="xs muted">Recorded audio stays on this device. Only a 24-band acoustic vector is compared with your baseline.</div>
          </div>
        )}
      </div>
    </Card>
  );
}
