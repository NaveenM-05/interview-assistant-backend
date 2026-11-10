import { BookOpenCheck, CheckCircle2, LayoutDashboard, MessageSquareQuote, XCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { STAR_PARTS, toPercent } from '../../lib/topics';
import Button from '../ui/Button';
import ScoreRing from '../ui/ScoreRing';

export default function EvaluationPanel({ evaluation, isBehavioral, topic }) {
  const reduce = useReducedMotion();
  const { score, teacherFeedback, optimalSolutionText, validation, rubric } = evaluation;

  return (
    <motion.section
      aria-labelledby="evaluation-heading"
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="glass glow-border p-6 sm:p-8"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <ScoreRing value={toPercent(score)} size={128} label="Final score" />
        <div className="flex-1">
          <h2 id="evaluation-heading" className="font-display text-2xl font-semibold text-white">
            Evaluation results
          </h2>
          <p className="mt-1 text-sm text-soft">
            Saved to your feedback dashboard under <span className="font-semibold text-white">{topic}</span>.
          </p>
          {isBehavioral && validation && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="STAR checklist">
              {STAR_PARTS.map(({ key, label }) => {
                const ok = Boolean(validation[key]);
                return (
                  <li
                    key={key}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                      ok ? 'bg-good/15 text-good' : 'bg-bad/15 text-bad'
                    }`}
                  >
                    {ok ? <CheckCircle2 size={14} aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
                    {label} {ok ? 'covered' : 'missing'}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Button to="/dashboard" variant="glass" className="self-start sm:self-center">
          <LayoutDashboard size={16} aria-hidden="true" />
          Open dashboard
        </Button>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {teacherFeedback && (
          <div className="rounded-2xl border border-line bg-white/[0.03] p-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan">
              <MessageSquareQuote size={16} aria-hidden="true" />
              Teacher feedback
            </h3>
            <p className="text-sm leading-relaxed text-ink">{teacherFeedback}</p>
          </div>
        )}

        {optimalSolutionText && (
          <div className={`rounded-2xl border border-line bg-white/[0.03] p-5 ${teacherFeedback ? '' : 'lg:col-span-2'}`}>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-orchid">
              <BookOpenCheck size={16} aria-hidden="true" />
              {isBehavioral ? 'Model STAR answer' : 'Optimal solution and complexity'}
            </h3>
            {!isBehavioral && rubric && (
              <div className="mb-3 flex flex-wrap gap-1.5 border-b border-line pb-3">
                {[
                  ['Paradigm', rubric.algorithmic_paradigm],
                  ['Time', rubric.time_complexity],
                  ['Space', rubric.space_complexity],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <span key={k} className="rounded-md bg-violet/15 px-2 py-0.5 font-mono text-[11px] text-orchid">
                      {k}: <span className="text-white">{v}</span>
                    </span>
                  ))}
              </div>
            )}
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{optimalSolutionText}</p>
          </div>
        )}
      </div>
    </motion.section>
  );
}
