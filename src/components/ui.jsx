import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Check, Copy, Info, Loader2, X } from 'lucide-react';

/* ------------------------------------------------------------------ toasts */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const remove = useCallback((id) => setItems((x) => x.filter((t) => t.id !== id)), []);
  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x.slice(-3), { id, tone: 'default', ...toast }]);
    setTimeout(() => remove(id), toast.duration || 5200);
  }, [remove]);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-stack">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`} role="status">
            <div style={{ marginTop: 1, color: t.tone === 'rose' ? 'var(--rose)' : t.tone === 'amber' ? 'var(--amber)' : 'var(--mint)' }}>
              {t.tone === 'rose' ? <Info size={15} /> : <Check size={15} />}
            </div>
            <div style={{ flex: 1 }}>
              <b>{t.title}</b>
              {t.body && <p>{t.body}</p>}
            </div>
            <button className="btn ghost icon tiny" onClick={() => remove(t.id)} aria-label="Dismiss">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------ atoms */
export function Card({ children, className = '', style }) {
  return <div className={`card ${className}`} style={style}>{children}</div>;
}

export function CardHead({ title, sub, right, icon }) {
  return (
    <div className="card-hd">
      {icon && <span style={{ color: 'var(--mint)' }}>{icon}</span>}
      <div style={{ minWidth: 0 }}>
        <h3>{title}</h3>
        {sub && <div className="hint">{sub}</div>}
      </div>
      {right && <div className="right">{right}</div>}
    </div>
  );
}

export function Chip({ tone = '', children, className = '', plain, ...rest }) {
  return <span className={`chip ${plain ? 'plain' : ''} ${tone} ${className}`} {...rest}>{children}</span>;
}

export function KPI({ label, value, unit, sub, tone = '', icon }) {
  return (
    <div className={`kpi ${tone}`}>
      <div className="k-label">{icon}{label}</div>
      <div className="k-value">{value}{unit && <small>{unit}</small>}</div>
      {sub && <div className="k-sub">{sub}</div>}
    </div>
  );
}

export function Avatar({ initials, tone = 'mint', size = '' }) {
  return <div className={`avatar ${tone} ${size}`}>{initials}</div>;
}

export function Bar({ value, tone = '', height }) {
  return (
    <div className={`bar ${tone}`} style={height ? { height } : undefined}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Gauge({ value, label, tone, size = '' }) {
  const r = 62;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const color = tone === 'rose' ? 'var(--rose)' : tone === 'amber' ? 'var(--amber)' : tone === 'violet' ? 'var(--violet)' : 'var(--mint)';
  return (
    <div className={`gauge ${size}`}>
      <svg width="100%" height="100%" viewBox="0 0 148 148">
        <circle cx="74" cy="74" r={r} fill="none" stroke="rgba(255,255,255,0.075)" strokeWidth="9" />
        <circle
          cx="74" cy="74" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          style={{ filter: `drop-shadow(0 0 8px ${color}55)`, transition: 'stroke-dasharray 0.7s cubic-bezier(0.22,0.8,0.3,1)' }}
        />
      </svg>
      <div className="g-center">
        <b style={{ color }}>{Math.round(value)}<span style={{ fontSize: '0.5em', color: 'var(--muted)' }}>%</span></b>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function Spinner({ size = 14 }) {
  return <Loader2 size={size} style={{ animation: 'spin 1s linear infinite' }} />;
}

export function Empty({ icon, title, body }) {
  return (
    <div className="empty">
      {icon}
      <b>{title}</b>
      {body && <p>{body}</p>}
    </div>
  );
}

export function CopyButton({ text, label = 'Copy', size = 'small' }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className={`btn ghost ${size}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? <Check size={13} /> : <Copy size={13} />} {done ? 'Copied' : label}
    </button>
  );
}

export function HighlightedText({ text, tells = [] }) {
  const segments = useMemo(() => {
    if (!tells.length) return [{ text, mark: false }];
    const sorted = [...tells].sort((a, b) => a.index - b.index);
    const out = [];
    let cursor = 0;
    sorted.forEach((t) => {
      if (t.index < cursor) return;
      if (t.index > cursor) out.push({ text: text.slice(cursor, t.index), mark: false });
      out.push({ text: text.slice(t.index, t.index + t.phrase.length), mark: true, label: t.label });
      cursor = t.index + t.phrase.length;
    });
    if (cursor < text.length) out.push({ text: text.slice(cursor), mark: false });
    return out;
  }, [text, tells]);

  return (
    <div className="paper">
      {segments.map((s, i) =>
        s.mark ? (
          <span key={i} className="tell-mark" title={s.label}>{s.text}</span>
        ) : (
          <React.Fragment key={i}>{s.text}</React.Fragment>
        )
      )}
    </div>
  );
}

export function Sparkline({ points = [], color = 'var(--mint)', height = 40 }) {
  if (!points.length) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const step = 100 / Math.max(1, points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${height - ((p - min) / span) * (height - 6) - 3}`).join(' ');
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <path d={`${path} L 100 ${height} L 0 ${height} Z`} fill={color} opacity="0.1" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Minimal Telegram-flavoured markdown: *bold*, _italic_, line breaks. */
export function TelegramText({ text }) {
  return (
    <>
      {String(text).split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((part, i) => {
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <b key={i}>{part.slice(1, -1)}</b>;
        if (part.startsWith('_') && part.endsWith('_') && part.length > 2) return <i key={i}>{part.slice(1, -1)}</i>;
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

export function Drawer({ open, onClose, title, sub, children, actions }) {
  if (!open) return null;
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="drawer-hd">
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 16 }}>{title}</h3>
            {sub && <div className="hint" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{sub}</div>}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {actions}
            <button className="btn ghost icon small" onClick={onClose} aria-label="Close"><X size={15} /></button>
          </div>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ format */
export const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

export const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

export const timeAgo = (iso) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return fmtDate(iso);
};

export const dueLabel = (iso) => {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Overdue';
  const hours = Math.round(diff / 3600000);
  if (hours < 1) return `${Math.max(1, Math.round(diff / 60000))} min left`;
  if (hours < 36) return `${hours} h left`;
  return `${Math.round(hours / 24)} d left`;
};

export const initialsOf = (name = '') =>
  name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export const aiTone = (p) => (p >= 70 ? 'rose' : p >= 45 ? 'amber' : p >= 20 ? 'violet' : 'mint');
export const aiBandLabel = (band) =>
  band === 'likely-ai' ? 'Likely AI' : band === 'suspicious' ? 'Suspicious' : band === 'mixed' ? 'Mixed' : 'Original';
export const statusTone = (status) => (status === 'approved' ? 'mint' : status === 'flagged' ? 'rose' : 'amber');
