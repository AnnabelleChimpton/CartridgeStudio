// CodeMirror 6 with the 7800basic mode, in the app's dark theme. Loaded lazily
// (see LazyBasicEditor.tsx): nobody pays for it until code is on screen.
//
// Keyboard: Tab indents, so Esc then Tab (or Shift+Tab) leaves the editor,
// CodeMirror's own escape hatch. ⌘F / Ctrl+F searches, ⇧⌘M / Ctrl+Shift+M
// lists the build's problems, F8 jumps to the next one.

import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  HighlightStyle,
  StreamLanguage,
  bracketMatching,
  indentService,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { lintGutter, lintKeymap, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { Compartment, EditorSelection, EditorState, RangeSetBuilder, Transaction, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useEffect, useRef, type Ref } from "react";
import type { BuildProblem } from "./build-log.ts";
import { basicParser, indentAfter } from "./lang.ts";

export interface BasicEditorHandle {
  /** Moves the cursor to the start of a line (1-based) and focuses the editor. */
  goTo(line: number): void;
  focus(): void;
  /** The cursor's offset in the document. */
  cursor(): number;
}

export interface LineRange {
  from: number;
  to: number;
}

export interface BasicEditorProps {
  value: string;
  onChange?: (value: string) => void;
  /** Read-only views can still be focused, read and searched. */
  readOnly?: boolean;
  label: string;
  describedBy?: string;
  /** Errors and warnings from the last build, by line. */
  problems?: BuildProblem[];
  /** Lines (1-based, inclusive) to mark and scroll to. */
  highlight?: LineRange[];
  /** Where the cursor starts (offset). */
  initialCursor?: number;
  handle?: Ref<BasicEditorHandle>;
  testId?: string;
}

const basic = StreamLanguage.define(basicParser);

// Colors are the app's tokens; every one is at least 4.5:1 on the editor's #0f1115.
const highlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#f0a23a" },
  { tag: t.comment, color: "#9aa1ad", fontStyle: "italic" },
  { tag: [t.number, t.atom], color: "#7cc4ff" },
  { tag: t.string, color: "#a5d6a7" },
  { tag: t.labelName, color: "#ffd580", fontWeight: "600" },
  { tag: t.standard(t.variableName), color: "#d2a8ff" },
  { tag: t.meta, color: "#b9c0cb" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "#c9ced6" },
  { tag: t.variableName, color: "#e6e8ec" },
]);

const theme = EditorView.theme(
  {
    "&": { backgroundColor: "#0f1115", color: "#e6e8ec", fontSize: "13px", borderRadius: "6px", border: "1px solid #6b7280" },
    "&.cm-focused": { outline: "2px solid #f0a23a", outlineOffset: "2px" },
    ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", lineHeight: "1.5" },
    ".cm-content": { caretColor: "#f0a23a" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#f0a23a", borderLeftWidth: "2px" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "#3a4252 !important",
    },
    ".cm-gutters": { backgroundColor: "#14161b", color: "#9aa1ad", borderRight: "1px solid #2c313b" },
    ".cm-activeLine": { backgroundColor: "#ffffff0a" },
    ".cm-activeLineGutter": { backgroundColor: "#ffffff12", color: "#e6e8ec" },
    ".cm-matchingBracket": { backgroundColor: "#3a4252", outline: "1px solid #9aa1ad" },
    ".cm-searchMatch": { backgroundColor: "#f0a23a40", outline: "1px solid #f0a23a" },
    ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "#f0a23a80" },
    ".cm-selectionMatch": { backgroundColor: "#ffffff1a" },
    ".cm-marked": { backgroundColor: "#f0a23a24", boxShadow: "inset 3px 0 0 #f0a23a" },
    ".cm-panels": { backgroundColor: "#1d2027", color: "#e6e8ec" },
    ".cm-panels.cm-panels-top": { borderBottom: "1px solid #2c313b" },
    ".cm-panels.cm-panels-bottom": { borderTop: "1px solid #2c313b" },
    ".cm-textfield": { backgroundColor: "#0f1115", color: "#e6e8ec", border: "1px solid #6b7280", borderRadius: "4px" },
    ".cm-button": { backgroundImage: "none", backgroundColor: "#2c313b", color: "#e6e8ec", border: "0", borderRadius: "4px" },
    ".cm-panel.cm-search label": { color: "#e6e8ec", display: "inline-flex", alignItems: "center", gap: "4px", minHeight: "28px" },
    // Every control at least 24 px (WCAG 2.5.8).
    ".cm-panel.cm-search .cm-textfield, .cm-panel.cm-search .cm-button": { minHeight: "28px", padding: "2px 8px", fontSize: "13px" },
    ".cm-panel.cm-search input[type=checkbox]": { width: "24px", height: "24px", margin: "0" },
    ".cm-panel.cm-search button[name=close]": { minWidth: "28px", minHeight: "28px", fontSize: "18px" },
    ".cm-panel button[name=close]": { color: "#e6e8ec" },
    ".cm-tooltip": { backgroundColor: "#1d2027", color: "#e6e8ec", border: "1px solid #6b7280" },
    ".cm-diagnostic-error": { borderLeftColor: "#ff7b72" },
    ".cm-diagnostic-warning": { borderLeftColor: "#f0a23a" },
    ".cm-panel.cm-panel-lint ul [aria-selected]": { backgroundColor: "#3a4252" },
  },
  { dark: true },
);

/** New lines follow the line above; after a label they start one space in, as statements must. */
const basicIndent = indentService.of((cx, pos) => {
  const here = cx.lineAt(pos, 1);
  if (here.from === 0) return 0;
  return indentAfter(cx.lineAt(here.from - 1, -1).text);
});

const external = Transaction.userEvent.of("external");

function lineMarks(state: EditorState, ranges: LineRange[]): Extension {
  const builder = new RangeSetBuilder<Decoration>();
  const mark = Decoration.line({ class: "cm-marked" });
  const lines = state.doc.lines;
  for (const r of [...ranges].sort((a, b) => a.from - b.from)) {
    for (let n = Math.max(1, r.from); n <= Math.min(lines, r.to); n++) {
      const line = state.doc.line(n);
      builder.add(line.from, line.from, mark);
    }
  }
  return EditorView.decorations.of(builder.finish());
}

function toDiagnostics(state: EditorState, problems: BuildProblem[]): Diagnostic[] {
  return problems
    .filter((p) => p.line !== undefined)
    .map((p) => {
      const line = state.doc.line(Math.min(Math.max(1, p.line!), state.doc.lines));
      const indent = /^\s*/.exec(line.text)![0].length;
      return { from: line.from + indent, to: line.to, severity: p.severity, message: p.message, source: p.tool };
    });
}

export default function BasicEditor({ value, onChange, readOnly = false, label, describedBy, problems, highlight, initialCursor, handle, testId }: BasicEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const marks = useRef(new Compartment());
  const scrolledTo = useRef("");

  // Create the view once.
  useEffect(() => {
    // tabindex: contenteditable is focusable anyway, but axe only counts it as such with one.
    const attrs: Record<string, string> = { "aria-label": label, tabindex: "0" };
    if (describedBy) attrs["aria-describedby"] = describedBy;
    if (readOnly) attrs["aria-readonly"] = "true";
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      drawSelection(),
      highlightActiveLine(),
      bracketMatching(),
      highlightSelectionMatches(),
      basic,
      syntaxHighlighting(highlightStyle),
      theme,
      search({ top: true }),
      EditorView.contentAttributes.of(attrs),
      marks.current.of([]),
      keymap.of([...searchKeymap, ...defaultKeymap]),
    ];
    if (readOnly) extensions.push(EditorState.readOnly.of(true));
    else {
      extensions.push(
        history(),
        indentUnit.of(" "),
        basicIndent,
        lintGutter(),
        keymap.of([...historyKeymap, ...lintKeymap, indentWithTab]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !u.transactions.every((tr) => tr.annotation(Transaction.userEvent) === "external")) {
            onChangeRef.current?.(u.state.doc.toString());
          }
        }),
      );
    }
    const state = EditorState.create({
      doc: value,
      extensions,
      selection: initialCursor !== undefined ? EditorSelection.cursor(Math.min(initialCursor, value.length)) : undefined,
    });
    const v = new EditorView({ state, parent: host.current! });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // The view is made once; later prop changes are dispatched below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outside changes (undo in the top bar, a reference insert, a new build's code).
  useEffect(() => {
    const v = view.current;
    if (!v || v.state.doc.toString() === value) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value }, annotations: [external] });
  }, [value]);

  useEffect(() => {
    const v = view.current;
    if (!v || readOnly) return;
    v.dispatch(setDiagnostics(v.state, toDiagnostics(v.state, problems ?? [])));
  }, [problems, readOnly]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const ranges = highlight ?? [];
    const effects = [marks.current.reconfigure(lineMarks(v.state, ranges))];
    const first = ranges[0];
    // Scroll only when the marked lines move, not on every rebuild of the same selection.
    const key = first ? `${first.from}-${first.to}` : "";
    const moved = key !== scrolledTo.current;
    scrolledTo.current = key;
    if (first && moved && first.from <= v.state.doc.lines) {
      v.dispatch({ effects: [...effects, EditorView.scrollIntoView(v.state.doc.line(first.from).from, { y: "start", yMargin: 24 })] });
    } else v.dispatch({ effects });
  }, [highlight, value]);

  useEffect(() => {
    const api: BasicEditorHandle = {
      goTo(line) {
        const v = view.current;
        if (!v) return;
        const l = v.state.doc.line(Math.min(Math.max(1, line), v.state.doc.lines));
        const at = l.from + /^\s*/.exec(l.text)![0].length;
        v.dispatch({ selection: { anchor: at }, effects: EditorView.scrollIntoView(at, { y: "center" }) });
        v.focus();
      },
      focus: () => view.current?.focus(),
      cursor: () => view.current?.state.selection.main.head ?? 0,
    };
    if (typeof handle === "function") handle(api);
    else if (handle) (handle as { current: BasicEditorHandle | null }).current = api;
  }, [handle]);

  return <div ref={host} className={`basic-editor${readOnly ? " readonly" : ""}`} data-testid={testId} />;
}
