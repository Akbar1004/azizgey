import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3, BookOpen, ClipboardCheck, FileCode2, Flame, Gift, GraduationCap, Home,
  ShieldCheck, Sparkles, Trophy, Users, ChevronDown, Wifi, Landmark,
} from 'lucide-react';
import { api } from './api.js';
import { AppCtx } from './context.jsx';
import { ToastProvider, useToast, Spinner, Avatar } from './components/ui.jsx';
import Overview from './views/Overview.jsx';
import Homework from './views/Homework.jsx';
import Mentor from './views/Mentor.jsx';
import Rewards from './views/Rewards.jsx';
import Leaderboard from './views/Leaderboard.jsx';
import TeacherQueue from './views/TeacherQueue.jsx';
import Studio from './views/Studio.jsx';
import Analytics from './views/Analytics.jsx';
import Parents from './views/Parents.jsx';
import Prompts from './views/Prompts.jsx';

const ROLES = [
  { id: 'student', label: 'Student', icon: GraduationCap, name: 'Aziz Karimov', detail: '11-A · Sergeli' },
  { id: 'teacher', label: 'Teacher', icon: ClipboardCheck, name: 'Malika Rasulova', detail: 'Academic Integrity Lead' },
  { id: 'director', label: 'Director', icon: Landmark, name: 'Kamola Ismoilova', detail: 'Director of Academics' },
  { id: 'parent', label: 'Parent', icon: Users, name: 'Dilbar Karimova', detail: '@dilbar_k · Telegram' },
];

const NAV = {
  student: [
    { group: 'Learn', items: [
      { id: 'overview', label: 'Overview', icon: Home },
      { id: 'homework', label: 'My homework', icon: BookOpen },
      { id: 'mentor', label: 'Angry Mentor', icon: Flame },
    ] },
    { group: 'Progress', items: [
      { id: 'rewards', label: 'Target Coins', icon: Gift },
      { id: 'leaderboard', label: 'Leaderboards', icon: Trophy },
    ] },
  ],
  teacher: [
    { group: 'Teach', items: [
      { id: 'overview', label: 'Overview', icon: Home },
      { id: 'queue', label: 'Review queue', icon: ClipboardCheck, badge: 'pending' },
      { id: 'studio', label: 'Assignment studio', icon: Sparkles },
    ] },
    { group: 'Insight', items: [
      { id: 'analytics', label: 'Heat-map & analytics', icon: BarChart3 },
      { id: 'leaderboard', label: 'Leaderboards', icon: Trophy },
      { id: 'parents', label: 'Parent reports', icon: Users },
    ] },
  ],
  director: [
    { group: 'Leadership', items: [
      { id: 'overview', label: 'Overview', icon: Home },
      { id: 'analytics', label: 'Weak-topic heat-map', icon: BarChart3 },
      { id: 'leaderboard', label: 'Branch leaderboards', icon: Trophy },
      { id: 'parents', label: 'Parent comms', icon: Users },
    ] },
  ],
  parent: [
    { group: 'My child', items: [
      { id: 'parents', label: 'Weekly report', icon: Users },
      { id: 'leaderboard', label: 'Leaderboards', icon: Trophy },
    ] },
  ],
};

const VIEWS = {
  overview: Overview,
  homework: Homework,
  mentor: Mentor,
  rewards: Rewards,
  leaderboard: Leaderboard,
  queue: TeacherQueue,
  studio: Studio,
  analytics: Analytics,
  parents: Parents,
  prompts: Prompts,
};

function readView(role) {
  const hash = (window.location.hash || '').replace('#', '');
  const allowed = [...NAV[role].flatMap((g) => g.items.map((i) => i.id)), 'prompts'];
  return allowed.includes(hash) ? hash : 'overview';
}

function Shell() {
  const toast = useToast();
  const [boot, setBoot] = useState(null);
  const [error, setError] = useState('');
  const [role, setRole] = useState('student');
  const [studentId, setStudentId] = useState('aziz');
  const [view, setView] = useState(() => readView('student'));
  const [rev, setRev] = useState(0);

  const load = useCallback(async (sid = studentId) => {
    try {
      const data = await api.bootstrap(sid);
      setBoot(data);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [studentId]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    const onHash = () => setView(readView(role));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [role]);

  const navigate = useCallback((id) => {
    setView(id);
    window.location.hash = id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const changeRole = (next) => {
    setRole(next);
    const allowed = NAV[next].flatMap((g) => g.items.map((i) => i.id));
    setView((v) => (allowed.includes(v) ? v : allowed[0]));
    window.location.hash = allowed.includes(view) ? view : allowed[0];
  };

  const refresh = useCallback(async () => {
    setRev((r) => r + 1);
    await load();
  }, [load]);

  useEffect(() => {
    if (studentId) load(studentId);
    /* eslint-disable-next-line */
  }, [studentId]);

  const ctx = useMemo(() => ({
    boot, role, studentId, setStudentId, view, navigate, rev, refresh, toast,
    settings: boot?.settings || {},
    parentId: 'p-dilbar',
  }), [boot, role, studentId, view, navigate, rev, refresh, toast]);

  if (!boot) {
    return (
      <div className="boot">
        <div className="brand-mark"><ShieldCheck size={22} /></div>
        <p>{error ? 'Server unreachable' : 'Loading school day…'}</p>
        {error ? <div className="notice rose" style={{ maxWidth: 420 }}>{error}</div> : <Spinner size={18} />}
      </div>
    );
  }

  const active = VIEWS[view] || Overview;
  const ActiveView = active;
  const roleMeta = ROLES.find((r) => r.id === role);
  const currentNav = NAV[role].flatMap((g) => g.items);
  const viewLabel = currentNav.find((i) => i.id === view)?.label || 'Overview';
  const student = boot.roster.find((s) => s.id === studentId);

  return (
    <AppCtx.Provider value={ctx}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark"><ShieldCheck size={21} /></div>
            <div className="brand-text">
              <b>Target</b>
              <span>Integrity OS</span>
            </div>
          </div>

          {NAV[role].map((group) => (
            <div className="nav-group" key={group.group}>
              <div className="nav-label">{group.group}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const badge = item.badge === 'pending' ? boot.stats.pending : null;
                return (
                  <button
                    key={item.id}
                    className={`nav-item ${view === item.id ? 'active' : ''}`}
                    onClick={() => navigate(item.id)}
                  >
                    <Icon size={16} />
                    {item.label}
                    {badge ? <span className="nav-badge">{badge}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}

          <div className="nav-group">
            <div className="nav-label">Platform</div>
            <button className={`nav-item ${view === 'prompts' ? 'active' : ''}`} onClick={() => navigate('prompts')}>
              <FileCode2 size={16} /> Prompts & config
            </button>
          </div>

          <div className="sidebar-foot">
            <div className="side-card">
              <div className="row tight" style={{ marginBottom: 6 }}>
                <Wifi size={12} style={{ color: boot.settings.demoMode ? 'var(--amber)' : 'var(--mint)' }} />
                <b style={{ fontSize: 11.5 }}>{boot.settings.demoMode ? 'Local engine · no keys' : 'OpenAI Realtime'}</b>
              </div>
              <p>
                {boot.settings.demoMode
                  ? 'Deterministic persona, Socratic tutor and integrity heuristics run in-process. Every screen is live.'
                  : 'Realtime voice session routed to the hosted model.'}
              </p>
            </div>
            <div className="side-card" style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
              <div className="brand-mark" style={{ width: 30, height: 30, flex: '0 0 30px', borderRadius: 9, background: 'rgba(94,234,212,0.12)', color: 'var(--mint)', boxShadow: 'none' }}>
                <RoleIcon role={role} />
              </div>
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 11.5, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{roleMeta.name}</b>
                <p style={{ marginTop: 1 }}>{roleMeta.detail}</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="crumb">
              <span>{roleMeta.label}</span>
              <span style={{ opacity: 0.4 }}>/</span>
              <b>{viewLabel}</b>
            </div>
            <div className="topbar-right">
              {role === 'student' && (
                <label className="row tight" style={{ gap: 6 }}>
                  <span className="xs muted nowrap">Demo as</span>
                  <select
                    className="select"
                    style={{ width: 'auto', padding: '5px 26px 5px 9px', fontSize: 12 }}
                    value={studentId}
                    onChange={(e) => { setStudentId(e.target.value); navigate('overview'); }}
                  >
                    {boot.roster.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {role === 'teacher' && (
                <span className="chip amber dot">{boot.stats.pending} awaiting review · {boot.stats.flagged} flagged</span>
              )}
              {role === 'student' && (
                <span className="chip amber"><Sparkles size={12} /> {student?.coins ?? 0} coins</span>
              )}
              <div className="segmented" role="tablist" aria-label="Switch role">
                {ROLES.map((r) => (
                  <button key={r.id} className={role === r.id ? 'active' : ''} onClick={() => changeRole(r.id)}>
                    {r.label}
                  </button>
                ))}
              </div>
              <Avatar initials={roleMeta.name.split(' ').map((x) => x[0]).slice(0, 2).join('')} tone={role === 'student' ? 'mint' : role === 'teacher' ? 'violet' : role === 'director' ? 'amber' : 'rose'} />
            </div>
          </header>

          <main className="content">
            <ActiveView key={`${view}-${rev}-${role}-${studentId}`} />
          </main>
        </div>
      </div>
    </AppCtx.Provider>
  );
}

function RoleIcon({ role }) {
  const Icon = ROLES.find((r) => r.id === role)?.icon || GraduationCap;
  return <Icon size={15} />;
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
