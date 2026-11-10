// Wordmark: a glowing waveform glyph + product name.
export default function Logo({ compact = false }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-electric-gradient shadow-[0_0_24px_-4px_rgb(96_165_250_/_0.8)]">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
          <path
            d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2M21 12h0"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-[15px] font-semibold leading-tight tracking-tight text-white">
          Interview<span className="text-gradient">AI</span>
        </span>
      )}
    </span>
  );
}
