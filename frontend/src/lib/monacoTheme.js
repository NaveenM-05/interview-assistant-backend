// Navy Monaco theme matching the app palette. Pass to <Editor beforeMount={defineNavyTheme} theme={NAVY_THEME} />.
export const NAVY_THEME = 'ia-navy';

export function defineNavyTheme(monaco) {
  monaco.editor.defineTheme(NAVY_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6B7599', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'A78BFA' },
      { token: 'string', foreground: '7DD3FC' },
      { token: 'number', foreground: 'F0ABFC' },
      { token: 'type', foreground: '60A5FA' },
      { token: 'identifier', foreground: 'E7EBF8' },
      { token: 'delimiter', foreground: '94A3C8' },
    ],
    colors: {
      'editor.background': '#080D1F',
      'editor.foreground': '#E7EBF8',
      'editorLineNumber.foreground': '#3A4468',
      'editorLineNumber.activeForeground': '#93C5FD',
      'editor.lineHighlightBackground': '#111A3580',
      'editor.lineHighlightBorder': '#00000000',
      'editor.selectionBackground': '#3B82F655',
      'editor.inactiveSelectionBackground': '#3B82F630',
      'editorCursor.foreground': '#38BDF8',
      'editorIndentGuide.background1': '#1A2342',
      'editorIndentGuide.activeBackground1': '#334170',
      'editorGutter.background': '#080D1F',
      'editorWidget.background': '#0E1630',
      'editorWidget.border': '#24305A',
      'scrollbarSlider.background': '#94A3D622',
      'scrollbarSlider.hoverBackground': '#94A3D644',
      'diffEditor.insertedTextBackground': '#34D39926',
      'diffEditor.removedTextBackground': '#F8717126',
      'diffEditor.insertedLineBackground': '#34D39912',
      'diffEditor.removedLineBackground': '#F8717112',
    },
  });
}
