import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ClipboardCheck, Coins, Flag, GraduationCap, Info, Mic, Search,
  ShieldCheck, Sparkles, XCircle, Clock, ArrowRight,
} from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { useData } from '../hooks.js';
import {
  Avatar, Bar, Card, CardHead, Chip, Drawer, Gauge, HighlightedText, KPI, Spinner,
  aiBandLabel, aiTone, initialsOf, timeAgo,
} from '../components/ui.jsx';

export default function TeacherQueue() {
  const { toast, refresh } = useApp();
  const [kick, setKick] = useState(0);
  const { data, error } = useData(() => api.teacherOverview(), [kick]);
  const [filter, setFilter] = useState('pending');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);

  const open = useCallback(async (id) => {
    setSelected(id);
    setDetail(null);
    setLoadingDetail(true);
    try {
      setDetail(await api.teacherSubmission(id));
    } catch (e) {
      toast({ tone: 'rose', title: 'Could not load submission', body: e.message });
    } finally {
      setLoadingDetail(false);
    }
  }, [toast]);

  const reload = () => {
    setKick((k) => k + 1);
    if (selected) open(selected);
  };

  const approve = async (grade, note) => {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await api.approve(detail.submission.id, { grade: Number(grade), note });
      toast({ tone: 'mint', title: `Approved at ${res.submission.grade}/100`, body: `${res.submission.studentName} · ${res.submission.coins.reduce((a, c) => a + c.coins, 0)} coins settled.` });
      reload();
      refresh();
    } catch (e) {
      toast({ tone: 'rose', title: 'Approval blocked', body: e.message });
    } finally {
      setBusy(false);
    }
  };

  const flag = async (reason) => {
    if (!detail) return;
    setBusy(true);
    try {
      await api.flag(detail.submission.id, { reason });
      toast({ tone: 'rose', title: 'Flagged for coordinator', body: reason || 'Authorship could not be verified.' });
      reload();
      refresh();
    } catch (e) {
      toast({ tone: 'rose', title: 'Could not flag', body: e.message });
    } finally {
      setBusy(false);
    }
  };

  const bulkApprove = async () => {
    const eligible = (data?.queue || []).filter((s) => s.status === 'pending' && s.report.aiProbability < 20 && s.defense?.voiceprint?.verdict === 'match');
    if (!eligible.length) {
      toast({ tone: 'amber', title: 'Nothing auto-clear', body: 'No pending paper is simultaneously AI-free and Voice-Print verified.' });
      return;
    }
    setBusy(true);
    let ok = 0;
    for (const s of eligible) {
      try {
        await api.approve(s.id, { grade: s.report.grade.total, note: 'Bulk-approved: AI-free + Voice-Print verified.' });
        ok++;
      } catch { /* skip */ }
    }
    setBusy(false);
    toast({ tone: 'mint', title: `${ok} papers approved`, body: 'AI-free and Voice-Print verified — approved with the rubric grade.' });
    reload();
    refresh();
  };

  const rows = useMemo(() => {
    const list = data?.queue || [];
    return list
      .filter((s) => filter === 'all' || s.status === filter)
      .filter((s) => !query || s.studentName.toLowerCase().includes(query.toLowerCase()) || s.variantCode.toLowerCase().includes(query.toLowerCase()));
  }, [data, filter, query]);

  if (error) return <Card><div className="card-body"><div className="notice rose"><AlertTriangle size={15} />{error}</div></div></Card>;
  if (!data) return <Card><div className="card-body" style={{ display: 'grid', placeItems: 'center', minHeight: 240 }}><Spinner /></div></Card>;

  const counts = {
    pending: data.queue.filter((s) => s.status === 'pending').length,
    approved: data.queue.filter((s) => s.status === 'approved').length,
    flagged: data.queue.filter((s) => s.status === 'flagged').length,
    all: data.queue.length,
  };
  const el = detail?.submission;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row tight" style={{ marginBottom: 8 }}>
            <Chip tone="amber dot">{counts.pending} pending</Chip>
            <Chip tone="rose">{counts.flagged} escalated</Chip>
            <Chip plain>Target &lt; 10 s per report</Chip>
          </div>
          <h1>Review queue</h1>
          <p className="sub">AI signal, peer overlap, trap compliance and the Voice-Print check arrive together. Approve, adjust the grade, or escalate — one click each.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={bulkApprove} disabled={busy}><Sparkles size={15} /> Approve all clear</button>
          <button className="btn primary" onClick={() => (window.location.hash = 'studio')}><ClipboardCheck size={15} /> New assignment</button>
        </div>
      </div>

      <div className="grid g4">
        <KPI label="Awaiting review" value={counts.pending} sub="Sorted by risk" tone="amber" icon={<Clock size={13} />} />
        <KPI label="Approved" value={counts.approved} sub={`${Math.round((counts.approved / Math.max(1, counts.all)) * 100)}% of queue`} tone="mint" icon={<CheckCircle2 size={13} />} />
        <KPI label="Escalated" value={counts.flagged} sub="Voice mismatch or copy overlap" tone="rose" icon={<Flag size={13} />} />
        <KPI label="Avg AI signal" value={data.stats.avgAi} unit="%" sub="Whole cohort" tone="violet" icon={<ShieldCheck size={13} />} />
      </div>

      <Card>
        <CardHead
          title="Submissions"
          sub="Click a row to open the full teacher report"
          icon={<ClipboardCheck size={16} />}
          right={
            <div className="row tight">
              <div className="segmented">
                {['pending', 'flagged', 'approved', 'all'].map((f) => (
                  <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                    {f}{f !== 'all' ? ` ${counts[f]}` : ''}
                  </button>
                ))}
              </div>
            </div>
          }
        />
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
              <Search size={14} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--muted)' }} />
              <input className="input" style={{ paddingLeft: 32 }} placeholder="Search student or variant code" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <span className="xs muted">{rows.length} shown</span>
          </div>
        </div>
        <div className="card-body flush">
          <table className="table">
            <thead>
              <tr><th>Student</th><th>Variant</th><th>AI signal</th><th>Peer overlap</th><th>Voice-Print</th><th>Traps</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="clickable" onClick={() => open(s.id)}>
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
                  <td><Chip tone={aiTone(s.report.aiProbability)}>{s.report.aiProbability}% · {aiBandLabel(s.report.band)}</Chip></td>
                  <td>
                    <span className="mono xs" style={{ color: s.plagiarism.maxSimilarity > 0.5 ? 'var(--rose)' : 'var(--muted)' }}>
                      {Math.round(s.plagiarism.maxSimilarity * 100)}%
                    </span>
                  </td>
                  <td>
                    <Chip tone={s.defense?.voiceprint?.verdict === 'match' ? 'mint' : s.defense?.voiceprint?.verdict === 'review' ? 'amber' : s.defense ? 'rose' : 'plain'}>
                      {s.defense ? `${Math.round((s.defense.voiceprint?.similarity || 0) * 100)}% ${s.defense.voiceprint?.verdict}` : 'no defense'}
                    </Chip>
                  </td>
                  <td className="mono xs">{s.report.traps.filter((t) => t.pass).length}/{s.report.traps.length}</td>
                  <td><Chip tone={s.status === 'approved' ? 'mint' : s.status === 'flagged' ? 'rose' : 'amber'}>{s.status}</Chip></td>
                  <td><ArrowRight size={13} className="muted" /></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8}><div className="empty"><ClipboardCheck /><b>Nothing here</b><p>No submissions match this filter.</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer
        open={!!selected}
        onClose={() => { setSelected(null); setDetail(null); }}
        title={el ? el.studentName : 'Teacher report'}
        sub={el ? `${el.setTitle} · ${el.variantCode} · ${el.id}` : 'Loading…'}
        actions={el ? <Chip tone={el.status === 'approved' ? 'mint' : el.status === 'flagged' ? 'rose' : 'amber'} dot>{el.status}</Chip> : null}
      >
        {loadingDetail || !detail ? (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 200 }}><Spinner size={20} /></div>
        ) : (
          <>
            <div className="card">
              <div className="card-body">
                <div className="row" style={{ gap: 18, alignItems: 'flex-start' }}>
                  <div style={{ display: 'grid', justifyItems: 'center', gap: 7 }}>
                    <Gauge value={el.report.aiProbability} label="AI signal" tone={aiTone(el.report.aiProbability)} />
                    <Chip tone={aiTone(el.report.aiProbability)}>{aiBandLabel(el.report.band)}</Chip>
                  </div>
                  <div className="stack" style={{ gap: 9, flex: 1 }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="small dim">Methods</span>
                      <span className="xs muted">{el.report.metrics.elapsedMs} ms compute · 10 s budget</span>
                    </div>
                    {el.report.signals.slice(0, 6).map((s) => (
                      <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 10, alignItems: 'center' }}>
                        <div>
                          <div className="row" style={{ justifyContent: 'space-between' }}>
                            <b style={{ fontSize: 12 }}>{s.label}</b>
                            <span className="mono xs muted">{Math.round(s.value * 100)}</span>
                          </div>
                          <div className="xs muted">{s.detail}</div>
                        </div>
                        <Bar value={s.value * 100} tone="rose" height={5} />
                      </div>
                    ))}
                    {el.report.counters.length > 0 && (
                      <div className="row tight">
                        {el.report.counters.map((c) => <Chip key={c.id} tone="mint">authorship: {c.label}</Chip>)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid g2">
              <div className="card">
                <CardHead title="Suggested grade" sub="Rubric-aligned, editable" icon={<GraduationCap size={15} />} />
                <div className="card-body stack" style={{ gap: 9 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span className="mono" style={{ fontSize: 24 }}>{el.report.grade.total}<span className="muted" style={{ fontSize: 13 }}>/100</span></span>
                    <Chip tone={el.report.grade.total >= 75 ? 'mint' : 'amber'}>{el.report.grade.letter}</Chip>
                  </div>
                  {el.report.grade.criteria.map((c) => (
                    <div key={c.id}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <span className="xs dim">{c.label}</span>
                        <span className="mono xs">{c.score}/{c.max}</span>
                      </div>
                      <div style={{ marginTop: 3 }}><Bar value={(c.score / c.max) * 100} height={4} tone={c.score / c.max > 0.7 ? '' : c.score / c.max > 0.45 ? 'amber' : 'rose'} /></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <CardHead title="Voice defense" sub="30-second recording" icon={<Mic size={15} />} />
                <div className="card-body stack" style={{ gap: 9 }}>
                  {el.defense ? (
                    <>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <span className="small dim">Voice-Print</span>
                        <Chip tone={el.defense.voiceprint?.verdict === 'match' ? 'mint' : el.defense.voiceprint?.verdict === 'review' ? 'amber' : 'rose'}>
                          {Math.round((el.defense.voiceprint?.similarity || 0) * 100)}% · {el.defense.voiceprint?.verdict}
                        </Chip>
                      </div>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <span className="small dim">Duration</span>
                        <span className="mono xs">{Math.round(el.defense.durationS || 0)}s</span>
                      </div>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <span className="small dim">Speech quality</span>
                        <span className="mono xs">{el.defense.transcriptQuality}</span>
                      </div>
                      <div className="notice" style={{ padding: '8px 10px', fontSize: 11.5 }}>
                        <Info size={13} />
                        <span>“{el.defense.question}”</span>
                      </div>
                    </>
                  ) : (
                    <div className="notice amber"><Clock size={14} /><span>Defense not recorded yet. Coins stay locked.</span></div>
                  )}
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="small dim">Peer overlap</span>
                    <Chip tone={el.plagiarism.maxSimilarity > 0.5 ? 'rose' : 'plain'}>{Math.round(el.plagiarism.maxSimilarity * 100)}%</Chip>
                  </div>
                  {el.plagiarism.peerName && (
                    <div className="xs muted">Closest match: {el.plagiarism.peerName}. Six-word shingle overlap against every peer submission in the same set.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <CardHead title="Embedded trap compliance" sub="What an external model cannot fake" icon={<ShieldCheck size={15} />} />
              <div className="card-body stack" style={{ gap: 7 }}>
                {el.report.traps.map((t) => (
                  <div key={t.id} className={`trap ${t.pass ? 'pass' : 'fail'}`}>
                    <span className="t-ico">{t.pass ? <CheckCircle2 size={13} style={{ color: 'var(--mint)' }} /> : <XCircle size={13} style={{ color: 'var(--rose)' }} />}</span>
                    <div><b>{t.label}</b><span>{t.detail}</span></div>
                  </div>
                ))}
                {detail.variant?.detectionKey && (
                  <details style={{ marginTop: 4 }}>
                    <summary className="xs muted" style={{ cursor: 'pointer' }}>Detection key for this variant (hidden from students)</summary>
                    <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                      {detail.variant.detectionKey.expectedGenericPhrases.map((p) => <div key={p} className="xs muted">· {p}</div>)}
                      <div className="xs muted" style={{ marginTop: 4 }}>{detail.variant.detectionKey.trapExplanation}</div>
                    </div>
                  </details>
                )}
              </div>
            </div>

            {el.report.issues.length > 0 && (
              <div className="card">
                <CardHead title="Specific errors" sub="Grammar, logic and integrity" icon={<AlertTriangle size={15} />} right={<Chip plain>{el.report.issues.length}</Chip>} />
                <div className="card-body stack" style={{ gap: 7 }}>
                  {el.report.issues.map((iss, i) => (
                    <div className="issue" key={i}>
                      <span className={`i-kind ${iss.kind}`}>{iss.kind}</span>
                      <div><p><q>{iss.quote}</q> — {iss.note}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <CardHead title="Socratic tutor log" sub={`${el.hintsUsed} hints attached to this submission`} icon={<Sparkles size={15} />} />
              <div className="card-body">
                {detail.tutorLog?.length ? (
                  <div className="stack" style={{ gap: 6 }}>
                    {detail.tutorLog.flatMap((l) => l.hints).slice(-5).map((h, i) => (
                      <div key={i} className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
                        <Chip tone="violet">L{h.level}</Chip>
                        <div>
                          <b style={{ fontSize: 12 }}>{h.label}</b>
                          <div className="xs muted">“{h.excerpt}”</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="xs muted">No tutor hints — the student worked independently.</div>
                )}
                <p className="xs muted" style={{ marginTop: 8 }}>The tutor is Socratic-only: it refused {detail.tutorLog?.length ? 'any' : 'no'} direct-answer attempts and never supplied wording.</p>
              </div>
            </div>

            <div className="card">
              <CardHead title="Submitted text" sub="Highlighted spans raised the AI signal" icon={<ClipboardCheck size={15} />} right={<span className="xs muted">{el.report.metrics.wordCount} words</span>} />
              <div className="card-body"><HighlightedText text={el.text} tells={el.report.tells} /></div>
            </div>

            <ApproveBar el={el} busy={busy} onApprove={approve} onFlag={flag} />
          </>
        )}
      </Drawer>
    </>
  );
}

function ApproveBar({ el, busy, onApprove, onFlag }) {
  const [grade, setGrade] = useState(el.report.grade.total);
  const [note, setNote] = useState(el.teacherNote || '');
  const [flagReason, setFlagReason] = useState('');
  const [mode, setMode] = useState('approve');
  const coins = el.coins.reduce((a, c) => a + c.coins, 0);

  useEffect(() => { setGrade(el.report.grade.total); setNote(el.teacherNote || ''); }, [el.id, el.report.grade.total, el.teacherNote]);

  return (
    <div className="card" style={{ position: 'sticky', bottom: 0, borderColor: 'var(--line-strong)' }}>
      <div className="card-body stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="segmented">
            <button className={mode === 'approve' ? 'active' : ''} onClick={() => setMode('approve')}>Approve</button>
            <button className={mode === 'flag' ? 'active' : ''} onClick={() => setMode('flag')}>Escalate</button>
          </div>
          <Chip tone="amber"><Coins size={12} /> {coins} coins {el.status === 'approved' ? 'settled' : 'held'}</Chip>
        </div>

        {mode === 'approve' ? (
          <>
            <div className="row tight" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ width: 96 }}>
                <label>Grade</label>
                <input className="input" type="number" min="0" max="100" value={grade} onChange={(e) => setGrade(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Teacher note (optional)</label>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Strong local anchor — approved." />
              </div>
              <button className="btn primary" disabled={busy} onClick={() => onApprove(grade, note)}>
                {busy ? <Spinner size={14} /> : <CheckCircle2 size={15} />} {el.status === 'approved' ? 'Update grade' : 'Approve & settle coins'}
              </button>
            </div>
            {el.defense?.voiceprint?.verdict === 'mismatch' && (
              <div className="notice rose" style={{ padding: '8px 11px' }}>
                <AlertTriangle size={14} /><span>Voice-Print mismatch on record. Approving publishes the grade but keeps the authorship flag.</span>
              </div>
            )}
          </>
        ) : (
          <div className="row tight" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Reason for escalation</label>
              <input className="input" value={flagReason} onChange={(e) => setFlagReason(e.target.value)} placeholder="e.g. Voice mismatch + 86% overlap with another variant" />
            </div>
            <button className="btn danger" disabled={busy} onClick={() => onFlag(flagReason)}>
              <Flag size={15} /> Escalate & reverse coins
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
