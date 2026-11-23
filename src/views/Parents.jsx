import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Coins, Mic, Send, ShieldCheck, Smartphone, Users } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { useData } from '../hooks.js';
import { Avatar, Bar, Card, CardHead, Chip, CopyButton, KPI, Spinner, TelegramText, timeAgo } from '../components/ui.jsx';

export default function Parents() {
  const { parentId: defaultParent, toast } = useApp();
  const { data: parentData, error } = useData(() => api.parents(), []);
  const [selected, setSelected] = useState(defaultParent);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState([]);

  useEffect(() => {
    if (!parentData) return;
    if (!parentData.parents.some((p) => p.id === selected)) setSelected(parentData.parents[0].id);
  }, [parentData, selected]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.parentReport(selected)
      .then((r) => { if (live) setReport(r); })
      .catch((e) => { if (live) toast({ tone: 'rose', title: 'Report failed', body: e.message }); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [selected, toast]);

  const send = async () => {
    setSending(true);
    try {
      const res = await api.sendReport(selected);
      setLog((l) => [res.delivery, ...l]);
      toast({ tone: 'mint', title: 'Delivered on Telegram', body: `${res.report.parent.name} · ${res.report.parent.telegram} · 1 message` });
    } catch (e) {
      toast({ tone: 'rose', title: 'Delivery failed', body: e.message });
    } finally {
      setSending(false);
    }
  };

  if (error) return <Card><div className="card-body"><div className="notice rose"><AlertTriangle size={15} />{error}</div></div></Card>;
  if (!parentData) return <Card><div className="card-body" style={{ display: 'grid', placeItems: 'center', minHeight: 220 }}><Spinner /></div></Card>;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row tight" style={{ marginBottom: 8 }}>
            <Chip tone="mint dot">Telegram connected</Chip>
            <Chip plain>{parentData.parents.length} opted-in parents</Chip>
            <Chip plain>Weekly · Sunday 18:00</Chip>
          </div>
          <h1>Parent reports</h1>
          <p className="sub">Plain-language summaries of on-time, AI-free work and voice-defense results. No jargon, no accusation — and a concrete thing the parent can do tonight.</p>
        </div>
        <div className="page-actions">
          <select className="select" style={{ width: 'auto' }} value={selected} onChange={(e) => setSelected(e.target.value)}>
            {parentData.parents.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.childName}</option>)}
          </select>
          <button className="btn primary" onClick={send} disabled={sending || !report}>
            {sending ? <Spinner size={14} /> : <Send size={15} />} Send now
          </button>
        </div>
      </div>

      {loading || !report ? (
        <Card><div className="card-body" style={{ display: 'grid', placeItems: 'center', minHeight: 220 }}><Spinner /></div></Card>
      ) : (
        <>
          <div className="grid g4">
            <KPI label="On-time" value={report.stats.onTime} unit="%" sub={`${report.stats.submissions} submissions`} tone="mint" icon={<Clock size={13} />} />
            <KPI label="AI-free" value={report.stats.aiFree} unit="%" sub="Below 20% AI signal" tone="violet" icon={<ShieldCheck size={13} />} />
            <KPI label="Voice defense" value={report.stats.defense} unit="%" sub="Passed on attempt" tone="amber" icon={<Mic size={13} />} />
            <KPI label="Average grade" value={report.stats.avgGrade ?? '—'} unit={report.stats.avgGrade ? "/100" : ''} sub={`${report.stats.graded} approved`} tone="mint" icon={<CheckCircle2 size={13} />} />
          </div>

          <div className="split">
            <Card>
              <CardHead
                title="Telegram preview"
                sub={`${report.parent.name} · ${report.parent.telegram}`}
                icon={<Smartphone size={16} />}
                right={<CopyButton text={report.message} label="Copy text" />}
              />
              <div className="card-body">
                <div className="telegram">
                  <div className="telegram-hd">
                    <Avatar initials="TS" tone="mint" />
                    <div style={{ flex: 1 }}>
                      <b style={{ fontSize: 12.5 }}>Target International School</b>
                      <div className="xs muted">@target_integrity_bot · weekly report</div>
                    </div>
                    <Chip tone="mint">bot</Chip>
                  </div>
                  <div className="telegram-body">
                    <div className="tg-bubble">
                      <TelegramText text={report.message} />
                      <div className="tg-time">18:00 <CheckCircle2 size={11} /></div>
                    </div>
                  </div>
                </div>
                <div className="row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
                  <span className="xs muted">Message length {report.message.length} characters · Uzbek-English mix available</span>
                  <button className="btn small" onClick={send} disabled={sending}>{sending ? <Spinner size={13} /> : <Send size={13} />} Deliver</button>
                </div>
              </div>
            </Card>

            <div className="stack">
              <Card>
                <CardHead title="Child snapshot" sub="Same data the parent sees" icon={<Users size={16} />} />
                <div className="card-body stack" style={{ gap: 10 }}>
                  <div className="row tight">
                    <Avatar initials={report.child.name.split(' ').map((x) => x[0]).join('')} tone="violet" size="lg" />
                    <div>
                      <b style={{ fontSize: 14 }}>{report.child.name}</b>
                      <div className="xs muted">{report.child.className} · {report.child.branchId} branch</div>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div className="mono" style={{ color: 'var(--amber)' }}>{report.child.coins}</div>
                      <div className="xs muted">coins</div>
                    </div>
                  </div>
                  <div className="divider" />
                  <div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="xs muted">Attendance of deadlines</span>
                      <span className="mono xs">{report.stats.onTime}%</span>
                    </div>
                    <div style={{ marginTop: 4 }}><Bar value={report.stats.onTime} height={5} /></div>
                  </div>
                  <div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="xs muted">AI-free rate</span>
                      <span className="mono xs">{report.stats.aiFree}%</span>
                    </div>
                    <div style={{ marginTop: 4 }}><Bar value={report.stats.aiFree} height={5} tone="violet" /></div>
                  </div>
                  <div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="xs muted">Defense pass rate</span>
                      <span className="mono xs">{report.stats.defense}%</span>
                    </div>
                    <div style={{ marginTop: 4 }}><Bar value={report.stats.defense} height={5} tone="amber" /></div>
                  </div>
                  {report.pending && (
                    <div className="notice amber" style={{ marginTop: 4 }}>
                      <Mic size={14} /><span><b>Open item:</b> voice defense for “{report.pending.setTitle}”.</span>
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <CardHead title="Weak topics flagged" sub="From the school heat-map" icon={<AlertTriangle size={16} />} right={<Chip tone={report.weakTopics.length ? 'rose' : 'mint'}>{report.weakTopics.length}</Chip>} />
                <div className="card-body stack" style={{ gap: 7 }}>
                  {report.weakTopics.length === 0 && <div className="xs muted">No weak topics in this section.</div>}
                  {report.weakTopics.map((w) => (
                    <div className="row" style={{ justifyContent: 'space-between' }} key={w.topic}>
                      <span className="small dim">{w.topic}</span>
                      <Chip tone="rose">{w.mastery}%</Chip>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          <Card>
            <CardHead title="Delivery log" sub="Every send is audited" icon={<Send size={16} />} right={<Chip plain>{log.length} this session</Chip>} />
            <div className="card-body flush">
              <table className="table">
                <thead><tr><th>Parent</th><th>Channel</th><th>Status</th><th>When</th><th>Preview</th></tr></thead>
                <tbody>
                  {log.length === 0 && (
                    <tr><td colSpan={5}><div className="xs muted" style={{ padding: 10 }}>No manual sends this session — the Sunday 18:00 batch runs automatically.</div></td></tr>
                  )}
                  {log.map((l) => (
                    <tr key={l.id}>
                      <td>{report.parent.name}</td>
                      <td className="mono xs">telegram</td>
                      <td><Chip tone="mint">{l.status}</Chip></td>
                      <td className="xs muted">{timeAgo(l.at)}</td>
                      <td className="xs muted" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.preview}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
