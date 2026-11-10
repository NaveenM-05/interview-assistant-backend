import {
  ArrowRight,
  AudioLines,
  BarChart3,
  Braces,
  CheckCircle2,
  GitCompareArrows,
  GraduationCap,
  ListChecks,
  MessageSquareQuote,
  Mic,
  Repeat,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import Button from '../components/ui/Button';
import Reveal from '../components/ui/Reveal';

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function HeroVideo() {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  // Smaller file on phones; poster only when the user prefers reduced motion.
  const [src] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
      ? '/media/hero-720.mp4'
      : '/media/hero.mp4',
  );

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (reduce) v.pause();
    else v.play().catch(() => {});
  }, [reduce]);

  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
      <video
        ref={ref}
        className="h-full w-full scale-105 object-cover object-[70%_30%] opacity-70 saturate-[0.7]"
        src={src}
        poster="/media/hero-poster.jpg"
        autoPlay={!reduce}
        muted
        loop
        playsInline
        preload="metadata"
      />
      {/* Navy wash so the warm footage sits in the palette */}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgb(37_99_235_/_0.35),rgb(124_58_237_/_0.3))] mix-blend-color" />
      <div className="absolute inset-0 bg-gradient-to-r from-void via-void/85 to-void/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-void via-void/30 to-void/60" />
    </div>
  );
}

function LiveSessionCard() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass glow-border w-full max-w-md p-5 animate-float"
      aria-label="Example of a live interview exchange"
      role="figure"
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-soft">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-rose-500" />
            <span className="relative h-2 w-2 rounded-full bg-rose-500" />
          </span>
          Live session
        </span>
        <span className="font-mono text-xs text-mute">Two Pointers, Medium</span>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex gap-3">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-electric/20 text-cyan">
            <Sparkles size={16} />
          </span>
          <p className="rounded-xl rounded-tl-sm bg-white/[0.05] px-3.5 py-2.5 text-soft">
            What happens to your time complexity if the array is already sorted?
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <p className="rounded-xl rounded-tr-sm bg-electric-gradient px-3.5 py-2.5 text-white">
            Then I can walk two pointers inward, so it’s O(n) time and O(1) space
            <span className="ml-1 inline-block h-3.5 w-0.5 translate-y-0.5 animate-pulse bg-white/80" />
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4 font-mono text-[11px]">
        <span className="rounded-md bg-cyan/10 px-2 py-1 text-cyan">Paradigm: Two Pointers</span>
        <span className="rounded-md bg-violet/15 px-2 py-1 text-orchid">Time: O(n)</span>
        <span className="rounded-md bg-violet/15 px-2 py-1 text-orchid">Space: O(1)</span>
      </div>
    </motion.div>
  );
}

function Hero() {
  const reduce = useReducedMotion();
  const fade = (delay) => ({
    initial: reduce ? false : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] },
  });

  return (
    <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-24 pb-16">
      <HeroVideo />
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="max-w-2xl">
          <motion.p {...fade(0)} className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-3.5 py-1.5 text-xs font-semibold text-cyan backdrop-blur">
              <AudioLines size={14} aria-hidden="true" />
              Voice-first AI interviewer
            </span>
          </motion.p>
          <motion.h1
            {...fade(0.1)}
            className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            Practice the interview <span className="text-gradient">before it counts.</span>
          </motion.h1>
          <motion.p {...fade(0.2)} className="mt-6 max-w-xl text-lg leading-relaxed text-soft">
            Talk through DSA problems and behavioral stories with an AI interviewer that listens in real time, reads
            your code as you write it, and tells you exactly what to fix.
          </motion.p>
          <motion.div {...fade(0.3)} className="mt-9 flex flex-wrap gap-3">
            <Button to="/setup" size="lg">
              Start an interview
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
            <Button to="/dashboard" variant="glass" size="lg">
              View your dashboard
            </Button>
          </motion.div>
        </div>

        <div className="hidden justify-end lg:flex">
          <LiveSessionCard />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Interview modes                                                     */
/* ------------------------------------------------------------------ */

function Feature({ icon: Icon, children }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-lg bg-electric/15 text-cyan">
        <Icon size={15} aria-hidden="true" />
      </span>
      <span className="text-soft">{children}</span>
    </li>
  );
}

function ModeRow({ image, alt, title, intro, features, chips, reverse }) {
  return (
    <div className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
      <Reveal>
        <div className="glass glow-border overflow-hidden p-2">
          <div className="photo-tint aspect-[4/3] rounded-[1rem]">
            <img src={image} alt={alt} loading="lazy" className="h-full w-full object-cover" />
          </div>
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        <h3 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h3>
        <p className="mt-4 text-lg leading-relaxed text-soft">{intro}</p>
        <ul className="mt-7 space-y-4">
          {features.map((f) => (
            <Feature key={f.text} icon={f.icon}>
              {f.text}
            </Feature>
          ))}
        </ul>
        <div className="mt-7 flex flex-wrap gap-2">
          {chips.map((c) => (
            <span key={c} className="rounded-full border border-line bg-white/[0.03] px-3 py-1 text-xs text-mute">
              {c}
            </span>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

function Modes() {
  return (
    <section id="modes" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Two interview modes, <span className="text-gradient">one live interviewer</span>
          </h2>
          <p className="mt-5 text-lg text-soft">
            Every question is generated for the topic you pick, and the conversation adapts to how you answer.
          </p>
        </Reveal>

        <div className="space-y-24 sm:space-y-32">
          <ModeRow
            image="/media/dsa-coding.jpg"
            alt="Over-the-shoulder view of a developer writing code on a laptop"
            title="DSA and live code studio"
            intro="Solve a generated problem in a full Python editor while you explain your approach out loud, the way a real technical screen works."
            features={[
              { icon: Braces, text: 'Questions generated for your topic and difficulty, from Easy to Hard.' },
              { icon: Mic, text: 'Narrate while you code; your explanation is transcribed as you speak.' },
              { icon: Repeat, text: 'Follow-up questions when your reasoning or complexity drifts.' },
              { icon: GitCompareArrows, text: 'See your code side by side with the optimal solution after the evaluation.' },
            ]}
            chips={['Arrays', 'Graphs', 'Dynamic Programming', 'Sliding Window', 'Binary Search', 'Heaps']}
          />
          <ModeRow
            reverse
            image="/media/behavioral-headset.jpg"
            alt="A candidate wearing a headset typing on a laptop in a meeting room"
            title="Behavioral, scored on STAR"
            intro="Tell your story out loud. The interviewer checks it against the STAR method and asks about the part you skipped."
            features={[
              { icon: AudioLines, text: 'Answer by voice with a live transcript you can edit before sending.' },
              { icon: ListChecks, text: 'Each answer is checked for Situation, Task, Action and Result.' },
              { icon: MessageSquareQuote, text: 'Spoken follow-ups from the interviewer, read aloud in a natural voice.' },
              { icon: CheckCircle2, text: 'A model STAR answer to compare against when you finish.' },
            ]}
            chips={['Leadership', 'Conflict Resolution', 'Time Management', 'Adaptability', 'Handling Failure']}
          />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How a session works                                                 */
/* ------------------------------------------------------------------ */

const STEPS = [
  { icon: Target, title: 'Pick a topic', text: 'Choose DSA or behavioral, a topic, and a difficulty. A fresh question is generated.' },
  { icon: Mic, title: 'Answer out loud', text: 'Speak your answer and, for DSA, write the code. Send it whenever you’re ready.' },
  { icon: Repeat, title: 'Handle follow-ups', text: 'The interviewer pushes back in real time, just like a live interviewer would.' },
  { icon: BarChart3, title: 'Get evaluated', text: 'Finalize for a score, written feedback and the optimal answer, saved to your dashboard.' },
];

function HowItWorks() {
  return (
    <section className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="mb-14 max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            How a session works
          </h2>
          <p className="mt-4 text-lg text-soft">About ten minutes from first question to final score.</p>
        </Reveal>

        <ol className="relative grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div
            aria-hidden="true"
            className="absolute top-9 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-cyan/0 via-electric/50 to-violet/0 lg:block"
          />
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 0.08} className="glass glass-hover relative p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-electric-gradient text-white shadow-[0_0_30px_-6px_rgb(96_165_250_/_0.8)]">
                  <s.icon size={20} aria-hidden="true" />
                </span>
                <span className="font-mono text-sm text-mute">Step {i + 1}</span>
              </div>
              <h3 className="font-display text-lg font-semibold text-white">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-soft">{s.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Who it's for                                                        */
/* ------------------------------------------------------------------ */

const AUDIENCE = [
  { icon: GraduationCap, title: 'Students and interns', text: 'Get comfortable thinking out loud before your first technical screen.' },
  { icon: Sparkles, title: 'New graduates', text: 'Turn class projects and team work into clear STAR stories.' },
  { icon: Users, title: 'Career switchers', text: 'Drill the DSA patterns interviewers expect, one topic at a time.' },
];

function Audience() {
  return (
    <section className="relative py-24 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <Reveal>
          <div className="photo-tint aspect-[4/3] overflow-hidden rounded-[1.5rem] border border-line">
            <img
              src="/media/students-cafe.jpg"
              alt="A student studying on a laptop at a café table with textbooks"
              loading="lazy"
              className="h-full w-full object-cover object-[60%_center]"
            />
          </div>
        </Reveal>
        <div>
          <Reveal>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Built for your first technical interviews
            </h2>
            <p className="mt-4 text-lg text-soft">
              Practise from anywhere, as often as you like, without booking a mock interview with anyone.
            </p>
          </Reveal>
          <ul className="mt-9 space-y-4">
            {AUDIENCE.map((a, i) => (
              <Reveal as="li" key={a.title} delay={0.05 + i * 0.08} className="glass glass-hover flex gap-4 p-5">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-violet/15 text-orchid">
                  <a.icon size={20} aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-display font-semibold text-white">{a.title}</span>
                  <span className="mt-1 block text-soft">{a.text}</span>
                </span>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Closing CTA                                                         */
/* ------------------------------------------------------------------ */

function ClosingCta() {
  return (
    <section className="px-4 pt-8 pb-28 sm:px-6">
      <Reveal className="glass glow-border relative mx-auto max-w-5xl overflow-hidden px-6 py-16 text-center sm:px-16">
        <div
          aria-hidden="true"
          className="absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-electric/30 blur-[100px]"
        />
        <h2 className="relative font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          Your next interview starts with a practice run.
        </h2>
        <p className="relative mx-auto mt-5 max-w-xl text-lg text-soft">
          Pick a topic and get your first question in seconds.
        </p>
        <div className="relative mt-9 flex flex-wrap justify-center gap-3">
          <Button to="/setup" size="lg">
            Start an interview
            <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </div>
      </Reveal>
    </section>
  );
}

export default function Landing() {
  return (
    <>
      <Hero />
      <Modes />
      <HowItWorks />
      <Audience />
      <ClosingCta />
    </>
  );
}
