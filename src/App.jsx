import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3, BookOpen, ClipboardCheck, FileCode2, Flame, Gift, GraduationCap, Home,
  ShieldCheck, Sparkles, Trophy, Users, Wifi, Landmark, CloudOff, RefreshCw, Radio, AlertTriangle,
} from 'lucide-react';
import { api, checkHealth, setOfflineResponder } from './api.js';
import { enableOffline, disableOffline, offlineResponder } from './offline.js';
import { AppCtx } from './context.jsx';
import { ToastProvider, useToast, Spinner, Avatar } from './components/ui.jsx';
import { ConnectionError, OfflineBanner } from './components/ConnectionError.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ shell */
function Shell() {
  const toast = useToast();
  const [boot, setBoot] = useState(null);
  const [phase, setPhase] = useState('connecting');
  const [connError, setConnError] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [offlineInfo, setOfflineInfo] = useState(null);
  const [stale, setStale] = useState(false);
  const [role, setRole] = useState('student');
  const [studentId, setStudentId] = useState('aziz');
  const [view, setView] = useState(() => readView('student'));
  const [rev, setRev] = useState(0);

  const bootRef = useRef(null);
  bootRef.current = boot;
  const offlineRef = useRef(false);
  offlineRef.current = offline;
  const firstStudentRun = useRef(true);

  /**
   * Boot / refresh the dashboard. Three attempts with backoff on first load so a
   * server that is still starting never produces a dead-end screen; a single
   * attempt on later refreshes so the UI stays responsive.
   */
  const connect = useCallback(async (sid, { retries = 2, silent = false } = {}) => {
    if (!silent) setPhase('connecting');
    let lastErr = null;
    for (let i = 0; i <= retries; i++) {
      setAttempts(i + 1);
      try {
        const data = await api.bootstrap(sid);
        setBoot(data);
        setConnError(null);
        setPhase('ready');
        setStale(false);
        return { ok: true, data };
      } catch (e) {
        lastErr = e;
        if (i < retries) await sleep(700 * (i + 1));
      }
    }
    setConnError(lastErr);
    if (!bootRef.current) setPhase('error');
    else setStale(true);
    return { ok: false, error: lastErr };
  }, []);

  useEffect(() => {
    connect('aziz');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onHash = () => setView(readView(role));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [role]);

  useEffect(() => {
    if (firstStudentRun.current) { firstStudentRun.current = false; return; }
    if (offline) return;
    connect(studentId, { retries: 1, silent: true }).then((res) => {
      if (!res.ok && bootRef.current) {
        toast({ tone: 'amber', title: 'Could not refresh this student', body: `${res.error.message} Showing the last loaded data.` });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const navigate = useCallback((id) => {
    setView(id);
    window.location.hash = id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const changeRole = (next) => {
    setRole(next);
    const allowed = NAV[next].flatMap((g) => g.items.map((i) => i.id));
    const target = allowed.includes(view) ? view : allowed[0];
    setView(target);
    window.location.hash = target;
  };

  const refresh = useCallback(async () => {
    setRev((r) => r + 1);
    if (offlineRef.current) {
      toast({ tone: 'violet', title: 'Offline preview', body: 'That action needs the live server. Press Reconnect in the banner.' });
      return;
    }
    const res = await connect(studentId, { retries: 1, silent: true });
    if (!res.ok) {
      toast({ tone: 'amber', title: 'Refresh failed', body: `${res.error.message} The last loaded data is still on screen.` });
    }
  }, [connect, studentId, toast]);

  /** Retry from the error screen — re-probes health, then bootstraps. */
  const retryConnection = useCallback(async () => {
    setRetrying(true);
    try {
      if (offlineRef.current) setOfflineResponder(null);
      const health = await checkHealth();
      if (!health.ok) {
        setAttempts((a) => a + 1);
        toast({
          tone: 'rose',
          title: 'Server still unreachable',
          body: `${health.message || 'Health check failed'} — start it with \`npm run dev\` and retry.`,
          duration: 7000,
        });
        if (offlineRef.current) setOfflineResponder(offlineResponder);
        return;
      }
      const res = await connect(studentId, { retries: 1 });
      if (res.ok) {
        if (offlineRef.current) {
          setOffline(false);
          setOfflineInfo(null);
          disableOffline();
          toast({ tone: 'mint', title: 'Back online', body: 'Live school data restored.' });
        } else {
          toast({ tone: 'mint', title: 'Connected', body: `Server responded in ${health.latencyMs} ms.` });
        }
      } else if (offlineRef.current) {
        setOfflineResponder(offlineResponder);
        toast({ tone: 'rose', title: 'Health check passed but data failed', body: res.error.message });
      }
    } finally {
      setRetrying(false);
    }
  }, [connect, studentId, toast]);

  /** Enter the frozen-snapshot fallback without a page reload. */
  const goOffline = useCallback(async () => {
    setOfflineBusy(true);
    try {
      const snap = await enableOffline();
      setOfflineResponder(offlineResponder);
      const data = await api.bootstrap(studentId);
      setBoot(data);
      setOfflineInfo(snap.__meta || { capturedAt: null });
      setOffline(true);
      setConnError(null);
      setPhase('ready');
      setStale(false);
      toast({ tone: 'amber', title: 'Offline preview enabled', body: 'Read-only frozen snapshot. Mutations are disabled until you reconnect.', duration: 6500 });
    } catch (e) {
      setOfflineResponder(null);
      toast({ tone: 'rose', title: 'Offline snapshot unavailable', body: e.message });
    } finally {
      setOfflineBusy(false);
    }
  }, [studentId, toast]);

  /** Leave offline mode and attempt a live load again. */
  const leaveOffline = useCallback(async () => {
    setOfflineResponder(null);
    setOffline(false);
    setOfflineInfo(null);
    disableOffline();
    setBoot(null);
    setAttempts(0);
    await connect(studentId, { retries: 1 });
  }, [connect, studentId]);

  const ctx = useMemo(() => ({
    boot, role, studentId, setStudentId, view, navigate, rev, refresh, toast,
    settings: boot?.settings || {},
    parentId: 'p-dilbar',
    offline,
    offlineInfo,
    reconnect: retryConnection,
    reconnecting: retrying,
  }), [boot, role, studentId, view, navigate, rev, refresh, toast, offline, offlineInfo, retryConnection, retrying]);

  if (!boot) {
    if (phase === 'error') {
      return (
        <ConnectionError
          error={connError}
          attempts={attempts}
          retrying={retrying}
          onRetry={retryConnection}
          onOffline={goOffline}
          offlineBusy={offlineBusy}
        />
      );
    }
    return <ConnectingScreen attempt={attempts} onSkip={goOffline} onHelp={() => setPhase('error')} />;
  }

  const ActiveView = VIEWS[view] || Overview;
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
                {offline ? <CloudOff size={12} style={{ color: 'var(--amber)' }} /> : <Wifi size={12} style={{ color: boot.settings.demoMode ? 'var(--amber)' : 'var(--mint)' }} />}
                <b style={{ fontSize: 11.5 }}>
                  {offline ? 'Offline snapshot' : boot.settings.demoMode ? 'Local engine · no keys' : 'OpenAI Realtime'}
                </b>
              </div>
              <p>
                {offline
                  ? 'Frozen read-only demo data. Reconnect from the banner to run live actions.'
                  : boot.settings.demoMode
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

          {offline && (
            <OfflineBanner
              meta={offlineInfo}
              reconnecting={retrying}
              onReconnect={retryConnection}
              onExit={leaveOffline}
            />
          )}
          {!offline && stale && (
            <div className="stale-bar" role="status">
              <AlertTriangle size={13} />
              <b>Live refresh failed.</b>
              <span>Showing the last successful load.</span>
              <button className="btn tiny" onClick={retryConnection} disabled={retrying}>
                {retrying ? <><RefreshCw size={12} className="spin" /> Reconnecting…</> : <><RefreshCw size={12} /> Reconnect</>}
              </button>
            </div>
          )}

          <main className="content">
            <ActiveView key={`${view}-${rev}-${role}-${studentId}-${offline ? 'offline' : 'live'}`} />
          </main>
        </div>
      </div>
    </AppCtx.Provider>
  );
}

/* ------------------------------------------------------------------ connecting */
function ConnectingScreen({ attempt, onSkip, onHelp }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="boot">
      <div className="brand-mark"><ShieldCheck size={22} /></div>
      <p>Connecting to the school server…</p>
      <div className="row tight xs muted">
        <Spinner size={13} />
        <span>attempt {Math.max(1, attempt)} · {elapsed}s</span>
      </div>
      {elapsed >= 2 && (
        <div className="row tight" style={{ marginTop: 6 }}>
          <button className="btn small ghost" onClick={onHelp}>Having trouble? Diagnostics</button>
          <button className="btn small ghost" onClick={onSkip}><Radio size={13} /> Offline preview</button>
        </div>
      )}
      <p className="xs muted" style={{ maxWidth: 340, textAlign: 'center', marginTop: 4 }}>
        The app retries automatically. If the API is not running you can keep exploring a frozen snapshot instead.
      </p>
    </div>
  );
}

function RoleIcon({ role }) {
  const Icon = ROLES.find((r) => r.id === role)?.icon || GraduationCap;
  return <Icon size={15} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </ErrorBoundary>
  );
}
