import { DiffEditor, Editor } from '@monaco-editor/react';
import { ArrowLeft, Code2, GitCompareArrows, Loader2 } from 'lucide-react';
import { NAVY_THEME, defineNavyTheme } from '../../lib/monacoTheme';

const loading = (
  <div className="grid h-full place-items-center text-sm text-mute">
    <span className="inline-flex items-center gap-2">
      <Loader2 size={16} className="animate-spin text-cyan" aria-hidden="true" />
      Loading editor…
    </span>
  </div>
);

export default function CodePanel({ code, onChange, optimalCode, onBackToEditor }) {
  const showingDiff = Boolean(optimalCode);
  return (
    <section aria-label="Code editor" className="glass flex min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          {showingDiff ? (
            <>
              <GitCompareArrows size={16} className="text-good" aria-hidden="true" />
              Your code vs. optimal solution
            </>
          ) : (
            <>
              <Code2 size={16} className="text-cyan" aria-hidden="true" />
              Live code editor
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-mute">Python</span>
            </>
          )}
        </h2>
        {showingDiff && (
          <button
            type="button"
            onClick={onBackToEditor}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan hover:text-white cursor-pointer"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back to editor
          </button>
        )}
      </div>

      <div className="h-[30rem] w-full bg-[#080D1F] lg:h-[37.5rem]">
        {showingDiff ? (
          <DiffEditor
            height="100%"
            language="python"
            theme={NAVY_THEME}
            beforeMount={defineNavyTheme}
            original={code}
            modified={optimalCode}
            loading={loading}
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        ) : (
          <Editor
            height="100%"
            language="python"
            theme={NAVY_THEME}
            beforeMount={defineNavyTheme}
            value={code}
            onChange={(val) => onChange(val ?? '')}
            loading={loading}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontLigatures: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              padding: { top: 16 },
              smoothScrolling: true,
              cursorBlinking: 'smooth',
            }}
          />
        )}
      </div>
    </section>
  );
}
