/**
 * Target's Angry Mentor — local persona engine.
 * The production path is a realtime speech-to-speech session (see
 * REALTIME_VOICE_PROMPT / REALTIME_SESSION_CONFIG). This engine reproduces the
 * same behaviour contract offline: <3 sentence turns, instant barge-in recovery,
 * school-safe roasting, Tashkent code-switching, mini-quizzes for Target Coins,
 * and passive Voice-Print enrolment.
 */
import { mentorSessions, getStudent, addCoins, SETTINGS } from './store.js';

const GREETINGS = [
  'Look who finally opened the app. I was starting to think your homework was writing itself — oh wait, that is exactly what ChatGPT is for, right?',
  'Oh, the legend returns. Sit down, we have ninety seconds and your excuses are already boring me.',
  'You are late. Not to school — to your own potential. Anyway, you are here, so talk.',
];

const BARGE_IN_ACK = [
  'Oh, now you suddenly have energy to talk?',
  'Hold on — do not cut me off unless you have an actual point.',
  'Wow, interrupted by the student who was “just about to start”. Go on then.',
  'Did your brain finally log in? Speak.',
  'You cut me off. Bold move from someone with 40% battery and 0% homework done.',
];

const PROCRASTINATION = [
  'Later is where dreams go to die, aka 11:59 PM panic time. Show me one paragraph right now, not your intentions.',
  '“Later” — the official language of people who cry on Sunday night. Open the assignment. I will wait, loudly.',
  'You have six days of streak and you want to throw it away for a nap? Brave. Wrong, but brave.',
];

const CHATGPT_ROAST = [
  'ChatGPT does not know what Ms. Rasulova wrote on the board in Room 214, and neither do you if you let it write for you. One paragraph, your words, go.',
  'You want a robot to write it, then a robot gets the coin. Sounds fair to me. Your turn — say the idea out loud in one sentence.',
  'Congrats, the model can spell better than both of us. It still cannot pass your voice defense, so start talking.',
  'Pasting AI text into Target is like bringing a translator to your own wedding. Everyone notices.',
];

const TIRED = [
  'Tired? Charchadim? Your brain is a muscle, not a phone — it does not recharge by scrolling. Ten minutes, then you nap like a champion.',
  'Okay, tired is allowed. Quitting is not. Say one thing you learned today and you get to leave.',
  'Tired is fine. Silent is not. Give me one sentence about the lesson and I will stop roasting you for exactly four minutes.',
];

const EXCUSE = [
  'Everyone is busy. The difference is some people are busy finishing and others are busy explaining why they are not.',
  'Great excuse. Framed it, hung it on the wall. Homework still not done.',
  'Your teacher does not accept excuses, and I am meaner than your teacher. Talk.',
];

const GREETING_REPLY = [
  'Salom. No small talk — what are you working on, and how much of it is actually yours?',
  'Hey. Since you are here: what was today’s lesson about? One sentence, no googling.',
  'Salom, qahramon. Today’s homework or today’s excuses? Choose carefully.',
];

const CORRECT = [
  'Correct. Annoyingly correct. Take the coins and do not let it go to your head.',
  'Look at that — the brain works! Coins are yours. Next one, harder.',
  'Huh. You actually knew that. Fine, I am impressed. Do not make it a habit.',
  'Bingo. That is +coins and minus one excuse from your record.',
];

const WRONG = [
  'Wrong, but loud — my favourite combination. Try again, and this time think before your mouth opens.',
  'Not even close. That answer was a guess wearing a suit. Again.',
  'Yaqin emas. Think: what does the word actually mean in a normal sentence?',
];

const LATE_NIGHT = [
  'It is late, you are tired, and your paragraph is still theory. Ten minutes of actual writing and I will call it a night.',
  'Late-night writing is just anxiety with a keyboard. Do one sentence properly, then sleep.',
];

const VOCAB_QUIZZES = [
  { id: 'ubiquitous', question: 'Five seconds: what does “ubiquitous” mean? Use it in one sentence.', expect: ['everywhere', 'every place', 'widespread', 'present everywhere', 'hamma joyda'], reward: 15, difficulty: 'vocab' },
  { id: 'crucial', question: 'Give me a synonym for “crucial” — not the word “important”, something sharper.', expect: ['vital', 'essential', 'critical', 'decisive', 'pivotal'], reward: 12, difficulty: 'vocab' },
  { id: 'thorough', question: 'Spell “thorough” and then use it in a sentence about homework.', expect: ['thorough', 't h o r o u g h', 'careful', 'complete', 'detailed'], reward: 15, difficulty: 'vocab' },
  { id: 'subtle', question: 'What does “subtle” mean? One example, five seconds.', expect: ['not obvious', 'delicate', 'nuance', 'slight', 'understated', 'sezilarsiz'], reward: 12, difficulty: 'vocab' },
  { id: 'regret', question: 'Turn this regret into a third conditional out loud: “I missed the train.” Go.', expect: ['if i had', 'would have', 'had left', 'had not', 'hadn’t'], reward: 18, difficulty: 'grammar' },
  { id: 'because', question: 'Finish the chain: “I use a question first because…” — one real reason, five seconds.', expect: ['because', 'reader', 'attention', 'curious', 'listen', 'audience'], reward: 12, difficulty: 'logic' },
  { id: 'logic1', question: 'Homework is due at 18:00 and it is 14:25. How many minutes do you have? Fast.', expect: ['215', 'three hours', '3 hours'], reward: 15, difficulty: 'logic' },
  { id: 'logic2', question: 'If every persuasive paragraph needs one question, and you wrote four paragraphs and three questions, how many paragraphs are missing one?', expect: ['1', 'one'], reward: 15, difficulty: 'logic' },
  { id: 'unnecessary', question: 'Name the sentence in your last paragraph you could delete without losing meaning. Five seconds.', expect: ['last', 'delete', 'cut', 'second', 'summary', 'conclusion'], reward: 10, difficulty: 'self-awareness' },
];

const UZBEK_HINTS = /\b(salom|qalaysan|nima|nimaga|yaxshi|zo'?r|charchadim|ertaga|keyin|dars|kitob|uyga|vazifa|aka|uka|bolai|ha|yo'?q)\b/i;
const INTENTS = {
  chatgpt: /\b(chat\s?gpt|gpt|ai|bot|copy|paste|yozib ber|internetdan)\b/i,
  procrastination: /\b(later|tomorrow|keyin|ertaga|after|nap|sleep|uxlayman)\b/i,
  tired: /\b(tired|charchadim|exhausted|sleepy|uyqu)\b/i,
  excuse: /\b(busy|band|no time|vaqt yo'?q|too much|teacher|football|game)\b/i,
  greeting: /\b(hi|hello|hey|salom|assalom|good morning|good evening)\b/i,
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function evaluateQuiz(quiz, text) {
  const lower = text.toLowerCase().replace(/[’]/g, "'");
  if (!lower.trim()) return 'empty';
  const hit = quiz.expect.some((k) => lower.includes(k.toLowerCase()));
  if (hit) return 'correct';
  if (lower.split(/\s+/).length <= 2 && /\d/.test(lower)) return 'wrong';
  return 'attempt';
}

export function mentorTurn({ studentId, text = '', interrupted = false, event = null }) {
  const student = getStudent(studentId);
  const key = studentId;
  const st = mentorSessions.get(key) || {
    turn: 0,
    quiz: null,
    correct: 0,
    total: 0,
    coins: 0,
    streak: 0,
    lastIntent: null,
    history: [],
  };
  st.turn += 1;

  const input = (text || '').trim();
  const lower = input.toLowerCase();
  const parts = [];
  let coins = 0;
  let quiz = st.quiz;
  let quizResult = null;
  let bargeIn = false;

  if (event === 'start') {
    parts.push(pick(GREETINGS));
    st.quiz = null;
    quiz = null;
  } else {
    if (interrupted) {
      bargeIn = true;
      parts.push(pick(BARGE_IN_ACK));
    }

    // 1) Active mini-quiz gets evaluated before anything else.
    if (quiz) {
      quizResult = evaluateQuiz(quiz, input);
      if (quizResult === 'correct') {
        coins += quiz.reward;
        st.correct += 1;
        st.streak += 1;
        parts.push(pick(CORRECT));
        quiz = null;
      } else if (quizResult === 'wrong' || quizResult === 'attempt') {
        st.streak = 0;
        parts.push(pick(WRONG));
      }
    }

    // 2) Intent handling (only if the quiz did not consume the turn).
    if (!quiz && !quizResult) {
      if (INTENTS.chatgpt.test(lower)) {
        st.lastIntent = 'chatgpt';
        parts.push(pick(CHATGPT_ROAST));
      } else if (INTENTS.procrastination.test(lower)) {
        st.lastIntent = 'procrastination';
        parts.push(pick(PROCRASTINATION));
      } else if (INTENTS.tired.test(lower)) {
        st.lastIntent = 'tired';
        parts.push(pick(TIRED));
      } else if (INTENTS.excuse.test(lower)) {
        st.lastIntent = 'excuse';
        parts.push(pick(EXCUSE));
      } else if (INTENTS.greeting.test(lower) && lower.length < 40) {
        st.lastIntent = 'greeting';
        parts.push(pick(GREETING_REPLY));
      } else if (UZBEK_HINTS.test(lower)) {
        st.lastIntent = 'uzbek';
        parts.push(
          pick([
            'Yaxshi, o‘zbekcha gapiryapsan — demak, fikr bor. Endi shu fikrni inglizcha bir gapda ayt, men kutaman.',
            'Zo‘r. Uzbek-English switch qildik, endi homework haqida gapiramiz. What is your paragraph about?',
            'Ha, tushundim. Endi menga bitta aniq gap ayt — nima yozmoqchisan?',
          ])
        );
      } else if (input.length > 0) {
        // Reflective / defensive answer: reward effort, push for specifics.
        st.lastIntent = 'reflect';
        const kw = input.split(/\s+/).filter((w) => w.length > 5)[0];
        parts.push(
          pick([
            `Okay, “${kw || 'that'}” is a start. But a start is not an answer. What is the one sentence you would defend in front of the whole class?`,
            'Hm. That is a sentence, not an argument. Give me the reason behind it — “because…” — and do not stop halfway.',
            'Fine, I believe you are thinking. Now prove it: what did the lesson actually change about how you would write the paragraph?',
          ])
        );
        st.streak += 1;
      } else {
        parts.push('Silence. Cool. Silence does not raise your grade. Say one sentence about today’s lesson.');
      }
    }

    // 3) Fire a new 5-second challenge most turns.
    if (!quiz && st.turn % 2 === 1) {
      const candidates = VOCAB_QUIZZES.filter((q) => q.id !== st.quiz?.id);
      quiz = candidates[Math.floor(Math.random() * candidates.length)];
      st.total += 1;
      parts.push(`Five seconds, bonus coins: ${quiz.question}`);
    } else if (!quiz) {
      // occasionally a lighter challenge
      quiz = VOCAB_QUIZZES[(st.turn + 2) % VOCAB_QUIZZES.length];
      st.total += 1;
      parts.push(`Boshqa savol, tez: ${quiz.question}`);
    }
  }

  // Confidence/streak coin, capped so the module cannot be farmed by spamming.
  if (!quizResult && !event && input.length > 8 && coins === 0) {
    coins += 4;
  }
  coins = Math.min(coins, 20);

  if (coins > 0 && student) {
    addCoins(studentId, coins, quizResult === 'correct' ? `Angry Mentor mini-quiz · “${quiz?.question.slice(0, 40)}…”` : 'Angry Mentor · effort streak');
    st.coins += coins;
  }

  st.quiz = quiz;
  st.history.push({ at: new Date().toISOString(), text: input, reply: parts.join(' '), interrupted, coins });
  if (st.history.length > 40) st.history.shift();
  mentorSessions.set(key, st);

  const reply = parts.join(' ').replace(/\s+/g, ' ').trim();

  return {
    reply: reply.length > 420 ? reply.slice(0, 417) + '…' : reply,
    bargeIn,
    quiz: quiz ? { id: quiz.id, question: quiz.question, reward: quiz.reward, difficulty: quiz.difficulty } : null,
    quizResult,
    coins,
    coinsBalance: student?.coins ?? 0,
    streak: st.streak,
    turn: st.turn,
    language: UZBEK_HINTS.test(lower) ? 'uz-en' : 'en',
    voiceprintEnrolled: !!student?.voiceprint,
    policy: {
      maxSentences: 3,
      bargeIn: true,
      schoolSafe: true,
      provider: SETTINGS.modelProvider,
    },
  };
}

export function mentorState(studentId) {
  const st = mentorSessions.get(studentId);
  const student = getStudent(studentId);
  return {
    active: !!st,
    turn: st?.turn || 0,
    correct: st?.correct || 0,
    asked: st?.total || 0,
    coinsEarned: st?.coins || 0,
    streak: st?.streak || 0,
    history: st?.history?.slice(-12) || [],
    voiceprintEnrolled: !!student?.voiceprint,
  };
}
