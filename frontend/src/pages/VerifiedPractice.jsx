import {
  AlertCircle,
  ArrowRight,
  Braces,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Lock,
  MessagesSquare,
  Mic,
  MicOff,
  Quote,
  RotateCcw,
  ShieldCheck,
  Volume2,
  XCircle,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import ScoreRing from '../components/ui/ScoreRing';
import { USER_ID } from '../config';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { useVoice } from '../hooks/useVoice';
import { assessVerified, getVerifiedProgress, getVerifiedQuestions } from '../lib/verifiedApi';

// Verified warm-up: the grading pipeline from our CSCT 2026 paper.
// The LLM only extracts what the candidate said (with a quote for each item);
// fixed rubric rules on the server decide the verdict, score and follow-up.
// Scoring >= the unlock threshold on a DSA topic unlocks that topic's coding interview.

const MODES = [
  { id: 'dsa', icon: Braces, title: 'DSA explanation', text: 'Explain an approach and its time and space complexity.' },
  { id: 'star', icon: MessagesSquare, title: 'Behavioral (STAR)', text: 'Tell a story; each STAR part is checked.' },
];

const TONE = {
  good: 'bg-good/15 text-good border-good/30',
  warn: 'bg-warn/15 text-warn border-warn/30',
  bad: 'bg-bad/15 text-bad border-bad/30',
  info: 'bg-cyan/15 text-cyan border-cyan/30',
  mute: 'bg-white/[0.04] text-mute border-line',
};

const VERDICT = {
  optimal: { label: 'Optimal', tone: 'good' },
  suboptimal: { label: 'Works, not optimal', tone: 'warn' },
  incorrect: { label: 'Incorrect', tone: 'bad' },
  incomplete: { label: 'Incomplete', tone: 'warn' },
  unverifiable: { label: 'Needs human review', tone: 'info' },
};

const PARADIGM_STATUS = {
  accepted: ['Accepted approach', 'good'],
  suboptimal: ['Works, but slower', 'warn'],
  inapplicable: ['Does not solve it', 'bad'],
  unlisted: ['Not in rubric', 'info'],
  missing: ['Not stated', 'mute'],
};

const TIME_STATUS = {
  optimal: ['Optimal', 'good'],
  worse: ['Slower than optimal', 'warn'],
  consistent_suboptimal: ['Correct for this approach', 'warn'],
  better_than_possible: ['Better than possible?', 'bad'],
  wrong_for_approach: ['Wrong for this approach', 'bad'],
  unverifiable: ['Cannot verify', 'info'],
  missing: ['Not stated', 'mute'],
};

const SPACE_STATUS = {
  optimal: ['Optimal', 'good'],
  non_optimal: ['Not optimal', 'warn'],
  missing: ['Not stated', 'mute'],
};

const STAR_ROWS = [
  { key: 'situation', label: 'Situation', weight: 15 },
  { key: 'task', label: 'Task', weight: 15 },
  { key: 'action', label: 'Action', weight: 40 },
  { key: 'result', label: 'Result', weight: 30 },
];

const pretty = (s) => (s ? String(s).replaceAll('_', ' ') : null);

function Chip({ tone = 'mute', children }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE[tone]}`}>
      {children}
    </span>
  );
}

function EvidenceRow({ label, value, status, evidence, rejected }) {
  const [statusLabel, tone] = status;
  return (
    <li className="rounded-xl border border-line bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-mute">{label}</span>
          <span className="font-mono text-sm text-white">{value || '—'}</span>
        </div>
        <Chip tone={tone}>{statusLabel}</Chip>
      </div>
      {evidence ? (
        <p className="mt-2 flex gap-2 text-sm italic leading-relaxed text-soft">
          <Quote size={14} className="mt-1 shrink-0 text-cyan" aria-hidden="true" />
          <span>“{evidence}”</span>
        </p>
      ) : (
        <p className="mt-2 text-xs text-mute">
          {rejected ? 'The AI claimed this, but it was not found in your answer, so it was ignored.' : 'Nothing in your answer covered this.'}
        </p>
      )}
    </li>
  );
}

function DsaResult({ result }) {
  const { extraction: ex, grade: g, grounding_rejected: rejected = [], is_final: isFinal, rubric } = result;
  const verdict = VERDICT[g.verdict] ?? { label: g.verdict, tone: 'mute' };
  return (
    <>
      <div className="flex items-center gap-5">
        <ScoreRing value={Math.round(result.score_01 * 100)} size={104} label="Rubric score" />
        <div>
          <Chip tone={verdict.tone}>{verdict.label}</Chip>
          <p className="mt-2 font-display text-2xl font-semibold text-white">
            {g.score} <span className="text-base text-mute">/ 10</span>
          </p>
          <p className="text-xs text-mute">Approach 4 · Time 4 · Space 2</p>
        </div>
      </div>
      <ul className="mt-5 space-y-3">
        <EvidenceRow
          label="Approach"
          value={pretty(ex.paradigm)}
          status={PARADIGM_STATUS[g.paradigm_status] ?? [g.paradigm_status, 'mute']}
          evidence={ex.paradigm_evidence}
          rejected={rejected.includes('paradigm')}
        />
        <EvidenceRow
          label="Time"
          value={ex.time_complexity}
          status={TIME_STATUS[g.time_status] ?? [g.time_status, 'mute']}
          evidence={ex.time_evidence}
          rejected={rejected.includes('time_complexity')}
        />
        <EvidenceRow
          label="Space"
          value={ex.space_complexity}
          status={SPACE_STATUS[g.space_status] ?? [g.space_status, 'mute']}
          evidence={ex.space_evidence}
          rejected={rejected.includes('space_complexity')}
        />
      </ul>
      {g.reasons?.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm text-soft">
          {g.reasons.map((r) => (
            <li key={r} className="flex gap-2">
              <ArrowRight size={14} className="mt-1 shrink-0 text-cyan" aria-hidden="true" />
              {r}
            </li>
          ))}
        </ul>
      )}
      {isFinal && rubric?.optimal_time?.length > 0 && (
        <p className="mt-4 rounded-xl border border-orchid/30 bg-orchid/10 px-4 py-3 text-sm text-ink">
          Rubric optimum: time <span className="font-mono">{rubric.optimal_time.join(' or ')}</span>, space{' '}
          <span className="font-mono">{rubric.optimal_space.join(' or ')}</span>
        </p>
      )}
    </>
  );
}

function StarResult({ result }) {
  const { extraction: ex, grade: g, grounding_rejected: rejected = [] } = result;
  return (
    <>
      <div className="flex items-center gap-5">
        <ScoreRing value={Math.round(result.score_01 * 100)} size={104} label="STAR score" />
        <div>
          <Chip tone={g.missing.length ? 'warn' : 'good'}>
            {g.missing.length ? `${g.missing.length} part${g.missing.length > 1 ? 's' : ''} missing` : 'All four parts'}
          </Chip>
          <p className="mt-2 text-xs text-mute">Weights: Situation 15 · Task 15 · Action 40 · Result 30</p>
        </div>
      </div>
      <ul className="mt-5 space-y-3">
        {STAR_ROWS.map(({ key, label, weight }) => {
          const present = Boolean(g.components?.[key]);
          return (
            <li key={key} className="rounded-xl border border-line bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  {present ? (
                    <CheckCircle2 size={16} className="text-good" aria-hidden="true" />
                  ) : (
                    <XCircle size={16} className="text-bad" aria-hidden="true" />
                  )}
                  {label}
                </span>
                <span className="text-xs text-mute">{weight}%</span>
              </div>
              {present && ex[key]?.evidence ? (
                <p className="mt-2 flex gap-2 text-sm italic leading-relaxed text-soft">
                  <Quote size={14} className="mt-1 shrink-0 text-cyan" aria-hidden="true" />
                  <span>“{ex[key].evidence}”</span>
                </p>
              ) : (
                <p className="mt-2 text-xs text-mute">
                  {rejected.includes(key)
                    ? 'The AI claimed this, but it was not found in your answer, so it was ignored.'
                    : 'Not covered yet.'}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

const pctOf = (v) => (typeof v === 'number' ? Math.round(v * 100) : null);

// Lock status of the current DSA topic, with a link to its coding interview once unlocked.
function TopicStatus({ topic, info, threshold }) {
  if (!topic || !info) return null;
  const setupLink = `/setup?topic=${encodeURIComponent(topic)}`;
  if (info.unlocked) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-good/30 bg-good/10 px-4 py-3 text-sm text-ink">
        <span className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-good" aria-hidden="true" />
          Coding unlocked for {topic} (best {pctOf(info.best_score)}%)
        </span>
        <Button to={setupLink} size="sm">
          Go to coding
          <ArrowRight size={14} aria-hidden="true" />
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-ink">
      <Lock size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
      <span>
        Coding for <span className="font-semibold">{topic}</span> unlocks at {pctOf(threshold)}%.
        {info.best_score !== null ? ` Best so far: ${pctOf(info.best_score)}%.` : ' Explain any question in this topic to try.'}
      </span>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    ['Answer out loud', 'Speak (Chrome or Edge) or type, like in a real interview.'],
    ['Only what you said counts', 'The AI pulls out your approach, Big-O or STAR parts, each with a quote from your answer. Anything without a matching quote is dropped.'],
    ['Fixed rules grade it', 'A rubric, not the AI, gives the verdict and the next question, so the same answer always gets the same grade.'],
    ['Unlock coding', 'Score 70% or more on a DSA topic to unlock that topic’s coding interview.'],
  ];
  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
        <ShieldCheck size={18} className="text-cyan" aria-hidden="true" />
        How the warm-up works
      </h2>
      <ol className="space-y-3">
        {steps.map(([title, text], i) => (
          <li key={title} className="flex gap-3 rounded-xl border border-line bg-white/[0.03] p-4">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-electric-gradient text-xs font-bold text-white">
              {i + 1}
            </span>
            <span>
              <span className="block text-sm font-semibold text-white">{title}</span>
              <span className="mt-0.5 block text-sm leading-relaxed text-soft">{text}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function VerifiedPractice() {
  const reduce = useReducedMotion();
  const speech = useSpeechInput();
  const { speak, cancel } = useVoice();

  const [searchParams] = useSearchParams();
  const topicParam = searchParams.get('topic');
  const [catalog, setCatalog] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [kind, setKind] = useState('dsa');
  const [questionId, setQuestionId] = useState(null);
  const [turns, setTurns] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [followupsAsked, setFollowupsAsked] = useState(0);
  const [result, setResult] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState(null);
  const [autoSpeak, setAutoSpeak] = useState(true);

  useEffect(() => {
    let alive = true;
    getVerifiedQuestions()
      .then((data) => alive && setCatalog(data))
      .catch((err) => alive && setLoadError(err.message));
    getVerifiedProgress(USER_ID)
      .then((data) => alive && setProgress(data))
      .catch(() => alive && setProgress(null));
    return () => {
      alive = false;
    };
  }, []);

  const list = useMemo(() => (catalog ? catalog[kind === 'dsa' ? 'dsa' : 'behavioral'] : []), [catalog, kind]);
  const current =
    list.find((q) => q.id === questionId) ??
    (kind === 'dsa' && topicParam ? list.find((q) => q.topic === topicParam) : null) ??
    list[0] ??
    null;
  const topicInfo = kind === 'dsa' && current ? progress?.topics?.[current.topic] ?? null : null;
  const threshold = progress?.threshold ?? catalog?.unlock_threshold ?? 0.7;
  const grouped = useMemo(() => {
    const groups = new Map();
    list.forEach((q) => groups.set(q.topic, [...(groups.get(q.topic) ?? []), q]));
    return [...groups.entries()];
  }, [list]);

  const isFinal = Boolean(result?.is_final);

  const reset = (nextKind, nextId) => {
    speech.stop();
    speech.clear();
    cancel();
    setKind(nextKind);
    setQuestionId(nextId);
    setTurns([]);
    setAnswers([]);
    setFollowupsAsked(0);
    setResult(null);
    setError(null);
  };

  // DSA: stay within the current topic (that's what unlocks it); STAR: go through all.
  const nextQuestion = () => {
    const pool = kind === 'dsa' && current ? list.filter((q) => q.topic === current.topic) : list;
    const i = pool.findIndex((q) => q.id === current?.id);
    const next = pool[(i + 1) % pool.length];
    reset(kind, next?.id ?? null);
  };

  const submit = async () => {
    const text = speech.transcript.trim();
    if (!text || !current || isChecking) return;
    speech.stop();
    const nextAnswers = [...answers, text];
    setIsChecking(true);
    setError(null);
    try {
      const data = await assessVerified({
        kind,
        questionId: current.id,
        transcript: nextAnswers.join('\n'),
        followupsAsked,
        userId: USER_ID,
      });
      const isFollowup = data.next?.type === 'followup';
      setAnswers(nextAnswers);
      setTurns((t) => [
        ...t,
        { role: 'you', text },
        { role: isFollowup ? 'interviewer' : 'feedback', text: data.next?.prompt },
      ]);
      if (isFollowup) setFollowupsAsked((n) => n + 1);
      setResult(data);
      if (data.unlock) {
        setProgress((p) => ({
          threshold: data.unlock.threshold,
          topics: {
            ...(p?.topics ?? {}),
            [data.unlock.topic]: {
              ...(p?.topics?.[data.unlock.topic] ?? { attempts: 0 }),
              best_score: data.unlock.best_score,
              unlocked: data.unlock.unlocked,
            },
          },
        }));
      }
      speech.clear();
      if (autoSpeak && data.next?.prompt) speak(data.next.prompt);
    } catch (err) {
      setError(err.message || 'Could not check the answer.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8 max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-soft">
          <ShieldCheck size={14} className="text-cyan" aria-hidden="true" />
          Warm-up before coding · rubric-graded
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Verified <span className="text-gradient">warm-up</span>
        </h1>
        <p className="mt-3 text-base leading-relaxed text-soft">
          Explain your approach out loud first. Every point in your grade is backed by a quote from your own answer,
          the verdict comes from fixed rubric rules, and a good score unlocks that topic’s coding interview.
        </p>
      </header>

      {loadError && (
        <p role="alert" className="mb-6 flex items-start gap-2 rounded-xl border border-bad/40 bg-bad/10 p-4 text-sm text-rose-100">
          <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          {loadError}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* ---------------------------------------------------------- question + answer */}
        <section aria-label="Question and answer" className="glass space-y-6 p-5 sm:p-7">
          <div role="radiogroup" aria-label="Question type" className="grid gap-3 sm:grid-cols-2">
            {MODES.map((m) => {
              const active = kind === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => !active && reset(m.id, null)}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition cursor-pointer ${
                    active
                      ? 'border-electric/70 bg-electric/10 shadow-[0_0_0_1px_rgb(96_165_250_/_0.35)]'
                      : 'border-line bg-white/[0.02] hover:border-electric/40'
                  }`}
                >
                  <m.icon size={18} className="mt-0.5 shrink-0 text-cyan" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold text-white">{m.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-soft">{m.text}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div>
            <label htmlFor="verified-question" className="mb-2 block text-sm font-semibold text-white">
              Question
            </label>
            <select
              id="verified-question"
              value={current?.id ?? ''}
              onChange={(e) => reset(kind, e.target.value)}
              disabled={!catalog}
              className="w-full cursor-pointer rounded-xl border border-line bg-deep px-4 py-3 text-sm text-ink focus:border-electric/60"
            >
              {grouped.map(([topic, qs]) => (
                <optgroup key={topic} label={topic}>
                  {qs.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <TopicStatus topic={current?.topic} info={topicInfo} threshold={threshold} />

          {current ? (
            <div className="rounded-2xl border border-line bg-white/[0.03] p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-base leading-relaxed text-ink">{current.question}</p>
                <button
                  type="button"
                  onClick={() => speak(current.question)}
                  className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-soft hover:bg-white/5 hover:text-white"
                  aria-label="Read the question aloud"
                >
                  <Volume2 size={18} aria-hidden="true" />
                </button>
              </div>
              <p className="mt-3 text-xs text-mute">Topic: {current.topic}</p>
            </div>
          ) : (
            !loadError && <div className="skeleton h-28 w-full" aria-busy="true" />
          )}

          {turns.length > 0 && (
            <ol aria-label="Conversation" className="space-y-3">
              {turns.map((t, i) => (
                <li
                  key={i}
                  className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    t.role === 'you'
                      ? 'ml-8 border border-electric/30 bg-electric/10 text-ink'
                      : t.role === 'feedback'
                        ? 'mr-8 border border-good/30 bg-good/10 text-ink'
                        : 'mr-8 border border-line bg-white/[0.04] text-ink'
                  }`}
                >
                  <span className="mb-1 block text-xs font-semibold text-mute">
                    {t.role === 'you' ? 'You' : t.role === 'feedback' ? 'Feedback' : 'Follow-up'}
                  </span>
                  {t.text}
                </li>
              ))}
            </ol>
          )}

          {!isFinal ? (
            <div className="space-y-3">
              <label htmlFor="verified-answer" className="block text-sm font-semibold text-white">
                {answers.length ? 'Your answer to the follow-up' : 'Your answer'}
              </label>
              <textarea
                id="verified-answer"
                rows={6}
                value={speech.transcript}
                onChange={(e) => speech.setTranscript(e.target.value)}
                placeholder="Press the mic and explain your answer, or type it here."
                className="w-full resize-y rounded-xl border border-line bg-deep/70 px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-mute focus:border-electric/60"
              />
              {speech.error && <p className="text-xs text-warn">{speech.error}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <Button variant={speech.isRecording ? 'danger' : 'glass'} onClick={speech.toggle} disabled={isChecking}>
                  {speech.isRecording ? <MicOff size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
                  {speech.isRecording ? 'Stop' : 'Speak'}
                </Button>
                <Button onClick={submit} disabled={!speech.transcript.trim() || !current || isChecking}>
                  {isChecking ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldCheck size={16} aria-hidden="true" />
                  )}
                  {isChecking ? 'Checking…' : 'Check answer'}
                </Button>
                <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-soft">
                  <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} />
                  Read replies aloud
                </label>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button onClick={nextQuestion}>
                Next question
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
              <Button variant="glass" onClick={() => reset(kind, current?.id ?? null)}>
                <RotateCcw size={16} aria-hidden="true" />
                Try again
              </Button>
            </div>
          )}

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-rose-100">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </section>

        {/* ---------------------------------------------------------- result */}
        <section aria-label="Verified result" aria-live="polite" className="glass glow-border p-5 sm:p-7">
          {isChecking && !result ? (
            <div className="space-y-4" aria-busy="true">
              <div className="skeleton h-24 w-full" />
              <div className="skeleton h-20 w-full" />
              <div className="skeleton h-20 w-full" />
            </div>
          ) : result ? (
            <motion.div
              key={`${result.question_id}-${answers.length}`}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className={isChecking ? 'opacity-60' : ''}
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold text-white">
                  {isFinal ? 'Final result' : 'Result so far'}
                </h2>
                {!isFinal && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-mute">
                    <CircleDashed size={14} aria-hidden="true" />
                    Follow-up {followupsAsked} of {catalog?.max_followups ?? 2}
                  </span>
                )}
              </div>
              {result.unlock?.just_unlocked && (
                <div className="mb-5 rounded-2xl border border-good/40 bg-good/10 p-5">
                  <p className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                    <CheckCircle2 size={20} className="text-good" aria-hidden="true" />
                    Coding unlocked for {result.unlock.topic}
                  </p>
                  <p className="mt-1 text-sm text-soft">You explained it well. Now try solving one in code.</p>
                  <Button to={`/setup?topic=${encodeURIComponent(result.unlock.topic)}`} className="mt-4">
                    Start coding interview
                    <ArrowRight size={16} aria-hidden="true" />
                  </Button>
                </div>
              )}
              {result.is_final && result.unlock && !result.unlock.unlocked && (
                <p className="mb-5 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-ink">
                  {pctOf(result.score_01)}% this time. You need {pctOf(result.unlock.threshold)}% to unlock coding for{' '}
                  {result.unlock.topic}. Try the next question in this topic.
                </p>
              )}
              {result.kind === 'dsa' ? <DsaResult result={result} /> : <StarResult result={result} />}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-mute">
                <span>
                  Extraction {Math.round(result.timings_ms.llm_ms).toLocaleString()} ms · rules{' '}
                  {result.timings_ms.rules_ms} ms · {result.llm?.model}
                </span>
                {isFinal && <span>{result.saved ? 'Saved to your warm-up progress' : 'Not saved (database unavailable)'}</span>}
              </div>
            </motion.div>
          ) : (
            <HowItWorks />
          )}
        </section>
      </div>
    </div>
  );
}
