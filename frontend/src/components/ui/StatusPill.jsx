// Small rounded status chip with a coloured dot (optionally pulsing).
const tones = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  live: 'bg-rose-500',
  info: 'bg-cyan',
};

export default function StatusPill({ tone = 'info', pulse = false, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-soft backdrop-blur ${className}`}
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        {pulse && <span className={`absolute inset-0 rounded-full ${tones[tone]} animate-pulse-ring`} />}
        <span className={`relative h-2 w-2 rounded-full ${tones[tone]}`} />
      </span>
      {children}
    </span>
  );
}
