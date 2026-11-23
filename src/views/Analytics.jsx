import React, { useMemo } from 'react';
import { AlertTriangle, BarChart3, Map, Send, ShieldCheck, Sparkles, Target, TrendingDown, Trophy, Users } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { useData } from '../hooks.js';
import { Bar, Card, CardHead, Chip, KPI, Sparkline, Spinner } from '../components/ui.jsx';

const BUCKETS = [
  { label: '0–19% original', tone: '', key: 'original' },
  { label: '20–44% mixed', tone: 'violet', key: 'mixed' },
  { label: '45–69% suspicious', tone: 'amber', key: 'suspicious' },
  { label: '70%+ likely AI', tone: 'rose', key: 'ai' },
];

export default function Analytics() {
  const { toast, navigate } = useApp();
  const { data, error } = useData(() => api.teacherOverview(), []);

  const derived = useMemo(() => {
    if (!data) return null;
    const q = data.queue;
    const buckets = {
      original: q.filter((s) => s.report.aiProbability < 20).length,
      mixed: q.filter((s) => s.report.aiProbability >= 20 && s.report.aiProbability < 45).length,
      suspicious: q.filter((s) => s.report.aiProbability >= 45 && s.report.aiProbability < 70).length,
      ai: q.filter((s) => s.report.aiProbability >= 70).length,
    };
    const aiFree = Math.round(((buckets.original + buckets.mixed) / Math.max(1, q.length)) * 100);
    const weak = data.heatmap.weak;
    const trend = [...q]
      .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
      .slice(-10)
      .map((s) => s.report.aiProbability);
    return { buckets, aiFree, weak, trend };
  }, [data]);

  if (error) return <Card><div className="card-body"><div className="notice rose"><AlertTriangle size={15} />{error}</div></div></Card>;
  if (!data || !derived) return <Card><div className="card-body" style={{ display: 'grid', placeItems: 'center', minHeight: 240 }}><Spinner /></div></Card>;

  const { heatmap, leaderboard, stats, queue } = data;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row tight" style={{ marginBottom: 8 }}>
            <Chip tone="violet dot">Leadership view</Chip>
            <Chip plain>Mastery from graded work + voice-verified submissions</Chip>
          </div>
          <h1>Weak-topic heat-map</h1>
          <p className="sub">Anything under 30% mastery is flagged automatically and queued for an intervention assignment. The map updates after every approved submission.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate('studio')}><Sparkles size={15} /> Draft intervention</button>
          <button className="btn primary" onClick={() => navigate('parents')}><Send size={15} /> Parent reports</button>
        </div>
      </div>

      <div className="grid g4">
        <KPI label="Weak cells" value={derived.weak.length} sub="Below 30% mastery" tone="rose" icon={<TrendingDown size={13} />} />
        <KPI label="AI-free share" value={derived.aiFree} unit="%" sub={`${queue.length} live submissions`} tone="mint" icon={<ShieldCheck size={13} />} />
        <KPI label="Defense pass" value={`${stats.defenseRate}%`} sub="Voice-Print verified" tone="violet" icon={<Target size={13} />} />
        <KPI label="Escalations" value={stats.flagged} sub="Held from grading" tone="amber" icon={<AlertTriangle size={13} />} />
      </div>

      <Card>
        <CardHead
          title="Mastery by class and topic"
          sub="Grey cells were not taught in that section — never averaged into the school figure"
          icon={<Map size={16} />}
          right={<Chip tone="rose">{derived.weak.length} cells below 30%</Chip>}
        />
        <div className="card-body">
          <div className="heatmap" style={{ gridTemplateColumns: `minmax(190px, 1.5fr) repeat(${heatmap.classes.length}, minmax(70px, 1fr))` }}>
            <div />
            {heatmap.classes.map((c) => <div className="hm-head" key={c}>{c}</div>)}
            {heatmap.rows.map((row) => (
              <React.Fragment key={row.topic}>
                <div className="hm-row-label">
                  <div>
                    <div style={{ fontSize: 12.5 }}>{row.topic}</div>
                    <div className="xs muted">{row.subject} · avg {row.avg ?? '—'}%</div>
                  </div>
                </div>
                {row.cells.map((cell) => (
                  <div
                    key={cell.className}
                    className={`hm-cell ${cell.value === null ? 'empty' : cell.value < 30 ? 'weak' : ''}`}
                    style={cell.value === null ? undefined : {
                      background: `rgba(${cell.value < 30 ? '251,113,133' : cell.value < 60 ? '251,191,36' : '94,234,212'},${0.09 + (cell.value / 100) * 0.4})`,
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
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
            <div className="row tight">
              <span className="legend"><i style={{ background: 'rgba(251,113,133,0.5)' }} /> &lt;30% · intervention</span>
              <span className="legend"><i style={{ background: 'rgba(251,191,36,0.5)' }} /> 30–59%</span>
              <span className="legend"><i style={{ background: 'rgba(94,234,212,0.5)' }} /> 60%+</span>
              <span className="legend"><i style={{ background: 'rgba(255,255,255,0.06)' }} /> not taught</span>
            </div>
            <span className="xs muted">Threshold 30% · reviewed every Sunday</span>
          </div>
        </div>
      </Card>

      <div className="split">
        <div className="stack">
          <Card>
            <CardHead title="Intervention queue" sub="Lowest cells first" icon={<AlertTriangle size={16} />} />
            <div className="card-body flush">
              <table className="table">
                <thead><tr><th>Topic</th><th>Class</th><th>Mastery</th><th /></tr></thead>
                <tbody>
                  {[...derived.weak].sort((a, b) => a.mastery - b.mastery).map((w) => (
                    <tr key={`${w.topic}-${w.className}`}>
                      <td><b style={{ fontSize: 12.5 }}>{w.topic}</b><div className="xs muted">{w.subject}</div></td>
                      <td className="mono xs">{w.className}</td>
                      <td>
                        <div className="row tight">
                          <div style={{ width: 64 }}><Bar value={w.mastery} tone="rose" height={4} /></div>
                          <span className="mono xs" style={{ color: 'var(--rose)' }}>{w.mastery}%</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn tiny"
                          onClick={() => toast({ tone: 'mint', title: 'Intervention drafted', body: `A re-teach set with voice defense is staged for ${w.topic} (${w.className}). Open Assignment Studio to publish it.` })}
                        >
                          Draft
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHead title="AI-signal distribution" sub="Pilot cohort, live submissions" icon={<BarChart3 size={16} />} />
            <div className="card-body stack" style={{ gap: 12 }}>
              {BUCKETS.map((b) => {
                const count = derived.buckets[b.key];
                return (
                  <div key={b.key}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="small dim">{b.label}</span>
                      <span className="mono xs">{count} paper{count === 1 ? '' : 's'}</span>
                    </div>
                    <div style={{ marginTop: 4 }}><Bar value={(count / Math.max(1, queue.length)) * 100} tone={b.tone} height={6} /></div>
                  </div>
                );
              })}
              <div className="divider" />
              <div>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="small dim">AI signal trend (last 10 submissions)</span>
                  <span className="mono xs">{derived.trend[derived.trend.length - 1] ?? 0}% latest</span>
                </div>
                <Sparkline points={derived.trend} color="var(--amber)" height={44} />
              </div>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHead title="Branch performance" sub="Integrity metrics, not just coins" icon={<Trophy size={16} />} />
            <div className="card-body stack" style={{ gap: 12 }}>
              {leaderboard.branches.map((b) => (
                <div key={b.id}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <b style={{ fontSize: 12.5 }}>{b.name}</b>
                    <span className="mono xs" style={{ color: 'var(--amber)' }}>{b.coins.toLocaleString()}</span>
                  </div>
                  <div className="grid g3" style={{ gap: 8, marginTop: 5 }}>
                    {[['AI-free', b.aiFree], ['On-time', b.onTime], ['Defense', b.defense]].map(([l, v]) => (
                      <div key={l}>
                        <div className="xs muted">{l} {v}%</div>
                        <div style={{ marginTop: 3 }}><Bar value={v} height={3} tone={v >= 90 ? '' : v >= 84 ? 'violet' : 'amber'} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title="Delivery & cadence" sub="Automation that runs without a teacher" icon={<Send size={16} />} />
            <div className="card-body stack" style={{ gap: 9 }}>
              {[
                ['Weekly Telegram report', 'Sunday 18:00', 'mint'],
                ['Heat-map refresh', 'Daily 11:55', 'mint'],
                ['Voice-print re-enrolment', 'Every 60 days', 'violet'],
                ['Coordinator escalation digest', 'Weekdays 07:30', 'amber'],
              ].map(([label, when, tone]) => (
                <div className="row" style={{ justifyContent: 'space-between' }} key={label}>
                  <span className="small dim">{label}</span>
                  <Chip tone={tone}>{when}</Chip>
                </div>
              ))}
              <div className="notice mint" style={{ marginTop: 4 }}>
                <Users size={14} /><span>Reports go only to opted-in, verified parent numbers — never to a student device.</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
