// CodeMirror 6 with the 7800basic mode, in the app's dark theme. Loaded lazily
// (see LazyBasicEditor.tsx): nobody pays for it until code is on screen.
//
// Colors come from the --code-* design tokens (code.css), so the grammar
// follows the app's theme. Palette values get a swatch of their NTSC color,
// and incgraphic lines a thumbnail of the graphic in the gutter.
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
  GutterMarker,
  MatchDecorator,
  ViewPlugin,
  WidgetType,
  gutter,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useEffect, useRef, type Ref } from "react";
import { ntscCss } from "../ui/ntsc.ts";
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

/** Graphics by file stem (lowercase), for the gutter thumbnails. */
export type GraphicThumbs = Record<string, { rows: string[]; colors: readonly string[] }>;

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
  /** Lines the last edit changed (marked more quietly). */
  changed?: LineRange[];
  graphics?: GraphicThumbs;
  /** Where the cursor starts (offset). */
  initialCursor?: number;
  handle?: Ref<BasicEditorHandle>;
  testId?: string;
}

const basic = StreamLanguage.define(basicParser);

// Every color is a --code-* token (code.css); each is at least 4.5:1 on --code-bg.
const highlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "var(--code-keyword)" },
  { tag: t.comment, color: "var(--code-comment)", fontStyle: "italic" },
  { tag: [t.number, t.atom], color: "var(--code-number)" },
  { tag: t.string, color: "var(--code-string)" },
  { tag: t.labelName, color: "var(--code-label)", fontWeight: "600" },
  { tag: t.standard(t.variableName), color: "var(--code-builtin)" },
  { tag: t.meta, color: "var(--code-meta)" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "var(--code-operator)" },
  { tag: t.variableName, color: "var(--code-text)" },
]);

const theme = EditorView.theme(
  {
    "&": { backgroundColor: "var(--code-bg)", color: "var(--code-text)", fontSize: "13px", borderRadius: "2px", border: "1px solid var(--code-edge)" },
    "&.cm-focused": { outline: "2px solid var(--code-focus)", outlineOffset: "2px" },
    ".cm-scroller": { fontFamily: "var(--code-font)", lineHeight: "1.5" },
    ".cm-content": { caretColor: "var(--code-focus)" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--code-focus)", borderLeftWidth: "2px" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "var(--code-selection) !important",
    },
    ".cm-gutters": { backgroundColor: "var(--code-gutter-bg)", color: "var(--code-comment)", borderRight: "1px solid var(--code-rule)" },
    ".cm-activeLine": { backgroundColor: "var(--code-active-line)" },
    ".cm-activeLineGutter": { backgroundColor: "var(--code-active-line)", color: "var(--code-text)" },
    ".cm-matchingBracket": { backgroundColor: "var(--code-selection)", outline: "1px solid var(--code-comment)" },
    ".cm-searchMatch": { backgroundColor: "var(--code-search)", outline: "1px solid var(--code-focus)" },
    ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "var(--code-search-strong)" },
    ".cm-selectionMatch": { backgroundColor: "var(--code-active-line)" },
    ".cm-marked": { backgroundColor: "var(--code-marked)", boxShadow: "inset 3px 0 0 var(--code-focus)" },
    ".cm-changed": { boxShadow: "inset 3px 0 0 var(--code-changed)" },
    ".cm-marked.cm-changed": { boxShadow: "inset 3px 0 0 var(--code-focus), inset 6px 0 0 var(--code-changed)" },
    ".cm-swatch": {
      display: "inline-block", width: "0.9em", height: "0.9em", marginLeft: "4px", verticalAlign: "-1px",
      borderRadius: "2px", boxShadow: "0 0 0 1px var(--code-edge)",
    },
    ".cm-thumbs .cm-gutterElement": { display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" },
    ".cm-thumb": { imageRendering: "pixelated", maxHeight: "16px", maxWidth: "32px" },
    ".cm-panels": { backgroundColor: "var(--code-panel-bg)", color: "var(--code-text)" },
    ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--code-rule)" },
    ".cm-panels.cm-panels-bottom": { borderTop: "1px solid var(--code-rule)" },
    ".cm-textfield": { backgroundColor: "var(--code-bg)", color: "var(--code-text)", border: "1px solid var(--code-edge)", borderRadius: "4px" },
    ".cm-button": { backgroundImage: "none", backgroundColor: "var(--code-button-bg)", color: "var(--code-text)", border: "0", borderRadius: "4px" },
    ".cm-panel.cm-search label": { color: "var(--code-text)", display: "inline-flex", alignItems: "center", gap: "4px", minHeight: "28px" },
    // Every control at least 24 px (WCAG 2.5.8).
    ".cm-panel.cm-search .cm-textfield, .cm-panel.cm-search .cm-button": { minHeight: "28px", padding: "2px 8px", fontSize: "13px" },
    ".cm-panel.cm-search input[type=checkbox]": { width: "24px", height: "24px", margin: "0" },
    ".cm-panel.cm-search button[name=close]": { minWidth: "28px", minHeight: "28px", fontSize: "18px" },
    ".cm-panel button[name=close]": { color: "var(--code-text)" },
    ".cm-tooltip": { backgroundColor: "var(--code-panel-bg)", color: "var(--code-text)", border: "1px solid var(--code-edge)" },
    ".cm-diagnostic-error": { borderLeftColor: "var(--code-error)" },
    ".cm-diagnostic-warning": { borderLeftColor: "var(--code-focus)" },
    ".cm-panel.cm-panel-lint ul [aria-selected]": { backgroundColor: "var(--code-selection)" },
  },
  { dark: true },
);

/** A swatch of the NTSC color after palette values: `P0C1 = $1C`, `BACKGRND = $00`. */
class SwatchWidget extends WidgetType {
  readonly color: string;
  constructor(color: string) {
    super();
    this.color = color;
  }
  eq(other: SwatchWidget) {
    return other.color === this.color;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-swatch";
    el.style.backgroundColor = ntscCss(this.color);
    el.title = `${this.color} on an NTSC console`;
    el.setAttribute("aria-hidden", "true");
    return el;
  }
}

const swatchMatcher = new MatchDecorator({
  regexp: /\b(?:P[0-7]C[1-3]|BACKGRND)\s*=\s*(\$[0-9A-Fa-f]{2})\b/gi,
  decorate: (add, _from, to, match) => add(to, to, Decoration.widget({ widget: new SwatchWidget(match[1]!.toUpperCase()), side: 1 })),
});

const swatches = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = swatchMatcher.createDeco(view);
    }
    update(u: { view: EditorView; docChanged: boolean; viewportChanged: boolean }) {
      this.decorations = swatchMatcher.updateDeco(u as Parameters<MatchDecorator["updateDeco"]>[0], this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

class ThumbMarker extends GutterMarker {
  readonly name: string;
  readonly g: GraphicThumbs[string];
  constructor(name: string, g: GraphicThumbs[string]) {
    super();
    this.name = name;
    this.g = g;
  }
  eq(other: ThumbMarker) {
    return other.g === this.g;
  }
  toDOM() {
    const rows = this.g.rows;
    const w = rows[0]?.length ?? 0;
    const c = document.createElement("canvas");
    c.width = w * 2;
    c.height = rows.length;
    c.className = "cm-thumb";
    c.setAttribute("aria-hidden", "true");
    c.title = this.name;
    const ctx = c.getContext("2d");
    if (ctx) {
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const v = row.charCodeAt(x) - 48;
          if (v <= 0 || !this.g.colors[v - 1]) continue;
          ctx.fillStyle = ntscCss(this.g.colors[v - 1]!);
          ctx.fillRect(x * 2, y, 2, 1);
        }
      });
    }
    return c;
  }
}

/** A gutter with each incgraphic line's graphic. */
function thumbGutter(graphics: GraphicThumbs): Extension {
  return gutter({
    class: "cm-thumbs",
    lineMarker(view, line) {
      const text = view.state.doc.sliceString(line.from, line.to);
      const name = /^\s+incgraphic\s+(\S+?)\.png\b/i.exec(text)?.[1]?.toLowerCase();
      const g = name ? graphics[name] : undefined;
      return g ? new ThumbMarker(name!, g) : null;
    },
    lineMarkerChange: () => true,
  });
}

/** New lines follow the line above; after a label they start one space in, as statements must. */
const basicIndent = indentService.of((cx, pos) => {
  const here = cx.lineAt(pos, 1);
  if (here.from === 0) return 0;
  return indentAfter(cx.lineAt(here.from - 1, -1).text);
});

const external = Transaction.userEvent.of("external");

function lineMarks(state: EditorState, ranges: LineRange[], changed: LineRange[]): Extension {
  const classes = new Map<number, string[]>();
  const lines = state.doc.lines;
  const tag = (list: LineRange[], cls: string) => {
    for (const r of list) for (let n = Math.max(1, r.from); n <= Math.min(lines, r.to); n++) classes.set(n, [...(classes.get(n) ?? []), cls]);
  };
  tag(ranges, "cm-marked");
  tag(changed, "cm-changed");
  const builder = new RangeSetBuilder<Decoration>();
  for (const n of [...classes.keys()].sort((a, b) => a - b)) {
    const from = state.doc.line(n).from;
    builder.add(from, from, Decoration.line({ class: classes.get(n)!.join(" ") }));
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

export default function BasicEditor({
  value,
  onChange,
  readOnly = false,
  label,
  describedBy,
  problems,
  highlight,
  changed,
  graphics,
  initialCursor,
  handle,
  testId,
}: BasicEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const marks = useRef(new Compartment());
  const scrolledTo = useRef("");
  const thumbs = useRef(new Compartment());

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
      swatches,
      thumbs.current.of(graphics ? thumbGutter(graphics) : []),
      lintGutter(),
      search({ top: true }),
      EditorView.contentAttributes.of(attrs),
      marks.current.of([]),
      keymap.of([...searchKeymap, ...lintKeymap, ...defaultKeymap]),
    ];
    if (readOnly) extensions.push(EditorState.readOnly.of(true));
    else {
      extensions.push(
        history(),
        indentUnit.of(" "),
        basicIndent,
        keymap.of([...historyKeymap, indentWithTab]),
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
    scrolledTo.current = ""; // a new view hasn't scrolled anywhere yet
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
    if (!v) return;
    v.dispatch(setDiagnostics(v.state, toDiagnostics(v.state, problems ?? [])));
  }, [problems]);

  useEffect(() => {
    view.current?.dispatch({ effects: thumbs.current.reconfigure(graphics ? thumbGutter(graphics) : []) });
  }, [graphics]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const ranges = highlight ?? [];
    const effects = [marks.current.reconfigure(lineMarks(v.state, ranges, changed ?? []))];
    const first = ranges[0];
    // Scroll only when the marked lines move, not on every rebuild of the same selection.
    const key = first ? `${first.from}-${first.to}` : "";
    const moved = key !== scrolledTo.current;
    scrolledTo.current = key;
    v.dispatch({ effects });
    if (first && moved && first.from <= v.state.doc.lines) {
      const scroll = () => v.dispatch({ effects: EditorView.scrollIntoView(v.state.doc.line(first.from).from, { y: "start", yMargin: 24 }) });
      // Right after mounting the view isn't measured yet, so scroll on the next frame too.
      scroll();
      requestAnimationFrame(() => view.current === v && scroll());
    }
  }, [highlight, changed, value]);

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
