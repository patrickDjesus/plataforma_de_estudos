import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Box, Braces, Brackets, CheckCircle2, Dices, Eye, GitBranch, Lightbulb, Loader2, Lock, Play, Repeat, Send, Sparkles, Trash2, Type, Wand2, XCircle } from 'lucide-react'
import { db, uid } from '../db/db'
import type { CodeChallenge } from '../db/types'
import { AIError, getAI } from '../lib/ai'
import { centerOf, confetti, playSfx } from '../lib/sfx'
import { showMascot } from '../lib/mascotBus'
import { askConfirm } from './confirm'
import { Capybara, type CapiPose } from './Capybara'
import { Card } from './ui'
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
function CodeEditor({ value, onChange, lang, highlight, tall = false, bare = false, markers, onMarker }: { value: string; onChange: (v: string) => void; lang: Lang; highlight?: number; tall?: boolean; bare?: boolean; markers?: Map<number, number>; onMarker?: (step: number) => void }) {
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
    <div className={`relative flex overflow-hidden bg-[#16181d] font-mono text-[13.5px] leading-[1.6] ${bare ? '' : 'rounded-2xl shadow-inner'} ${tall ? 'h-[460px]' : 'max-h-[460px] min-h-[260px]'}`}>
      {highlight ? <div className="cl-hl pointer-events-none absolute inset-x-0 z-0 bg-[#ffd34d]/15 shadow-[inset_3px_0_0_#ffd34d]" style={{ top: 12 + (highlight - 1) * LINE_H - scroll, height: LINE_H }} /> : null}
      <div ref={gutter} className="relative z-10 w-11 shrink-0 overflow-hidden bg-[#1d2027] py-3 pr-2 pl-2 text-right text-[#596071] select-none">
        {Array.from({ length: Math.max(lines, tall ? 24 : 12) }, (_, i) => {
          const step = markers?.get(i + 1)
          return step !== undefined ? (
            <button
              key={i}
              type="button"
              onClick={() => onMarker?.(step)}
              style={{ height: LINE_H }}
              className={`ml-auto grid w-[18px] place-items-center rounded-full text-[10px] font-extrabold transition ${highlight === i + 1 ? 'bg-[#ffd34d] text-[#16181d]' : 'bg-[#ffd34d]/25 text-[#ffd34d] hover:bg-[#ffd34d]/50'}`}
              title="Ver comentário da Mendi"
            >
              {step + 1}
            </button>
          ) : (
            <div key={i} className={highlight === i + 1 ? 'font-bold text-[#ffd34d]' : undefined}>
              {i + 1}
            </div>
          )
        })}
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

/* ---------------- Principal ---------------- */

export function CodeLab() {
  const [tab, setTab] = useState<'desafio' | 'meu' | 'duvidas'>('desafio')
  const [lang, setLangState] = useState<Lang>(() => load<Lang>(LANG_KEY, 'python'))
  const setLang = (l: Lang) => {
    setLangState(l)
    save(LANG_KEY, l)
  }
  const doors: { id: typeof tab; title: string; text: string; art: ReactNode; ring: string }[] = [
    { id: 'desafio', title: 'Desafios', text: 'A Mendi inventa um problema de lógica e você resolve.', art: <DoorChallenge />, ring: '#0f8a63' },
    { id: 'meu', title: 'Meu código', text: 'Cole o seu código e a Mendi aponta o que melhorar.', art: <DoorMine />, ring: '#3e63f2' },
    { id: 'duvidas', title: 'Dúvidas', text: 'Pergunta qualquer coisa de programação.', art: <DoorDoubts />, ring: '#e08a00' },
  ]
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {doors.map((d) => {
          const on = tab === d.id
          return (
            <button
              key={d.id}
              onClick={() => setTab(d.id)}
              aria-pressed={on}
              className="cl-door flex flex-col items-start gap-2.5 rounded-[22px] border-2 bg-white p-5 text-left"
              style={{ borderColor: on ? d.ring : '#e6e8ee', boxShadow: on ? `0 14px 26px -18px ${d.ring}` : undefined }}
            >
              {d.art}
              <span className="font-display text-[19px] font-extrabold">{d.title}</span>
              <span className="text-[13px] leading-snug text-slate-600">{d.text}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col rounded-[22px] border border-line bg-white p-4 sm:p-5" style={{ minHeight: 'max(520px, calc(100vh - 520px))' }}>
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <span className="mr-1 text-xs font-bold text-muted">Linguagem</span>
          {(['python', 'javascript'] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className="flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-sm font-bold transition"
              style={lang === l ? { borderColor: l === 'python' ? '#306998' : '#c9b400', background: l === 'python' ? '#eef5fb' : '#fffbe0', color: l === 'python' ? '#306998' : '#6b5e00' } : { borderColor: '#e6e8ee', color: '#6b7280' }}
            >
              {l === 'python' ? <PythonLogo /> : <JsLogo />}
              {LANG_NAME[l]}
            </button>
          ))}
        </div>
        <div key={tab} className="home-panel flex min-w-0 flex-1 flex-col">
          {tab === 'desafio' ? <Challenges lang={lang} /> : tab === 'meu' ? <Mentor lang={lang} /> : <Doubts lang={lang} />}
        </div>
      </div>
    </div>
  )
}

/* Logos das linguagens */
function PythonLogo({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M11.9 2c-5.1 0-4.8 2.2-4.8 2.2v2.3h4.9v.7H5.2S2 6.8 2 12s2.8 5 2.8 5h1.7v-2.4s-.1-2.8 2.8-2.8h4.8s2.7 0 2.7-2.6V4.6S17.2 2 11.9 2zM9.2 3.5a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8z" fill="#3776ab" />
      <path d="M12.1 22c5.1 0 4.8-2.2 4.8-2.2v-2.3H12v-.7h6.8S22 17.2 22 12s-2.8-5-2.8-5h-1.7v2.4s.1 2.8-2.8 2.8H9.9s-2.7 0-2.7 2.6v4.6S6.8 22 12.1 22zm2.7-1.5a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8z" fill="#ffd43b" />
    </svg>
  )
}
function JsLogo({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect width="24" height="24" rx="3" fill="#f7df1e" />
      <text x="21" y="20.5" textAnchor="end" fontFamily="Inter, Arial, sans-serif" fontSize="10.5" fontWeight="800" fill="#16181d">
        JS
      </text>
    </svg>
  )
}

/* Ilustrações das três portas (animam ao passar o mouse) */
function DoorChallenge() {
  return (
    <svg viewBox="0 0 80 80" width="72" height="72" aria-hidden="true" className="cl-art">
      <defs>
        <linearGradient id="cl-d-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3fdca0" /><stop offset="1" stopColor="#0f8a63" /></linearGradient>
        <linearGradient id="cl-d-pz" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#d9f7ec" /></linearGradient>
      </defs>
      <rect x="4" y="8" width="72" height="68" rx="20" fill="#0b6b4c" />
      <rect x="4" y="4" width="72" height="68" rx="20" fill="url(#cl-d-bg)" />
      <ellipse cx="26" cy="16" rx="16" ry="6" fill="#fff" opacity=".22" />
      <g className="cl-float">
        <path d="M22 26h10a5 5 0 1 1 10 0h10v10a5 5 0 1 1 0 10v10H42a5 5 0 1 0-10 0H22V46a5 5 0 1 0 0-10z" fill="#0b6b4c" opacity=".35" transform="translate(2 3)" />
        <path d="M22 26h10a5 5 0 1 1 10 0h10v10a5 5 0 1 1 0 10v10H42a5 5 0 1 0-10 0H22V46a5 5 0 1 0 0-10z" fill="url(#cl-d-pz)" />
        <path d="M30 37l-4 4 4 4M44 37l4 4-4 4M39 34l-4 14" fill="none" stroke="#0f8a63" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path className="cl-zap" d="M62 6 L54 22 L60 22 L56 34 L68 18 L62 18 L66 6Z" fill="#ffd34d" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <path className="cl-twk" d="M14 58 l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6z" fill="#fff" />
    </svg>
  )
}
function DoorMine() {
  return (
    <svg viewBox="0 0 80 80" width="72" height="72" aria-hidden="true" className="cl-art">
      <defs>
        <linearGradient id="cl-m-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7d97ff" /><stop offset="1" stopColor="#3e63f2" /></linearGradient>
      </defs>
      <rect x="4" y="8" width="72" height="68" rx="20" fill="#2a3fb8" />
      <rect x="4" y="4" width="72" height="68" rx="20" fill="url(#cl-m-bg)" />
      <ellipse cx="26" cy="16" rx="16" ry="6" fill="#fff" opacity=".22" />
      <rect x="17" y="24" width="46" height="38" rx="7" fill="#1b1e2a" opacity=".35" />
      <rect x="15" y="21" width="46" height="38" rx="7" fill="#16181d" />
      <rect x="15" y="21" width="46" height="9" rx="7" fill="#262a36" />
      <rect x="15" y="26" width="46" height="4" fill="#262a36" />
      <circle cx="21" cy="25.5" r="1.6" fill="#ff5f57" />
      <circle cx="26" cy="25.5" r="1.6" fill="#febc2e" />
      <circle cx="31" cy="25.5" r="1.6" fill="#28c840" />
      <path className="cl-type" d="M20 36h12" stroke="#7cc4ff" strokeWidth="3" strokeLinecap="round" pathLength={100} />
      <path className="cl-type" style={{ animationDelay: '.3s' }} d="M24 42h16" stroke="#7cc4ff" strokeWidth="3" strokeLinecap="round" pathLength={100} />
      <path className="cl-type" style={{ animationDelay: '.6s' }} d="M24 48h9" stroke="#ffd34d" strokeWidth="3" strokeLinecap="round" pathLength={100} />
      <path className="cl-type" style={{ animationDelay: '.9s' }} d="M20 54h14" stroke="#7cc4ff" strokeWidth="3" strokeLinecap="round" pathLength={100} />
      <g className="cl-pen">
        <path d="M51 68 L69 42 L75 46 L57 72 L50 74Z" fill="#0b1026" opacity=".25" />
        <path d="M50 66 L68 40 L74 44 L56 70 L49 72Z" fill="#ffc83d" />
        <path d="M68 40 L70 37 Q72 35 74.5 36.6 Q76.6 38.4 75 41 L74 44Z" fill="#ff8fa3" />
        <path d="M49 72 L50 66 L56 70Z" fill="#f3d2a2" />
        <path d="M48.6 72.6 L49.4 69.8 L52 71.4Z" fill="#23263a" />
      </g>
    </svg>
  )
}
function DoorDoubts() {
  return (
    <svg viewBox="0 0 80 80" width="72" height="72" aria-hidden="true" className="cl-art">
      <defs>
        <linearGradient id="cl-q-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd166" /><stop offset="1" stopColor="#f29100" /></linearGradient>
      </defs>
      <rect x="4" y="8" width="72" height="68" rx="20" fill="#c06d00" />
      <rect x="4" y="4" width="72" height="68" rx="20" fill="url(#cl-q-bg)" />
      <ellipse cx="26" cy="16" rx="16" ry="6" fill="#fff" opacity=".28" />
      <g className="cl-float" style={{ animationDelay: '.3s' }}>
        <path d="M36 34h28a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6h-6l1 7-8-7H36a6 6 0 0 1-6-6V40a6 6 0 0 1 6-6z" fill="#16181d" />
        <g className="cl-dots">
          <circle cx="42" cy="47" r="3" fill="#7ef0b5" />
          <circle cx="50" cy="47" r="3" fill="#7ef0b5" />
          <circle cx="58" cy="47" r="3" fill="#7ef0b5" />
        </g>
      </g>
      <g className="cl-float">
        <path d="M18 17h26a7 7 0 0 1 7 7v13a7 7 0 0 1-7 7H30l-9 7 1.5-7H18a7 7 0 0 1-7-7V24a7 7 0 0 1 7-7z" fill="#7a4100" opacity=".25" />
        <path d="M16 14h26a7 7 0 0 1 7 7v13a7 7 0 0 1-7 7H28l-9 7 1.5-7H16a7 7 0 0 1-7-7V21a7 7 0 0 1 7-7z" fill="#fff" />
        <path d="M24.5 23.5a4.5 4.5 0 1 1 6.6 4c-1.4.8-2.1 1.6-2.1 3" fill="none" stroke="#e08a00" strokeWidth="3" strokeLinecap="round" />
        <circle cx="29" cy="35" r="1.9" fill="#e08a00" />
      </g>
      <path className="cl-twk" d="M66 14 l1.8 3.8 3.8 1.8 -3.8 1.8 -1.8 3.8 -1.8 -3.8 -3.8 -1.8 3.8 -1.8z" fill="#fff" />
    </svg>
  )
}

/** Janela escura de editor, com bolinhas no topo e ações à direita. */
function IdeWindow({ file, actions, children, className = '' }: { file: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[20px] bg-[#16181d] shadow-[0_20px_40px_-24px_rgba(16,24,40,.8)] ${className}`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-white/5 bg-[#1d2027] px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </span>
        <span className="rounded-lg bg-[#16181d] px-3 py-1 font-mono text-xs text-[#e6e9f2]">{file}</span>
        {actions && <span className="ml-auto flex flex-wrap gap-2">{actions}</span>}
      </div>
      {children}
    </div>
  )
}
const ideBtn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-40'
const slug = (t: string, lang: Lang) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, lang === 'python' ? '_' : '-')
    .replace(/^[-_]|[-_]$/g, '')
    .slice(0, 28) + (lang === 'python' ? '.py' : '.js')

const LEVEL_INFO: Record<string, { bars: number; hint: string }> = {
  'Bem fácil': { bars: 1, hint: 'uma conta ou um if' },
  Fácil: { bars: 2, hint: 'if/else e laços simples' },
  Médio: { bars: 3, hint: 'laços com listas e textos' },
}
const TOPIC_ICON: Record<string, { icon: ReactNode; from: string; to: string }> = {
  Qualquer: { icon: <Dices size={18} />, from: '#8a93a8', to: '#5b6478' },
  'Variáveis e contas': { icon: <Box size={18} />, from: '#5b7cff', to: '#3e63f2' },
  'Condições (if)': { icon: <GitBranch size={18} />, from: '#ff9a3d', to: '#e2551b' },
  'Laços (for/while)': { icon: <Repeat size={18} />, from: '#a77bff', to: '#6233d6' },
  Listas: { icon: <Brackets size={18} />, from: '#2fb5d6', to: '#1479a8' },
  Textos: { icon: <Type size={18} />, from: '#ff6b7a', to: '#c9273b' },
  Funções: { icon: <Braces size={18} />, from: '#2fcf9b', to: '#0f8a63' },
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
      <div className="grid flex-1 items-start gap-5 xl:grid-cols-[1fr_300px]">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <Capybara pose="focado" size={64} />
            <div>
              <h2 className="text-xl font-bold">Novo desafio</h2>
              <p className="text-sm text-muted">A Mendi inventa, você resolve em {LANG_NAME[lang]}.</p>
            </div>
          </div>

          <div className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">Nível</div>
          <div className="mb-5 grid grid-cols-3 gap-2.5">
            {LEVELS.map((l) => {
              const on = level === l
              const info = LEVEL_INFO[l]
              return (
                <button key={l} onClick={() => setLevel(l)} className={`rounded-2xl border-2 p-3.5 text-left transition ${on ? 'border-[#0f8a63] bg-[#e9f9f2]' : 'border-line bg-white hover:border-[#9fe6cb]'}`}>
                  <span className="flex gap-1">
                    {[1, 2, 3].map((k) => (
                      <span key={k} className={`h-2 w-5 rounded-full ${k <= info.bars ? (on ? 'bg-[#0f8a63]' : 'bg-[#2fcf9b]') : 'bg-[#e6e8ee]'}`} />
                    ))}
                  </span>
                  <span className="mt-2 block font-bold">{l}</span>
                  <span className="block text-xs text-muted">{info.hint}</span>
                </button>
              )
            })}
          </div>

          <div className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">Tema</div>
          <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TOPICS.map((t) => {
              const on = topic === t
              const ic = TOPIC_ICON[t]
              return (
                <button key={t} onClick={() => setTopic(t)} className={`flex items-center gap-2.5 rounded-2xl border-2 p-2.5 text-left text-sm font-semibold transition ${on ? 'border-[#0f8a63] bg-[#e9f9f2]' : 'border-line bg-white hover:border-[#9fe6cb]'}`}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-[0_6px_12px_-6px_rgba(16,24,40,.5)]" style={{ background: `linear-gradient(145deg, ${ic.from}, ${ic.to})` }}>
                    {ic.icon}
                  </span>
                  <span className="leading-tight">{t}</span>
                </button>
              )
            })}
          </div>

          {error && <p className="mb-3 text-sm font-semibold text-rose-600">{error}</p>}
          <button
            onClick={create}
            disabled={!!loading}
            className="act-btn inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 font-display text-base font-bold text-white disabled:opacity-70"
            style={{ background: 'linear-gradient(145deg, #2fcf9b, #0f8a63)', boxShadow: '0 12px 22px -12px #0f8a63' }}
          >
            {loading === 'novo' ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {loading === 'novo' ? 'Criando…' : 'Gerar desafio'}
          </button>
        </div>

        {/* histórico como "arquivos" */}
        <div className="overflow-hidden rounded-[20px] bg-[#16181d] text-[#e6e9f2]">
          <div className="flex items-center justify-between border-b border-white/5 bg-[#1d2027] px-4 py-3">
            <span className="text-xs font-bold tracking-wider text-[#8a93a8] uppercase">Seus desafios</span>
            {history.length > 0 && (
              <span className="rounded-full bg-[#2fcf9b]/15 px-2 py-0.5 text-[11px] font-bold text-[#7ef0b5]">
                {solved}/{history.length}
              </span>
            )}
          </div>
          {history.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#8a93a8]">Nenhum ainda.</p>
          ) : (
            <div className="thin-scroll max-h-[440px] overflow-y-auto py-1.5">
              {history.map((h) => (
                <div key={h.id} className="group flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/5">
                  {h.solved ? <CheckCircle2 size={15} className="shrink-0 text-[#2fcf9b]" /> : <span className="h-[15px] w-[15px] shrink-0 rounded-full border-2 border-[#596071]" />}
                  <button onClick={() => open(h)} className="min-w-0 flex-1 text-left">
                    <div className="truncate font-mono text-[12.5px]">{slug(h.title, h.lang)}</div>
                    <div className="text-[10.5px] text-[#8a93a8]">{h.level}</div>
                  </button>
                  <button onClick={async () => (await askConfirm('Apagar este desafio?')) && db.code.delete(h.id)} className="rounded p-1 text-[#596071] opacity-0 transition group-hover:opacity-100 hover:text-rose-400" title="Apagar">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )

  const isJS = cur.lang === 'javascript'
  return (
    <div ref={box} className="space-y-4">
      <button onClick={() => setCur(null)} className="text-xs font-bold text-muted hover:text-ink">
        ← Desafios
      </button>
      <IdeWindow
        file={slug(cur.title, cur.lang)}
        actions={
          <>
            {cur.hint && (
              <button onClick={() => setShowHint((v) => !v)} className={`${ideBtn} bg-[#ffd34d]/15 text-[#ffd34d] hover:bg-[#ffd34d]/25`}>
                <Lightbulb size={13} /> Dica
              </button>
            )}
            {cur.solution && (
              <button
                onClick={async () => {
                  if (showSolution) return setShowSolution(false)
                  if (await askConfirm('Ver a solução? Vale tentar mais um pouquinho antes!', false, { title: 'Ver solução', yes: 'Ver mesmo assim', no: 'Vou tentar' })) setShowSolution(true)
                }}
                className={`${ideBtn} bg-white/10 text-white hover:bg-white/20`}
              >
                <Eye size={13} /> Solução
              </button>
            )}
            {isJS && (
              <button onClick={doRun} disabled={!!loading} className={`${ideBtn} bg-[#5b7cff] text-white hover:brightness-110`}>
                {loading === 'rodar' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />} Rodar
              </button>
            )}
            <button onClick={send} disabled={!!loading || !code.trim()} className={`${ideBtn} bg-[#2fcf9b] text-[#08321f] hover:brightness-110`}>
              {loading === 'enviar' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {loading === 'enviar' ? 'Lendo…' : 'Enviar pra Mendi'}
            </button>
          </>
        }
      >
        <div className="grid lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
          {/* enunciado, como um README */}
          <div className="thin-scroll max-h-[460px] overflow-y-auto border-b border-white/5 p-5 text-[#c9cede] lg:border-r lg:border-b-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-bold text-[#8a93a8]">{cur.level}</span>
              {cur.solved && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#2fcf9b]/15 px-2 py-0.5 text-[11px] font-bold text-[#7ef0b5]">
                  <CheckCircle2 size={11} /> resolvido
                </span>
              )}
            </div>
            <h2 className="font-display text-xl font-bold text-white">{cur.title}</h2>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{cur.statement}</p>
            {cur.examples.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {cur.examples.map((e, i) => (
                  <div key={i} className="rounded-lg bg-black/30 px-3 py-2 font-mono text-[12.5px]">
                    <span className="text-[#596071]">&gt;</span> {e.input} <span className="text-[#596071]">→</span> <span className="text-[#7ef0b5]">{e.output}</span>
                  </div>
                ))}
              </div>
            )}
            {showHint && cur.hint && (
              <div className="capi-pop mt-4 rounded-xl border border-[#ffd34d]/30 bg-[#ffd34d]/10 px-3.5 py-2.5 text-sm text-[#ffe08a]">
                <Fx name="bulb" /> {cur.hint}
              </div>
            )}
            {showSolution && cur.solution && <pre className="capi-pop thin-scroll mt-4 overflow-x-auto rounded-xl bg-black/30 px-3.5 py-3 font-mono text-[12.5px] leading-[1.55] text-[#e6e9f2]">{cur.solution}</pre>}
          </div>
          <CodeEditor value={code} onChange={setCode} lang={cur.lang} bare />
        </div>
        {run && (
          <div className="border-t border-white/5 px-5 py-3 font-mono text-[12.5px]">
            <div className="mb-1.5 text-[10.5px] font-bold tracking-wider text-[#596071] uppercase">Terminal</div>
            {run.error && <p className="text-rose-300">{run.error}</p>}
            {run.results.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-[#c9cede]">
                {r.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#2fcf9b]" /> : <XCircle size={14} className="mt-0.5 shrink-0 text-rose-400" />}
                <span className="min-w-0 break-all">
                  {r.label} → <b className={r.ok ? 'text-[#7ef0b5]' : 'text-rose-300'}>{r.got}</b>
                  {!r.ok && <span className="text-[#596071]"> (esperado {r.expected})</span>}
                </span>
              </div>
            ))}
            {run.logs.length > 0 && <pre className="thin-scroll mt-2 max-h-32 overflow-auto text-[#8a93a8]">{run.logs.join('\n')}</pre>}
          </div>
        )}
      </IdeWindow>
      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}

      {review && (
        <div className={`capi-pop flex items-start gap-4 rounded-[20px] border-2 bg-white p-5 ${review.correto ? 'border-[#9fe6cb]' : 'border-[#ffe08a]'}`}>
          <Capybara pose={review.correto ? 'comemorando' : 'pensando'} size={78} />
          <div className="min-w-0 flex-1">
            <div className={`font-display text-lg font-bold ${review.correto ? 'text-[#0f8a63]' : 'text-[#b7791f]'}`}>{review.correto ? 'Resolvido!' : 'Quase lá'}</div>
            <p className="mt-0.5 text-sm text-slate-700">{review.resumo}</p>
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
            {review.proximoPasso && <p className="mt-3 text-sm font-semibold text-slate-800">{review.proximoPasso}</p>}
            {review.correto && (
              <button onClick={() => setCur(null)} className="mt-4 rounded-xl bg-[#0f8a63] px-4 py-2 text-sm font-bold text-white hover:brightness-110">
                Próximo desafio
              </button>
            )}
          </div>
        </div>
      )}
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
    <div className="flex min-h-0 flex-1 flex-col" style={{ maxHeight: 'max(560px, calc(100vh - 380px))' }}>
      <div className="thin-scroll flex-1 space-y-4 overflow-y-auto px-1 pb-4">
        {msgs.length === 0 && !busy && (
          <div className="flex flex-col items-center py-8 text-center">
            <Capybara pose="estudando" size={104} />
            <p className="mt-2 font-display text-lg font-bold">O que você quer entender?</p>
            <p className="text-sm text-muted">Pode colar seu código também.</p>
            <div className="mt-5 grid w-full max-w-xl gap-2.5 sm:grid-cols-2">
              {STARTERS.map((s, i) => {
                const ic = Object.values(TOPIC_ICON)[i + 1]
                return (
                  <button key={s} onClick={() => ask(s)} className="flex items-center gap-3 rounded-2xl border-2 border-line bg-white p-3 text-left text-sm font-semibold transition hover:-translate-y-0.5 hover:border-[#9fe6cb]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: `linear-gradient(145deg, ${ic.from}, ${ic.to})` }}>
                      {ic.icon}
                    </span>
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#0f8a63] px-4 py-2.5 text-sm whitespace-pre-wrap text-white">{m.text}</div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2">
              <Capybara pose="estudando" size={38} alive={false} />
              <div className="max-w-[85%] min-w-0 rounded-2xl rounded-tl-md bg-[#f6f7f9] px-4 py-3">
                <RichText text={m.text} />
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="flex items-start gap-2">
            <Capybara pose="pensando" size={38} alive={false} />
            <div className="max-w-[85%] min-w-0 rounded-2xl rounded-tl-md bg-[#f6f7f9] px-4 py-3">{live ? <RichText text={live} /> : <Loader2 size={16} className="animate-spin text-muted" />}</div>
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-[#f7f8fb] p-2">
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
          placeholder="Escreva sua dúvida…"
          className="thin-scroll max-h-40 flex-1 resize-none rounded-xl bg-transparent px-2 py-2.5 text-sm outline-none"
        />
        <button onClick={() => ask(q)} disabled={busy || !q.trim()} className="act-btn grid h-11 w-11 place-items-center rounded-xl text-white disabled:opacity-50" style={{ background: 'linear-gradient(145deg, #2fcf9b, #0f8a63)' }} aria-label="Enviar">
          <Send size={17} />
        </button>
      </div>
    </div>
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


/** Código da Mendi com os trechos escondidos ([[n]]) virando cadeados até você revelar. */
function CapiCode({ code, steps, open, className = 'max-h-[300px] rounded-2xl' }: { code: string; steps: Step[]; open: Set<number>; className?: string }) {
  const parts = code.split(/\[\[(\d+)\]\]/g)
  return (
    <pre className={`thin-scroll overflow-auto bg-[#16181d] px-4 py-3 font-mono text-[13px] leading-[1.65] text-[#e6e9f2] ${className}`}>
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
  const [result, setResult] = useState<Mentoring | null>(saved.result)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cur, setCur] = useState(0)
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
      const o = await ai.json<{ resumo?: string; codigoCapi?: string; passos?: { linha?: number; tipo?: string; texto?: string; pista?: string; trecho?: string; marcador?: number }[] }>(mentorPrompt(lang, code, goal, ''), { fresh: true })
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
      setCur(0)
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

  const steps = result?.steps ?? []
  const step = steps[cur]
  const markers = new Map<number, number>()
  steps.forEach((st, i) => st.line > 0 && !markers.has(st.line) && markers.set(st.line, i))
  const file = lang === 'python' ? 'main.py' : 'main.js'
  const pose: CapiPose = step?.kind === 'elogio' ? 'comemorando' : step?.kind === 'erro' ? 'pensando' : 'estudando'

  const reveal = async (st: Step, i: number) => {
    if (!opened.has(st.marker) && !hints.has(i) && st.hint && !(await askConfirm('Tenta com a dica antes?', false, { title: 'Abrir o trecho', yes: 'Abrir mesmo assim', no: 'Ver a dica' }))) {
      setHints((h) => new Set(h).add(i))
      return
    }
    setOpened((o) => toggle(o, st.marker))
  }

  return (
    <div className="space-y-4">
      {/* Editor no estilo de uma IDE: seu código e a versão da Mendi lado a lado */}
      <div className="overflow-hidden rounded-[22px] bg-[#16181d] shadow-[0_20px_40px_-24px_rgba(16,24,40,.8)]">
        <div className="flex items-center gap-3 border-b border-white/5 bg-[#1d2027] px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </span>
          <span className="rounded-lg bg-[#16181d] px-3 py-1 font-mono text-xs text-[#e6e9f2]">{file}</span>
          <span className="ml-auto flex gap-2">
            {lang === 'javascript' && (
              <button onClick={async () => setRun(await runJS(code))} disabled={!code.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20 disabled:opacity-40">
                <Play size={13} fill="currentColor" /> Rodar
              </button>
            )}
          </span>
        </div>
        <div className="grid lg:grid-cols-2">
          <CodeEditor value={code} onChange={setCode} lang={lang} highlight={step?.line || undefined} tall bare markers={markers} onMarker={setCur} />
          <div className="flex min-h-[200px] flex-col border-t border-white/5 lg:border-t-0 lg:border-l">
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2 font-mono text-xs text-[#8a93a8]">
              <span className="h-2 w-2 rounded-full bg-[#2fcf9b]" /> versão da Mendi
            </div>
            {result?.capiCode ? (
              <CapiCode code={result.capiCode} steps={steps} open={opened} className="h-[420px] flex-1" />
            ) : (
              <div className="grid flex-1 place-items-center px-6 text-center text-sm text-[#8a93a8]">
                <div>
                  <Capybara pose="pensando" size={86} />
                  <p className="mt-2">Escreva seu código ao lado e peça ajuda.</p>
                  <p className="mt-1 text-xs text-[#596071]">As partes importantes da minha versão ficam trancadas até você descobrir.</p>
                </div>
              </div>
            )}
          </div>
        </div>
        {run && (
          <pre className="thin-scroll max-h-36 overflow-auto border-t border-white/5 px-4 py-2.5 font-mono text-[12.5px] text-[#c9cede]">
            {run.error ? <span className="text-rose-300">{run.error}</span> : run.logs.length ? run.logs.join('\n') : '(nada impresso; use console.log)'}
          </pre>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-white/5 bg-[#1d2027] p-3">
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && analyze()}
            placeholder="O que o código deve fazer? (ex.: calcular o fatorial)"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#16181d] px-3.5 py-2.5 text-sm text-white placeholder:text-[#596071] outline-none focus:border-[#2fcf9b]"
          />
          <button onClick={analyze} disabled={busy || !code.trim()} className="act-btn inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ background: 'linear-gradient(145deg, #2fcf9b, #0f8a63)' }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} {busy ? 'Lendo…' : result ? 'Revisar de novo' : 'Pedir ajuda'}
          </button>
        </div>
      </div>
      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}

      {/* Comentários da Mendi, um de cada vez */}
      {result && (
        <Card className="p-5">
          {result.summary && <p className="mb-4 border-b border-line pb-4 text-sm text-slate-600">{result.summary}</p>}
          {step ? (
            <div key={cur} className="capi-pop flex items-start gap-4">
              <Capybara pose={pose} size={78} />
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  {step.line > 0 && <span className="rounded-md bg-[#16181d] px-2 py-0.5 font-mono text-[11px] font-bold text-[#ffd34d]">linha {step.line}</span>}
                  <span className="ml-auto flex items-center gap-1">
                    {steps.map((_, i) => (
                      <button key={i} onClick={() => setCur(i)} className={`h-2 rounded-full transition-all ${i === cur ? 'w-5 bg-[#0f8a63]' : 'w-2 bg-[#d6d9e2] hover:bg-[#9aa3b2]'}`} aria-label={`Comentário ${i + 1}`} />
                    ))}
                  </span>
                </div>
                <div className="text-[15px] leading-relaxed text-slate-800">
                  <RichText text={step.text} />
                </div>
                {hints.has(cur) && step.hint && (
                  <div className="capi-pop mt-3 rounded-xl bg-[#fff6dc] px-3.5 py-2.5 text-sm text-[#7a5a00]">
                    <RichText text={step.hint} />
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {step.hint && !hints.has(cur) && (
                    <button onClick={() => setHints((h) => new Set(h).add(cur))} className="inline-flex items-center gap-1.5 rounded-xl bg-[#fff6dc] px-3 py-2 text-xs font-bold text-[#7a5a00] hover:brightness-95">
                      <Lightbulb size={14} /> Dica
                    </button>
                  )}
                  {step.marker > 0 && step.piece && (
                    <button onClick={() => reveal(step, cur)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#16181d] px-3 py-2 text-xs font-bold text-[#ffd34d] hover:brightness-125">
                      <Lock size={13} /> {opened.has(step.marker) ? 'Trancar de novo' : `Abrir trecho ${step.marker}`}
                    </button>
                  )}
                  <span className="ml-auto flex gap-2">
                    <button onClick={() => setCur((c) => Math.max(0, c - 1))} disabled={cur === 0} className="rounded-xl border border-line px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                      Anterior
                    </button>
                    <button onClick={() => setCur((c) => Math.min(steps.length - 1, c + 1))} disabled={cur >= steps.length - 1} className="rounded-xl bg-[#0f8a63] px-3 py-2 text-xs font-bold text-white hover:brightness-110 disabled:opacity-40">
                      Próximo
                    </button>
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* conversa */}
          {(chat.length > 0 || chatBusy) && (
            <div className="thin-scroll mt-5 max-h-[320px] space-y-3 overflow-y-auto border-t border-line pt-4">
              {chat.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#0f8a63] px-3.5 py-2 text-sm whitespace-pre-wrap text-white">{m.text}</div>
                  </div>
                ) : (
                  <div key={i} className="flex items-start gap-2">
                    <Capybara pose="estudando" size={34} alive={false} />
                    <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-[#f6f7f9] px-3.5 py-2.5">
                      <RichText text={m.text} />
                    </div>
                  </div>
                ),
              )}
              {chatBusy && <div className="ml-10 max-w-[88%] rounded-2xl rounded-tl-md bg-[#f6f7f9] px-3.5 py-2.5">{live ? <RichText text={live} /> : <Loader2 size={16} className="animate-spin text-muted" />}</div>}
            </div>
          )}
          <div className="mt-4 flex items-end gap-2">
            <textarea
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  ask(step ? `(sobre a linha ${step.line}) ${q}` : q)
                }
              }}
              rows={Math.min(5, Math.max(1, q.split('\n').length))}
              placeholder="Responder ou perguntar…"
              className="thin-scroll max-h-32 flex-1 resize-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0f8a63]"
            />
            <button onClick={() => ask(step ? `(sobre a linha ${step.line}) ${q}` : q)} disabled={chatBusy || !q.trim()} className="act-btn grid h-11 w-11 place-items-center rounded-xl text-white disabled:opacity-50" style={{ background: 'linear-gradient(145deg, #2fcf9b, #0f8a63)' }} aria-label="Enviar">
              <Send size={17} />
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
