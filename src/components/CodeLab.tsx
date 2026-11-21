import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bot, CheckCircle2, Code2, FileCode2, Lock, MessageSquareReply, Wand2, Eye, Lightbulb, Loader2, MessageCircleQuestion, Play, Send, Sparkles, Trash2, XCircle } from 'lucide-react'
import { db, uid } from '../db/db'
import type { CodeChallenge } from '../db/types'
import { AIError, getAI } from '../lib/ai'
import { centerOf, confetti, playSfx } from '../lib/sfx'
import { showMascot } from '../lib/mascotBus'
import { askConfirm } from './confirm'
import { Capybara } from './Capybara'
import { Btn, Card } from './ui'
import { Fx } from './Fx'

type Lang = CodeChallenge['lang']
const LANG_NAME: Record<Lang, string> = { python: 'Python', javascript: 'JavaScript' }
const LEVELS = ['Bem fácil', 'Fácil', 'Médio']
const TOPICS = ['Qualquer', 'Variáveis e contas', 'Condições (if)', 'Laços (for/while)', 'Listas', 'Textos', 'Funções']

const LANG_KEY = 'mendonca-code-lang'
const CHAT_KEY = 'mendonca-code-chat'
const load = <T,>(k: string, def: T): T => {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : def
  } catch {
    return def
  }
}
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* sem armazenamento */
  }
}

/* ---------------- Prompts ---------------- */

const challengePrompt = (lang: Lang, level: string, topic: string, avoid: string[]) => `Você cria desafios curtos de LÓGICA DE PROGRAMAÇÃO para alguém que está começando a programar agora.
Linguagem: ${LANG_NAME[lang]}. Nível: ${level}. Tema: ${topic === 'Qualquer' ? 'qualquer tema básico' : topic}.
${avoid.length ? `Não repita estes desafios: ${avoid.slice(0, 15).join('; ')}.` : ''}
Regras:
- Simples e divertido, com contexto do dia a dia (escola, futebol, lanche, jogo...). Nada de matemática pesada.
- Resolve-se em 3 a 15 linhas, sem bibliotecas. O aluno escreve UMA função que recebe parâmetros e RETORNA o resultado (não imprime).
- Nome da função em ${lang === 'python' ? 'snake_case' : 'camelCase'}, em português sem acento.
- "Bem fácil" = uma conta ou um if. "Fácil" = if/else ou um laço simples. "Médio" = laço com condição, listas ou textos.
Responda SOMENTE com JSON:
{"titulo":"curto","enunciado":"2 a 4 frases explicando o que a função recebe e o que deve retornar","funcao":"nome_da_funcao","exemplos":[{"entrada":"chamada da função","saida":"resultado"}],"dica":"uma pista que não entrega a resposta","codigoInicial":"só a assinatura da função com um comentário dentro, pronta para completar","solucao":"código completo e simples da resposta","testes":[{"args":[valores],"esperado":valor}]}
Dê 2 exemplos e de 4 a 6 testes (inclua casos de borda). Os testes usam só valores JSON (números, textos, listas, true/false).`

const reviewPrompt = (c: CodeChallenge, code: string, ran: string) => `Você é a Mendi, uma tutora de programação paciente e animada, ajudando um iniciante.
Desafio (${LANG_NAME[c.lang]}): ${c.title}
${c.statement}
Exemplos: ${c.examples.map((e) => `${e.input} → ${e.output}`).join(' | ')}

Código do aluno:
\`\`\`
${code}
\`\`\`
${ran ? `Resultado real dos testes ao rodar o código:\n${ran}\n` : ''}
Avalie se o código resolve o desafio para todos os casos (inclusive os de borda). Se estiver errado, mostre ONDE está o problema e dê uma pista, mas NÃO entregue o código da resposta. Elogie o que estiver bom. Português simples, frases curtas.
Responda SOMENTE com JSON: {"correto":true,"resumo":"1 frase","pontos":["até 3 observações curtas"],"proximoPasso":"uma dica ou melhoria curta"}`

const chatPrompt = (lang: Lang, history: Msg[], q: string) => `Você é a Mendi, uma coruja tutora de programação. O aluno está começando a programar agora (prefere ${LANG_NAME[lang]}).
Explique como para um iniciante: português simples, frases curtas, um exemplo pequeno de código em bloco \`\`\` quando ajudar. Sem enrolação. Se ele pedir para você fazer o exercício dele, guie com pistas em vez de entregar tudo.

${history
  .slice(-10)
  .map((m) => `${m.role === 'user' ? 'Aluno' : 'Mendi'}: ${m.text}`)
  .join('\n\n')}

Aluno: ${q}

Mendi:`

/* ---------------- Rodar JavaScript ---------------- */

type RunResult = { logs: string[]; results: { label: string; ok: boolean; got: string; expected: string }[]; error?: string }

const WORKER = `
const fmt = (v) => typeof v === 'string' ? v : (() => { try { return JSON.stringify(v) } catch { return String(v) } })()
const show = (v) => { try { return JSON.stringify(v) } catch { return String(v) } }
self.onmessage = (e) => {
  const { code, fn, tests } = e.data
  const logs = []
  const log = (...a) => { if (logs.length < 200) logs.push(a.map(fmt).join(' ')) }
  const results = []
  let error
  try {
    const f = new Function('console', code + '\\n;return ' + (fn ? 'typeof ' + fn + " === 'function' ? " + fn + ' : undefined' : 'undefined'))({ log, error: log, warn: log, info: log })
    if (fn && !f) error = 'Não achei a função ' + fn + '. Confira o nome.'
    if (f && tests) for (const t of tests) {
      const label = fn + '(' + t.args.map(show).join(', ') + ')'
      try { const got = f(...t.args); results.push({ label, ok: show(got) === show(t.expected), got: show(got), expected: show(t.expected) }) }
      catch (err) { results.push({ label, ok: false, got: 'Erro: ' + err.message, expected: show(t.expected) }) }
    }
  } catch (err) { error = (err && err.name ? err.name + ': ' : '') + (err && err.message) }
  self.postMessage({ logs, results, error })
}`

function runJS(code: string, fn?: string, tests?: CodeChallenge['tests']): Promise<RunResult> {
  const safeFn = fn && /^[A-Za-z_$][\w$]*$/.test(fn) ? fn : undefined
  return new Promise((resolve) => {
    let w: Worker
    try {
      w = new Worker(URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' })))
    } catch {
      resolve({ logs: [], results: [], error: 'Não consegui rodar o código aqui. Envie para a Mendi corrigir.' })
      return
    }
    const timer = window.setTimeout(() => {
      w.terminate()
      resolve({ logs: [], results: [], error: 'Demorou demais. Será que tem um laço que nunca termina?' })
    }, 3000)
    w.onmessage = (e) => {
      window.clearTimeout(timer)
      w.terminate()
      resolve(e.data as RunResult)
    }
    w.onerror = (e) => {
      window.clearTimeout(timer)
      w.terminate()
      resolve({ logs: [], results: [], error: e.message || 'Erro ao rodar.' })
    }
    w.postMessage({ code, fn: safeFn, tests: tests ?? [] })
  })
}

/* ---------------- Editor ---------------- */

/** Editor simples: números de linha, Tab = 4 espaços e Enter mantendo a indentação. */
const LINE_H = 21.6
function CodeEditor({ value, onChange, lang, highlight, tall = false }: { value: string; onChange: (v: string) => void; lang: Lang; highlight?: number; tall?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const gutter = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState(0)
  const lines = value.split('\n').length

  // Linha apontada pela Mendi: rola até ela
  useEffect(() => {
    const el = ref.current
    if (!el || !highlight) return
    const y = (highlight - 1) * LINE_H
    if (y < el.scrollTop || y > el.scrollTop + el.clientHeight - 40) el.scrollTop = Math.max(0, y - 60)
  }, [highlight])

  const insert = (text: string, back = 0) => {
    const el = ref.current!
    const { selectionStart: a, selectionEnd: b } = el
    el.setRangeText(text, a, b, 'end')
    el.selectionStart = el.selectionEnd = a + text.length - back
    onChange(el.value)
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    if (e.key === 'Tab') {
      e.preventDefault()
      insert('    ')
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const before = el.value.slice(0, el.selectionStart)
      const line = before.slice(before.lastIndexOf('\n') + 1)
      let indent = line.match(/^\s*/)![0]
      if (/[:{[(]\s*$/.test(line)) indent += '    '
      insert('\n' + indent)
    }
  }

  return (
    <div className={`relative flex overflow-hidden rounded-2xl bg-[#16181d] font-mono text-[13.5px] leading-[1.6] shadow-inner ${tall ? 'h-[520px]' : 'max-h-[460px] min-h-[260px]'}`}>
      {highlight ? <div className="cl-hl pointer-events-none absolute inset-x-0 z-0 bg-[#ffd34d]/15 shadow-[inset_3px_0_0_#ffd34d]" style={{ top: 12 + (highlight - 1) * LINE_H - scroll, height: LINE_H }} /> : null}
      <div ref={gutter} className="relative z-10 shrink-0 overflow-hidden bg-[#1d2027] py-3 pr-2 pl-3 text-right text-[#596071] select-none" aria-hidden>
        {Array.from({ length: Math.max(lines, tall ? 24 : 12) }, (_, i) => (
          <div key={i} className={highlight === i + 1 ? 'font-bold text-[#ffd34d]' : undefined}>
            {i + 1}
          </div>
        ))}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        onScroll={(e) => {
          const t = e.currentTarget.scrollTop
          if (gutter.current) gutter.current.scrollTop = t
          setScroll(t)
        }}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label={`Seu código em ${LANG_NAME[lang]}`}
        className="thin-scroll relative z-10 h-full min-h-[260px] w-full resize-none bg-transparent px-3 py-3 whitespace-pre text-[#e6e9f2] caret-[#7ef0b5] outline-none"
        style={{ tabSize: 4 }}
      />
    </div>
  )
}

/* ---------------- Texto com blocos de código ---------------- */

function RichText({ text }: { text: string }) {
  const parts = text.split(/```[\w+-]*\n?([\s\S]*?)(?:```|$)/g)
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {parts.map((p, i) =>
        i % 2 ? (
          <pre key={i} className="thin-scroll overflow-x-auto rounded-xl bg-[#16181d] px-3.5 py-3 font-mono text-[12.5px] leading-[1.55] text-[#e6e9f2]">
            {p.replace(/\n$/, '')}
          </pre>
        ) : (
          p.trim() && (
            <p key={i} className="whitespace-pre-wrap">
              {p
                .trim()
                .split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
                .map((s, k) =>
                  s.startsWith('`') && s.endsWith('`') ? (
                    <code key={k} className="rounded-md bg-[#eef0f6] px-1.5 py-0.5 font-mono text-[12.5px] text-[#c9273b]">
                      {s.slice(1, -1)}
                    </code>
                  ) : s.startsWith('**') && s.endsWith('**') ? (
                    <strong key={k}>{s.slice(2, -2)}</strong>
                  ) : (
                    s
                  ),
                )}
            </p>
          )
        ),
      )}
    </div>
  )
}

/* ---------------- Peças ---------------- */

function Seg<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex gap-1 rounded-2xl bg-[#f1f2f5] p-1 text-sm font-bold">
      {items.map((it) => (
        <button key={it.id} onClick={() => onChange(it.id)} className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 transition ${value === it.id ? 'bg-white text-[#0f8a63] shadow-sm' : 'text-muted hover:text-ink'}`}>
          {it.label}
        </button>
      ))}
    </div>
  )
}
const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-xs font-bold transition ${on ? 'bg-[#0f8a63] text-white shadow-[0_6px_12px_-6px_#0f8a63]' : 'bg-[#f1f2f5] text-slate-600 hover:bg-[#e6f7f0]'}`

/* ---------------- Principal ---------------- */

export function CodeLab() {
  const [tab, setTab] = useState<'desafio' | 'meu' | 'duvidas'>('desafio')
  const [lang, setLangState] = useState<Lang>(() => load<Lang>(LANG_KEY, 'python'))
  const setLang = (l: Lang) => {
    setLangState(l)
    save(LANG_KEY, l)
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Seg
          value={tab}
          onChange={setTab}
          items={[
            { id: 'desafio', label: <><Code2 size={15} /> Desafios</> },
            { id: 'meu', label: <><FileCode2 size={15} /> Meu código</> },
            { id: 'duvidas', label: <><MessageCircleQuestion size={15} /> Tirar dúvida</> },
          ]}
        />
        <Seg value={lang} onChange={setLang} items={[{ id: 'python', label: 'Python' }, { id: 'javascript', label: 'JavaScript' }]} />
      </div>
      {tab === 'desafio' ? <Challenges lang={lang} /> : tab === 'meu' ? <Mentor lang={lang} /> : <Doubts lang={lang} />}
    </div>
  )
}

/* ---------------- Desafios ---------------- */

function Challenges({ lang }: { lang: Lang }) {
  const history = useLiveQuery(() => db.code.orderBy('createdAt').reverse().toArray(), [], [])
  const [level, setLevel] = useState(LEVELS[0])
  const [topic, setTopic] = useState(TOPICS[0])
  const [cur, setCur] = useState<CodeChallenge | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState<'' | 'novo' | 'rodar' | 'enviar' | 'solucao'>('')
  const [error, setError] = useState('')
  const [run, setRun] = useState<RunResult | null>(null)
  const [review, setReview] = useState<{ correto: boolean; resumo: string; pontos: string[]; proximoPasso: string } | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const solved = history.filter((h) => h.solved).length

  const open = (c: CodeChallenge) => {
    setCur(c)
    setCode(c.code)
    setRun(null)
    setReview(null)
    setShowHint(false)
    setShowSolution(false)
    setError('')
  }

  const create = async () => {
    setLoading('novo')
    setError('')
    try {
      const ai = await getAI()
      if (!ai) throw new AIError('unavailable', 'O Claude não está disponível aqui. Abra o Mendonça pelo claude.ai.')
      const o = await ai.json<{ titulo?: string; enunciado?: string; funcao?: string; exemplos?: { entrada?: string; saida?: string }[]; dica?: string; codigoInicial?: string; solucao?: string; testes?: { args?: unknown[]; esperado?: unknown }[] }>(
        challengePrompt(lang, level, topic, history.filter((h) => h.lang === lang).map((h) => h.title)),
        { tier: 'quick', fresh: true },
      )
      if (!o?.titulo || !o.enunciado) throw new Error()
      const c: CodeChallenge = {
        id: uid(),
        createdAt: Date.now(),
        lang,
        level,
        title: String(o.titulo),
        statement: String(o.enunciado),
        examples: (o.exemplos ?? []).filter((e) => e?.entrada).map((e) => ({ input: String(e.entrada), output: String(e.saida ?? '') })),
        hint: o.dica ? String(o.dica) : undefined,
        solution: o.solucao ? String(o.solucao) : undefined,
        fn: o.funcao ? String(o.funcao) : undefined,
        tests: (o.testes ?? []).filter((t) => Array.isArray(t?.args)).map((t) => ({ args: t.args!, expected: t.esperado })),
        code: String(o.codigoInicial ?? ''),
        solved: false,
        attempts: 0,
      }
      await db.code.add(c)
      open(c)
      playSfx('pop')
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Não consegui criar um desafio agora. Tente de novo.')
    } finally {
      setLoading('')
    }
  }

  const persist = (patch: Partial<CodeChallenge>) => {
    if (!cur) return
    const next = { ...cur, ...patch }
    setCur(next)
    db.code.update(cur.id, patch)
  }

  const celebrate = () => {
    playSfx('ok')
    const [x, y] = centerOf(box.current)
    confetti(x, y, 70, ['#2fcf9b', '#ffd34d', '#ffffff', '#3e63f2'])
    showMascot({ pose: 'comemorando', title: 'Desafio resolvido!', text: 'Mandou bem demais! Bora pro próximo?', autoHideMs: 5000 })
  }

  const doRun = async () => {
    if (!cur) return
    setLoading('rodar')
    const r = await runJS(code, cur.fn, cur.tests)
    setRun(r)
    setLoading('')
    persist({ code })
    if (r.results.length && r.results.every((x) => x.ok) && !cur.solved) {
      persist({ code, solved: true })
      celebrate()
    }
  }

  const send = async () => {
    if (!cur || !code.trim()) return
    setLoading('enviar')
    setError('')
    try {
      let ran = ''
      if (cur.lang === 'javascript') {
        const r = await runJS(code, cur.fn, cur.tests)
        setRun(r)
        ran = r.error ? `Erro: ${r.error}` : r.results.map((x) => `${x.label} → ${x.got} (esperado ${x.expected}) ${x.ok ? 'OK' : 'ERRADO'}`).join('\n')
      }
      const ai = await getAI()
      if (!ai) throw new AIError('unavailable', 'O Claude não está disponível aqui. Abra o Mendonça pelo claude.ai.')
      const o = await ai.json<{ correto?: boolean; resumo?: string; pontos?: string[]; proximoPasso?: string }>(reviewPrompt(cur, code, ran), { fresh: true })
      const rv = { correto: !!o?.correto, resumo: String(o?.resumo ?? ''), pontos: Array.isArray(o?.pontos) ? o.pontos.map(String).slice(0, 3) : [], proximoPasso: String(o?.proximoPasso ?? '') }
      setReview(rv)
      const wasSolved = cur.solved
      persist({ code, attempts: cur.attempts + 1, solved: cur.solved || rv.correto, feedback: rv.resumo })
      if (rv.correto && !wasSolved) celebrate()
      else if (!rv.correto) playSfx('bad')
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Não consegui corrigir agora. Seu código continua aqui; tente de novo.')
    } finally {
      setLoading('')
    }
  }

  // Sem desafio aberto: escolher nível/tema e ver o histórico
  if (!cur)
    return (
      <div className="grid items-start gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="relative overflow-hidden p-6">
          <div className="flex items-start gap-4">
            <Capybara pose="focado" size={92} />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold">Desafio de lógica</h2>
              <p className="mt-1 text-sm text-muted">A Mendi inventa, você resolve em {LANG_NAME[lang]}.</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <div className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">Nível</div>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((l) => (
                  <button key={l} onClick={() => setLevel(l)} className={chip(level === l)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">Tema</div>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((t) => (
                  <button key={t} onClick={() => setTopic(t)} className={chip(topic === t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {error && <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p>}
          <button
            onClick={create}
            disabled={!!loading}
            className="act-btn mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-display text-base font-bold text-white disabled:opacity-70"
            style={{ background: 'linear-gradient(145deg, #2fcf9b, #0f8a63)', boxShadow: '0 12px 22px -12px #0f8a63' }}
          >
            {loading === 'novo' ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {loading === 'novo' ? 'Criando desafio…' : 'Novo desafio'}
          </button>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold">Seus desafios</h3>
            {history.length > 0 && (
              <span className="rounded-full bg-[#e6f7f0] px-2.5 py-1 text-xs font-bold text-[#0f8a63]">
                {solved} de {history.length} resolvidos
              </span>
            )}
          </div>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Nenhum ainda. O primeiro é o mais legal!</p>
          ) : (
            <div className="thin-scroll max-h-[420px] space-y-1.5 overflow-y-auto">
              {history.map((h) => (
                <div key={h.id} className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-[#f6f7f9]">
                  {h.solved ? <CheckCircle2 size={18} className="shrink-0 text-emerald-500" /> : <span className="h-[18px] w-[18px] shrink-0 rounded-full border-2 border-[#d6d9e2]" />}
                  <button onClick={() => open(h)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-semibold">{h.title}</div>
                    <div className="text-[11px] text-muted">
                      {LANG_NAME[h.lang]} · {h.level}
                    </div>
                  </button>
                  <button
                    onClick={async () => (await askConfirm('Apagar este desafio?')) && db.code.delete(h.id)}
                    className="rounded-lg p-1 text-muted opacity-0 transition group-hover:opacity-100 hover:text-rose-600"
                    title="Apagar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    )

  const isJS = cur.lang === 'javascript'
  return (
    <div ref={box} className="grid items-start gap-5 lg:grid-cols-[1fr_1.25fr]">
      {/* Enunciado */}
      <Card className="p-6">
        <button onClick={() => setCur(null)} className="mb-3 text-xs font-bold text-muted hover:text-ink">
          ← Desafios
        </button>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#e6f7f0] px-2.5 py-1 text-[11px] font-bold text-[#0f8a63]">
            {LANG_NAME[cur.lang]} · {cur.level}
          </span>
          {cur.solved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white">
              <CheckCircle2 size={12} /> Resolvido
            </span>
          )}
        </div>
        <h2 className="mt-3 text-xl font-bold">{cur.title}</h2>
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">{cur.statement}</p>
        {cur.examples.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="text-xs font-bold tracking-wider text-muted uppercase">Exemplos</div>
            {cur.examples.map((e, i) => (
              <div key={i} className="rounded-xl bg-[#16181d] px-3.5 py-2 font-mono text-[12.5px] text-[#e6e9f2]">
                {e.input} <span className="text-[#596071]">→</span> <span className="text-[#7ef0b5]">{e.output}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {cur.hint && (
            <Btn variant="soft" onClick={() => setShowHint((v) => !v)}>
              <Lightbulb size={16} /> Dica
            </Btn>
          )}
          {cur.solution && (
            <Btn
              onClick={async () => {
                if (showSolution) return setShowSolution(false)
                if (await askConfirm('Ver a solução? Vale tentar mais um pouquinho antes!', false, { title: 'Ver solução', yes: 'Ver mesmo assim', no: 'Vou tentar' })) setShowSolution(true)
              }}
            >
              <Eye size={16} /> Solução
            </Btn>
          )}
        </div>
        {showHint && cur.hint && <div className="capi-pop mt-3 rounded-2xl bg-[#fff6dc] px-4 py-3 text-sm font-semibold text-[#7a5a00]"><Fx name="bulb" /> {cur.hint}</div>}
        {showSolution && cur.solution && (
          <pre className="capi-pop thin-scroll mt-3 overflow-x-auto rounded-xl bg-[#16181d] px-3.5 py-3 font-mono text-[12.5px] leading-[1.55] text-[#e6e9f2]">{cur.solution}</pre>
        )}
      </Card>

      {/* Editor e resultado */}
      <div className="space-y-4">
        <CodeEditor value={code} onChange={setCode} lang={cur.lang} />
        <div className="flex flex-wrap gap-2">
          {isJS && (
            <button onClick={doRun} disabled={!!loading} className="act-btn inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ background: 'linear-gradient(145deg, #5b7cff, #2a3fb8)', boxShadow: '0 10px 18px -10px #2a3fb8' }}>
              {loading === 'rodar' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />} Rodar testes
            </button>
          )}
          <button onClick={send} disabled={!!loading || !code.trim()} className="act-btn inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ background: 'linear-gradient(145deg, #2fcf9b, #0f8a63)', boxShadow: '0 10px 18px -10px #0f8a63' }}>
            {loading === 'enviar' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {loading === 'enviar' ? 'A Mendi está lendo…' : 'Enviar pra Mendi'}
          </button>
        </div>
        {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}

        {run && (
          <Card className="p-4">
            <div className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">Testes</div>
            {run.error && <p className="rounded-xl bg-rose-50 px-3 py-2 font-mono text-[12.5px] text-rose-700">{run.error}</p>}
            <div className="space-y-1">
              {run.results.map((r, i) => (
                <div key={i} className="flex items-start gap-2 font-mono text-[12.5px]">
                  {r.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-rose-500" />}
                  <span className="min-w-0 break-all">
                    {r.label} → <b className={r.ok ? 'text-emerald-700' : 'text-rose-700'}>{r.got}</b>
                    {!r.ok && <span className="text-muted"> (esperado {r.expected})</span>}
                  </span>
                </div>
              ))}
            </div>
            {run.logs.length > 0 && (
              <pre className="thin-scroll mt-3 max-h-40 overflow-auto rounded-xl bg-[#16181d] px-3 py-2 font-mono text-[12px] text-[#c9cede]">{run.logs.join('\n')}</pre>
            )}
          </Card>
        )}

        {review && (
          <Card className={`capi-pop p-5 ${review.correto ? 'ring-2 ring-emerald-200' : 'ring-2 ring-amber-200'}`}>
            <div className="flex items-start gap-3">
              <Capybara pose={review.correto ? 'comemorando' : 'pensando'} size={64} />
              <div className="min-w-0 flex-1">
                <div className={`font-bold ${review.correto ? 'text-emerald-700' : 'text-amber-700'}`}>{review.correto ? 'Resolvido!' : 'Quase lá'}</div>
                <p className="mt-0.5 text-sm text-slate-700">{review.resumo}</p>
              </div>
            </div>
            {review.pontos.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {review.pontos.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0f8a63]" />
                    <RichText text={p} />
                  </li>
                ))}
              </ul>
            )}
            {review.proximoPasso && <div className="mt-3 rounded-xl bg-[#f6f7f9] px-3.5 py-2.5 text-sm"><Fx name="point" /> {review.proximoPasso}</div>}
            {review.correto && (
              <Btn variant="primary" className="mt-4" onClick={() => setCur(null)}>
                Próximo desafio
              </Btn>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}

/* ---------------- Dúvidas ---------------- */

type Msg = { role: 'user' | 'capi'; text: string }
const STARTERS = ['O que é uma variável?', 'Qual a diferença entre if e else?', 'Como funciona um for?', 'O que é uma função?']

function Doubts({ lang }: { lang: Lang }) {
  const [msgs, setMsgs] = useState<Msg[]>(() => load<Msg[]>(CHAT_KEY, []))
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState('')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    save(CHAT_KEY, msgs.slice(-40))
  }, [msgs])
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [msgs, live])

  const ask = async (text: string) => {
    const t = text.trim()
    if (!t || busy) return
    const history = msgs
    setMsgs([...history, { role: 'user', text: t }])
    setQ('')
    setBusy(true)
    setLive('')
    try {
      const ai = await getAI()
      if (!ai) throw new AIError('unavailable', 'O Claude não está disponível aqui. Abra o Mendonça pelo claude.ai.')
      const out = await ai.text(chatPrompt(lang, history, t), { fresh: true, onText: setLive })
      setMsgs((m) => [...m, { role: 'capi', text: out.trim() }])
    } catch (e) {
      setMsgs((m) => [...m, { role: 'capi', text: e instanceof AIError ? e.message : 'Ops, não consegui responder agora. Tenta de novo?' }])
    } finally {
      setBusy(false)
      setLive('')
    }
  }

  return (
    <Card className="flex h-[min(680px,calc(100vh-260px))] min-h-[440px] flex-col p-0">
      <div className="thin-scroll flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {msgs.length === 0 && !busy && (
          <div className="flex flex-col items-center py-6 text-center">
            <Capybara pose="estudando" size={110} />
            <p className="mt-2 font-bold">Pergunta qualquer coisa de programação.</p>
            <p className="text-sm text-muted">Pode colar seu código também.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => ask(s)} className={chip(false)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#0f8a63] px-4 py-2.5 text-sm whitespace-pre-wrap text-white">{m.text}</div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e6f7f0] text-[#0f8a63]">
                <Bot size={17} />
              </span>
              <div className="max-w-[85%] min-w-0 rounded-2xl rounded-tl-md bg-[#f6f7f9] px-4 py-3">
                <RichText text={m.text} />
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="flex items-start gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e6f7f0] text-[#0f8a63]">
              <Bot size={17} />
            </span>
            <div className="max-w-[85%] min-w-0 rounded-2xl rounded-tl-md bg-[#f6f7f9] px-4 py-3">{live ? <RichText text={live} /> : <Loader2 size={16} className="animate-spin text-muted" />}</div>
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="flex items-end gap-2 border-t border-line p-3">
        {msgs.length > 0 && (
          <button onClick={() => setMsgs([])} className="rounded-xl p-2.5 text-muted hover:bg-[#f6f7f9] hover:text-ink" title="Limpar conversa">
            <Trash2 size={17} />
          </button>
        )}
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              ask(q)
            }
          }}
          rows={Math.min(6, Math.max(1, q.split('\n').length))}
          placeholder="Sua dúvida… (Shift+Enter pula linha)"
          className="thin-scroll max-h-40 flex-1 resize-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0f8a63]"
        />
        <button onClick={() => ask(q)} disabled={busy || !q.trim()} className="act-btn grid h-11 w-11 place-items-center rounded-xl text-white disabled:opacity-50" style={{ background: 'linear-gradient(145deg, #2fcf9b, #0f8a63)' }} aria-label="Enviar">
          <Send size={17} />
        </button>
      </div>
    </Card>
  )
}

/* ---------------- Meu código: a Mendi como mentora ---------------- */

type Step = { line: number; kind: 'pergunta' | 'sugestao' | 'erro' | 'elogio'; text: string; hint: string; piece: string; marker: number }
type Mentoring = { summary: string; capiCode: string; steps: Step[] }
const MENTOR_KEY = 'mendonca-code-mentor'

const numbered = (code: string) =>
  code
    .split('\n')
    .map((l, i) => `${String(i + 1).padStart(2, ' ')}| ${l}`)
    .join('\n')

const mentorPrompt = (lang: Lang, code: string, goal: string, doubt: string) => `Você é a Mendi, mentora de programação de alguém que está começando. Seu jeito: um professor sentado do lado, que faz o aluno PENSAR. Nunca entregue a resposta pronta de mão beijada.
Linguagem: ${LANG_NAME[lang]}.
O que o código deve fazer: ${goal.trim() || '(o aluno não disse; deduza pelo código)'}
${doubt.trim() ? `Dúvida do aluno: ${doubt.trim()}` : ''}

Código do aluno (com número das linhas):
${numbered(code)}

Monte:
1) "codigoCapi": a MELHOR versão desse código (simples, limpa, do jeito que um iniciante entende), mas com os trechos-chave que o aluno precisa descobrir trocados por marcadores [[1]], [[2]]... (de 1 a 4 marcadores). O resto do código aparece normal.
2) "passos": de 2 a 5 orientações, em ordem, cada uma apontando para uma linha do código DO ALUNO. Escreva como perguntas ou sugestões que guiam, por exemplo: "Na linha 3, por que usar while aqui? Um for não deixaria mais simples?", "Essa variável na linha 5 muda em algum momento?", "E se a lista vier vazia?". Inclua um elogio se algo estiver bom.
Cada passo pode estar ligado a um marcador do codigoCapi (o trecho que vai nele).
Responda SOMENTE com JSON:
{"resumo":"1 ou 2 frases: o que o código faz e como está","codigoCapi":"...","passos":[{"linha":3,"tipo":"pergunta|sugestao|erro|elogio","texto":"a pergunta/sugestão curta","pista":"uma dica a mais, se ele travar (sem dar o código)","marcador":1,"trecho":"o código exato que vai no marcador 1 (vazio se não tiver marcador)"}]}`

const followPrompt = (lang: Lang, code: string, goal: string, m: Mentoring | null, history: Msg[], q: string) => `Você é a Mendi, mentora de programação de um iniciante (${LANG_NAME[lang]}). Guie com perguntas e dicas curtas; não entregue o código completo. Se ele acertar, comemore e aponte o próximo passo.
Objetivo: ${goal.trim() || '(não informado)'}
Código atual do aluno:
${numbered(code)}
${m ? `Sua análise anterior: ${m.summary}\nOrientações: ${m.steps.map((s) => `linha ${s.line}: ${s.text}`).join(' | ')}` : ''}

${history
  .slice(-8)
  .map((x) => `${x.role === 'user' ? 'Aluno' : 'Mendi'}: ${x.text}`)
  .join('\n\n')}

Aluno: ${q}

Mendi:`

const KIND: Record<Step['kind'], { label: string; cls: string }> = {
  pergunta: { label: 'Pensa aqui', cls: 'bg-[#eef2ff] text-[#3e63f2]' },
  sugestao: { label: 'Sugestão', cls: 'bg-[#e6f7f0] text-[#0f8a63]' },
  erro: { label: 'Olha isso', cls: 'bg-rose-50 text-rose-600' },
  elogio: { label: 'Mandou bem', cls: 'bg-amber-50 text-amber-700' },
}

/** Código da Mendi com os trechos escondidos ([[n]]) virando cadeados até você revelar. */
function CapiCode({ code, steps, open }: { code: string; steps: Step[]; open: Set<number> }) {
  const parts = code.split(/\[\[(\d+)\]\]/g)
  return (
    <pre className="thin-scroll max-h-[300px] overflow-auto rounded-2xl bg-[#16181d] px-4 py-3 font-mono text-[13px] leading-[1.65] text-[#e6e9f2]">
      {parts.map((p, i) => {
        if (i % 2 === 0) return <span key={i}>{p}</span>
        const n = Number(p)
        const piece = steps.find((s) => s.marker === n)?.piece
        return open.has(n) && piece ? (
          <span key={i} className="capi-pop rounded bg-[#7ef0b5]/15 px-0.5 text-[#7ef0b5]">
            {piece}
          </span>
        ) : (
          <span key={i} className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-[#ffd34d]/20 px-1.5 align-middle text-[11px] font-bold text-[#ffd34d]">
            <Lock size={10} /> {n}
          </span>
        )
      })}
    </pre>
  )
}

function Mentor({ lang }: { lang: Lang }) {
  const saved = load<{ code: string; goal: string; result: Mentoring | null }>(`${MENTOR_KEY}-${lang}`, { code: '', goal: '', result: null })
  const [code, setCode] = useState(saved.code)
  const [goal, setGoal] = useState(saved.goal)
  const [doubt, setDoubt] = useState('')
  const [result, setResult] = useState<Mentoring | null>(saved.result)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [focus, setFocus] = useState<number | undefined>()
  const [opened, setOpened] = useState<Set<number>>(new Set())
  const [hints, setHints] = useState<Set<number>>(new Set())
  const [chat, setChat] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [live, setLive] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [run, setRun] = useState<RunResult | null>(null)

  useEffect(() => {
    save(`${MENTOR_KEY}-${lang}`, { code, goal, result })
  }, [code, goal, result, lang])

  const analyze = async () => {
    if (!code.trim()) return
    setBusy(true)
    setError('')
    try {
      const ai = await getAI()
      if (!ai) throw new AIError('unavailable', 'O Claude não está disponível aqui. Abra o Mendonça pelo claude.ai.')
      const o = await ai.json<{ resumo?: string; codigoCapi?: string; passos?: { linha?: number; tipo?: string; texto?: string; pista?: string; trecho?: string; marcador?: number }[] }>(mentorPrompt(lang, code, goal, doubt), { fresh: true })
      const steps: Step[] = (o?.passos ?? [])
        .filter((p) => p?.texto)
        .slice(0, 5)
        .map((p) => ({
          line: Math.max(0, Math.round(Number(p.linha) || 0)),
          kind: (['pergunta', 'sugestao', 'erro', 'elogio'].includes(String(p.tipo)) ? p.tipo : 'pergunta') as Step['kind'],
          text: String(p.texto),
          hint: String(p.pista ?? ''),
          piece: String(p.trecho ?? ''),
          marker: Math.round(Number(p.marcador) || 0),
        }))
      setResult({ summary: String(o?.resumo ?? ''), capiCode: String(o?.codigoCapi ?? ''), steps })
      setOpened(new Set())
      setHints(new Set())
      setChat([])
      setFocus(steps[0]?.line || undefined)
      setDoubt('')
      playSfx('pop')
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Não consegui analisar agora. Seu código continua aqui; tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const ask = async (text: string) => {
    const t = text.trim()
    if (!t || chatBusy) return
    const history = chat
    setChat([...history, { role: 'user', text: t }])
    setQ('')
    setChatBusy(true)
    setLive('')
    try {
      const ai = await getAI()
      if (!ai) throw new AIError('unavailable', 'O Claude não está disponível aqui. Abra o Mendonça pelo claude.ai.')
      const out = await ai.text(followPrompt(lang, code, goal, result, history, t), { fresh: true, onText: setLive })
      setChat((m) => [...m, { role: 'capi', text: out.trim() }])
    } catch (e) {
      setChat((m) => [...m, { role: 'capi', text: e instanceof AIError ? e.message : 'Ops, não consegui responder agora.' }])
    } finally {
      setChatBusy(false)
      setLive('')
    }
  }

  const toggle = (set: Set<number>, n: number) => {
    const s = new Set(set)
    if (s.has(n)) s.delete(n)
    else s.add(n)
    return s
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      {/* Esquerda: o código do aluno */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#16181d] px-3 py-1 text-xs font-bold text-white">Seu código</span>
          <span className="text-xs text-muted">{LANG_NAME[lang]}</span>
        </div>
        <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="O que esse código deve fazer? (opcional)" className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0f8a63]" />
        <CodeEditor value={code} onChange={setCode} lang={lang} highlight={focus} tall />
        <input
          value={doubt}
          onChange={(e) => setDoubt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && analyze()}
          placeholder="Alguma dúvida específica? (opcional)"
          className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0f8a63]"
        />
        <div className="flex flex-wrap gap-2">
          <button onClick={analyze} disabled={busy || !code.trim()} className="act-btn inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ background: 'linear-gradient(145deg, #2fcf9b, #0f8a63)', boxShadow: '0 10px 18px -10px #0f8a63' }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} {busy ? 'A Mendi está lendo…' : result ? 'Analisar de novo' : 'Pedir ajuda pra Mendi'}
          </button>
          {lang === 'javascript' && (
            <button
              onClick={async () => setRun(await runJS(code))}
              disabled={!code.trim()}
              className="act-btn inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(145deg, #5b7cff, #2a3fb8)', boxShadow: '0 10px 18px -10px #2a3fb8' }}
            >
              <Play size={16} fill="currentColor" /> Rodar
            </button>
          )}
        </div>
        {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
        {run && (
          <pre className="thin-scroll max-h-40 overflow-auto rounded-2xl bg-[#16181d] px-3.5 py-2.5 font-mono text-[12.5px] text-[#c9cede]">
            {run.error ? <span className="text-rose-300">{run.error}</span> : run.logs.length ? run.logs.join('\n') : '(nada foi impresso — use console.log)'}
          </pre>
        )}
      </div>

      {/* Direita: a Mendi guiando */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#0f8a63] px-3 py-1 text-xs font-bold text-white">Mendi</span>
          <span className="text-xs text-muted">guia passo a passo, sem entregar tudo</span>
        </div>
        {!result ? (
          <Card className="flex flex-col items-center px-6 py-12 text-center">
            <Capybara pose="estudando" size={110} />
            <p className="mt-2 font-bold">Escreva seu código do lado e me chama.</p>
            <p className="mt-1 max-w-sm text-sm text-muted">Eu monto a minha versão, mas escondo as partes importantes. Você vai descobrindo com as minhas perguntas.</p>
          </Card>
        ) : (
          <>
            {result.summary && (
              <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
                <Capybara pose="pensando" size={52} />
                <p className="text-sm text-slate-700">{result.summary}</p>
              </div>
            )}
            {result.capiCode && <CapiCode code={result.capiCode} steps={result.steps} open={opened} />}

            <div className="space-y-2">
              {result.steps.map((s, i) => {
                const k = KIND[s.kind]
                const active = focus === s.line && s.line > 0
                return (
                  <div
                    key={i}
                    onClick={() => s.line && setFocus(s.line)}
                    className={`capi-pop cursor-pointer rounded-2xl bg-white p-4 shadow-sm ring-1 transition ${active ? 'ring-2 ring-[#ffd34d]' : 'ring-line hover:ring-[#0f8a63]/40'}`}
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-[#16181d] text-[11px] font-bold text-white">{i + 1}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${k.cls}`}>{k.label}</span>
                      {s.line > 0 && <span className="rounded-full bg-[#fff6dc] px-2 py-0.5 font-mono text-[11px] font-bold text-[#7a5a00]">linha {s.line}</span>}
                    </div>
                    <div className="text-sm text-slate-800">
                      <RichText text={s.text} />
                    </div>
                    {hints.has(i) && s.hint && (
                      <div className="capi-pop mt-2 rounded-xl bg-[#fff6dc] px-3 py-2 text-sm text-[#7a5a00]">
                        <RichText text={s.hint} />
                      </div>
                    )}
                    <div className="mt-2.5 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {s.hint && (
                        <button onClick={() => setHints((h) => toggle(h, i))} className={chip(hints.has(i))}>
                          <Lightbulb size={12} className="mr-1 inline" /> Dica
                        </button>
                      )}
                      {s.marker > 0 && s.piece && (
                        <button
                          onClick={async () => {
                            if (!opened.has(s.marker) && !hints.has(i) && s.hint && !(await askConfirm('Tenta a dica antes? Descobrir sozinho fixa muito mais.', false, { title: 'Revelar o trecho', yes: 'Revelar mesmo assim', no: 'Ver a dica' }))) {
                              setHints((h) => new Set(h).add(i))
                              return
                            }
                            setOpened((o) => toggle(o, s.marker))
                          }}
                          className={chip(opened.has(s.marker))}
                        >
                          <Lock size={12} className="mr-1 inline" /> {opened.has(s.marker) ? 'Esconder' : `Revelar trecho ${s.marker}`}
                        </button>
                      )}
                      <button onClick={() => setQ(`Sobre o passo ${i + 1}: `)} className={chip(false)}>
                        <MessageSquareReply size={12} className="mr-1 inline" /> Responder
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* conversa sobre o código */}
            <Card className="p-0">
              {(chat.length > 0 || chatBusy) && (
                <div className="thin-scroll max-h-[320px] space-y-3 overflow-y-auto px-4 pt-4">
                  {chat.map((m, i) =>
                    m.role === 'user' ? (
                      <div key={i} className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#0f8a63] px-3.5 py-2 text-sm whitespace-pre-wrap text-white">{m.text}</div>
                      </div>
                    ) : (
                      <div key={i} className="max-w-[92%] rounded-2xl rounded-tl-md bg-[#f6f7f9] px-3.5 py-2.5">
                        <RichText text={m.text} />
                      </div>
                    ),
                  )}
                  {chatBusy && <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-[#f6f7f9] px-3.5 py-2.5">{live ? <RichText text={live} /> : <Loader2 size={16} className="animate-spin text-muted" />}</div>}
                </div>
              )}
              <div className="flex items-end gap-2 p-3">
                <textarea
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      ask(q)
                    }
                  }}
                  rows={Math.min(5, Math.max(1, q.split('\n').length))}
                  placeholder="Responda a Mendi ou pergunte algo sobre o código…"
                  className="thin-scroll max-h-32 flex-1 resize-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0f8a63]"
                />
                <button onClick={() => ask(q)} disabled={chatBusy || !q.trim()} className="act-btn grid h-11 w-11 place-items-center rounded-xl text-white disabled:opacity-50" style={{ background: 'linear-gradient(145deg, #2fcf9b, #0f8a63)' }} aria-label="Enviar">
                  <Send size={17} />
                </button>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
