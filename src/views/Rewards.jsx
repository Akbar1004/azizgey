import React, { useCallback, useState } from 'react';
import {
  BookOpen, Brain, CheckCircle2, Coffee, Coins, Flame, Gift, Lock, Mic, Shirt, Sparkles,
  Ticket, Trophy, ArrowRight, AlertTriangle,
} from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { useData } from '../hooks.js';
import { Avatar, Bar, Card, CardHead, Chip, KPI, Spinner, timeAgo } from '../components/ui.jsx';

const ICONS = { ticket: Ticket, shirt: Shirt, mic: Mic, brain: Brain, coffee: Coffee, book: BookOpen };

export default function Rewards() {
  const { studentId, toast, navigate } = useApp();
  const [kick, setKick] = useState(0);
  const { data, error } = useData(() => api.rewards(studentId), [studentId, kick]);
  const [busy, setBusy] = useState('');

  const redeem = useCallback(async (perk) => {
    setBusy(perk.id);
    try {
      const res = await api.redeem({ studentId, perkId: perk.id });
      toast({ tone: 'mint', title: `${perk.name} redeemed`, body: `−${perk.cost} coins · ${res.balance} left. Collect at the branch office.` });
      setKick((k) => k + 1);
    } catch (e) {
      toast({ tone: 'rose', title: 'Not yet', body: e.message });
    } finally {
      setBusy('');
    }
  }, [studentId, toast]);

  if (error) return <Card><div className="card-body"><div className="notice rose"><AlertTriangle size={15} />{error}</div></div></Card>;
  if (!data) return <Card><div className="card-body" style={{ display: 'grid', placeItems: 'center', minHeight: 220 }}><Spinner /></div></Card>;

  const { student, perks, ledger, redemptions } = data;
  const earned = ledger.filter((l) => l.amount > 0).reduce((a, l) => a + l.amount, 0);
  const spent = Math.abs(ledger.filter((l) => l.amount < 0).reduce((a, l) => a + l.amount, 0));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row tight" style={{ marginBottom: 8 }}>
            <Chip tone="amber dot">Target Coins</Chip>
            <Chip plain>{student.streak}-day streak</Chip>
            <Chip plain>{perks.filter((p) => p.stock > 0).length} perks in stock</Chip>
          </div>
          <h1>Spend what your integrity earned</h1>
          <p className="sub">Coins are only issued for on-time work that passed the AI check and the voice defense. Late-pass coupons, merch and competition priority are all redeemable here.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate('leaderboard')}><Trophy size={15} /> Leaderboard</button>
          <button className="btn primary" onClick={() => navigate('homework')}>Earn more <ArrowRight size={15} /></button>
        </div>
      </div>

      <div className="grid g4">
        <KPI label="Balance" value={student.coins} sub="Available now" tone="amber" icon={<Coins size={13} />} />
        <KPI label="Earned" value={`+${earned}`} sub="Recent ledger" tone="mint" icon={<Sparkles size={13} />} />
        <KPI label="Spent" value={`−${spent}`} sub={`${redemptions.length} redemptions`} tone="rose" icon={<Gift size={13} />} />
        <KPI label="XP" value={student.xp} sub="Feeds the branch leaderboard" tone="violet" icon={<Flame size={13} />} />
      </div>

      <Card>
        <CardHead title="Perk catalogue" sub="Redeemed instantly · stock is per term" icon={<Gift size={16} />} right={<Chip plain>Balance {student.coins}</Chip>} />
        <div className="card-body">
          <div className="grid g3">
            {perks.map((perk) => {
              const Icon = ICONS[perk.icon] || Gift;
              const afford = student.coins >= perk.cost;
              const out = perk.stock <= 0;
              return (
                <div className={`perk ${afford && !out ? 'afford' : ''}`} key={perk.id}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="p-ico"><Icon size={18} /></div>
                    <Chip tone={out ? 'rose' : 'plain'}>{out ? 'Out of stock' : `${perk.stock} left`}</Chip>
                  </div>
                  <div>
                    <h4>{perk.name}</h4>
                    <p>{perk.description}</p>
                  </div>
                  <div className="row" style={{ justifyContent: 'space-between', marginTop: 'auto' }}>
                    <span className="price"><Coins size={13} /> {perk.cost}</span>
                    <button
                      className={`btn small ${afford && !out ? 'primary' : ''}`}
                      disabled={!afford || out || busy === perk.id}
                      onClick={() => redeem(perk)}
                    >
                      {out ? 'Unavailable' : afford ? 'Redeem' : <><Lock size={12} /> {perk.cost - student.coins} short</>}
                    </button>
                  </div>
                  <div className="xs muted">{perk.category}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="split">
        <Card>
          <CardHead title="Coin ledger" sub="Every movement, attributable" icon={<Coins size={16} />} />
          <div className="card-body flush">
            <table className="table">
              <thead><tr><th>Reason</th><th>When</th><th style={{ textAlign: 'right' }}>Coins</th></tr></thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id}>
                    <td>{l.reason}</td>
                    <td className="xs muted nowrap">{timeAgo(l.at)}</td>
                    <td className="mono" style={{ textAlign: 'right', color: l.amount > 0 ? 'var(--mint)' : 'var(--rose)' }}>{l.amount > 0 ? '+' : ''}{l.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="stack">
          <Card>
            <CardHead title="Your redemptions" sub="Show the QR at the branch office" icon={<CheckCircle2 size={16} />} />
            <div className="card-body stack" style={{ gap: 9 }}>
              {redemptions.length === 0 && <div className="xs muted">Nothing redeemed yet — the hoodie is not going to buy itself.</div>}
              {redemptions.map((r) => {
                const perk = perks.find((p) => p.id === r.perkId);
                return (
                  <div key={r.id} className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="row tight">
                      <Avatar initials="✓" tone="mint" />
                      <div>
                        <b style={{ fontSize: 12.5 }}>{perk?.name || r.perkId}</b>
                        <div className="xs muted">{timeAgo(r.at)} · {r.status}</div>
                      </div>
                    </div>
                    <span className="mono xs" style={{ color: 'var(--amber)' }}>−{r.cost}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHead title="How coins are issued" sub="No participation trophies" icon={<Sparkles size={16} />} />
            <div className="card-body stack" style={{ gap: 7 }}>
              {[
                ['On-time submission', 40],
                ['AI-free (<20% signal)', 30],
                ['Voice defense passed', 25],
                ['Voice-Print matched', 10],
                ['No tutor hints', 10],
                ['Mentor mini-quiz', 15],
              ].map(([label, coins]) => (
                <div className="row" style={{ justifyContent: 'space-between' }} key={label}>
                  <span className="small dim">{label}</span>
                  <b className="mono" style={{ color: 'var(--mint)' }}>+{coins}</b>
                </div>
              ))}
              <div className="divider" />
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b className="small">Maximum per assignment</b>
                <b className="mono" style={{ color: 'var(--amber)' }}>+130</b>
              </div>
              <div className="xs muted">Coins settle when the teacher approves the paper. Flags reverse them automatically.</div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
