import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useId } from 'react';

// Circular percentage gauge (0–100) with a blue→violet stroke and a count-up.
export default function ScoreRing({ value, size = 120, stroke = 10, label }) {
  const id = useId();
  const reduce = useReducedMotion();
  const pct = typeof value === 'number' ? Math.max(0, Math.min(100, value)) : null;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${Math.round(v)}`);
  const dash = useTransform(mv, (v) => c - (v / 100) * c);

  useEffect(() => {
    if (pct === null) return undefined;
    if (reduce) {
      mv.set(pct);
      return undefined;
    }
    const controls = animate(mv, pct, { duration: 1.2, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [pct, reduce, mv]);

  const tone = pct === null ? 'text-mute' : pct >= 80 ? 'text-good' : pct >= 50 ? 'text-warn' : 'text-bad';

  return (
    <div
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={pct === null ? `${label ?? 'Score'}: not available` : `${label ?? 'Score'}: ${pct}%`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="55%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(148 163 214 / 0.14)" strokeWidth={stroke} />
        {pct !== null && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${id})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            style={{ strokeDashoffset: dash, filter: 'drop-shadow(0 0 6px rgb(96 165 250 / 0.6))' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center" aria-hidden="true">
        {pct === null ? (
          <span className="font-mono text-sm text-mute">N/A</span>
        ) : (
          <span className={`font-mono font-semibold leading-none ${tone}`} style={{ fontSize: size * 0.26 }}>
            <motion.span>{text}</motion.span>
            <span className="text-[0.55em] opacity-70">%</span>
          </span>
        )}
      </div>
    </div>
  );
}
