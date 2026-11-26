import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bug, CheckCircle2, Dices, Dumbbell, Eye, Gamepad2, GraduationCap, HeartPulse, Landmark, Lightbulb, Loader2, Lock, MessageCircle, Play, Plus, Send, Store, Trash2, Truck, UtensilsCrossed, Wrench, XCircle } from 'lucide-react'
import { db, uid } from '../db/db'
import type { OfficeProject, OfficeTask } from '../db/types'
import { AIError, getAI } from '../lib/ai'
import { centerOf, confetti, playSfx } from '../lib/sfx'
import { showMascot } from '../lib/mascotBus'
import { askConfirm } from './confirm'
import { Capybara } from './Capybara'
import { CodeEditor, GradeRing, IdeWindow, LANG_NAME, RichText, ideBtn, runJS, type Lang, type RunResult } from './CodeLab'

/*
 * Modo Empresarial: a IA inventa uma empresa e um sisteminha, e o gerente passa tarefas
 * (função nova, bug para corrigir, melhoria) uma de cada vez, no mesmo arquivo.
 */

const LEVELS: { id: string; bars: number; text: string; tasks: number; rules: string }[] = [
  { id: 'Estagiário', bars: 1, text: 'if, contas, textos e funções', tasks: 4, rules: 'Só if/else, contas, textos e funções simples. Nenhuma tarefa do tipo "bug". Uma "melhoria" no máximo.' },
  { id: 'Júnior', bars: 2, text: 'listas, laços e dicionários', tasks: 5, rules: 'Listas, for, dicionários simples e funções que usam outras funções. Pelo menos 1 tarefa "bug" e 1 "melhoria".' },
  { id: 'Júnior+', bars: 3, text: 'dados de verdade, bugs e validação', tasks: 6, rules: 'Listas de dicionários, contagem e agrupamento, validação de entrada, casos de borda e funções chamando funções. Pelo menos 2 tarefas "bug" e 1 "melhoria". Ainda sem classes, bibliotecas ou recursão.' },
]

const SECTORS: { id: string; icon: ReactNode; from: string; to: string }[] = [
  { id: 'Qualquer', icon: <Dices size={18} />, from: '#8a93a8', to: '#5b6478' },
  { id: 'Loja', icon: <Store size={18} />, from: '#ff9a3d', to: '#e2551b' },
  { id: 'Restaurante', icon: <UtensilsCrossed size={18} />, from: '#ff6b7a', to: '#c9273b' },
  { id: 'Escola', icon: <GraduationCap size={18} />, from: '#5b7cff', to: '#3e63f2' },
  { id: 'Games', icon: <Gamepad2 size={18} />, from: '#a77bff', to: '#6233d6' },
  { id: 'Banco', icon: <Landmark size={18} />, from: '#2fcf9b', to: '#0f8a63' },
  { id: 'Academia', icon: <Dumbbell size={18} />, from: '#ffb648', to: '#d98a00' },
  { id: 'Clínica', icon: <HeartPulse size={18} />, from: '#2fb5d6', to: '#1479a8' },
  { id: 'Entregas', icon: <Truck size={18} />, from: '#7d8597', to: '#3f4757' },
]
const sectorOf = (id: string) => SECTORS.find((s) => s.id === id) ?? SECTORS[0]

const KIND: Record<OfficeTask['kind'], { label: string; icon: ReactNode; cls: string }> = {
  nova: { label: 'Nova', icon: <Plus size={11} strokeWidth={3} />, cls: 'bg-[#e9f0ff] text-[#3e63f2]' },
  bug: { label: 'Bug', icon: <Bug size={11} strokeWidth={2.6} />, cls: 'bg-[#ffecef] text-[#c9273b]' },
  melhoria: { label: 'Melhoria', icon: <Wrench size={11} strokeWidth={2.6} />, cls: 'bg-[#fff4dc] text-[#b7791f]' },
}

/* ---------------- Prompts ---------------- */

const projectPrompt = (lang: Lang, level: (typeof LEVELS)[number], sector: string, avoid: string[]) => {
  const py = lang === 'python'
  return `Você é o gerente de uma empresa brasileira inventada e vai passar um PROJETO de programação para um funcionário novo. Ele ainda está aprendendo: já sabe o básico e está entrando no intermediário.
Linguagem: ${LANG_NAME[lang]}. Cargo do funcionário: ${level.id}. Ramo da empresa: ${sector === 'Qualquer' ? 'escolha um ramo do dia a dia' : sector}.
${avoid.length ? `Não repita estas empresas: ${avoid.slice(0, 12).join('; ')}.` : ''}
Monte:
- Uma empresa com nome criativo e um sistema pequeno e realista que ela precisa (ex.: pedidos de uma lanchonete, estoque de uma loja, notas de uma escola, ranking de um campeonato).
- "codigoInicial": o começo do arquivo do sistema, com dados de exemplo (${py ? 'listas e dicionários' : 'arrays e objetos'}) e 0 a 2 funções prontas que o funcionário vai ler ou usar. Comentários curtos em português. As funções RETORNAM valores (nada de ${py ? 'input()' : 'prompt()'}).
- Exatamente ${level.tasks} tarefas, da mais fácil para a mais difícil. Cada tarefa mexe em UMA função, com nome em ${py ? 'snake_case' : 'camelCase'}, em português sem acento.
  Tipos: "nova" (criar a função), "bug" (uma função escrita por um colega tem UM defeito realista; o funcionário precisa achar e corrigir; nenhum comentário pode apontar o defeito), "melhoria" (mudar uma função que já existe no arquivo: validação, caso de borda, parâmetro novo com valor padrão).
  ${level.rules}
  "mensagem": a ordem do gerente, como mensagem de chat do trabalho: informal, direta, 2 a 4 frases, com o motivo (cliente reclamou, o caixa precisa, o dono pediu...). Pode citar colegas inventados.
  "criterios": 2 a 4 critérios de aceite objetivos.
  "codigoExtra": código que entra no fim do arquivo quando a tarefa começa. Em "nova": só a assinatura da função com um comentário TODO dentro${py ? ' e pass' : ''}. Em "bug": a função com o defeito. Em "melhoria": vazio (a função já está no arquivo).
  "testes": 3 a 5 testes chamando a função só com valores JSON (números, textos, listas, objetos, true/false). Cada teste funciona sozinho, sem depender de outra tarefa ter mudado os dados.
  "dica": uma pista que não entrega a resposta.
Responda SOMENTE com JSON:
{"ramo":"um destes: ${SECTORS.slice(1).map((x) => x.id).join(", ")}","empresa":"","produto":"nome curto do sistema","resumo":"2 frases: a empresa e o que o sistema faz","gerente":{"nome":"nome e sobrenome","cargo":""},"arquivo":"nome_do_arquivo.${py ? 'py' : 'js'}","codigoInicial":"","tarefas":[{"titulo":"curto","tipo":"nova","mensagem":"","criterios":[""],"funcao":"","codigoExtra":"","testes":[{"args":[],"esperado":null}],"dica":""}]}`
}

const head = (p: OfficeProject) => `Você é ${p.manager.name}, ${p.manager.role} da ${p.company}. O funcionário (cargo: ${p.level}) está aprendendo a programar em ${LANG_NAME[p.lang]}.
Projeto: ${p.product}. ${p.pitch}`

const taskText = (t: OfficeTask) => `Tarefa ${t.id} (${KIND[t.kind].label}): ${t.title}
Pedido: ${t.message}
Critérios de aceite:
${t.criteria.map((c) => `- ${c}`).join('\n')}`

const reviewPrompt = (p: OfficeProject, t: OfficeTask, code: string, ran: string) => `${head(p)}
Você está fazendo o code review da entrega.
${taskText(t)}

Arquivo inteiro do projeto:
\`\`\`
${code}
\`\`\`
${ran ? `Resultado real dos testes ao rodar:\n${ran}\n` : ''}
Avalie SÓ esta tarefa (outras partes do arquivo podem estar com TODO). Aprove se cumprir todos os critérios e funcionar nos casos de borda. Se não aprovar, diga ONDE está o problema e dê uma pista, sem escrever o código da resposta. Fale como um gerente gente boa: direto, português simples, frases curtas.
Responda SOMENTE com JSON: {"aprovado":true,"resumo":"1 frase","pontos":["até 3 observações"],"proximo":"1 frase curta"}`

const askPrompt = (p: OfficeProject, t: OfficeTask, code: string, qa: { q: string; a: string }[], q: string) => `${head(p)}
${taskText(t)}

Código atual do arquivo:
\`\`\`
${code}
\`\`\`
${qa
  .slice(-4)
  .map((x) => `Funcionário: ${x.q}\nVocê: ${x.a}`)
  .join('\n\n')}

Funcionário: ${q}

Responda como o gerente que ajuda mas não faz o trabalho por ele: até 5 frases, português simples. Explique o conceito e, se ajudar, mostre um exemplo pequeno em bloco \`\`\` que NÃO seja a resposta da tarefa.

Você:`

const finalPrompt = (p: OfficeProject, code: string) => `${head(p)}
O funcionário terminou todas as tarefas. Tentativas até aprovar: ${p.tasks.map((t) => `${t.id}=${t.attempts}`).join(', ')}.
Arquivo final:
\`\`\`
${code}
\`\`\`
Dê a avaliação final, lembrando que ele está aprendendo (cargo ${p.level}): nota inteira de 0 a 10, um veredito de 1 a 2 frases e até 3 dicas para crescer.
Responda SOMENTE com JSON: {"nota":8,"veredito":"","dicas":[""]}`

/* ---------------- Peças ---------------- */

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')

function Avatar({ name, from, to, size = 40 }: { name: string; from: string; to: string; size?: number }) {
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <span className="grid h-full w-full place-items-center rounded-full font-display font-extrabold text-white" style={{ background: `linear-gradient(145deg, ${from}, ${to})`, fontSize: size * 0.36 }}>
        {initials(name)}
      </span>
      <span className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-white bg-[#28c840]" />
    </span>
  )
}

function Bars({ n, on }: { n: number; on: boolean }) {
  return (
    <span className="flex gap-1">
      {[1, 2, 3].map((k) => (
        <span key={k} className={`h-2 w-5 rounded-full ${k <= n ? (on ? 'bg-[#3e63f2]' : 'bg-[#8aa2ff]') : 'bg-[#e6e8ee]'}`} />
      ))}
    </span>
  )
}

const withPatch = (code: string, t: OfficeTask | undefined) => (t && t.patch && !t.patched ? `${code.trimEnd()}\n\n${t.patch.trim()}\n` : code)

/* ---------------- Principal ---------------- */

export function Office({ lang }: { lang: Lang }) {
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), [], [])
  const [openId, setOpenId] = useState<string | null>(null)
  const open = projects.find((p) => p.id === openId)
  if (open) return <ProjectView key={open.id} project={open} onBack={() => setOpenId(null)} />
  return <OfficeHome lang={lang} projects={projects} onOpen={setOpenId} />
}

function OfficeHome({ lang, projects, onOpen }: { lang: Lang; projects: OfficeProject[]; onOpen: (id: string) => void }) {
  const [level, setLevel] = useState(LEVELS[1].id)
  const [sector, setSector] = useState('Qualquer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const create = async () => {
    setLoading(true)
    setError('')
    try {
      const ai = await getAI()
      if (!ai) throw new AIError('unavailable', 'O Claude não está disponível aqui. Abra o Mendonça pelo claude.ai.')
      const lv = LEVELS.find((l) => l.id === level)!
      type Raw = { titulo?: string; tipo?: string; mensagem?: string; criterios?: string[]; funcao?: string; codigoExtra?: string; testes?: { args?: unknown[]; esperado?: unknown }[]; dica?: string }
      const o = await ai.json<{ ramo?: string; empresa?: string; produto?: string; resumo?: string; gerente?: { nome?: string; cargo?: string }; arquivo?: string; codigoInicial?: string; tarefas?: Raw[] }>(
        projectPrompt(lang, lv, sector, projects.map((p) => p.company)),
        { fresh: true },
      )
      const tasks: OfficeTask[] = (o?.tarefas ?? [])
        .filter((t) => t?.titulo && t.mensagem)
        .map((t, i) => ({
          id: `T-${i + 1}`,
          title: String(t.titulo),
          kind: t.tipo === 'bug' || t.tipo === 'melhoria' ? t.tipo : 'nova',
          message: String(t.mensagem),
          criteria: (t.criterios ?? []).map(String).slice(0, 5),
          patch: t.codigoExtra ? String(t.codigoExtra) : undefined,
          fn: t.funcao ? String(t.funcao) : undefined,
          tests: (t.testes ?? []).filter((x) => Array.isArray(x?.args)).map((x) => ({ args: x.args!, expected: x.esperado })),
          hint: t.dica ? String(t.dica) : undefined,
          done: false,
          attempts: 0,
        }))
      if (!o?.empresa || tasks.length < 2) throw new Error()
      const ext = lang === 'python' ? '.py' : '.js'
      let file = String(o.arquivo ?? '').trim().replace(/[^\w.-]/g, '_') || `sistema${ext}`
      if (!file.endsWith(ext)) file = file.replace(/\.\w+$/, '') + ext
      const p: OfficeProject = {
        id: uid(),
        createdAt: Date.now(),
        lang,
        level,
        sector: sector === 'Qualquer' ? (SECTORS.find((x) => x.id !== 'Qualquer' && x.id === String(o.ramo ?? '').trim())?.id ?? sector) : sector,
        company: String(o.empresa),
        product: String(o.produto ?? 'Sistema'),
        pitch: String(o.resumo ?? ''),
        manager: { name: String(o.gerente?.nome ?? 'Gerente'), role: String(o.gerente?.cargo ?? 'Gerente de projeto') },
        fileName: file,
        code: withPatch(String(o.codigoInicial ?? ''), tasks[0]),
        tasks: tasks.map((t, i) => (i === 0 && t.patch ? { ...t, patched: true } : t)),
        current: 0,
      }
      await db.projects.add(p)
      playSfx('pop')
      onOpen(p.id)
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Não consegui montar o projeto agora. Tente de novo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid flex-1 items-start gap-5 xl:grid-cols-[1fr_300px]">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Capybara pose="focado" size={64} />
          <div>
            <h2 className="text-xl font-bold">Empresarial</h2>
            <p className="text-sm text-muted">Um projeto inteiro de uma empresa, com tarefas do gerente, em {LANG_NAME[lang]}.</p>
          </div>
        </div>

        <div className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">Seu cargo</div>
        <div className="mb-5 grid gap-2.5 sm:grid-cols-3">
          {LEVELS.map((l) => {
            const on = level === l.id
            return (
              <button key={l.id} onClick={() => setLevel(l.id)} className={`rounded-2xl border-2 p-3.5 text-left transition ${on ? 'border-[#3e63f2] bg-[#eef2ff]' : 'border-line bg-white hover:border-[#b9c7ff]'}`}>
                <Bars n={l.bars} on={on} />
                <span className="mt-2 block font-bold">{l.id}</span>
                <span className="block text-xs text-muted">{l.text}</span>
                <span className="mt-1.5 block text-[11px] font-bold text-[#3e63f2]">{l.tasks} tarefas</span>
              </button>
            )
          })}
        </div>

        <div className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">Empresa</div>
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {SECTORS.map((s) => {
            const on = sector === s.id
            return (
              <button key={s.id} onClick={() => setSector(s.id)} className={`flex items-center gap-2.5 rounded-2xl border-2 p-2.5 text-left text-sm font-semibold transition ${on ? 'border-[#3e63f2] bg-[#eef2ff]' : 'border-line bg-white hover:border-[#b9c7ff]'}`}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-[0_6px_12px_-6px_rgba(16,24,40,.5)]" style={{ background: `linear-gradient(145deg, ${s.from}, ${s.to})` }}>
                  {s.icon}
                </span>
                <span className="leading-tight">{s.id}</span>
              </button>
            )
          })}
        </div>

        {error && <p className="mb-3 text-sm font-semibold text-rose-600">{error}</p>}
        <button
          onClick={create}
          disabled={loading}
          className="act-btn inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 font-display text-base font-bold text-white disabled:opacity-70"
          style={{ background: 'linear-gradient(145deg, #5b7cff, #3e63f2)', boxShadow: '0 12px 22px -12px #3e63f2' }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Briefcase />}
          {loading ? 'Montando o projeto…' : 'Receber projeto'}
        </button>
      </div>

      {/* projetos como "repositórios" */}
      <div className="overflow-hidden rounded-[20px] bg-[#16181d] text-[#e6e9f2]">
        <div className="border-b border-white/5 bg-[#1d2027] px-4 py-3 text-xs font-bold tracking-wider text-[#8a93a8] uppercase">Seus projetos</div>
        {projects.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#8a93a8]">Nenhum ainda.</p>
        ) : (
          <div className="thin-scroll max-h-[460px] overflow-y-auto py-1.5">
            {projects.map((p) => {
              const done = p.tasks.filter((t) => t.done).length
              const s = sectorOf(p.sector)
              return (
                <div key={p.id} className="group flex items-center gap-2.5 px-3 py-2 hover:bg-white/5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white [&_svg]:h-4 [&_svg]:w-4" style={{ background: `linear-gradient(145deg, ${s.from}, ${s.to})` }}>
                    {s.icon}
                  </span>
                  <button onClick={() => onOpen(p.id)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[13px] font-bold">{p.company}</div>
                    <div className="flex items-center gap-2 text-[10.5px] text-[#8a93a8]">
                      <span>{p.level}</span>
                      {p.finishedAt ? <span className="font-bold text-[#7ef0b5]">entregue · nota {p.grade}</span> : <span>{done}/{p.tasks.length} tarefas</span>}
                    </div>
                  </button>
                  <button onClick={async () => (await askConfirm('Apagar este projeto?')) && db.projects.delete(p.id)} className="rounded p-1 text-[#596071] opacity-0 transition group-hover:opacity-100 hover:text-rose-400" title="Apagar">
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Briefcase() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect x="3" y="7" width="18" height="13" rx="3" fill="#fff" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M3 12.5h18" stroke="#3e63f2" strokeWidth="1.6" />
      <rect x="10.5" y="11" width="3" height="3" rx=".8" fill="#ffd34d" />
    </svg>
  )
}

/* ---------------- Projeto aberto ---------------- */

function ProjectView({ project, onBack }: { project: OfficeProject; onBack: () => void }) {
  const p = project
  const s = sectorOf(p.sector)
  const [code, setCode] = useState(p.code)
  const [view, setView] = useState(Math.min(p.current, p.tasks.length - 1))
  const [loading, setLoading] = useState<'' | 'rodar' | 'entregar' | 'perguntar' | 'final'>('')
  const [error, setError] = useState('')
  const [run, setRun] = useState<RunResult | null>(null)
  const [hint, setHint] = useState(false)
  const [asking, setAsking] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const task = p.tasks[view]
  const isCurrent = view === p.current && !p.finishedAt
  const done = p.tasks.filter((t) => t.done).length

  // Salva o arquivo enquanto você digita
  useEffect(() => {
    if (code === p.code) return
    const t = window.setTimeout(() => db.projects.update(p.id, { code }), 700)
    return () => window.clearTimeout(t)
  }, [code, p.id, p.code])

  const patchTask = (i: number, patch: Partial<OfficeTask>, extra: Partial<OfficeProject> = {}) => {
    const tasks = p.tasks.map((t, k) => (k === i ? { ...t, ...patch } : t))
    return db.projects.update(p.id, { tasks, ...extra })
  }

  const doRun = async () => {
    if (!task) return
    setLoading('rodar')
    setRun(await runJS(code, task.fn, task.tests))
    setLoading('')
  }

  const finish = async (finalCode: string) => {
    setLoading('final')
    try {
      const ai = await getAI()
      if (!ai) throw new AIError('unavailable', 'O Claude não está disponível aqui.')
      const fresh = (await db.projects.get(p.id)) ?? p
      const o = await ai.json<{ nota?: number; veredito?: string; dicas?: string[] }>(finalPrompt(fresh, finalCode), { fresh: true })
      const grade = Math.max(0, Math.min(10, Math.round(Number(o?.nota ?? 7))))
      const verdict = String(o?.veredito ?? '')
      const tips = Array.isArray(o?.dicas) ? o.dicas.map(String).slice(0, 3) : []
      await db.projects.update(p.id, { finishedAt: Date.now(), grade, verdict, tips, current: p.tasks.length })
      // Vai para a Biblioteca junto com os códigos aprovados
      await db.snippets.add({ id: uid(), createdAt: Date.now(), lang: p.lang, goal: `${p.company}: ${p.product}`, code: finalCode, grade, verdict, tips })
      playSfx('ok')
      const [x, y] = centerOf(box.current)
      confetti(x, y, 110, ['#5b7cff', '#ffd34d', '#ffffff', '#2fcf9b'])
      showMascot({ pose: 'comemorando', title: 'Projeto entregue!', text: `${p.company} agradece. Nota ${grade}.`, autoHideMs: 6000 })
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Não consegui fechar a avaliação agora. Tente de novo.')
    } finally {
      setLoading('')
    }
  }

  const deliver = async () => {
    if (!task || !code.trim()) return
    setLoading('entregar')
    setError('')
    try {
      await db.projects.update(p.id, { code })
      let ran = ''
      if (p.lang === 'javascript' && task.fn) {
        const r = await runJS(code, task.fn, task.tests)
        setRun(r)
        ran = r.error ? `Erro: ${r.error}` : r.results.map((x) => `${x.label} → ${x.got} (esperado ${x.expected}) ${x.ok ? 'OK' : 'ERRADO'}`).join('\n')
      }
      const ai = await getAI()
      if (!ai) throw new AIError('unavailable', 'O Claude não está disponível aqui. Abra o Mendonça pelo claude.ai.')
      const o = await ai.json<{ aprovado?: boolean; resumo?: string; pontos?: string[]; proximo?: string }>(reviewPrompt(p, task, code, ran), { fresh: true })
      const fb = { ok: !!o?.aprovado, summary: String(o?.resumo ?? ''), points: Array.isArray(o?.pontos) ? o.pontos.map(String).slice(0, 3) : [], next: String(o?.proximo ?? '') }
      await patchTask(view, { feedback: fb, attempts: task.attempts + 1, done: task.done || fb.ok })
      if (fb.ok) {
        playSfx('ok')
        const [x, y] = centerOf(box.current)
        confetti(x, y, 60, ['#5b7cff', '#ffd34d', '#ffffff'])
        if (view === p.tasks.length - 1) await finish(code)
      } else playSfx('bad')
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Não consegui revisar agora. Seu código continua salvo; tente de novo.')
    } finally {
      setLoading((l) => (l === 'final' ? l : ''))
    }
  }

  const nextTask = async () => {
    const i = p.current + 1
    const nt = p.tasks[i]
    if (!nt) return
    const nextCode = withPatch(code, nt)
    setCode(nextCode)
    await patchTask(i, { patched: true }, { current: i, code: nextCode })
    setView(i)
    setRun(null)
    setHint(false)
    setAsking(false)
    playSfx('pop')
  }

  const ask = async () => {
    if (!task || !q.trim()) return
    setLoading('perguntar')
    setError('')
    try {
      const ai = await getAI()
      if (!ai) throw new AIError('unavailable', 'O Claude não está disponível aqui.')
      const a = (await ai.text(askPrompt(p, task, code, task.qa ?? [], q.trim()), { tier: 'quick', fresh: true })).trim()
      await patchTask(view, { qa: [...(task.qa ?? []), { q: q.trim(), a }] })
      setQ('')
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Não consegui responder agora.')
    } finally {
      setLoading('')
    }
  }

  const fb = task?.feedback
  return (
    <div ref={box} className="space-y-4">
      <button onClick={onBack} className="text-xs font-bold text-muted hover:text-ink">
        ← Projetos
      </button>

      {/* Empresa */}
      <div className="relative overflow-hidden rounded-[22px] p-5 text-white sm:p-6" style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}>
        <svg className="pointer-events-none absolute -top-6 -right-6 h-48 w-48 opacity-15" viewBox="0 0 100 100" aria-hidden="true">
          <rect x="18" y="30" width="26" height="62" rx="3" fill="#fff" />
          <rect x="50" y="10" width="32" height="82" rx="3" fill="#fff" />
          {[0, 1, 2, 3, 4, 5].map((r) => [0, 1].map((c) => <rect key={`${r}${c}`} x={56 + c * 13} y={18 + r * 12} width="7" height="6" rx="1" fill={s.to} />))}
        </svg>
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 [&_svg]:h-7 [&_svg]:w-7">{s.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-extrabold tracking-[.12em] text-white/75 uppercase">
              {p.product} · {p.level}
            </div>
            <h2 className="font-display text-2xl leading-tight font-extrabold">{p.company}</h2>
            {p.pitch && <p className="mt-1 max-w-2xl text-sm text-white/85">{p.pitch}</p>}
          </div>
          <div className="min-w-[180px]">
            <div className="mb-1.5 flex justify-between text-xs font-bold text-white/85">
              <span>Entregas</span>
              <span>
                {done}/{p.tasks.length}
              </span>
            </div>
            <div className="flex gap-1">
              {p.tasks.map((t, i) => (
                <span key={t.id} className={`h-2.5 flex-1 rounded-full ${t.done ? 'bg-white' : i === p.current ? 'bg-white/55' : 'bg-white/20'}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Avaliação final */}
      {p.finishedAt && (
        <div className="capi-pop flex flex-wrap items-center gap-5 rounded-[22px] border-2 border-[#c9d4ff] bg-white p-5">
          <GradeRing grade={p.grade ?? 0} />
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-bold text-[#3e63f2]">Projeto entregue</div>
            <p className="mt-0.5 text-sm text-slate-700">{p.verdict}</p>
            {!!p.tips?.length && (
              <ul className="mt-2.5 space-y-1.5">
                {p.tips.map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3e63f2]" />
                    <RichText text={t} />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted">O arquivo final foi para a Biblioteca.</p>
          </div>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
        {/* Quadro de tarefas */}
        <div className="rounded-[20px] border border-line bg-white p-3">
          <div className="px-2 pt-1 pb-2 text-xs font-bold tracking-wider text-muted uppercase">Quadro</div>
          <div className="space-y-1.5">
            {p.tasks.map((t, i) => {
              const locked = i > p.current
              const on = i === view
              const k = KIND[t.kind]
              return (
                <button
                  key={t.id}
                  disabled={locked}
                  onClick={() => {
                    setView(i)
                    setHint(false)
                    setAsking(false)
                    setRun(null)
                  }}
                  className={`flex w-full items-start gap-2.5 rounded-xl border-2 p-2.5 text-left transition ${on ? 'border-[#3e63f2] bg-[#f3f6ff]' : 'border-transparent hover:bg-slate-50'} ${locked ? 'opacity-50' : ''}`}
                >
                  <span className="mt-0.5 shrink-0">
                    {t.done ? <CheckCircle2 size={17} className="text-[#0f8a63]" /> : locked ? <Lock size={16} className="text-slate-400" /> : <span className="block h-[17px] w-[17px] rounded-full border-2 border-[#3e63f2] bg-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] font-bold text-muted">{t.id}</span>
                      <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-px text-[10.5px] font-bold ${k.cls}`}>
                        {k.icon}
                        {k.label}
                      </span>
                    </span>
                    <span className={`mt-0.5 block text-[13px] leading-snug font-semibold ${t.done ? 'text-slate-500' : ''}`}>{locked ? 'Bloqueada' : t.title}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {task && (
          <div className="min-w-0 space-y-4">
            {/* Mensagem do gerente */}
            <div className="rounded-[20px] border border-line bg-white p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Avatar name={p.manager.name} from={s.from} to={s.to} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-bold">{p.manager.name}</span>
                    <span className="text-xs text-muted">{p.manager.role}</span>
                  </div>
                  <div className="mt-1.5 rounded-2xl rounded-tl-md bg-[#f3f5fa] px-4 py-3 text-[14.5px] leading-relaxed text-slate-800">{task.message}</div>
                </div>
              </div>
              <div className="mt-4 sm:pl-[52px]">
                <div className="mb-1.5 flex items-center gap-2 text-xs font-bold tracking-wider text-muted uppercase">
                  {task.id} · {task.title}
                </div>
                <ul className="space-y-1.5">
                  {task.criteria.map((c, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                      {task.done ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#0f8a63]" /> : <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-2 border-slate-300" />}
                      <RichText text={c} />
                    </li>
                  ))}
                </ul>
                {task.fn && (
                  <p className="mt-2.5 text-xs text-muted">
                    Função: <code className="rounded-md bg-[#eef0f6] px-1.5 py-0.5 font-mono text-[12px] text-[#3e63f2]">{task.fn}</code>
                  </p>
                )}
                {isCurrent && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {task.hint && (
                      <button onClick={() => setHint((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#fff4dc] px-3 py-1.5 text-xs font-bold text-[#b7791f] hover:brightness-95">
                        <Lightbulb size={13} /> Dica
                      </button>
                    )}
                    <button onClick={() => setAsking((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#eef2ff] px-3 py-1.5 text-xs font-bold text-[#3e63f2] hover:brightness-95">
                      <MessageCircle size={13} /> Perguntar
                    </button>
                  </div>
                )}
                {hint && task.hint && <div className="capi-pop mt-3 rounded-xl border border-[#ffe08a] bg-[#fffaeb] px-3.5 py-2.5 text-sm text-[#7a5a00]">{task.hint}</div>}

                {(asking || (task.qa?.length ?? 0) > 0) && (
                  <div className="mt-3 space-y-2.5">
                    {(task.qa ?? []).map((x, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-md bg-[#3e63f2] px-3.5 py-2 text-sm text-white">{x.q}</div>
                        <div className="w-fit max-w-[92%] rounded-2xl rounded-tl-md bg-[#f3f5fa] px-3.5 py-2 text-slate-800">
                          <RichText text={x.a} />
                        </div>
                      </div>
                    ))}
                    {asking && isCurrent && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          void ask()
                        }}
                        className="flex gap-2"
                      >
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Pergunte para ${p.manager.name.split(' ')[0]}…`} className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-[#3e63f2]" />
                        <button disabled={!q.trim() || loading === 'perguntar'} className="grid w-10 place-items-center rounded-xl bg-[#3e63f2] text-white disabled:opacity-50">
                          {loading === 'perguntar' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Arquivo do projeto */}
            <IdeWindow
              file={p.fileName}
              actions={
                <>
                  {p.lang === 'javascript' && task.fn && (
                    <button onClick={doRun} disabled={!!loading} className={`${ideBtn} bg-[#5b7cff] text-white hover:brightness-110`}>
                      {loading === 'rodar' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />} Rodar
                    </button>
                  )}
                  {isCurrent && !task.done && (
                    <button onClick={deliver} disabled={!!loading || !code.trim()} className={`${ideBtn} bg-[#2fcf9b] text-[#08321f] hover:brightness-110`}>
                      {loading === 'entregar' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {loading === 'entregar' ? 'Revisando…' : 'Entregar'}
                    </button>
                  )}
                  {!isCurrent && (
                    <span className={`${ideBtn} bg-white/10 text-[#8a93a8]`}>
                      <Eye size={13} /> {p.finishedAt ? 'Projeto entregue' : 'Tarefa entregue'}
                    </span>
                  )}
                </>
              }
            >
              <CodeEditor value={code} onChange={setCode} readOnly={!!p.finishedAt} lang={p.lang} bare tall />
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

            {/* Code review do gerente */}
            {fb && (
              <div className={`capi-pop rounded-[20px] border-2 bg-white p-5 ${fb.ok ? 'border-[#9fe6cb]' : 'border-[#ffd1d7]'}`}>
                <div className="flex items-start gap-3">
                  <Avatar name={p.manager.name} from={s.from} to={s.to} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${fb.ok ? 'bg-[#e9f9f2] text-[#0f8a63]' : 'bg-[#ffecef] text-[#c9273b]'}`}>{fb.ok ? 'Aprovado' : 'Precisa de ajuste'}</span>
                      <span className="text-xs text-muted">
                        {task.attempts} {task.attempts === 1 ? 'entrega' : 'entregas'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-800">{fb.summary}</p>
                    {fb.points.length > 0 && (
                      <ul className="mt-2.5 space-y-1.5">
                        {fb.points.map((pt, i) => (
                          <li key={i} className="flex gap-2 text-sm text-slate-700">
                            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${fb.ok ? 'bg-[#0f8a63]' : 'bg-[#c9273b]'}`} />
                            <RichText text={pt} />
                          </li>
                        ))}
                      </ul>
                    )}
                    {fb.next && !p.finishedAt && <p className="mt-2.5 text-sm font-semibold text-slate-800">{fb.next}</p>}
                    {fb.ok && isCurrent && view < p.tasks.length - 1 && (
                      <button onClick={nextTask} className="mt-4 rounded-xl bg-[#3e63f2] px-4 py-2 text-sm font-bold text-white hover:brightness-110">
                        Próxima tarefa
                      </button>
                    )}
                    {fb.ok && view === p.tasks.length - 1 && !p.finishedAt && (
                      <button onClick={() => void finish(code)} disabled={!!loading} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#3e63f2] px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60">
                        {loading === 'final' && <Loader2 size={14} className="animate-spin" />} {loading === 'final' ? 'Fechando o projeto…' : 'Entregar projeto'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
