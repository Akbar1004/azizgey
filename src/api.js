/**
 * API client.
 * - Relative URLs only (never hardcoded localhost), so it works behind the preview
 *   proxy, on a LAN IP, or on a real domain.
 * - Every request has a timeout and a typed failure (offline / timeout / http /
 *   server / invalid-response) so the UI can explain exactly what happened.
 * - An optional offline responder can serve a frozen snapshot for the read-only
 *   demo fallback.
 */

export const REQUEST_TIMEOUT_MS = 12000;
export const HEALTH_TIMEOUT_MS = 5000;

let offlineResponder = null;

/** Register (or clear) the frozen-snapshot handler used by offline preview mode. */
export function setOfflineResponder(fn) {
  offlineResponder = fn;
}

export function isOfflineMode() {
  return !!offlineResponder;
}

export class ApiError extends Error {
  constructor(message, info = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = info.kind || 'unknown';
    this.url = info.url || '';
    this.status = info.status ?? 0;
    this.elapsedMs = info.elapsedMs ?? null;
    this.data = info.data || null;
    this.sample = info.sample || null;
    this.offline = !!info.offline;
    this.disabled = !!info.disabled;
    this.cause = info.cause || null;
  }
}

async function request(url, { method = 'GET', body } = {}) {
  if (offlineResponder) {
    if (method === 'GET') {
      try {
        const payload = await offlineResponder(url);
        if (payload !== undefined && payload !== null) return payload;
      } catch (e) {
        throw new ApiError(e.message || 'This view is not part of the offline snapshot.', {
          kind: 'offline-snapshot',
          url,
          offline: true,
        });
      }
      throw new ApiError('This view is not included in the offline snapshot.', { kind: 'offline-snapshot', url, offline: true });
    }
    throw new ApiError('Offline preview: changes are disabled until the server reconnects.', {
      kind: 'offline-disabled',
      url,
      offline: true,
      disabled: true,
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = performance.now();
  let res;
  try {
    res = await fetch(url, {
      method,
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) {
    clearTimeout(timer);
    const elapsedMs = Math.round(performance.now() - started);
    if (e.name === 'AbortError') {
      throw new ApiError(`The server did not answer within ${REQUEST_TIMEOUT_MS / 1000} seconds.`, {
        kind: 'timeout', url, elapsedMs, cause: e,
      });
    }
    throw new ApiError('Could not reach the server — the network request failed before any response arrived.', {
      kind: 'offline', url, elapsedMs, cause: e,
    });
  }
  clearTimeout(timer);
  const elapsedMs = Math.round(performance.now() - started);

  const text = await res.text().catch(() => '');
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError(
        `The server returned ${res.headers.get('content-type') || 'a non-JSON response'} instead of JSON (HTTP ${res.status}). ` +
          'This usually means the API route is missing, the server is still starting, or a proxy intercepted the request.',
        { kind: 'invalid-response', status: res.status, url, elapsedMs, sample: text.slice(0, 180) }
      );
    }
  }

  if (!res.ok) {
    throw new ApiError(data.error || `The server rejected the request with HTTP ${res.status}.`, {
      kind: res.status >= 500 ? 'server' : 'http',
      status: res.status,
      url,
      elapsedMs,
      data,
    });
  }
  return data;
}

const get = (url) => request(url);
const post = (url, body = {}) => request(url, { method: 'POST', body });

/* ------------------------------------------------------------------ health */
/**
 * Direct health probe. Bypasses the offline responder and never throws, so the
 * error screen can always show something useful.
 */
export async function checkHealth({ timeoutMs = HEALTH_TIMEOUT_MS } = {}) {
  if (typeof fetch !== 'function') {
    return { ok: false, url: '/health', status: 0, latencyMs: null, kind: 'unsupported', message: 'fetch is not available in this browser.' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const res = await fetch('/health', { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    const latencyMs = Math.round(performance.now() - started);
    let body = null;
    let contentType = res.headers.get('content-type') || '';
    try { body = await res.clone().json(); } catch { /* not JSON */ }
    return {
      ok: res.ok && body?.ok !== false,
      url: '/health',
      status: res.status,
      latencyMs,
      contentType,
      body,
      kind: res.ok ? 'ok' : res.status >= 500 ? 'server' : 'http',
      message: res.ok ? null : `Health endpoint returned HTTP ${res.status}.`,
    };
  } catch (e) {
    return {
      ok: false,
      url: '/health',
      status: 0,
      latencyMs: Math.round(performance.now() - started),
      kind: e.name === 'AbortError' ? 'timeout' : 'offline',
      message: e.name === 'AbortError' ? `Health check timed out after ${timeoutMs / 1000}s.` : e.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ describe */
/** Human-readable diagnosis used by the error screen and the offline banner. */
export function describeFailure(error) {
  const kind = error?.kind || 'unknown';
  if (kind === 'offline') {
    return {
      title: 'The browser could not open a connection to the app server.',
      detail:
        'This is a network-level failure: the server process is not listening, the port is wrong, or a proxy dropped the request. ' +
        'The page you are looking at may also be a cached copy from an earlier session.',
      hint: 'Start the server with `npm run dev` (or `npm run build && npm start`) and press Retry connection.',
      tone: 'rose',
    };
  }
  if (kind === 'timeout') {
    return {
      title: 'The server accepted the connection but never answered.',
      detail: 'A request hung for longer than the client timeout, which usually means the backend is overloaded, blocked, or stuck mid-startup.',
      hint: 'Check the server console for a stalled request, then retry. The app automatically retries twice before showing this screen.',
      tone: 'amber',
    };
  }
  if (kind === 'server') {
    return {
      title: `The server returned an internal error (HTTP ${error.status}).`,
      detail: `The API answered, but crashed while building this response${error.data?.path ? ` for ${error.data.path}` : ''}: “${error.message}”`,
      hint: 'The server log has the stack trace under [api]. Fix the route and press Retry connection — no reload needed.',
      tone: 'rose',
    };
  }
  if (kind === 'http') {
    return {
      title: `The API rejected the request (HTTP ${error.status}).`,
      detail: `The endpoint ${error.url || ''} does not exist or is not allowed. A stale frontend build is the usual cause when the server is newer than the bundle.`,
      hint: 'Rebuild the frontend (`npm run build`) or restart the dev server, then retry.',
      tone: 'amber',
    };
  }
  if (kind === 'invalid-response') {
    return {
      title: 'The server replied with HTML instead of JSON.',
      detail: `HTTP ${error.status} came back with the wrong content type. A proxy error page, a missing API route, or the SPA fallback answering an API call all look like this.`,
      hint: 'Confirm /health returns JSON. If it does, the API path is wrong — check the request in the diagnostics below.',
      tone: 'amber',
    };
  }
  if (kind === 'offline-snapshot') {
    return {
      title: 'That view is not part of the offline snapshot.',
      detail: 'Offline mode ships a frozen read-only copy of the dashboard, review queue, analytics and reports — not every action.',
      hint: 'Reconnect to the server for live data, or open Overview / Review queue / Analytics, which work offline.',
      tone: 'violet',
    };
  }
  if (kind === 'offline-disabled') {
    return {
      title: 'Offline preview is read-only.',
      detail: error.message,
      hint: 'Reconnect to the server to submit work, approve papers or redeem coins.',
      tone: 'violet',
    };
  }
  return {
    title: 'Something unexpected went wrong while contacting the server.',
    detail: error?.message || 'No further detail was returned.',
    hint: 'Run the diagnostics below, then retry.',
    tone: 'amber',
  };
}

/* ------------------------------------------------------------------ endpoints */
export const api = {
  bootstrap: (studentId = 'aziz') => get(`/api/bootstrap?studentId=${encodeURIComponent(studentId)}`),
  teacherOverview: () => get('/api/teacher/overview'),
  teacherSubmission: (id) => get(`/api/teacher/submissions/${encodeURIComponent(id)}`),
  approve: (id, body) => post(`/api/teacher/submissions/${encodeURIComponent(id)}/approve`, body),
  flag: (id, body) => post(`/api/teacher/submissions/${encodeURIComponent(id)}/flag`, body),
  sets: () => get('/api/teacher/sets'),
  generate: (body) => post('/api/teacher/generate', body),
  publish: (body) => post('/api/teacher/publish', body),
  student: (id) => get(`/api/student/${encodeURIComponent(id)}`),
  analyze: (id, body) => post(`/api/student/${encodeURIComponent(id)}/analyze`, body),
  tutor: (body) => post('/api/tutor', body),
  submit: (body) => post('/api/submissions', body),
  defenseQuestion: (id) => get(`/api/submissions/${encodeURIComponent(id)}/defense-question`),
  defense: (id, body) => post(`/api/submissions/${encodeURIComponent(id)}/defense`, body),
  enroll: (body) => post('/api/voiceprint/enroll', body),
  compare: (body) => post('/api/voiceprint/compare', body),
  mentorState: (studentId) => get(`/api/mentor/state?studentId=${encodeURIComponent(studentId)}`),
  mentorTurn: (body) => post('/api/mentor/turn', body),
  leaderboard: () => get('/api/leaderboard'),
  rewards: (studentId) => get(`/api/rewards/${encodeURIComponent(studentId)}`),
  redeem: (body) => post('/api/rewards/redeem', body),
  parents: () => get('/api/parents'),
  parentReport: (id) => get(`/api/parents/${encodeURIComponent(id)}/report`),
  sendReport: (id) => post(`/api/parents/${encodeURIComponent(id)}/send`, {}),
  prompts: () => get('/api/prompts'),
  audit: () => get('/api/audit'),
};
