import React, { useMemo, useState } from 'react';
import { AlertTriangle, Braces, ClipboardCheck, Download, FileCode2, Flame, KeyRound, Layers, Sparkles, Terminal, Cpu, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { useData } from '../hooks.js';
import { Card, CardHead, Chip, CopyButton, Spinner } from '../components/ui.jsx';

const TABS = [
  { id: 'master', label: 'Master system prompt', icon: Layers },
  { id: 'assignment', label: 'Assignment generator', icon: ClipboardCheck },
  { id: 'realtime', label: 'Realtime voice', icon: Flame },
  { id: 'config', label: 'Session config', icon: Braces },
];

const MODULE_MAP = [
  ['Teacher AI-assistant', 'master + assignment generator', 'heuristics + rubric'],
  ['Smart Tutor', 'master (module 2)', 'Socratic policy engine'],
  ['Gamification', 'master (module 3)', 'ledger + approval settling'],
  ['Parent & leadership', 'master (module 4)', 'heat-map + Telegram'],
  ['Audio defense & Voice-Print', 'master (module 5)', 'on-device band energies'],
  ['Angry Mentor · barge-in', 'realtime voice + session config', 'local persona engine'],
];

export default function Prompts() {
  const { data, error } = useData(() => api.prompts(), []);
  const [tab, setTab] = useState('master');

  const content = useMemo(() => {
    if (!data) return '';
    if (tab === 'master') return data.master;
    if (tab === 'assignment') return data.assignment;
    if (tab === 'realtime') return data.realtime;
    return JSON.stringify(data.sessionConfig, null, 2);
  }, [data, tab]);

  const download = () => {
    const blob = new Blob([tab === 'config' ? content : JSON.stringify({ prompt: content }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = tab === 'config' ? 'target-realtime-session.json' : `target-${tab}-prompt.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (error) return <Card><div className="card-body"><div className="notice rose"><AlertTriangle size={15} />{error}</div></div></Card>;
  if (!data) return <Card><div className="card-body" style={{ display: 'grid', placeItems: 'center', minHeight: 220 }}><Spinner /></div></Card>;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row tight" style={{ marginBottom: 8 }}>
            <Chip tone="mint dot">Prompt library</Chip>
            <Chip plain>Versioned with the platform</Chip>
            <Chip tone={data.demoMode ? 'amber' : 'mint'}>{data.demoMode ? 'Local engine' : 'Hosted model'}</Chip>
          </div>
          <h1>Prompts &amp; realtime configuration</h1>
          <p className="sub">The three prompts that define the ecosystem, plus the session config to paste into OpenAI Realtime, Vapi or LiveKit. Every screen in this app is wired to the contracts below.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={download}><Download size={15} /> Download {tab === 'config' ? 'JSON' : 'prompt'}</button>
          <CopyButton text={content} label="Copy" size="" />
        </div>
      </div>

      <div className="grid g4">
        <div className="kpi mint">
          <div className="k-label"><Cpu size={13} /> Provider</div>
          <div className="k-value" style={{ fontSize: 21 }}>{data.provider}</div>
          <div className="k-sub">{data.demoMode ? 'No API key detected — deterministic fallback is live' : 'Hosted realtime session active'}</div>
        </div>
        <div className="kpi violet">
          <div className="k-label"><Layers size={13} /> Modules</div>
          <div className="k-value">6</div>
          <div className="k-sub">All wired into one store</div>
        </div>
        <div className="kpi amber">
          <div className="k-label"><Braces size={13} /> Tools exposed</div>
          <div className="k-value">{data.sessionConfig.tools.length}</div>
          <div className="k-sub">coins · quiz · voiceprint · escalate</div>
        </div>
        <div className="kpi">
          <div className="k-label"><ShieldCheck size={13} /> Turn detection</div>
          <div className="k-value" style={{ fontSize: 20 }}>{data.sessionConfig.turn_detection.type}</div>
          <div className="k-sub">interrupt_response {String(data.sessionConfig.turn_detection.interrupt_response)}</div>
        </div>
      </div>

      <div className="split" style={{ gridTemplateColumns: 'minmax(0, 1.9fr) minmax(0, 1fr)' }}>
        <Card>
          <div style={{ padding: '14px 16px 0' }}>
            <div className="tabs">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                    <span className="row tight" style={{ gap: 6 }}><Icon size={13} /> {t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="card-body stack" style={{ gap: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="xs muted">{content.length.toLocaleString()} characters · {content.split(/\s+/).length.toLocaleString()} words</span>
              <CopyButton text={content} />
            </div>
            <pre className="code-block">{content}</pre>
          </div>
        </Card>

        <div className="stack">
          <Card>
            <CardHead title="Adapter status" sub="How the app reaches a model" icon={<Terminal size={16} />} />
            <div className="card-body stack" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small dim">Runtime</span>
                <Chip tone={data.demoMode ? 'amber' : 'mint'}>{data.provider}</Chip>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small dim">Fallback</span>
                <span className="mono xs">local-persona-engine</span>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small dim">Voice I/O</span>
                <span className="mono xs">browser TTS + dictation</span>
              </div>
              <p className="xs muted">{data.adapterNote}</p>
              <div className="code-block" style={{ fontSize: 10.5, maxHeight: 150 }}>{`# .env\nOPENAI_API_KEY=sk-...\n# restart: npm run dev\n# the provider line above switches to\n# openai-realtime automatically`}</div>
            </div>
          </Card>

          <Card>
            <CardHead title="Module → prompt map" sub="Nothing undocumented" icon={<FileCode2 size={16} />} />
            <div className="card-body stack" style={{ gap: 9 }}>
              {MODULE_MAP.map(([mod, prompt, impl]) => (
                <div key={mod}>
                  <b style={{ fontSize: 12 }}>{mod}</b>
                  <div className="xs muted">{prompt}</div>
                  <div className="xs" style={{ color: 'var(--mint)' }}>{impl}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="soft">
            <CardHead title="Production checklist" sub="What changes with a real key" icon={<KeyRound size={16} />} />
            <div className="card-body stack" style={{ gap: 7 }}>
              {[
                'Swap persona engine for Realtime speech-to-speech',
                'Server-side VAD with interrupt_response',
                'Whisper transcription for defense scoring',
                'Store voice vectors in a KMS-backed vault',
                'Move the store to Postgres + append-only audit',
              ].map((x) => (
                <div className="row tight xs muted" key={x}><Sparkles size={11} style={{ color: 'var(--mint)' }} /> {x}</div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
