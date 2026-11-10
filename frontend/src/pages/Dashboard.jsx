import { AlertCircle, ArrowRight, Gauge, Lightbulb, RefreshCw, Target, TrendingDown } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import ScoreRing from '../components/ui/ScoreRing';
import { USER_ID } from '../config';
import { getRecommendations } from '../lib/api';

function StatCard({ icon: Icon, label, value, hint, tone = 'text-cyan' }) {
  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 text-sm text-soft">
        <Icon size={16} className={tone} aria-hidden="true" />
        {label}
      </div>
      <p
        className={`mt-3 font-display font-semibold text-white ${
          typeof value === 'string' && !/^\d/.test(value) ? 'text-xl leading-snug sm:text-2xl' : 'text-3xl'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 truncate text-xs text-mute">{hint}</p>}
    </div>
  );
}

function SkillCard({ rec, index }) {
  const reduce = useReducedMotion();
  const level = rec.accuracy >= 80 ? 'Strong' : rec.accuracy >= 50 ? 'Developing' : 'Needs work';
  const levelTone =
    rec.accuracy >= 80 ? 'bg-good/15 text-good' : rec.accuracy >= 50 ? 'bg-warn/15 text-warn' : 'bg-bad/15 text-bad';

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.06, 0.4), ease: [0.22, 1, 0.36, 1] }}
      className="glass glass-hover flex flex-col p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold text-white">{rec.skill}</h3>
          <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${levelTone}`}>
            {level}
          </span>
        </div>
        <ScoreRing value={rec.accuracy} size={76} stroke={7} label={`${rec.skill} accuracy`} />
      </div>

      <dl className="mt-5 space-y-2.5 rounded-xl border border-line bg-void/40 p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-mute">Weak area</dt>
          <dd className="text-right font-semibold text-ink">{rec.weak_area}</dd>
        </div>
        {rec.priority !== undefined && (
          <div className="flex justify-between gap-4">
            <dt className="text-mute">Priority score</dt>
            <dd className="font-mono font-semibold text-orchid">{rec.priority}</dd>
          </div>
        )}
      </dl>

      <div className="mt-5 flex flex-1 flex-col border-t border-line pt-4">
        <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-cyan">
          <Lightbulb size={15} aria-hidden="true" />
          Suggested action
        </h4>
        <p className="text-sm leading-relaxed text-soft">{rec.action}</p>
      </div>
    </motion.article>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="glass space-y-4 p-6">
          <div className="flex justify-between">
            <div className="skeleton h-6 w-32" />
            <div className="skeleton h-16 w-16 !rounded-full" />
          </div>
          <div className="skeleton h-20 w-full" />
          <div className="skeleton h-12 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecommendations(await getRecommendations(USER_ID));
    } catch (err) {
      setError(err.message || 'Failed to load recommendations.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch (state starts as loading, so no synchronous setState here).
  useEffect(() => {
    let alive = true;
    getRecommendations(USER_ID)
      .then((recs) => alive && setRecommendations(recs))
      .catch((err) => alive && setError(err.message || 'Failed to load recommendations.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    if (!recommendations.length) return null;
    const avg = Math.round(recommendations.reduce((s, r) => s + (Number(r.accuracy) || 0), 0) / recommendations.length);
    const weakest = [...recommendations].sort((a, b) => a.accuracy - b.accuracy)[0];
    const topPriority = [...recommendations].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
    return { avg, weakest, topPriority };
  }, [recommendations]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14">
      <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Feedback <span className="text-gradient">dashboard</span>
          </h1>
          <p className="mt-3 text-lg text-soft">
            Accuracy and weak areas across your sessions, with what to practise next.
          </p>
          <p className="mt-1 text-sm text-mute">
            Showing results for <span className="font-mono text-cyan">{USER_ID}</span>
          </p>
        </div>
        <Button variant="glass" onClick={load} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </Button>
      </header>

      {loading ? (
        <div role="status" aria-label="Loading recommendations">
          <LoadingGrid />
        </div>
      ) : error ? (
        <div role="alert" className="glass mx-auto max-w-xl p-8 text-center">
          <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-bad/15 text-bad">
            <AlertCircle size={22} aria-hidden="true" />
          </span>
          <h2 className="font-display text-xl font-semibold text-white">Couldn’t load your recommendations</h2>
          <p className="mt-2 text-sm text-soft">{error}</p>
          <Button className="mt-6" onClick={load}>
            Try again
          </Button>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="glass glow-border mx-auto max-w-xl p-10 text-center">
          <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-electric/15 text-cyan">
            <Target size={26} aria-hidden="true" />
          </span>
          <h2 className="font-display text-2xl font-semibold text-white">No results yet</h2>
          <p className="mx-auto mt-3 max-w-sm text-soft">
            Finish and evaluate a mock interview, and your accuracy and recommendations will appear here.
          </p>
          <Button to="/setup" size="lg" className="mt-7">
            Start a mock interview
            <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {stats && (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={Gauge} label="Average accuracy" value={`${stats.avg}%`} hint={`Across ${recommendations.length} skills`} />
              <StatCard
                icon={TrendingDown}
                label="Weakest skill"
                value={stats.weakest.skill}
                hint={`${stats.weakest.accuracy}% accuracy`}
                tone="text-bad"
              />
              <StatCard
                icon={Target}
                label="Practise next"
                value={stats.topPriority.skill}
                hint={stats.topPriority.weak_area}
                tone="text-orchid"
              />
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((rec, i) => (
              <SkillCard key={rec.skill || i} rec={rec} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
