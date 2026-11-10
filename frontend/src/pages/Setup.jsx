import { AlertCircle, ArrowRight, Braces, Loader2, MessagesSquare } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useSession } from '../context/session';
import { generateQuestion } from '../lib/api';
import { BEHAVIORAL_TOPICS, DIFFICULTIES, DSA_TOPICS, starterCode } from '../lib/topics';

const MODES = [
  {
    id: 'DSA',
    icon: Braces,
    title: 'DSA and coding',
    text: 'Solve a problem in Python while explaining your approach and complexity.',
    tone: 'from-cyan/25 to-electric/10 text-cyan',
  },
  {
    id: 'BEHAVIORAL',
    icon: MessagesSquare,
    title: 'Behavioral (STAR)',
    text: 'Tell a story about your experience; it’s checked for Situation, Task, Action and Result.',
    tone: 'from-violet/30 to-orchid/10 text-orchid',
  },
];

function SectionLabel({ children, id }) {
  return (
    <h2 id={id} className="mb-3 font-display text-sm font-semibold text-white">
      {children}
    </h2>
  );
}

export default function Setup() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { session, startSession } = useSession();

  const [interviewType, setInterviewType] = useState(session?.interviewType ?? 'DSA');
  const [topic, setTopic] = useState(session?.topic ?? DSA_TOPICS[0]);
  const [difficulty, setDifficulty] = useState(session?.difficulty ?? 'Medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const isBehavioral = interviewType === 'BEHAVIORAL';
  const topics = isBehavioral ? BEHAVIORAL_TOPICS : DSA_TOPICS;

  const chooseType = (type) => {
    setInterviewType(type);
    setTopic(type === 'BEHAVIORAL' ? BEHAVIORAL_TOPICS[0] : DSA_TOPICS[0]);
  };

  const generate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const data = await generateQuestion({ interviewType, topic, difficulty });
      startSession({
        interviewType,
        topic,
        difficulty,
        question: data.generated_question,
        sessionId: data.session_id,
        code: starterCode(topic, difficulty),
      });
      navigate('/interview');
    } catch (err) {
      console.error('Failed to generate interview question:', err);
      setError(err.message || 'Couldn’t generate a question.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-10 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          Set up your <span className="text-gradient">interview</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-soft">
          Choose a mode and topic. We’ll generate a fresh question and connect you to the live interviewer.
        </p>
      </header>

      <div className="glass glow-border space-y-9 p-6 sm:p-9">
        <section aria-labelledby="mode-label">
          <SectionLabel id="mode-label">Interview type</SectionLabel>
          <div role="radiogroup" aria-labelledby="mode-label" className="grid gap-4 sm:grid-cols-2">
            {MODES.map((m) => {
              const active = interviewType === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => chooseType(m.id)}
                  className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition duration-300 cursor-pointer ${
                    active
                      ? 'border-electric/70 bg-electric/10 shadow-[0_0_0_1px_rgb(96_165_250_/_0.35),0_20px_50px_-25px_rgb(59_130_246_/_0.9)]'
                      : 'border-line bg-white/[0.02] hover:border-electric/40 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className={`mb-4 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${m.tone}`}>
                    <m.icon size={20} aria-hidden="true" />
                  </span>
                  <span className="block font-display text-lg font-semibold text-white">{m.title}</span>
                  <span className="mt-1.5 block text-sm leading-relaxed text-soft">{m.text}</span>
                  {active && (
                    <motion.span
                      layoutId={reduce ? undefined : 'mode-dot'}
                      className="absolute top-5 right-5 h-2.5 w-2.5 rounded-full bg-cyan shadow-[0_0_12px_rgb(56_189_248)]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="topic-label">
          <SectionLabel id="topic-label">{isBehavioral ? 'Soft-skill topic' : 'DSA topic'}</SectionLabel>
          <div role="radiogroup" aria-labelledby="topic-label" className="flex flex-wrap gap-2.5">
            {topics.map((t) => {
              const active = topic === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTopic(t)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition cursor-pointer ${
                    active
                      ? 'border-transparent bg-electric-gradient text-white shadow-[0_6px_24px_-8px_rgb(59_130_246_/_0.9)]'
                      : 'border-line bg-white/[0.03] text-soft hover:border-electric/40 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </section>

        {!isBehavioral && (
          <section aria-labelledby="difficulty-label">
            <SectionLabel id="difficulty-label">Difficulty</SectionLabel>
            <div
              role="radiogroup"
              aria-labelledby="difficulty-label"
              className="inline-flex rounded-xl border border-line bg-void/40 p-1"
            >
              {DIFFICULTIES.map((d) => {
                const active = difficulty === d;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDifficulty(d)}
                    className={`relative rounded-lg px-5 py-2 text-sm font-semibold transition cursor-pointer ${
                      active ? 'text-white' : 'text-mute hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId={reduce ? undefined : 'difficulty-pill'}
                        className="absolute inset-0 rounded-lg bg-white/10 shadow-[inset_0_0_0_1px_rgb(96_165_250_/_0.4)]"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.45 }}
                      />
                    )}
                    <span className="relative">{d}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {error && (
          <div
            role="alert"
            className="flex gap-3 rounded-xl border border-bad/30 bg-bad/10 p-4 text-sm text-rose-100"
          >
            <AlertCircle size={18} className="mt-0.5 flex-none text-bad" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col-reverse items-stretch justify-between gap-4 border-t border-line pt-7 sm:flex-row sm:items-center">
          <p className="text-sm text-mute">
            <span className="text-soft">{isBehavioral ? 'Behavioral' : 'DSA'}</span>, {topic}
            {!isBehavioral && `, ${difficulty}`}
          </p>
          <Button size="lg" onClick={generate} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                Generating your question…
              </>
            ) : (
              <>
                Generate interview
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
