import React from 'react';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';

/**
 * Last-resort guard: a render crash should never leave a blank dark page.
 * Offers a reload and a "clear local drafts" escape hatch (drafts live in
 * localStorage and could be what triggered the crash).
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ui] render crash', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="conn-screen">
        <div className="conn-card">
          <div className="conn-brand">
            <div className="brand-mark" style={{ background: 'rgba(251,191,36,0.14)', color: 'var(--amber)', boxShadow: '0 0 0 1px rgba(251,191,36,0.35)' }}>
              <AlertTriangle size={21} />
            </div>
            <div className="brand-text">
              <b>Target</b>
              <span>Integrity OS</span>
            </div>
            <span className="chip amber dot" style={{ marginLeft: 'auto' }}>UI crash</span>
          </div>
          <h1 className="conn-title">This screen hit a rendering error.</h1>
          <p className="conn-detail">
            The app caught the crash instead of showing a blank page. Your work on the server is untouched; only this browser tab
            needs to recover.
          </p>
          <div className="code-block" style={{ maxHeight: 160, fontSize: 11 }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <div className="conn-actions">
            <button className="btn primary" onClick={() => window.location.reload()}>
              <RotateCcw size={15} /> Reload
            </button>
            <button
              className="btn danger"
              onClick={() => {
                try { localStorage.clear(); } catch { /* noop */ }
                window.location.href = '/';
              }}
            >
              <Trash2 size={15} /> Clear local drafts &amp; reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
