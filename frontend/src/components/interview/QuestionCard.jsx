import { Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownComponents } from './MessageBubble';

export default function QuestionCard({ question, isBehavioral }) {
  return (
    <section aria-labelledby="question-heading" className="glass glow-border p-6 sm:p-7">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-electric-gradient text-white shadow-[0_0_20px_-4px_rgb(96_165_250_/_0.9)]">
          <Sparkles size={16} aria-hidden="true" />
        </span>
        <h2 id="question-heading" className="text-sm font-semibold text-soft">
          Your {isBehavioral ? 'behavioral' : 'DSA'} question
        </h2>
      </div>
      <div className="text-base leading-relaxed text-white sm:text-lg">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {question}
        </ReactMarkdown>
      </div>
    </section>
  );
}
