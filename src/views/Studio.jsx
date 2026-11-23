import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CheckCircle2, Copy, Eye, EyeOff, FileJson, Layers, Lock,
  Send, ShieldCheck, Sparkles, Target, Wand2, XCircle, Clock,
} from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { useData } from '../hooks.js';
import { Card, CardHead, Chip, CopyButton, Drawer, KPI, Spinner } from '../components/ui.jsx';

const SUBJECTS = ['English', 'Business', 'SAT Math', 'Mathematics', 'Computer Science', 'Physics', 'History', 'Economics', 'IELTS'];
const GRADES = ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

export default function Studio() {
  const { toast, refresh } = useApp();
  const { data } = useData(() => api.sets(), []);
  const [form, setForm] = useState({ subject: 'English', grade: 'Grade 11', topic: '', classDetail: '', dueInDays: 1 });
  const [prefilled, setPrefilled] = useState(false);
  const [variants, setVariants] = useState([]);
  const [meta, setMeta] = useState(null);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [openVariant, setOpenVariant] = useState(null);
  const [revealKey, setRevealKey] = useState(false);

  useEffect(() => {
    if (prefilled || !data) return;
    const active = data.sets.find((s) => s.status === 'active');
    if (active) {
      setForm((f) => ({ ...f, subject: active.subject, grade: active.grade, topic: active.topic, classDetail: active.classDetail }));
      setPrefilled(true);
    }
  }, [data, prefilled]);

  const generate = async () => {
    if (!form.topic.trim()) {
      toast({ tone: 'amber', title: 'Topic required', body: 'Tell the generator which lesson this is for.' });
      return;
    }
    setBusy(true);
    try {
      const res = await api.generate(form);
      setVariants(res.variants);
      setMeta(res);
      toast({ tone: 'mint', title: '10 unique variants generated', body: 'Every student gets a different scenario, banned list and structural rule.' });
    } catch (e) {
      toast({ tone: 'rose', title: 'Generation failed', body: e.message });
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const res = await api.publish(form);
      toast({ tone: 'mint', title: `“${res.set.title}” published`, body: `${res.set.variants.length} variants assigned · due in ${form.dueInDays} day(s).` });
      setVariants(res.set.variants);
      refresh();
    } catch (e) {
      toast({ tone: 'rose', title: 'Publish failed', body: e.message });
    } finally {
      setPublishing(false);
    }
  };

  const activeSet = data?.sets.find((s) => s.id === data.activeId);
  const stats = useMemo(() => {
    const list = variants.length ? variants : activeSet?.variants || [];
    return {
      count: list.length,
      traps: list.length ? Math.round(list.reduce((a, v) => a + v.traps.length, 0) / list.length) : 0,
      scenarios: new Set(list.map((v) => v.scenarioId)).size,
      codes: new Set(list.map((v) => v.code)).size,
    };
  }, [variants, activeSet]);

  const shown = variants.length ? variants : activeSet?.variants || [];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row tight" style={{ marginBottom: 8 }}>
            <Chip tone="mint dot">Assignment studio</Chip>
            <Chip plain>{stats.codes} unique variant codes</Chip>
            <Chip plain>{stats.traps} traps per paper</Chip>
          </div>
          <h1>One topic, ten un-copyable variants</h1>
          <p className="sub">Generate the set, inspect the hidden detection key, then publish. Every student receives a different Tashkent scenario, a different banned-phrase list and a different structural constraint.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={generate} disabled={busy}>
            {busy ? <Spinner size={14} /> : <Wand2 size={15} />} {variants.length ? 'Regenerate' : 'Generate 10'}
          </button>
          <button className="btn primary" onClick={publish} disabled={publishing || !form.topic.trim()}>
            {publishing ? <Spinner size={14} /> : <Send size={15} />} Publish to classes
          </button>
        </div>
      </div>

      <div className="grid g4">
        <KPI label="Variants" value={stats.count} sub="No two students share a code" tone="mint" icon={<Layers size={13} />} />
        <KPI label="Tashkent scenarios" value={stats.scenarios} sub="Local context per variant" tone="violet" icon={<Target size={13} />} />
        <KPI label="Trap layers" value={stats.traps} unit="/paper" sub="Scenario · classroom · banned · structure · length" tone="amber" icon={<ShieldCheck size={13} />} />
        <KPI label="Active set" value={activeSet ? activeSet.variants.length : 0} sub={activeSet ? activeSet.title : 'none'} tone="mint" icon={<CheckCircle2 size={13} />} />
      </div>

      <div className="split">
        <Card>
          <CardHead title="Generation inputs" sub="Part 2 of the master prompt, wired to the UI" icon={<Sparkles size={16} />} right={<Chip tone="amber"><Lock size={11} /> key hidden from students</Chip>} />
          <div className="card-body stack" style={{ gap: 12 }}>
            <div className="grid g2" style={{ gap: 12 }}>
              <div className="field">
                <label>Subject</label>
                <select className="select" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                  {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Grade level</label>
                <select className="select" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                  {GRADES.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Lesson topic</label>
              <input className="input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Persuasive paragraph structure" />
            </div>
            <div className="field">
              <label>Today's classroom detail</label>
              <textarea
                className="textarea"
                style={{ minHeight: 88 }}
                value={form.classDetail}
                onChange={(e) => setForm({ ...form, classDetail: e.target.value })}
                placeholder="A specific example, debate or event from today — the anchor an external AI can never know."
              />
              <span className="hintline">This becomes an unguessable trap: the answer must reference it or it fails compliance.</span>
            </div>
            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ width: 150 }}>
                <label>Due in</label>
                <select className="select" value={form.dueInDays} onChange={(e) => setForm({ ...form, dueInDays: Number(e.target.value) })}>
                  <option value={1}>1 day</option>
                  <option value={2}>2 days</option>
                  <option value={3}>3 days</option>
                  <option value={7}>1 week</option>
                </select>
              </div>
              <div style={{ flex: 1 }} />
              <button className="btn primary" onClick={generate} disabled={busy} style={{ alignSelf: 'flex-end' }}>
                {busy ? <Spinner size={14} /> : <Wand2 size={15} />} Generate variants
              </button>
            </div>
          </div>
        </Card>

        <div className="stack">
          <Card>
            <CardHead title="How the trap works" sub="Academic-integrity logic" icon={<ShieldCheck size={16} />} />
            <div className="card-body stack" style={{ gap: 10 }}>
              {[
                ['Unique variant code', 'Each student’s code is embedded in the brief. If it turns up in a paste, the source is known.'],
                ['Classroom anchor', 'The answer must reference a detail only students in Room 214 heard.'],
                ['Scenario lock', 'A Tashkent context replaces generic examples; a model reaches for New York.'],
                ['Banned phrases', 'High-probability AI connectors void the submission outright.'],
                ['Structural constraint', '“Exactly one sentence starting with However,” is trivial for a human, hard for a model.'],
                ['Voice defense', 'The final lock: 30 seconds on a paragraph you did not choose.'],
              ].map(([t, d], i) => (
                <div className="row" style={{ alignItems: 'flex-start', gap: 9 }} key={t}>
                  <span className="step-num" style={{ width: 20, height: 20, fontSize: 10 }}>{i + 1}</span>
                  <div><b style={{ fontSize: 12.5 }}>{t}</b><div className="xs muted">{d}</div></div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="soft">
            <div className="card-body row" style={{ justifyContent: 'space-between' }}>
              <div>
                <b style={{ fontSize: 12.5 }}>Output contract</b>
                <div className="xs muted">JSON schema, hidden key, rubric</div>
              </div>
              <a className="btn small ghost" href="/api/prompts" target="_blank" rel="noreferrer"><FileJson size={13} /> Prompt library</a>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHead
          title={variants.length ? 'Generated variants' : `Active set · ${activeSet?.title || 'none'}`}
          sub={meta ? `Generated ${new Date(meta.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · seed locked to lesson date` : 'Click any variant to inspect the teacher-only detection key'}
          icon={<Layers size={16} />}
          right={<Chip tone="mint">{shown.length} variants</Chip>}
        />
        <div className="card-body">
          <div className="grid g2">
            {shown.map((v) => (
              <button key={v.code} className="card soft pad" style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit' }} onClick={() => { setOpenVariant(v); setRevealKey(false); }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="mono" style={{ color: 'var(--mint)', fontSize: 11.5 }}>{v.code}</span>
                  <span className="row tight">
                    <Chip plain>#{v.index}</Chip>
                    <Chip tone="amber" className="nowrap">{v.estimatedMinutes} min</Chip>
                  </span>
                </div>
                <b style={{ fontFamily: 'var(--display)', fontSize: 14.5, display: 'block', lineHeight: 1.3 }}>{v.title}</b>
                <p className="xs muted" style={{ marginTop: 5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.questions[0]}</p>
                <div className="row tight" style={{ marginTop: 9 }}>
                  <Chip tone="violet">{v.traps.length} traps</Chip>
                  <Chip tone="rose">{v.bannedPhrases.length} banned</Chip>
                  <Chip plain>{v.wordRange ? `${v.wordRange.min}–${v.wordRange.max}w` : `${v.traps.find((t) => t.kind === 'length')?.min || 180}w`}</Chip>
                </div>
              </button>
            ))}
          </div>
          {shown.length === 0 && <div className="xs muted">No set yet — generate variants above.</div>}
        </div>
      </Card>

      <Drawer
        open={!!openVariant}
        onClose={() => setOpenVariant(null)}
        title={openVariant?.title || ''}
        sub={openVariant ? `${openVariant.subject} · ${openVariant.grade} · ${openVariant.code}` : ''}
        actions={openVariant ? <CopyButton text={JSON.stringify(openVariant, null, 2)} label="Copy JSON" /> : null}
      >
        {openVariant && (
          <>
            <div className="notice mint"><ShieldCheck size={15} /><span>{openVariant.objective}</span></div>

            <div className="card">
              <CardHead title="Part 1 · Analytical questions" icon={<Target size={15} />} />
              <div className="card-body stack" style={{ gap: 11 }}>
                {openVariant.questions.map((q, i) => (
                  <div key={i} className="row" style={{ alignItems: 'flex-start', gap: 9 }}>
                    <span className="mono muted" style={{ marginTop: 2 }}>Q{i + 1}</span>
                    <p className="small dim">{q}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <CardHead title="Part 2 · Embedded AI-trap constraints" icon={<Lock size={15} />} right={<Chip tone="rose">student-visible</Chip>} />
              <div className="card-body stack" style={{ gap: 8 }}>
                {openVariant.constraint.map((c, i) => (
                  <div className="row" style={{ alignItems: 'flex-start', gap: 9 }} key={i}>
                    <span className="step-num" style={{ width: 20, height: 20, fontSize: 10 }}>{i + 1}</span>
                    <p className="xs dim">{c}</p>
                  </div>
                ))}
                <div className="trap-list" style={{ marginTop: 6 }}>
                  {openVariant.traps.map((t) => (
                    <div key={t.id} className="trap">
                      <span className="t-ico"><ShieldCheck size={13} style={{ color: 'var(--mint)' }} /></span>
                      <div><b>{t.label}</b><span>{t.kind}{t.value ? ` · ${t.value}` : ''}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <CardHead title="Part 3 · Voice defense" icon={<MicIcon />} right={<Chip tone="violet">30 seconds</Chip>} />
              <div className="card-body"><p className="small dim">{openVariant.defensePrompt}</p></div>
            </div>

            <div className="card">
              <CardHead
                title="Part 5 · AI-Detection key"
                sub="Hidden from students — internal only"
                icon={<Eye size={15} />}
                right={<button className="btn tiny" onClick={() => setRevealKey((r) => !r)}>{revealKey ? <><EyeOff size={12} /> Hide</> : <><Eye size={12} /> Reveal</>}</button>}
              />
              <div className="card-body stack" style={{ gap: 10 }}>
                {!revealKey ? (
                  <div className="empty" style={{ padding: '14px 0' }}>
                    <Lock />
                    <b>Key hidden</b>
                    <p>Revealing this is an audited action in production and is never available to student accounts.</p>
                  </div>
                ) : (
                  <>
                    <div className="row tight"><Chip tone="rose">watermark {openVariant.watermark || openVariant.code}</Chip><Chip plain>rubric {openVariant.rubricTotal} pts</Chip></div>
                    <div>
                      <b className="xs" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>Generic phrasing expected</b>
                      <div className="stack" style={{ gap: 4, marginTop: 5 }}>
                        {openVariant.detectionKey.expectedGenericPhrases.map((p) => <div className="xs muted" key={p}>· {p}</div>)}
                      </div>
                    </div>
                    <div>
                      <b className="xs" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>Structural template</b>
                      <p className="xs muted" style={{ marginTop: 4 }}>{openVariant.detectionKey.structuralTemplate}</p>
                    </div>
                    <div>
                      <b className="xs" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>Hallucination tells</b>
                      <div className="stack" style={{ gap: 4, marginTop: 5 }}>
                        {openVariant.detectionKey.factualHallucinations.map((p) => <div className="xs muted" key={p}>· {p}</div>)}
                      </div>
                    </div>
                    <div className="notice amber"><AlertTriangle size={14} /><span>{openVariant.detectionKey.trapExplanation}</span></div>
                    <div>
                      <b className="xs" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>10-point rubric</b>
                      <div className="stack" style={{ gap: 4, marginTop: 5 }}>
                        {openVariant.detectionKey.rubric.map((r) => <div className="xs muted" key={r}>· {r}</div>)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </Drawer>
    </>
  );
}

function MicIcon() {
  return <Sparkles size={15} />;
}
