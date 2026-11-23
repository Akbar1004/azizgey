import React, { useState } from 'react';
import { AlertTriangle, Coins, Flame, Trophy, Users, Zap, Medal } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { useData } from '../hooks.js';
import { Avatar, Bar, Card, CardHead, Chip, KPI, Spinner, initialsOf } from '../components/ui.jsx';

export default function Leaderboard() {
  const { studentId, role } = useApp();
  const { data, error } = useData(() => api.leaderboard(), []);
  const [tab, setTab] = useState('branches');

  if (error) return <Card><div className="card-body"><div className="notice rose"><AlertTriangle size={15} />{error}</div></div></Card>;
  if (!data) return <Card><div className="card-body" style={{ display: 'grid', placeItems: 'center', minHeight: 220 }}><Spinner /></div></Card>;

  const top = data.branches[0];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row tight" style={{ marginBottom: 8 }}>
            <Chip tone="amber dot">Live standings</Chip>
            <Chip plain>Term 2 · Week 12</Chip>
            <Chip plain>Reset every term</Chip>
          </div>
          <h1>Branch &amp; class leaderboards</h1>
          <p className="sub">Points come from verified work only — on-time, AI-free, voice-defended. No streak farming, no ghost submissions.</p>
        </div>
        <div className="page-actions">
          <div className="segmented">
            {[['branches', 'Branches'], ['classes', 'Classes'], ['students', 'Students']].map(([id, label]) => (
              <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid g4">
        <KPI label="Leading branch" value={top.name} sub={`${top.coins.toLocaleString()} coins`} tone="amber" icon={<Trophy size={13} />} />
        <KPI label="Branches live" value={data.branches.length} sub="Sergeli · Yunusobod · Qoraqamish · Tinchlik" tone="mint" icon={<Users size={13} />} />
        <KPI label="Pilot students" value={data.students.length} sub="Voice-verified cohort" tone="violet" icon={<Zap size={13} />} />
        <KPI label="Best AI-free rate" value={`${Math.max(...data.branches.map((b) => b.aiFree))}%`} sub="Branch average" tone="mint" icon={<Flame size={13} />} />
      </div>

      {tab === 'branches' && (
        <div className="grid g2">
          {data.branches.map((b, i) => (
            <Card key={b.id}>
              <div className="card-body stack" style={{ gap: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="row" style={{ gap: 10 }}>
                    <div className={`medal g${i + 1}`} style={{ fontSize: 22 }}>{i + 1}</div>
                    <div>
                      <h3 style={{ fontSize: 17 }}>{b.name}</h3>
                      <div className="xs muted">{b.students} students · opened {2018 + i}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: 16, color: 'var(--amber)' }}>{b.coins.toLocaleString()}</div>
                    <div className="xs muted">Target Coins</div>
                  </div>
                </div>
                <Bar value={(b.coins / top.coins) * 100} tone={i === 0 ? '' : 'violet'} height={6} />
                <div className="grid g3" style={{ gap: 8 }}>
                  {[['AI-free', b.aiFree, '%'], ['On-time', b.onTime, '%'], ['Defense', b.defense, '%']].map(([label, v, u]) => (
                    <div key={label}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <span className="xs muted">{label}</span>
                        <span className="mono xs">{v}{u}</span>
                      </div>
                      <div style={{ marginTop: 4 }}><Bar value={v} height={4} tone={v >= 90 ? '' : v >= 82 ? 'violet' : 'amber'} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'classes' && (
        <Card>
          <CardHead title="Class standings" sub="Coins per class, all branches" icon={<Medal size={16} />} />
          <div className="card-body flush">
            <table className="table">
              <thead><tr><th>#</th><th>Class</th><th>Students</th><th>AI-free</th><th style={{ textAlign: 'right' }}>Coins</th></tr></thead>
              <tbody>
                {data.classes.map((c, i) => (
                  <tr key={c.id}>
                    <td><div className={`medal g${i + 1}`}>{i + 1}</div></td>
                    <td><b style={{ fontSize: 12.5 }}>{c.label}</b></td>
                    <td className="mono xs">{c.members}</td>
                    <td>
                      <div className="row tight">
                        <div style={{ width: 70 }}><Bar value={c.aiFree} height={4} tone={c.aiFree > 85 ? '' : 'amber'} /></div>
                        <span className="mono xs">{c.aiFree}%</span>
                      </div>
                    </td>
                    <td className="mono" style={{ textAlign: 'right', color: 'var(--amber)' }}>{c.coins.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'students' && (
        <Card>
          <CardHead title="Student standings" sub="Your row is highlighted" icon={<Trophy size={16} />} right={<Chip plain>{data.students.length} students</Chip>} />
          <div className="card-body flush">
            <table className="table">
              <thead><tr><th>#</th><th>Student</th><th>Branch</th><th>Class</th><th>Streak</th><th style={{ textAlign: 'right' }}>Coins</th><th style={{ textAlign: 'right' }}>XP</th></tr></thead>
              <tbody>
                {data.students.map((s, i) => (
                  <tr key={s.id} className={role === 'student' && s.id === studentId ? 'me' : ''}>
                    <td><div className={`medal g${i + 1}`}>{i + 1}</div></td>
                    <td>
                      <div className="row tight">
                        <Avatar initials={initialsOf(s.name)} tone={s.tone} />
                        <div>
                          <b style={{ fontSize: 12.5 }}>{s.name}</b>
                          {role === 'student' && s.id === studentId && <div className="xs" style={{ color: 'var(--mint)' }}>you</div>}
                        </div>
                      </div>
                    </td>
                    <td className="small dim">{s.branchName}</td>
                    <td className="mono xs">{s.className}</td>
                    <td><Chip tone={s.streak >= 5 ? 'mint' : 'plain'}><Flame size={11} /> {s.streak}</Chip></td>
                    <td className="mono" style={{ textAlign: 'right', color: 'var(--amber)' }}>{s.coins}</td>
                    <td className="mono xs" style={{ textAlign: 'right', color: 'var(--muted)' }}>{s.xp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
