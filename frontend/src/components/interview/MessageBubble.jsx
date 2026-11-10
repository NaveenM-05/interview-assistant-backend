import { AlertTriangle, GraduationCap, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { STAR_PARTS, toPercent } from '../../lib/topics';

export const markdownComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-soft">{children}</em>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code className={`${className || ''} font-mono text-xs text-soft`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-md border border-white/10 bg-white/[0.08] px-1.5 py-0.5 font-mono text-xs text-cyan"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-xl border border-line bg-void/80 p-3 font-mono text-xs text-soft">
      {children}
    </pre>
  ),
};

function StarChips({ validation }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="STAR coverage">
      {STAR_PARTS.map(({ key, label }) => {
        const ok = Boolean(validation[key]);
        return (
          <span
            key={key}
            title={`${label}: ${ok ? 'covered' : 'missing'}`}
            className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold ${
              ok ? 'bg-good/15 text-good' : 'bg-bad/15 text-bad'
            }`}
          >
            {key} {ok ? '✓' : '✗'}
            <span className="sr-only">{`${label} ${ok ? 'covered' : 'missing'}`}</span>
          </span>
        );
      })}
    </div>
  );
}

function ComplexityChips({ extraction }) {
  const items = [
    ['Paradigm', extraction.paradigm || extraction.algorithmic_paradigm],
    ['Time', extraction.time_complexity],
    ['Space', extraction.space_complexity],
  ].filter(([, v]) => v);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(([k, v]) => (
        <span key={k} className="rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-[11px] text-soft">
          {k}: <span className="text-white">{v}</span>
        </span>
      ))}
    </div>
  );
}

export default function MessageBubble({ msg, isBehavioral }) {
  const reduce = useReducedMotion();
  const enter = {
    initial: reduce ? false : { opacity: 0, y: 12, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  };

  if (msg.role === 'user') {
    return (
      <motion.div {...enter} className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-electric-gradient px-4 py-3 text-white shadow-[0_10px_30px_-12px_rgb(59_130_246_/_0.8)]">
          <div className="mb-1 flex items-center justify-between gap-4 text-[11px] text-blue-100/80">
            <span className="font-semibold">You</span>
            <span>{msg.timestamp}</span>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-line">{msg.transcript}</p>
        </div>
      </motion.div>
    );
  }

  const isTeacher = msg.role === 'teacher';
  const pct = toPercent(msg.score);
  const showStar = msg.validation && ('S' in msg.validation || isBehavioral);

  return (
    <motion.div {...enter} className="flex justify-start gap-3">
      <span
        className={`mt-1 grid h-8 w-8 flex-none place-items-center rounded-lg ${
          msg.error ? 'bg-bad/15 text-bad' : isTeacher ? 'bg-good/15 text-good' : 'bg-electric/15 text-cyan'
        }`}
        aria-hidden="true"
      >
        {msg.error ? <AlertTriangle size={16} /> : isTeacher ? <GraduationCap size={16} /> : <Sparkles size={16} />}
      </span>
      <div
        className={`max-w-[85%] flex-1 rounded-2xl rounded-tl-md border px-4 py-3 ${
          isTeacher ? 'border-good/25 bg-good/[0.06]' : 'border-line bg-white/[0.04]'
        }`}
      >
        <div className="mb-1.5 flex items-center justify-between gap-4 text-[11px] text-mute">
          <span className={`font-semibold ${isTeacher ? 'text-good' : 'text-cyan'}`}>
            {isTeacher ? 'AI teacher, final evaluation' : 'AI interviewer'}
          </span>
          <span>{msg.timestamp}</span>
        </div>

        {msg.error ? (
          <p className="text-sm text-rose-200">{msg.error}</p>
        ) : (
          <div className="space-y-2.5">
            {msg.bargeInPrompt && (
              <div className="text-sm leading-relaxed text-ink">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {msg.bargeInPrompt}
                </ReactMarkdown>
                {msg.isStreaming && (
                  <span
                    className="ml-1 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-cyan align-middle"
                    aria-hidden="true"
                  />
                )}
              </div>
            )}
            {!msg.isStreaming && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-electric/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-cyan">
                  Score {pct === null ? 'N/A' : `${pct}%`}
                </span>
                {showStar ? (
                  <StarChips validation={msg.validation} />
                ) : (
                  msg.rawExtraction && <ComplexityChips extraction={msg.rawExtraction} />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
