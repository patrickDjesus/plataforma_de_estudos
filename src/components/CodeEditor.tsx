import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Maximize2, Minimize2, Minus, Plus, Target } from 'lucide-react'
import { Compartment, EditorState, Prec, RangeSet, RangeSetBuilder, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, GutterMarker, ViewPlugin, drawSelection, gutter, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentLess, indentMore, toggleComment } from '@codemirror/commands'
import { HighlightStyle, bracketMatching, indentOnInput, indentUnit, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { acceptCompletion, autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, completionStatus, ifNotIn } from '@codemirror/autocomplete'
import { python, localCompletionSource as pyLocal } from '@codemirror/lang-python'
import { javascript, localCompletionSource as jsLocal } from '@codemirror/lang-javascript'
import { tags as t } from '@lezer/highlight'
import { codeCompletions } from '../lib/codeHints'

type Lang = 'python' | 'javascript'
const LANG_NAME: Record<Lang, string> = { python: 'Python', javascript: 'JavaScript' }

/* ---------------- Tela cheia da janela do editor ---------------- */

const FullCtx = createContext<{ full: boolean; toggle: () => void } | null>(null)

/** Janela escura de editor (bolinhas, nome do arquivo, botões). Pode abrir em tela cheia. */
export function IdeWindow({ file, actions, children, className = '', goal }: { file: string; actions?: ReactNode; children: ReactNode; className?: string; goal?: ReactNode }) {
  const [full, setFull] = useState(false)
  const [goalOpen, setGoalOpen] = useState(true)
  useEffect(() => {
    if (!full) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setFull(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [full])
  return (
    <FullCtx.Provider value={{ full, toggle: () => setFull((v) => !v) }}>
      <div className={full ? 'fixed inset-0 z-[80] flex flex-col bg-[#16181d]' : `overflow-hidden rounded-[20px] bg-[#16181d] shadow-[0_20px_40px_-24px_rgba(16,24,40,.8)] ${className}`}>
        <div className="flex flex-wrap items-center gap-3 border-b border-white/5 bg-[#1d2027] px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </span>
          <span className="rounded-lg bg-[#16181d] px-3 py-1 font-mono text-xs text-[#e6e9f2]">{file}</span>
          <span className="ml-auto flex flex-wrap gap-2">
            {actions}
            <button onClick={() => setFull((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-bold text-[#c9cede] transition hover:bg-white/20" title={full ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}>
              {full ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span className="hidden sm:inline">{full ? 'Sair' : 'Tela cheia'}</span>
            </button>
          </span>
        </div>
        <div className={full ? 'thin-scroll min-h-0 flex-1 overflow-auto' : ''}>{children}</div>
        {full && goal ? (
          goalOpen ? (
            <div className="capi-pop absolute top-[60px] right-4 z-20 w-[360px] max-w-[calc(100%-2rem)] rounded-2xl border border-[#2d323d] bg-[#242833]/95 p-4 text-[#e6e9f2] shadow-[0_18px_40px_-16px_rgba(0,0,0,.8)] backdrop-blur">
              <div className="mb-2 flex items-center gap-2">
                <Target size={15} className="text-[#7ef0b5]" />
                <span className="text-[11px] font-extrabold tracking-[.12em] text-[#7ef0b5] uppercase">Objetivo</span>
                <button onClick={() => setGoalOpen(false)} className="ml-auto grid h-6 w-6 place-items-center rounded-md text-[#8a93a8] hover:bg-white/10 hover:text-white" title="Esconder">
                  <ChevronUp size={15} />
                </button>
              </div>
              <div className="thin-scroll max-h-[45vh] overflow-y-auto text-[13.5px] leading-relaxed text-[#c9cede]">{goal}</div>
            </div>
          ) : (
            <button onClick={() => setGoalOpen(true)} className="absolute top-[60px] right-4 z-20 inline-flex items-center gap-1.5 rounded-xl border border-[#2d323d] bg-[#242833] px-3 py-1.5 text-xs font-bold text-[#7ef0b5] shadow-lg hover:bg-[#2b303c]">
              <Target size={13} /> Objetivo <ChevronDown size={13} />
            </button>
          )
        ) : null}
      </div>
    </FullCtx.Provider>
  )
}

/* ---------------- Cores ---------------- */

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: '#ff7ab2', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: '#a8e07a' },
  { tag: [t.number, t.bool, t.null, t.atom], color: '#ffa45b' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#6f7a90', fontStyle: 'italic' },
  { tag: [t.operator, t.compareOperator, t.arithmeticOperator, t.logicOperator, t.updateOperator], color: '#7fd7f5' },
  { tag: [t.propertyName], color: '#9cc7ff' },
  { tag: [t.self, t.className, t.typeName], color: '#ffd866' },
  { tag: [t.variableName], color: '#e6e9f2' },
  { tag: [t.definition(t.variableName)], color: '#f0f3fb' },
  { tag: [t.escape], color: '#ffb86c' },
  { tag: [t.punctuation, t.separator], color: '#aab2c5' },
])

const theme = EditorView.theme(
  {
    '&': { color: '#e6e9f2', backgroundColor: '#16181d', height: '100%', fontSize: 'var(--code-size, 14px)' },
    '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.6' },
    '.cm-content': { caretColor: '#7ef0b5', padding: '12px 0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#7ef0b5', borderLeftWidth: '2px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#3e63f255 !important' },
    '.cm-gutters': { backgroundColor: '#1d2027', color: '#596071', border: 'none' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 8px', minWidth: '34px' },
    '.cm-activeLine': { backgroundColor: '#ffffff08' },
    '.cm-activeLineGutter': { backgroundColor: '#ffffff0d', color: '#c9cede' },
    '&.cm-focused': { outline: 'none' },
    '.cm-matchingBracket': { backgroundColor: '#ffffff1f', outline: '1px solid #ffffff40', borderRadius: '2px' },
    '.cm-mendi-line': { backgroundColor: '#ffd34d26', boxShadow: 'inset 3px 0 0 #ffd34d' },
    '.cm-tooltip': { border: '1px solid #2d323d', backgroundColor: '#1d2027', color: '#e6e9f2', borderRadius: '12px', boxShadow: '0 18px 40px -16px rgba(0,0,0,.7)' },
    '.cm-tooltip-autocomplete > ul': { borderRadius: '12px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', maxHeight: '15em' },
    '.cm-tooltip-autocomplete > ul > li': { padding: '3px 10px 3px 6px', lineHeight: '1.5' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#3e63f2', color: '#fff' },
    '.cm-completionDetail': { color: '#8a93a8', fontStyle: 'normal', marginLeft: '10px', fontSize: '.85em' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionDetail': { color: '#dfe6ff' },
    '.cm-completionMatchedText': { textDecoration: 'none', color: '#7ef0b5', fontWeight: '700' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionMatchedText': { color: '#fff' },
    '.cm-completionInfo': { backgroundColor: '#242833', border: '1px solid #2d323d', borderRadius: '10px', margin: '0 6px', padding: '8px 12px', maxWidth: '300px', fontFamily: 'Inter, sans-serif', fontSize: '13px', lineHeight: '1.45', color: '#c9cede' },
    '.cm-completionIcon': { opacity: '1', width: '1.3em', fontSize: '.95em' },
    '.cm-completionIcon-function, .cm-completionIcon-method': { color: '#ffd866' },
    '.cm-completionIcon-keyword': { color: '#ff7ab2' },
    '.cm-completionIcon-variable': { color: '#9cc7ff' },
    '.cm-completionIcon-property': { color: '#9cc7ff' },
    '.cm-completionIcon-text': { color: '#a8e07a' },
    '.cm-snippetField': { backgroundColor: '#ffffff14', borderRadius: '3px' },
    '.cm-step-gutter .cm-gutterElement': { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px 0 6px' },
    '.cm-step': { display: 'grid', placeItems: 'center', width: '18px', height: '18px', borderRadius: '999px', fontSize: '10px', fontWeight: '800', cursor: 'pointer', backgroundColor: '#ffd34d40', color: '#ffd34d', fontFamily: 'Inter, sans-serif' },
    '.cm-step.on': { backgroundColor: '#ffd34d', color: '#16181d' },
  },
  { dark: true },
)

/* Colchetes coloridos por profundidade e cada função com a sua cor */
const BRACKETS = ['#ffd866', '#ff7ab2', '#7fd7f5', '#a8e07a', '#c3a6ff', '#ffa45b']
const FN_COLORS = ['#ffd866', '#7fd7f5', '#ff9ecf', '#a8e07a', '#ffa45b', '#c3a6ff', '#5ae0c0', '#ffb86c']
const bracketMarks = BRACKETS.map((c) => Decoration.mark({ attributes: { style: `color:${c}` } }))
const fnMarks = FN_COLORS.map((c) => Decoration.mark({ attributes: { style: `color:${c};font-weight:600` } }))
const hash = (s: string) => {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
const OPEN = new Set(['(', '[', '{'])
const CLOSE = new Set([')', ']', '}'])
const DEF_PARENTS = new Set(['FunctionDefinition', 'FunctionDeclaration'])

function paint(view: EditorView): DecorationSet {
  const { state } = view
  const marks: { from: number; to: number; deco: Decoration }[] = []
  // Colchetes e nomes de função
  let depth = 0
  syntaxTree(state).iterate({
    enter(n) {
      if (OPEN.has(n.name)) marks.push({ from: n.from, to: n.to, deco: bracketMarks[depth++ % BRACKETS.length] })
      else if (CLOSE.has(n.name)) {
        depth = Math.max(0, depth - 1)
        marks.push({ from: n.from, to: n.to, deco: bracketMarks[depth % BRACKETS.length] })
      } else if (n.name === 'VariableName' || n.name === 'VariableDefinition' || n.name === 'PropertyName') {
        const parent = n.node.parent
        let isFn = false
        if (parent && DEF_PARENTS.has(parent.name) && n.node.prevSibling?.name.match(/^(def|function)$/)) isFn = true
        else if (parent?.name === 'CallExpression' && parent.firstChild?.from === n.from) isFn = true
        else if (n.name === 'PropertyName' && parent?.name === 'MemberExpression' && parent.parent?.name === 'CallExpression' && parent.parent.firstChild?.from === parent.from) isFn = true
        if (isFn) marks.push({ from: n.from, to: n.to, deco: fnMarks[hash(state.sliceDoc(n.from, n.to)) % FN_COLORS.length] })
      }
    },
  })
  marks.sort((a, b) => a.from - b.from || a.to - b.to)
  const b = new RangeSetBuilder<Decoration>()
  for (const mk of marks) b.add(mk.from, mk.to, mk.deco)
  return b.finish()
}

const colorful = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = paint(view)
    }
    update(u: ViewUpdate) {
      if (u.docChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) this.decorations = paint(u.view)
    }
  },
  { decorations: (v) => v.decorations },
)

/* ---------------- Linha apontada e marcadores da Mendi ---------------- */

const setFocusLine = StateEffect.define<number | null>()
const focusLine = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects)
      if (e.is(setFocusLine)) {
        if (!e.value || e.value > tr.state.doc.lines) return Decoration.none
        return Decoration.set([Decoration.line({ class: 'cm-mendi-line' }).range(tr.state.doc.line(e.value).from)])
      }
    return deco.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f),
})

class StepMarker extends GutterMarker {
  constructor(
    readonly step: number,
    readonly on: boolean,
  ) {
    super()
  }
  eq(o: StepMarker) {
    return o.step === this.step && o.on === this.on
  }
  toDOM() {
    const el = document.createElement('span')
    el.className = `cm-step${this.on ? ' on' : ''}`
    el.textContent = String(this.step + 1)
    el.title = 'Ver comentário da Mendi'
    return el
  }
}
const setSteps = StateEffect.define<{ markers: Map<number, number>; on?: number }>()
const steps = StateField.define<RangeSet<StepMarker>>({
  create: () => RangeSet.empty,
  update(set, tr) {
    for (const e of tr.effects)
      if (e.is(setSteps)) {
        const b = new RangeSetBuilder<StepMarker>()
        ;[...e.value.markers.entries()]
          .filter(([line]) => line >= 1 && line <= tr.state.doc.lines)
          .sort((a, c) => a[0] - c[0])
          .forEach(([line, step]) => b.add(tr.state.doc.line(line).from, tr.state.doc.line(line).from, new StepMarker(step, e.value.on === line)))
        return b.finish()
      }
    return set.map(tr.changes)
  },
})

/* ---------------- Zoom ---------------- */

const ZOOM_KEY = 'mendonca-code-zoom'
const SIZES = [12, 13, 14, 15, 16, 18, 20, 22, 24]
const loadZoom = () => {
  try {
    const v = Number(localStorage.getItem(ZOOM_KEY))
    return SIZES.includes(v) ? v : 14
  } catch {
    return 14
  }
}
const zoomListeners = new Set<(n: number) => void>()
function setZoomAll(n: number) {
  try {
    localStorage.setItem(ZOOM_KEY, String(n))
  } catch {
    /* sem armazenamento */
  }
  zoomListeners.forEach((l) => l(n))
}

/* ---------------- Editor ---------------- */

const langExt = (lang: Lang): Extension => {
  const strings = ['String', 'FormatString', 'TemplateString', 'Comment', 'LineComment', 'BlockComment']
  return [
    lang === 'python' ? python() : javascript(),
    indentUnit.of(lang === 'python' ? '    ' : '  '),
    autocompletion({
      override: [ifNotIn(strings, codeCompletions(lang)), ifNotIn(strings, lang === 'python' ? pyLocal : jsLocal)],
      icons: true,
      activateOnTypingDelay: 60,
      addToOptions: [],
    }),
  ]
}

/**
 * Editor de código de verdade (CodeMirror): cores, sugestões ao digitar, colchetes e indentação
 * coloridos, Ctrl+/ comenta, zoom e tela cheia.
 */
export function CodeEditor({
  value,
  onChange,
  lang,
  highlight: hl,
  tall = false,
  bare = false,
  markers,
  onMarker,
  readOnly = false,
}: {
  value: string
  onChange: (v: string) => void
  lang: Lang
  highlight?: number
  tall?: boolean
  bare?: boolean
  markers?: Map<number, number>
  onMarker?: (step: number) => void
  readOnly?: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onMarkerRef = useRef(onMarker)
  onChangeRef.current = onChange
  onMarkerRef.current = onMarker
  const langComp = useRef(new Compartment())
  const roComp = useRef(new Compartment())
  const [size, setSize] = useState(loadZoom)
  const [pos, setPos] = useState({ line: 1, col: 1 })
  const full = useContext(FullCtx)?.full ?? false

  useEffect(() => {
    const l = (n: number) => setSize(n)
    zoomListeners.add(l)
    return () => {
      zoomListeners.delete(l)
    }
  }, [])
  const zoom = (d: number) => {
    const i = SIZES.indexOf(size)
    setZoomAll(SIZES[Math.max(0, Math.min(SIZES.length - 1, (i < 0 ? 2 : i) + d))])
  }
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  // Cria o editor uma vez
  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          gutter({
            class: 'cm-step-gutter',
            markers: (vw) => vw.state.field(steps),
            domEventHandlers: {
              mousedown(vw, block) {
                const m = vw.state.field(steps).iter(block.from)
                if (m.value && m.from === block.from) {
                  onMarkerRef.current?.(m.value.step)
                  return true
                }
                return false
              },
            },
          }),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          highlightActiveLine(),
          syntaxHighlighting(highlight),
          theme,
          Prec.highest(colorful),
          focusLine,
          steps,
          EditorState.tabSize.of(4),
          langComp.current.of(langExt(lang)),
          roComp.current.of(EditorState.readOnly.of(readOnly)),
          keymap.of([
            { key: 'Tab', run: (vw) => (completionStatus(vw.state) === 'active' ? acceptCompletion(vw) : indentMore(vw)), shift: indentLess },
            { key: 'Mod-/', run: toggleComment },
            { key: 'Mod-=', run: () => (zoomRef.current(1), true) },
            { key: 'Mod-+', run: () => (zoomRef.current(1), true) },
            { key: 'Mod--', run: () => (zoomRef.current(-1), true) },
            ...closeBracketsKeymap,
            ...completionKeymap,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString())
            if (u.selectionSet || u.docChanged) {
              const head = u.state.selection.main.head
              const line = u.state.doc.lineAt(head)
              setPos({ line: line.number, col: head - line.from + 1 })
            }
          }),
          EditorView.domEventHandlers({
            wheel(e) {
              if (!e.ctrlKey && !e.metaKey) return false
              e.preventDefault()
              zoomRef.current(e.deltaY < 0 ? 1 : -1)
              return true
            },
          }),
          EditorView.contentAttributes.of({ 'aria-label': `Seu código em ${LANG_NAME[lang]}`, spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
        ],
      }),
    })
    view.current = v
    return () => {
      v.destroy()
      view.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Valor trocado por fora (outra tarefa, código novo)
  useEffect(() => {
    const v = view.current
    if (v && value !== v.state.doc.toString()) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } })
  }, [value])

  useEffect(() => {
    view.current?.dispatch({ effects: langComp.current.reconfigure(langExt(lang)) })
  }, [lang])
  useEffect(() => {
    view.current?.dispatch({ effects: roComp.current.reconfigure(EditorState.readOnly.of(readOnly)) })
  }, [readOnly])

  // Linha apontada pela Mendi
  useEffect(() => {
    const v = view.current
    if (!v) return
    const ok = hl && hl <= v.state.doc.lines
    v.dispatch({ effects: [setFocusLine.of(ok ? hl! : null), ...(ok ? [EditorView.scrollIntoView(v.state.doc.line(hl!).from, { y: 'center' })] : [])] })
  }, [hl, value])
  useEffect(() => {
    view.current?.dispatch({ effects: setSteps.of({ markers: markers ?? new Map(), on: hl }) })
  }, [markers, hl, value])

  useEffect(() => {
    view.current?.requestMeasure()
  }, [size, full])

  const height = full ? 'h-[calc(100dvh-92px)]' : tall ? 'h-[460px]' : 'h-[420px]'
  return (
    <div className={`flex min-w-0 flex-col bg-[#16181d] ${bare ? '' : 'overflow-hidden rounded-2xl shadow-inner'}`}>
      <div ref={host} className={`min-h-0 min-w-0 ${height}`} style={{ ['--code-size' as string]: `${size}px` }} />
      <div className="flex items-center gap-3 border-t border-white/5 bg-[#1d2027] px-3 py-1 font-mono text-[11px] text-[#8a93a8] select-none">
        <span>
          Ln {pos.line}, Col {pos.col}
        </span>
        <span className="hidden sm:inline">{LANG_NAME[lang]}</span>
        <span className="hidden text-[#596071] md:inline">Tab completa · Ctrl+/ comenta · Ctrl+Espaço sugere</span>
        <span className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => zoom(-1)} className="grid h-5 w-5 place-items-center rounded hover:bg-white/10 hover:text-white" title="Diminuir (Ctrl -)">
            <Minus size={12} />
          </button>
          <span className="w-9 text-center">{Math.round((size / 14) * 100)}%</span>
          <button type="button" onClick={() => zoom(1)} className="grid h-5 w-5 place-items-center rounded hover:bg-white/10 hover:text-white" title="Aumentar (Ctrl +)">
            <Plus size={12} />
          </button>
        </span>
      </div>
    </div>
  )
}
