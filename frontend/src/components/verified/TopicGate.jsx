import { CheckCircle2, Loader2, Lock, ShieldCheck } from 'lucide-react';
import Button from '../ui/Button';

const pct = (v) => (typeof v === 'number' ? Math.round(v * 100) : null);

// Shown on the Setup page for DSA topics: coding unlocks after the warm-up.
export default function TopicGate({ topic, gate }) {
  if (gate.loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-mute">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        Checking your warm-up for {topic}…
      </p>
    );
  }
  if (gate.error) {
    // Fail open: the coding interview stays available.
    return <p className="text-xs text-mute">Couldn’t check the warm-up status, so coding is open.</p>;
  }

  const info = gate.info(topic);
  if (!info) return null; // no warm-up questions for this topic

  const threshold = pct(gate.threshold);
  const best = pct(info.best_score);
  const warmupLink = `/verified?topic=${encodeURIComponent(topic)}`;

  if (info.unlocked) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-good/30 bg-good/10 px-4 py-3 text-sm text-ink">
        <span className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-good" aria-hidden="true" />
          Warm-up passed for {topic} (best {best}%). Coding is unlocked.
        </span>
        <Button to={warmupLink} variant="ghost" size="sm">
          Practice again
        </Button>
      </div>
    );
  }

  return (
    <div role="status" className="flex flex-col gap-4 rounded-2xl border border-warn/30 bg-warn/10 p-5 sm:flex-row sm:items-center">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-warn/15 text-warn">
        <Lock size={20} aria-hidden="true" />
      </span>
      <div className="flex-1">
        <p className="font-semibold text-white">Warm up before coding {topic}</p>
        <p className="mt-1 text-sm leading-relaxed text-soft">
          Explain a problem from {topic} out loud and score {threshold}% or more to unlock the coding interview.
          {best !== null ? ` Your best so far: ${best}% (${info.attempts} attempt${info.attempts === 1 ? '' : 's'}).` : ''}
        </p>
      </div>
      <Button to={warmupLink}>
        <ShieldCheck size={16} aria-hidden="true" />
        Start warm-up
      </Button>
    </div>
  );
}
