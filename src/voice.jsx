import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Mic, Square, Wand2 } from 'lucide-react';

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
export const recognitionSupported =
  typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

/* ------------------------------------------------------------------ speech out */
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const voiceRef = useRef(null);

  useEffect(() => {
    if (!speechSupported) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) {
        setVoices(v);
        const ranked = v.filter((x) => /en[-_]/i.test(x.lang));
        voiceRef.current =
          ranked.find((x) => /(guy|ryan|arthur|daniel|alex|thomas|male)/i.test(x.name)) ||
          ranked.find((x) => /en[-_]GB/i.test(x.lang)) ||
          ranked[0] ||
          v[0];
      }
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const cancel = useCallback(() => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text, opts = {}) => {
    if (!speechSupported || !text) {
      opts.onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*_`#]/g, ''));
    if (voiceRef.current) u.voice = voiceRef.current;
    u.rate = opts.rate ?? 1.07;
    u.pitch = opts.pitch ?? 0.92;
    u.volume = opts.volume ?? 1;
    u.onstart = () => { setSpeaking(true); opts.onStart?.(); };
    u.onend = () => { setSpeaking(false); opts.onEnd?.(); };
    u.onerror = () => { setSpeaking(false); opts.onEnd?.(); };
    window.speechSynthesis.speak(u);
  }, []);

  return { speak, cancel, speaking, supported: speechSupported, voiceName: voiceRef.current?.name || (voices[0]?.name ?? null) };
}

/* ------------------------------------------------------------------ speech in */
export function useDictation({ onFinal }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recRef = useRef(null);
  const wantRef = useRef(false);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  const spawn = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let captured = '';
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) captured += r[0].transcript;
        else live += r[0].transcript;
      }
      setInterim(live);
      if (captured.trim()) {
        setInterim('');
        finalRef.current?.(captured.trim());
      }
    };
    rec.onerror = (ev) => {
      if (ev.error === 'no-speech' || ev.error === 'aborted') return;
      setError(ev.error === 'not-allowed' ? 'Microphone permission denied — type instead.' : `Dictation error: ${ev.error}`);
      wantRef.current = false;
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      if (wantRef.current) setTimeout(() => { if (wantRef.current) spawn(); }, 260);
    };
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
      setError('');
    } catch {
      setError('Could not start dictation in this browser.');
    }
  }, []);

  const start = useCallback(() => {
    if (!recognitionSupported) {
      setError('Live dictation is not available in this browser — type your reply below.');
      return;
    }
    wantRef.current = true;
    if (!recRef.current) spawn();
  }, [spawn]);

  const stop = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop?.();
    recRef.current = null;
    setListening(false);
    setInterim('');
  }, []);

  useEffect(() => () => {
    wantRef.current = false;
    try { recRef.current?.stop?.(); } catch { /* noop */ }
  }, []);

  return { start, stop, listening, interim, error, supported: recognitionSupported };
}

/* ------------------------------------------------------------------ fingerprint */
const BANDS = 24;
const logBands = (sampleRate, fftSize) => {
  const nyquist = sampleRate / 2;
  const edges = [];
  const lo = 90;
  const hi = Math.min(6000, nyquist * 0.96);
  for (let i = 0; i <= BANDS; i++) {
    const f = lo * Math.pow(hi / lo, i / BANDS);
    edges.push(Math.max(1, Math.round((f / nyquist) * (fftSize / 2))));
  }
  return edges;
};

/** Samples the live microphone and returns a 24-band acoustic fingerprint. */
export function createFingerprintSampler(stream) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.55;
  source.connect(analyser);

  const freq = new Float32Array(analyser.frequencyBinCount);
  const time = new Float32Array(analyser.fftSize);
  const edges = logBands(ctx.sampleRate, analyser.fftSize);
  const sums = new Float32Array(BANDS);
  const pitches = [];
  const zcrs = [];
  let frames = 0;
  let voiced = 0;
  let level = 0;
  const startedAt = performance.now();
  let timer = null;

  const measurePitch = () => {
    const buf = time;
    const sr = ctx.sampleRate;
    const minLag = Math.floor(sr / 400);
    const maxLag = Math.floor(sr / 70);
    let bestLag = -1;
    let bestCorr = 0;
    for (let lag = minLag; lag < maxLag; lag += 2) {
      let corr = 0;
      let energy = 0;
      for (let i = 0; i < buf.length - lag; i += 4) {
        corr += buf[i] * buf[i + lag];
        energy += buf[i] * buf[i];
      }
      if (energy > 0) corr /= energy;
      if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }
    if (bestCorr > 0.32 && bestLag > 0) return sr / bestLag;
    return null;
  };

  const tick = () => {
    analyser.getFloatFrequencyData(freq);
    analyser.getFloatTimeDomainData(time);
    let energy = 0;
    let zeroCross = 0;
    for (let i = 0; i < time.length; i++) {
      energy += time[i] * time[i];
      if (i > 0 && (time[i - 1] < 0) !== (time[i] < 0)) zeroCross++;
    }
    const rms = Math.sqrt(energy / time.length);
    level = Math.min(1, rms * 7);
    frames++;
    if (rms > 0.008) {
      voiced++;
      for (let b = 0; b < BANDS; b++) {
        const from = edges[b];
        const to = Math.max(from + 1, edges[b + 1]);
        let acc = 0;
        let n = 0;
        for (let bin = from; bin < to && bin < freq.length; bin++) {
          acc += Math.pow(10, freq[bin] / 20);
          n++;
        }
        sums[b] += n ? acc / n : 0;
      }
      zcrs.push(zeroCross / time.length);
      if (voiced % 3 === 0) {
        const p = measurePitch();
        if (p && p > 70 && p < 420) pitches.push(p);
      }
    }
  };

  timer = setInterval(tick, 70);
  tick();

  return {
    get level() { return level; },
    get elapsed() { return (performance.now() - startedAt) / 1000; },
    get voicedRatio() { return frames ? voiced / frames : 0; },
    stop() {
      clearInterval(timer);
      try { source.disconnect(); ctx.close(); } catch { /* noop */ }
      const raw = Array.from(sums).map((x) => x / Math.max(1, voiced));
      const max = Math.max(...raw, 1e-9);
      const bands = raw.map((x) => Number((x / max).toFixed(4)));
      const median = (arr) => {
        if (!arr.length) return 0;
        const s = [...arr].sort((a, b) => a - b);
        return s[Math.floor(s.length / 2)];
      };
      const durationS = (performance.now() - startedAt) / 1000;
      return {
        bands,
        pitch: Number(median(pitches).toFixed(1)),
        zcr: Number((zcrs.length ? zcrs.reduce((a, b) => a + b, 0) / zcrs.length : 0).toFixed(4)),
        durationS: Number(durationS.toFixed(1)),
        quality: Number(Math.min(1, 0.35 + (voiced / Math.max(1, frames)) * 0.5 + Math.min(1, durationS / 20) * 0.15).toFixed(2)),
      };
    },
  };
}

/** Deterministic simulated fingerprint for devices without a microphone. */
export function simulateFingerprint({ baseline = null, mode = 'match' } = {}) {
  const jitter = (v, amt) => Number((v * (1 + (Math.random() - 0.5) * amt)).toFixed(4));
  if (baseline && Array.isArray(baseline.bands) && baseline.bands.length) {
    if (mode === 'impostor') {
      return {
        bands: baseline.bands.map((v, i) => Number(Math.max(0.01, v * (0.55 + ((i * 13) % 7) / 14)).toFixed(4))).reverse(),
        pitch: Math.round((baseline.pitch || 160) * 0.74),
        zcr: Number(((baseline.zcr || 0.05) * 1.34).toFixed(4)),
        durationS: 27,
        quality: 0.82,
      };
    }
    return {
      bands: baseline.bands.map((v) => jitter(v, 0.14)),
      pitch: Math.round((baseline.pitch || 160) * (0.97 + Math.random() * 0.05)),
      zcr: Number(((baseline.zcr || 0.05) * (0.93 + Math.random() * 0.12)).toFixed(4)),
      durationS: 27,
      quality: 0.88,
    };
  }
  return {
    bands: Array.from({ length: BANDS }, (_, i) => Number((0.25 + 0.55 * Math.abs(Math.sin(i * 1.3 + 0.4))).toFixed(4))),
    pitch: 130 + Math.round(Math.random() * 60),
    zcr: 0.049,
    durationS: 27,
    quality: 0.8,
  };
}

/* ------------------------------------------------------------------ recorder */
export function LevelMeter({ getLevel, bars = 32 }) {
  const [history, setHistory] = useState(() => new Array(bars).fill(0.05));
  const raf = useRef(0);
  useEffect(() => {
    let mounted = true;
    const loop = () => {
      if (!mounted) return;
      const v = typeof getLevel === 'function' ? getLevel() : 0;
      setHistory((h) => [...h.slice(1), Math.max(0.05, v)]);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { mounted = false; cancelAnimationFrame(raf.current); };
  }, [getLevel]);
  return (
    <div className="meter" aria-hidden="true">
      {history.map((h, i) => (
        <i key={i} style={{ height: `${Math.round(h * 100)}%`, opacity: 0.35 + h * 0.65 }} />
      ))}
    </div>
  );
}

export function Recorder({ seconds = 30, title, hint, onDone, simulateOptions = [], busy = false }) {
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [left, setLeft] = useState(seconds);
  const [sampler, setSampler] = useState(null);
  const streamRef = useRef(null);
  const samplerRef = useRef(null);
  const tickRef = useRef(null);

  const cleanup = useCallback(() => {
    clearInterval(tickRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const finish = useCallback(() => {
    clearInterval(tickRef.current);
    const s = samplerRef.current;
    if (!s) return;
    const fingerprint = s.stop();
    samplerRef.current = null;
    setSampler(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setState('done');
    onDone?.({ fingerprint, durationS: fingerprint.durationS, simulated: false });
  }, [onDone]);

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const s = createFingerprintSampler(stream);
      samplerRef.current = s;
      setSampler(s);
      setLeft(seconds);
      setState('recording');
      const began = Date.now();
      tickRef.current = setInterval(() => {
        const remaining = seconds - (Date.now() - began) / 1000;
        setLeft(Math.max(0, remaining));
        if (remaining <= 0) finish();
      }, 200);
    } catch (e) {
      setError(
        e?.name === 'NotAllowedError'
          ? 'Microphone blocked. Allow access in your browser, or use a simulation below.'
          : 'No microphone available in this environment — use a simulation below.'
      );
      setState('idle');
    }
  };

  const manualStop = () => {
    if (samplerRef.current && samplerRef.current.voicedRatio < 0.25) {
      setError('Almost no speech detected. Try again closer to the microphone, or simulate.');
      cleanup();
      samplerRef.current = null;
      setSampler(null);
      setState('idle');
      return;
    }
    finish();
  };

  const runSim = (opt) => {
    const fingerprint = simulateFingerprint({ baseline: opt.baseline, mode: opt.mode });
    setState('done');
    onDone?.({ fingerprint, durationS: fingerprint.durationS, simulated: true, label: opt.label });
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          {title && <b style={{ fontSize: 13 }}>{title}</b>}
          {hint && <div className="hintline">{hint}</div>}
        </div>
        <span className={`chip ${state === 'recording' ? 'rose dot' : state === 'done' ? 'mint' : 'plain'}`}>
          {state === 'recording' ? 'Recording' : state === 'done' ? 'Captured' : 'Ready'}
        </span>
      </div>

      <div className="row" style={{ gap: 16, alignItems: 'center' }}>
        <button
          className={`rec-btn ${state === 'recording' ? 'recording' : ''}`}
          onClick={state === 'recording' ? manualStop : start}
          disabled={busy || state === 'done'}
          aria-label={state === 'recording' ? 'Stop recording' : 'Start recording'}
        >
          {state === 'recording' ? <Square size={22} /> : <Mic size={24} />}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={`timer ${state === 'recording' && left < 8 ? 'low' : ''}`}>
            {state === 'recording' ? `${Math.ceil(left)}s` : state === 'done' ? 'Captured' : `${seconds}s`}
          </div>
          <div className="hintline">
            {state === 'recording'
              ? 'Speak naturally in full sentences. Your fingerprint is computed on this device.'
              : state === 'done'
                ? 'Fingerprint extracted on-device. Raw audio was never uploaded.'
                : 'Tap the microphone to begin.'}
          </div>
          {state === 'recording' && sampler && <div style={{ marginTop: 8 }}><LevelMeter getLevel={() => samplerRef.current?.level || 0} /></div>}
        </div>
      </div>

      {error && (
        <div className="notice amber">
          <AlertTriangle size={14} /> <span>{error}</span>
        </div>
      )}

      {simulateOptions.length > 0 && state !== 'recording' && (
        <div className="row tight">
          <span className="xs muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Wand2 size={12} /> No mic? Simulate:
          </span>
          {simulateOptions.map((opt) => (
            <button key={opt.label} className="btn tiny ghost" onClick={() => runSim(opt)} disabled={busy || state === 'done'}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
