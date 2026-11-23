import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Check, ChevronDown, ChevronRight, ClipboardCopy, CloudOff, RefreshCw,
  ServerCrash, ShieldCheck, Wifi, WifiOff, Wrench, ArrowRight, Radio,
} from 'lucide-react';
import { checkHealth, describeFailure, REQUEST_TIMEOUT_MS } from '../api.js';

const toneColor = (tone) => (tone === 'rose' ? 'var(--rose)' : tone === 'violet' ? 'var(--violet)' : tone === 'mint' ? 'var(--mint)' : 'var(--amber)');

export function ConnectionError({ error, attempts = 0, retrying = false, onRetry, onOffline, offlineBusy = false, offlineMeta = null }) {
  const failure = describeFailure(error);
  const [diag, setDiag] = useState(null);
  const [running, setRunning] = useState(false);
  const [showDetail, setShowDetail] = useState(true);
  const [copied, setCopied] = useState(false);

  const runDiagnostics = useCallback(async () => {
    setRunning(true);
    const started = performance.now();
    const health = await checkHealth();
    const checks = [{ name: 'GET /health', ...health }];

    let bootstrap = { name: 'GET /api/bootstrap', ok: false, status: 0, latencyMs: null, message: 'not attempted' };
    const t0 = performance.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('/api/bootstrap?studentId=aziz', { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
      clearTimeout(timer);
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* not json */ }
      bootstrap = {
        name: 'GET /api/bootstrap',
        ok: res.ok && !!json,
        status: res.status,
        latencyMs: Math.round(performance.now() - t0),
        contentType: res.headers.get('content-type') || '',
        message: res.ok ? (json ? 'JSON payload received' : 'Response was not JSON') : `HTTP ${res.status}`,
      };
    } catch (e) {
      bootstrap = {
        name: 'GET /api/bootstrap',
        ok: false,
        status: 0,
        latencyMs: Math.round(performance.now() - t0),
        message: e.name === 'AbortError' ? 'timed out after 8s' : e.message,
      };
    }
    checks.push(bootstrap);

    setDiag({
      checks,
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      origin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
      protocol: typeof window !== 'undefined' ? window.location.protocol : 'unknown',
      took: Math.round(performance.now() - started),
      at: new Date().toISOString(),
    });
    setRunning(false);
  }, []);

  useEffect(() => {
    runDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const diagnosticsText = () => {
    const lines = [
      'Target Integrity OS — connection diagnostics',
      `captured: ${new Date().toISOString()}`,
      `page: ${typeof window !== 'undefined' ? window.location.href : 'n/a'}`,
      `failure kind: ${error?.kind || 'unknown'}`,
      `message: ${error?.message || 'n/a'}`,
      `http status: ${error?.status || 0}`,
      `request url: ${error?.url || 'n/a'}`,
      `attempts: ${attempts}`,
      `navigator.onLine: ${diag?.online}`,
      `health: ${diag?.checks?.[0] ? `${diag.checks[0].status || 'ERR'} in ${diag.checks[0].latencyMs}ms ${diag.checks[0].message || ''}` : 'pending'}`,
      `bootstrap: ${diag?.checks?.[1] ? `${diag.checks[1].status || 'ERR'} in ${diag.checks[1].latencyMs}ms ${diag.checks[1].message || ''}` : 'pending'}`,
    ];
    return lines.join('\n');
  };

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(diagnosticsText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowDetail(true);
    }
  };

  const health = diag?.checks?.[0];
  const api = diag?.checks?.[1];
  const bothDown = health && !health.ok && api && !api.ok;

  return (
    <div className="conn-screen">
      <div className="conn-card">
        <div className="conn-brand">
          <div className="brand-mark" style={{ background: 'rgba(251,113,133,0.14)', color: 'var(--rose)', boxShadow: '0 0 0 1px rgba(251,113,133,0.35)' }}>
            <CloudOff size={21} />
          </div>
          <div className="brand-text">
            <b>Target</b>
            <span>Integrity OS</span>
          </div>
          <span className="chip rose dot" style={{ marginLeft: 'auto' }}>Connection failed</span>
        </div>

        <h1 className="conn-title">{failure.title}</h1>
        <p className="conn-detail">{failure.detail}</p>

        <div className="conn-meta">
          <span className="chip plain mono">{(error?.kind || 'unknown').toUpperCase()}</span>
          {error?.status ? <span className="chip plain mono">HTTP {error.status}</span> : null}
          {error?.elapsedMs != null ? <span className="chip plain mono">{error.elapsedMs} ms</span> : null}
          <span className="chip plain mono">{attempts} attempt{attempts === 1 ? '' : 's'}</span>
          <span className="chip plain mono">{REQUEST_TIMEOUT_MS / 1000}s client timeout</span>
        </div>

        <div className="notice" style={{ borderColor: `color-mix(in srgb, ${toneColor(failure.tone)} 35%, transparent)`, background: 'rgba(255,255,255,0.03)' }}>
          {failure.tone === 'rose' ? <AlertTriangle size={15} /> : <Wrench size={15} />}
          <span><b>Likely fix.</b> {failure.hint}</span>
        </div>

        <div className="conn-actions">
          <button className="btn primary" onClick={onRetry} disabled={retrying}>
            {retrying ? <><RefreshCw size={15} className="spin" /> Checking…</> : <><RefreshCw size={15} /> Retry connection</>}
          </button>
          <button className="btn" onClick={onOffline} disabled={offlineBusy}>
            {offlineBusy ? <><RefreshCw size={15} className="spin" /> Loading snapshot…</> : <><Radio size={15} /> Continue in offline mode</>}
          </button>
          <button className="btn ghost" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>

        <button className="conn-toggle" onClick={() => setShowDetail((v) => !v)} aria-expanded={showDetail}>
          {showDetail ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Diagnostics {diag ? <span className="muted">· ran in {diag.took} ms</span> : null}
        </button>

        {showDetail && (
          <div className="diag">
            <div className="diag-row">
              <span className="diag-label">Health endpoint</span>
              <span className={`diag-value ${health?.ok ? 'ok' : 'fail'}`}>
                {health ? (health.ok ? <><Check size={12} /> HTTP {health.status} · {health.latencyMs} ms</> : <>✕ {health.status || 'no response'} · {health.message || health.kind}</>) : 'checking…'}
              </span>
            </div>
            <div className="diag-row">
              <span className="diag-label">Bootstrap request</span>
              <span className={`diag-value ${api?.ok ? 'ok' : 'fail'}`}>
                {api ? (api.ok ? <><Check size={12} /> HTTP {api.status} · {api.latencyMs} ms</> : <>✕ {api.status || 'no response'} · {api.message}</>) : 'checking…'}
              </span>
            </div>
            <div className="diag-row">
              <span className="diag-label">Browser network</span>
              <span className={`diag-value ${diag?.online ? 'ok' : 'fail'}`}>
                {diag ? (diag.online ? <><Wifi size={12} /> online</> : <><WifiOff size={12} /> offline</>) : 'checking…'}
              </span>
            </div>
            <div className="diag-row">
              <span className="diag-label">Page origin</span>
              <span className="diag-value mono">{diag?.origin || '—'}</span>
            </div>
            <div className="diag-row">
              <span className="diag-label">Request that failed</span>
              <span className="diag-value mono">{error?.url || '—'}</span>
            </div>
            <div className="diag-row">
              <span className="diag-label">Server message</span>
              <span className="diag-value">{error?.message || '—'}</span>
            </div>

            {bothDown && (
              <div className="notice rose" style={{ marginTop: 8 }}>
                <ServerCrash size={15} />
                <span>
                  Both the health check and the bootstrap call failed, so the API process is not answering on this origin.
                  Run <b>npm run dev</b> (or <b>npm run build &amp;&amp; npm start</b>) and retry. You can also explore the frozen demo snapshot below.
                </span>
              </div>
            )}

            <div className="row tight" style={{ marginTop: 10 }}>
              <button className="btn small ghost" onClick={runDiagnostics} disabled={running}>
                {running ? <><RefreshCw size={12} className="spin" /> Running…</> : <><RefreshCw size={12} /> Re-run diagnostics</>}
              </button>
              <button className="btn small ghost" onClick={copyDiagnostics}>
                {copied ? <><Check size={12} /> Copied</> : <><ClipboardCopy size={12} /> Copy diagnostics</>}
              </button>
            </div>
          </div>
        )}

        <div className="conn-foot">
          <ShieldCheck size={13} />
          <span>
            Automatic retries already ran with backoff. {offlineMeta ? `Offline snapshot captured ${new Date(offlineMeta.capturedAt).toLocaleString()}.` : 'Offline mode serves a frozen, read-only copy of the demo school.'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ banner */
export function OfflineBanner({ meta, reconnecting, onReconnect, onExit }) {
  return (
    <div className="offline-bar" role="status">
      <span className="offline-dot" />
      <b>Offline preview</b>
      <span className="offline-text">
        Frozen snapshot{meta?.capturedAt ? ` from ${new Date(meta.capturedAt).toLocaleString()}` : ''} — read-only. Actions are disabled until the server reconnects.
      </span>
      <span className="row tight" style={{ marginLeft: 'auto' }}>
        <button className="btn tiny primary" onClick={onReconnect} disabled={reconnecting}>
          {reconnecting ? <><RefreshCw size={12} className="spin" /> Reconnecting…</> : <><RefreshCw size={12} /> Reconnect</>}
        </button>
        <button className="btn tiny ghost" onClick={onExit}>Leave offline mode</button>
      </span>
    </div>
  );
}
