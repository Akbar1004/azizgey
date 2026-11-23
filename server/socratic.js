/**
 * Smart Tutor — Socratic only.
 * Hard rule enforced server-side: the tutor never supplies the answer, never
 * writes a sentence for the student, and never rewrites their paragraph. Every
 * exchange is logged as a hint so the teacher can see how much scaffolding the
 * submission needed.
 */
import { tutorSessions, getStudent } from './store.js';

const DIRECT_ANSWER = [
  /\bjust (give|tell) me\b/i,
  /\b(write|do) (it|this|that|my (homework|paragraph|essay)) for me\b/i,
  /\bgive me the answer\b/i,
  /\bwhat('s| is) the answer\b/i,
  /\bsolve (it|this) for me\b/i,
  /\banswer (it|this) for me\b/i,
  /\bjavobini (ayt|yoz)/i,
  /\byozib ber/i,
  /\bcan you write (my|the) (paragraph|essay|answer)/i,
];

const CONFUSION = /\b(i (don'?t|do not) (know|understand)|confused|stuck|no idea|tushunmadim|bilmadim)\b/i;
const BOREDOM = /\b(boring|pointless|why do i|nimaga|zerikarli)\b/i;

const LADDER = [
  {
    level: 1,
    label: 'Clarify the goal',
    build: (ctx) => `Before I say anything — which of your three questions are you actually stuck on? Point at the sentence you would delete if I gave you thirty seconds to edit.`,
  },
  {
    level: 1,
    label: 'Read your own claim',
    build: (ctx) => `Read your first sentence out loud. What is it promising the reader will get by the end of the paragraph? Say it in your own words — I am not accepting a paraphrase of the question.`,
  },
  {
    level: 2,
    label: 'Ground it in the room',
    build: (ctx) => `You are writing about “${ctx.topic}”. What exactly happened in Room 214 today that proves your point? Not the topic in general — the thing someone said, wrote on the board or argued about.`,
  },
  {
    level: 2,
    label: 'Force a counter-argument',
    build: (ctx) => `Imagine ${ctx.role || 'a classmate'} disagrees with you. What is the strongest sentence they could say back? If you cannot produce one, your paragraph has no argument yet.`,
  },
  {
    level: 3,
    label: 'Test the chain',
    build: (ctx) => `You have a claim. Now say “because…” and finish it. Then say “which means…” and finish that. Somewhere in those two sentences is your reasoning — where does it break?`,
  },
  {
    level: 3,
    label: 'Choose the sacrifice',
    build: (ctx) => `You have more ideas than words. Which example would you cut to make the other one twice as convincing, and what do you lose by cutting it?`,
  },
  {
    level: 4,
    label: 'Voice rehearsal',
    build: (ctx) => `Forget writing for a second. Explain your answer to me out loud in one breath, as if we are in the corridor. Now — which sentence got weaker when you said it? That is the sentence to rewrite.`,
  },
];

function pickKeyword(message) {
  const stop = new Set('the a an and or but because i you we they it this that is are was were have has had do does did my me your our about with for from to of in on at as so if then than very really just like what how why when where who'.split(' '));
  const words = (message.toLowerCase().match(/[a-z']{4,}/g) || []).filter((w) => !stop.has(w));
  return words[0] || null;
}

export function tutorTurn({ studentId, variant = {}, message = '', history = [], questionIndex = 0 }) {
  const student = getStudent(studentId);
  const key = `${studentId}:${variant.code || 'default'}`;
  const session = tutorSessions.get(key) || { hints: [], turns: 0 };
  session.turns += 1;

  const text = (message || '').trim();
  const attemptsDirectAnswer = DIRECT_ANSWER.some((re) => re.test(text));

  // Extract a phrase of the student's own writing so the reply feels anchored.
  const quoted = (() => {
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.split(/\s+/).length > 5);
    if (!sentences.length) return null;
    const longest = sentences.sort((a, b) => b.length - a.length)[0];
    return longest.length > 110 ? longest.slice(0, 110).trim() + '…' : longest.trim();
  })();

  let reply;
  let hint = null;

  if (!text) {
    reply = `I am not going to fill the silence for you. What is the one sentence in your draft you are least proud of? Start there — I will wait.`;
  } else if (attemptsDirectAnswer) {
    reply = `No. If I hand you the sentence, the only thing you will have practised is copy-paste with extra steps. Here is what I will do instead: tell me the claim you are trying to prove in one line, and I will ask you the question that exposes whether it survives.`;
    hint = { level: 0, label: 'Direct-answer request refused', concept: 'Ownership of the answer' };
  } else if (CONFUSION.test(text) && text.length < 120) {
    const q = LADDER[Math.min(1, LADDER.length - 1)];
    reply = `${q.build({ topic: variant.topic, role: 'a classmate' })}`;
    hint = { level: q.level, label: q.label, concept: 'Locate the confusion' };
  } else if (quoted) {
    reply = `You wrote: “${quoted}” Good — that is ours to work with. What in that sentence would a sceptical reader refuse to accept without evidence, and what could you point to from today’s lesson?`;
    hint = { level: 2, label: 'Evidence audit on own sentence', concept: 'Evidence vs assertion' };
  } else {
    const idx = (session.turns + questionIndex * 2) % LADDER.length;
    const q = LADDER[idx];
    const kw = pickKeyword(text);
    const anchor = kw ? `You mentioned “${kw}” — ` : '';
    reply = `${anchor}${q.build({ topic: variant.topic || 'the topic', role: 'a classmate' })}`;
    hint = { level: q.level, label: q.label, concept: q.label };
  }

  if (BOREDOM.test(text)) {
    reply = `“Boring” is usually a symptom, not a diagnosis. ${reply}`;
  }

  if (hint) session.hints.push({ ...hint, at: new Date().toISOString(), excerpt: text.slice(0, 120) });
  tutorSessions.set(key, session);

  return {
    reply,
    hint,
    hintsUsed: session.hints.length,
    turns: session.turns,
    policy: 'socratic-only',
    refusal: attemptsDirectAnswer,
    studentName: student?.firstName || 'there',
    nextAction:
      session.hints.length >= 3
        ? 'Teacher will see this submission was heavily scaffolded. The voice defense question will focus on the assisted paragraph.'
        : null,
  };
}

export function tutorLog(studentId) {
  const out = [];
  tutorSessions.forEach((v, k) => {
    if (k.startsWith(`${studentId}:`)) out.push({ key: k, ...v });
  });
  return out;
}
