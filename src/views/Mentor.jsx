import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowRight, AudioLines, Coins, Flame, Headphones, Languages, Mic, MicOff,
  Radio, Send, Sparkles, Timer, Volume2, VolumeX, Zap, ShieldCheck, Lock,
} from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { useData } from '../hooks.js';
import { Bar, Card, CardHead, Chip, Spinner, useToast } from '../components/ui.jsx';
import { Recorder, LevelMeter, useDictation, useSpeech, recognitionSupported, speechSupported } from '../voice.jsx';

export default function Mentor() {
  const { studentId, settings, toast, navigate } = useApp();
  const { data, error } = useData(() => api.student(studentId), [studentId]);
  const [state, setState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [coins, setCoins] = useState(0);
  const [balance, setBalance] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [lastInterrupt, setLastInterrupt] = useState(false);
  const [bargeStreak, setBargeStreak] = useState(0);
  const [showEnroll, setShowEnroll] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [quizTimer, setQuizTimer] = useState(0);
  const scroller = useRef(null);
  const speech = useSpeech();
  const speakingRef = useRef(false);
  const lastMentorRef = useRef('');
  speakingRef.current = speech.speaking;

  useEffect(() => {
    api.mentorState(studentId).then((s) => {
      setState(s);
      setCorrect(s.correct || 0);
      setCoins(s.coinsEarned || 0);
      if (s.history?.length) {
        const restored = [];
        s.history.slice(-6).forEach((h) => {
          restored.push({ role: 'student', text: h.text });
          restored.push({ role: 'mentor', text: h.reply, meta: h.interrupted ? 'barge-in' : null });
        });
        setMessages(restored);
        setSessionActive(true);
      }
    }).catch(() => {});
  }, [studentId]);

  useEffect(() => {
    scroller.current?.scrollTo?.({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => {
    if (!quiz) { setQuizTimer(0); return; }
    setQuizTimer(8);
    const t = setInterval(() => setQuizTimer((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, [quiz]);

  const pushMentor = (text, meta, tone) => {
    lastMentorRef.current = text;
    setMessages((m) => [...m.slice(-24), { role: 'mentor', text, meta, tone }]);
  };

  const turn = useCallback(async (text, { interrupted = false, event = null } = {}) => {
    if (!event && !text.trim()) return;
    if (event !== 'start') {
      setMessages((m) => [...m.slice(-24), { role: 'student', text, interrupted }]);
    }
    setInput('');
    setThinking(true);
    if (interrupted) { speech.cancel(); setLastInterrupt(true); setTimeout(() => setLastInterrupt(false), 2400); setBargeStreak((b) => b + 1); }
    try {
      const res = await api.mentorTurn({ studentId, text, interrupted, event });
      pushMentor(res.reply, interrupted ? 'barge-in acknowledged' : res.quizResult === 'correct' ? 'quiz cleared' : null);
      setQuiz(res.quiz);
      if (res.coins > 0) { setCoins((c) => c + res.coins); }
      if (res.quizResult === 'correct') setCorrect((c) => c + 1);
      if (voiceOn) speech.speak(res.reply);
      setState((s) => ({ ...(s || {}), voiceprintEnrolled: res.voiceprintEnrolled }));
    } catch (e) {
      pushMentor(`Connection hiccup: ${e.message}. Say that again — I am not repeating myself twice.`, 'system', 'rose');
    } finally {
      setThinking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, voiceOn]);

  const onFinal = useCallback((text) => {
    if (!text.trim()) return;
    if (speakingRef.current) {
      // Self-audio guard: ignore the mentor's own voice picked up by the mic.
      const norm = (s) => s.toLowerCase().replace(/[^a-z\s]/g, '').trim();
      const heard = norm(text);
      const echo = norm(lastMentorRef.current);
      if (heard.length > 12 && echo.includes(heard.slice(0, 24))) return;
      speech.cancel();
      turn(text, { interrupted: true });
    } else {
      turn(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn]);

  const dictation = useDictation({ onFinal });

  useEffect(() => {
    if (micOn) dictation.start();
    else dictation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micOn]);

  const start = () => {
    setSessionActive(true);
    turn('', { event: 'start' });
  };

  const enroll = async ({ fingerprint, simulated }) => {
    try {
      const res = await api.enroll({ studentId, fingerprint, simulated });
      setShowEnroll(false);
      if (res.coins > 0) setCoins((c) => c + res.coins);
      if (res.student?.coins) setBalance(res.student.coins);
      toast({ tone: 'mint', title: 'Voice-Print enrolled', body: `${res.coins > 0 ? `+${res.coins} coins · ` : ''}Your homework defense will now be matched against this baseline.` });
      setState((s) => ({ ...(s || {}), voiceprintEnrolled: true }));
    } catch (e) {
      toast({ tone: 'rose', title: 'Enrolment failed', body: e.message });
    }
  };

  if (error) return <Card><div className="card-body"><div className="notice rose">{error}</div></div></Card>;
  if (!data) return <Card><div className="card-body" style={{ display: 'grid', placeItems: 'center', minHeight: 240 }}><Spinner /></div></Card>;

  const student = data.student;
  const enrolled = state?.voiceprintEnrolled ?? student.voiceprintEnrolled;
  const orbState = speech.speaking ? 'speaking' : dictation.listening ? 'listening' : thinking ? 'thinking' : 'idle';

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row tight" style={{ marginBottom: 8 }}>
            <Chip tone="rose dot">Full-duplex · barge-in armed</Chip>
            <Chip tone={enrolled ? 'violet' : 'amber'}><Mic size={12} /> Voice-Print {enrolled ? 'enrolled' : 'missing'}</Chip>
            <Chip plain>{speech.supported ? 'TTS ready' : 'TTS unavailable'} · {recognitionSupported ? 'dictation ready' : 'type mode'}</Chip>
          </div>
          <h1>Angry Mentor</h1>
          <p className="sub">
            Impatient older-brother energy, Tashkent slang, five-second challenges for coins — and yes, you can interrupt him mid-sentence. That is the whole point.
          </p>
        </div>
        <div className="page-actions">
          <button className={`btn ${voiceOn ? '' : 'ghost'}`} onClick={() => { setVoiceOn((v) => !v); if (voiceOn) speech.cancel(); }}>
            {voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />} Voice {voiceOn ? 'on' : 'muted'}
          </button>
          <button className={`btn ${micOn ? 'danger' : ''}`} onClick={() => setMicOn((m) => !m)} disabled={!recognitionSupported}>
            {micOn ? <MicOff size={15} /> : <Mic size={15} />} {micOn ? 'Stop mic' : 'Live mic'}
          </button>
        </div>
      </div>

      <div className="split">
        <div className="stack">
          <Card>
            <div className="orb-stage">
              <div className="orb-ripple" />
              <div className={`orb ${orbState === 'speaking' ? 'speaking' : orbState === 'listening' ? 'listening' : orbState === 'thinking' ? 'thinking' : ''}`} />
              <div className="orb-caption">
                {orbState === 'speaking' ? 'Mentor speaking — interrupt me' : orbState === 'listening' ? 'Listening — barge-in ready' : orbState === 'thinking' ? 'Thinking of a better insult…' : sessionActive ? 'Idle — say something' : 'Session not started'}
              </div>
            </div>
            <div className="card-body stack" style={{ gap: 12, borderTop: '1px solid var(--line)' }}>
              {lastInterrupt && (
                <div className="notice rose" style={{ padding: '8px 12px' }}>
                  <Zap size={14} /><span><b>Barge-in fired.</b> Speech synthesis stopped mid-word and the mentor acknowledged you instantly — no apology, no restart.</span>
                </div>
              )}
              {!sessionActive ? (
                <button className="btn primary wide" onClick={start}><Flame size={15} /> Start session</button>
              ) : (
                <div className="row" style={{ gap: 8 }}>
                  <input
                    className="input"
                    value={input}
                    placeholder={micOn ? 'Listening… or type to interrupt' : 'Type to interrupt him mid-sentence'}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && input.trim()) { speech.cancel(); turn(input, { interrupted: speech.speaking }); } }}
                  />
                  <button className="btn primary" onClick={() => { const interrupted = speech.speaking; speech.cancel(); turn(input, { interrupted }); }} disabled={!input.trim() || thinking}>
                    <Send size={15} />
                  </button>
                </div>
              )}
              <div className="row tight">
                {['I’ll do it later', 'Can ChatGPT write it?', 'Salom, nima gap?', 'I’m tired aka'].map((s) => (
                  <button key={s} className="btn tiny ghost" onClick={() => turn(s)} disabled={thinking}>{s}</button>
                ))}
              </div>
              {micOn && (
                <div className="row tight xs muted">
                  <AudioLines size={13} style={{ color: 'var(--mint)' }} />
                  {dictation.listening ? 'Dictation active — speak and he will be cut off mid-sentence.' : dictation.error || 'Starting microphone…'}
                  {dictation.interim && <em style={{ color: 'var(--text-2)' }}>“{dictation.interim}”</em>}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHead
              title="Live transcript"
              sub="Every turn capped at three sentences"
              icon={<Headphones size={16} />}
              right={<Chip tone="mint">{messages.filter((m) => m.role === 'mentor').length} mentor turns</Chip>}
            />
            <div className="card-body">
              <div className="chat" style={{ maxHeight: 330 }} ref={scroller}>
                {messages.length === 0 && <div className="bubble sys">No transcript yet. Press “Start session” and he will open with a roast.</div>}
                {messages.map((m, i) => (
                  <div key={i} className={`bubble ${m.role === 'student' ? 'me' : m.role === 'system' ? 'sys' : 'tutor'}`}>
                    {m.text}
                    {m.meta && <div className="b-meta"><Zap size={10} /> {m.meta}</div>}
                    {m.interrupted && m.role === 'student' && <div className="b-meta"><Zap size={10} /> interrupted mid-sentence</div>}
                  </div>
                ))}
                {thinking && <div className="bubble tutor"><span className="typing"><i /><i /><i /></span></div>}
              </div>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHead title="Session stats" sub="Coins only, no gold stars" icon={<Coins size={16} />} />
            <div className="card-body stack" style={{ gap: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div className="xs muted">Coins earned here</div>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 30, lineHeight: 1.1, color: 'var(--amber)' }}>+{coins}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="xs muted">Balance</div>
                  <div className="mono" style={{ fontSize: 15 }}>{balance ?? student.coins}</div>
                </div>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small dim">Challenges cleared</span>
                <Chip tone="mint">{correct}</Chip>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small dim">Barge-ins</span>
                <Chip tone="rose">{bargeStreak}</Chip>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small dim">Voice-Print baseline</span>
                {enrolled ? <Chip tone="violet"><Lock size={11} /> enrolled</Chip> : <Chip tone="amber">missing</Chip>}
              </div>
              {!enrolled && !showEnroll && (
                <button className="btn primary small" onClick={() => setShowEnroll(true)}><Mic size={14} /> Enrol Voice-Print (+25)</button>
              )}
              {showEnroll && (
                <Recorder
                  seconds={settings.enrollmentSeconds}
                  title="Passive enrolment"
                  hint="Keep talking naturally — the mentor keeps the conversation alive."
                  onDone={enroll}
                  simulateOptions={[{ label: 'Simulate enrolment', mode: 'match', baseline: null }]}
                />
              )}
              <button className="btn ghost small" onClick={() => navigate('homework')}>Back to homework <ArrowRight size={13} /></button>
            </div>
          </Card>

          <Card>
            <CardHead title="Five-second challenge" sub="Answer in your next turn" icon={<Timer size={16} />} right={quiz ? <Chip tone="amber">{quizTimer}s</Chip> : <Chip plain>idle</Chip>} />
            <div className="card-body">
              {quiz ? (
                <div className="stack" style={{ gap: 10 }}>
                  <p className="small" style={{ fontWeight: 600 }}>{quiz.question}</p>
                  <Bar value={(quizTimer / 8) * 100} tone={quizTimer < 3 ? 'rose' : 'amber'} height={5} />
                  <div className="row tight">
                    <Chip tone="amber"><Coins size={11} /> +{quiz.reward}</Chip>
                    <Chip plain>{quiz.difficulty}</Chip>
                  </div>
                  <div className="xs muted">Speak your answer or type it. He grades it on the spot.</div>
                </div>
              ) : (
                <div className="empty" style={{ padding: '12px 0' }}>
                  <Sparkles />
                  <b>No challenge live</b>
                  <p>Keep talking — he fires one roughly every other turn.</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="soft">
            <div className="card-body stack" style={{ gap: 8 }}>
              <div className="row tight"><Languages size={13} style={{ color: 'var(--mint)' }} /><b className="small">Code-switching</b></div>
              <p className="xs muted">Speak Uzbek or mix it with English — the persona answers in kind. The local engine mirrors the same contract as the hosted realtime model.</p>
              <div className="row tight">
                <Chip tone="mint">≤3 sentences</Chip>
                <Chip>school-safe</Chip>
                <Chip>no “how can I help”</Chip>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
