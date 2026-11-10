import { Loader2, MessagesSquare, Mic, MicOff, Send, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';
import Button from '../ui/Button';
import MessageBubble from './MessageBubble';

function MicButton({ isRecording, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isRecording}
      className={`relative inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition cursor-pointer ${
        isRecording
          ? 'bg-rose-500/20 text-rose-100 shadow-[inset_0_0_0_1px_rgb(244_63_94_/_0.6),0_0_30px_-6px_rgb(244_63_94_/_0.7)]'
          : 'glass glass-hover !rounded-xl text-ink'
      }`}
    >
      <span className="relative grid h-5 w-5 place-items-center">
        {isRecording && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-rose-500/60" />}
        {isRecording ? <MicOff size={17} className="relative" /> : <Mic size={17} className="relative" />}
      </span>
      {isRecording ? 'Stop mic' : 'Start mic'}
    </button>
  );
}

export default function ChatPanel({
  messages,
  isBehavioral,
  transcript,
  onTranscriptChange,
  isRecording,
  onToggleMic,
  onSend,
  onFinalize,
  isFinalizing,
  isAwaitingReply,
  error,
}) {
  const endRef = useRef(null);
  const listRef = useRef(null);

  // Keep the newest message in view inside the panel (without scrolling the page).
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [messages, isFinalizing, isAwaitingReply]);

  return (
    <section aria-label="Interview conversation" className="glass flex min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <MessagesSquare size={16} className="text-cyan" aria-hidden="true" />
          Live conversation
        </h2>
        <span className="text-xs text-mute">
          {messages.length} {messages.length === 1 ? 'turn' : 'turns'}
        </span>
      </div>

      <div ref={listRef} className="h-[22rem] space-y-4 overflow-y-auto px-5 py-5 lg:h-[26rem]" aria-live="polite">
        {messages.length === 0 && (
          <div className="grid h-full place-content-center justify-items-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-electric/10 text-cyan">
              <Sparkles size={22} aria-hidden="true" />
            </span>
            <p className="max-w-xs text-sm text-mute">
              Start the mic and talk through your answer, or type it below. Send it when you’re ready for feedback.
            </p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} msg={msg} isBehavioral={isBehavioral} />
        ))}
        {(isFinalizing || isAwaitingReply) && (
          <div className="flex items-center gap-3" role="status">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-electric/15 text-cyan">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-line bg-white/[0.04] px-4 py-2.5 text-sm text-soft">
              {isFinalizing ? 'Evaluating your full answer' : 'Interviewer is thinking'}
              <span className="inline-flex gap-0.5" aria-hidden="true">
                <span className="h-1 w-1 animate-bounce rounded-full bg-cyan [animation-delay:-0.3s]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-cyan [animation-delay:-0.15s]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-cyan" />
              </span>
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="space-y-3 border-t border-line bg-void/30 p-4">
        <div className="flex items-center justify-between">
          <label htmlFor="transcript-input" className="text-xs font-semibold text-soft">
            {isBehavioral ? 'Your STAR answer' : 'Your explanation'}
          </label>
          {isRecording && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" aria-hidden="true" />
              Listening…
            </span>
          )}
        </div>
        <textarea
          id="transcript-input"
          rows={3}
          value={transcript}
          onChange={(e) => onTranscriptChange(e.target.value)}
          placeholder={
            isBehavioral
              ? 'Describe the situation, your task, the action you took, and the measurable result…'
              : 'Explain your approach, the algorithmic paradigm, and its time and space complexity…'
          }
          className="w-full resize-y rounded-xl border border-line bg-void/60 p-3.5 text-sm leading-relaxed text-ink placeholder:text-mute/80 transition focus:border-electric/60 focus:shadow-[0_0_0_3px_rgb(59_130_246_/_0.2)] focus:outline-none"
        />
        {error && (
          <p role="alert" className="text-xs font-medium text-rose-300">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MicButton isRecording={isRecording} onToggle={onToggleMic} />
          <div className="flex flex-wrap gap-2">
            <Button variant="glass" onClick={onSend}>
              <Send size={15} aria-hidden="true" />
              Send answer
            </Button>
            <Button variant="success" onClick={onFinalize} disabled={isFinalizing}>
              {isFinalizing ? 'Evaluating…' : 'Finalize and evaluate'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
