import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Clock3, Flag, Timer, X } from 'lucide-react'
import { AREAS, useSettings, useSubjects, useTopics, useWeek } from '../db/hooks'
import { currentWeekId } from '../db/repo'
import { logSimulado, logSimuladoError } from '../db/practice'
import { AIError, getAI } from '../lib/ai'
import { addBatch, defaultRushState, genPrompt, parseLoose, planBatch, rawList, type RushQ, type RushState } from '../lib/rush'
import { tint } from '../lib/colors'
import { Capybara } from '../components/Capybara'
import { MathText } from '../components/MathText'
import { SubjectIcon } from '../components/SubjectIcon'
import { Spinner } from '../components/Voice'
import { Card } from '../components/ui'
import { showMascot } from '../lib/mascotBus'
import { useCountUp } from './rush/RushFx'
import { Fx } from '../components/Fx'

const SIZES = [10, 20, 45]
const PER_Q = [2, 3, 4]

type Phase = 'config' | 'gerando' | 'prova' | 'resultado'
interface Answer {
  choice: number | null
  ms: number
}

/** Simulado cronometrado: só múltipla escolha, sem ajudas, nota no fim. */
export function Simulado() {
  const navigate = useNavigate()
  const subjects = useSubjects()
  const topics = useTopics()
  const settings = useSettings()
  const week = useWeek(currentWeekId())
  const [phase, setPhase] = useState<Phase>('config')
  const [size, setSize] = useState(20)
  const [perQ, setPerQ] = useState(3)
  const [chosen, setChosen] = useState<string[]>([])
  const [qs, setQs] = useState<RushQ[]>([])
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [short, setShort] = useState(0)
  const [deadline, setDeadline] = useState(0)
  const [now, setNow] = useState(Date.now())
  const qStart = useRef(0)
  const ctl = useRef<AbortController | null>(null)

  // matérias da semana temática por padrão
  useEffect(() => {
    if (chosen.length || !subjects.length) return
    const th = week?.themes ? Object.values(week.themes).filter((id): id is string => !!id && subjects.some((s) => s.id === id)) : []
    setChosen(th.length ? th : subjects.slice(0, 3).map((s) => s.id))
  }, [week, subjects, chosen.length])

  // relógio
  useEffect(() => {
    if (phase !== 'prova') return
    const t = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(t)
  }, [phase])
  const left = Math.max(0, deadline - now)
  useEffect(() => {
    if (phase === 'prova' && left === 0 && deadline) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase])

  const topicName = (id: string) => topics.find((t) => t.id === id)?.name
  const subjName = (id: string) => subjects.find((s) => s.id === id)?.name ?? 'Matéria'

  const generate = async () => {
    setError('')
    setPhase('gerando')
    const ai = await getAI()
    if (!ai) {
      setError('A IA só funciona com o Mendonça aberto pelo claude.ai.')
      setPhase('config')
      return
    }
    ctl.current?.abort()
    const c = (ctl.current = new AbortController())
    // estado temporário do Rush só para planejar e normalizar as questões
    const S: RushState = defaultRushState()
    S.started = true
    S.cfg.subjects = chosen.map((id) => ({ id, focus: '', topicIds: [] }))
    S.cfg.format = 'multipla'
    S.cfg.level = settings.targetExam ? `estilo ${settings.targetExam}, nível de prova` : 'nível ENEM/vestibular, como numa prova de verdade'
    S.cfg.mix = 50
    S.level = 5 // dificuldade média de prova
    S.stats.done = 999 // evita a leva "de aquecimento"
    S.nextBoss = 1e9 // sem chefão
    const out: RushQ[] = []
    try {
      const batches = Math.ceil(size / 5)
      for (let b = 0; b < batches && !c.signal.aborted; b++) {
        setProgress(`Gerando questões… ${Math.min(size, b * 5)}/${size}`)
        const n = Math.min(5, size - b * 5)
        const plan = planBatch(S, n, topicName)
        const text = await ai.text(genPrompt(S, plan, subjName), { tier: 'default', fresh: true, signal: c.signal })
        const raw = rawList(parseLoose(text))
        const before = S.queue.length
        addBatch(S, plan, raw)
        out.push(...S.queue.slice(before).filter((q) => q.formato === 'multipla'))
      }
    } catch (e) {
      if ((e as AIError).code === 'cancelled') return
      if (!out.length) {
        setError(e instanceof AIError ? e.message : 'Não consegui gerar o simulado. Tente de novo.')
        setPhase('config')
        return
      }
    }
    if (out.length < 5) {
      setError('A IA não mandou questões suficientes. Tente de novo.')
      setPhase('config')
      return
    }
    const list = out.slice(0, size)
    setShort(list.length < size ? size - list.length : 0)
    setQs(list)
    setAnswers([])
    setI(0)
    setSel(null)
    setDeadline(Date.now() + list.length * perQ * 60000)
    setNow(Date.now())
    qStart.current = Date.now()
    setPhase('prova')
  }

  const answer = (choice: number | null) => {
    const a: Answer = { choice, ms: Date.now() - qStart.current }
    const next = [...answers, a]
    setAnswers(next)
    setSel(null)
    if (i + 1 >= qs.length) finish(next)
    else {
      setI(i + 1)
      qStart.current = Date.now()
    }
  }

  const finish = async (final = answers) => {
    const all = qs.map((_, k) => final[k] ?? { choice: null, ms: 0 })
    setAnswers(all)
    setPhase('resultado')
    // registra por matéria/tópico, erros e aviso
    const rows = new Map<string, { subjectId: string; topicId?: string; done: number; correct: number }>()
    qs.forEach((q, k) => {
      const key = `${q.materia}|${q.topicId ?? ''}`
      const r = rows.get(key) ?? { subjectId: q.materia, topicId: q.topicId, done: 0, correct: 0 }
      r.done++
      if (all[k].choice === q.correta) r.correct++
      rows.set(key, r)
    })
    await logSimulado([...rows.values()]).catch(() => undefined)
    await Promise.all(qs.map((q, k) => (all[k].choice === q.correta ? null : logSimuladoError(q, all[k].choice)))).catch(() => undefined)
    const correct = qs.filter((q, k) => all[k].choice === q.correta).length
    const pct = Math.round((100 * correct) / qs.length)
    showMascot({ pose: pct >= 70 ? 'comemorando' : 'pensando', title: `Simulado: ${pct}%`, text: pct >= 70 ? 'Nível de aprovação! Os erros já estão no caderno para você revisar.' : 'Os erros foram para o caderno. Revise e tenta de novo em uns dias.', autoHideMs: 8000 })
  }

  const fmt = (ms: number) => {
    const s = Math.max(0, Math.round(ms / 1000))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  if (phase === 'config')
    return (
      <Card className="mx-auto max-w-3xl p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-4">
          <Capybara pose="focado" size={90} />
          <div>
            <h2 className="font-display text-3xl font-extrabold">Simulado</h2>
            <p className="text-sm text-muted">Como numa prova de verdade: só múltipla escolha, tempo marcado, sem dica, sem Mendi, sem efeitos. A nota e os erros entram nas suas estatísticas.</p>
          </div>
        </div>
        <div className="space-y-5">
          <div>
            <div className="mb-2 text-sm font-bold">Matérias</div>
            {AREAS.map((a) => {
              const list = subjects.filter((s) => s.areaId === a.id)
              if (!list.length) return null
              return (
                <div key={a.id} className="mb-2">
                  <div className="mb-1 text-[11px] font-bold tracking-wider text-muted uppercase">{a.name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((s) => {
                      const on = chosen.includes(s.id)
                      return (
                        <button key={s.id} onClick={() => setChosen(on ? chosen.filter((x) => x !== s.id) : [...chosen, s.id])} aria-pressed={on} className={`flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm font-semibold transition ${on ? 'text-white' : 'border-line bg-white'}`} style={on ? { background: s.color, borderColor: s.color } : undefined}>
                          <SubjectIcon subject={s} size={22} /> {s.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {week?.themes && <p className="text-[11px] text-muted">Pré-selecionadas: as matérias da semana temática.</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-bold">Questões</div>
              <div className="flex gap-2">
                {SIZES.map((n) => (
                  <button key={n} onClick={() => setSize(n)} className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold ${size === n ? 'border-brand bg-brand text-white' : 'border-line bg-white'}`}>
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted">45 = meio ENEM de uma área.</p>
            </div>
            <div>
              <div className="mb-2 text-sm font-bold">Tempo por questão</div>
              <div className="flex gap-2">
                {PER_Q.map((n) => (
                  <button key={n} onClick={() => setPerQ(n)} className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold ${perQ === n ? 'border-brand bg-brand text-white' : 'border-line bg-white'}`}>
                    {n} min
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Total: {size * perQ} min. Vestibular dá cerca de 3.
              </p>
            </div>
          </div>
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</p>}
          <button disabled={!chosen.length} onClick={generate} className="flex items-center gap-2 rounded-2xl bg-ink px-7 py-3.5 font-display text-lg font-bold text-white shadow-[0_6px_0_#000] transition active:translate-y-1 disabled:opacity-40">
            <Timer size={18} /> Começar simulado
          </button>
        </div>
      </Card>
    )

  if (phase === 'gerando')
    return (
      <Card className="mx-auto flex max-w-xl flex-col items-center gap-3 p-10 text-center">
        <Capybara pose="pensando" size={120} />
        <h3 className="font-display text-2xl font-bold">Montando sua prova…</h3>
        <Spinner size={26} />
        <p className="text-sm text-muted">{progress || 'Preparando…'}</p>
        <p className="text-xs text-muted">Uns 15 a 30 segundos a cada 5 questões. O relógio só começa quando a prova abrir.</p>
        <button
          onClick={() => {
            ctl.current?.abort()
            setPhase('config')
          }}
          className="text-sm font-semibold text-muted hover:text-ink"
        >
          Cancelar
        </button>
      </Card>
    )

  if (phase === 'prova') {
    const q = qs[i]
    const s = subjects.find((x) => x.id === q.materia)
    const urgent = left < 60000 * Math.max(1, Math.round(qs.length * 0.1))
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-bold text-muted">
            Questão {i + 1} de {qs.length}
            {short > 0 && <span className="ml-2 text-xs font-semibold text-amber-700">(a IA mandou {qs.length} de {qs.length + short}; o tempo foi ajustado)</span>}
          </span>
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-display text-base font-extrabold tabular-nums ${urgent ? 'bg-rose-100 text-rose-700' : 'bg-[#16181d] text-white'}`}>
            <Clock3 size={15} /> {fmt(left)}
          </span>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[#e6e8ee]">
          <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${(i / qs.length) * 100}%` }} />
        </div>
        <Card key={q.id} className="page-in p-6 sm:p-8">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="rounded-full px-2.5 py-1" style={{ background: tint(s?.color ?? '#3e63f2', 0.14), color: s?.color }}>
              {s?.name}
            </span>
            {q.topico && <span className="rounded-full bg-[#f1f2f5] px-2.5 py-1 text-muted">{q.topico}</span>}
          </div>
          <MathText text={q.enunciado} className="mb-5 text-[17px] leading-relaxed font-semibold whitespace-pre-wrap" />
          <div className="grid gap-2" role="radiogroup">
            {q.alternativas.map((a, k) => (
              <button key={k} onClick={() => setSel(k)} aria-pressed={sel === k} className={`grid grid-cols-[34px_1fr] items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left font-semibold transition ${sel === k ? 'border-ink bg-[#f1f2f5]' : 'border-line bg-white hover:border-slate-300'}`}>
                <span className={`grid h-[34px] w-[34px] place-items-center rounded-full font-display font-bold ${sel === k ? 'bg-ink text-white' : 'bg-[#f1f2f5]'}`}>{'ABCDE'[k]}</span>
                <MathText as="span" text={a} />
              </button>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button disabled={sel == null} onClick={() => answer(sel)} className="flex items-center gap-2 rounded-2xl bg-ink px-5 py-3 font-display font-bold text-white disabled:opacity-40">
              {i + 1 >= qs.length ? 'Finalizar' : 'Próxima'} <Check size={16} />
            </button>
            <button onClick={() => answer(null)} className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-muted hover:bg-slate-100">
              Deixar em branco
            </button>
            <button onClick={() => finish()} className="ml-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50">
              <Flag size={14} /> Entregar agora
            </button>
          </div>
        </Card>
      </div>
    )
  }

  return <Result qs={qs} answers={answers} subjects={subjects} onAgain={() => setPhase('config')} onHome={() => navigate('/')} />
}

function Result({ qs, answers, subjects, onAgain, onHome }: { qs: RushQ[]; answers: Answer[]; subjects: ReturnType<typeof useSubjects>; onAgain: () => void; onHome: () => void }) {
  const correct = qs.filter((q, k) => answers[k]?.choice === q.correta).length
  const blank = answers.filter((a) => a.choice == null).length
  const pct = Math.round((100 * correct) / qs.length)
  const shown = useCountUp(pct, 1200)
  const avg = answers.reduce((a, x) => a + x.ms, 0) / Math.max(1, answers.length)
  const bySub = useMemo(() => {
    const m = new Map<string, { done: number; correct: number }>()
    qs.forEach((q, k) => {
      const r = m.get(q.materia) ?? { done: 0, correct: 0 }
      r.done++
      if (answers[k]?.choice === q.correta) r.correct++
      m.set(q.materia, r)
    })
    return [...m.entries()]
  }, [qs, answers])
  const [open, setOpen] = useState<number | null>(null)
  const color = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="p-6 text-center sm:p-8">
        <Capybara pose={pct >= 70 ? 'comemorando' : pct >= 50 ? 'pensando' : 'chorando'} size={120} />
        <div className="mt-2 font-display text-6xl font-extrabold tabular-nums" style={{ color }}>
          {shown}%
        </div>
        <p className="text-muted">
          {correct} de {qs.length} certas{blank ? ` · ${blank} em branco` : ''} · média de {Math.round(avg / 1000)}s por questão
        </p>
        <div className="mx-auto mt-5 grid max-w-md gap-2">
          {bySub.map(([id, r]) => {
            const s = subjects.find((x) => x.id === id)
            const p = Math.round((100 * r.correct) / r.done)
            return (
              <div key={id}>
                <div className="mb-0.5 flex justify-between text-xs font-bold">
                  <span>{s?.name}</span>
                  <span className="text-muted">
                    {p}% · {r.correct}/{r.done}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#eef0f4]">
                  <div className="h-full rounded-full" style={{ width: `${p}%`, background: s?.color ?? '#3e63f2' }} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={onAgain} className="rounded-2xl bg-ink px-5 py-2.5 font-bold text-white">
            Novo simulado
          </button>
          <button onClick={onHome} className="rounded-2xl border border-line bg-white px-5 py-2.5 font-bold">
            Voltar ao início
          </button>
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Gabarito e resoluções</h3>
        <div className="divide-y divide-line">
          {qs.map((q, k) => {
            const a = answers[k]
            const ok = a?.choice === q.correta
            const s = subjects.find((x) => x.id === q.materia)
            return (
              <div key={q.id} className="py-2">
                <button onClick={() => setOpen(open === k ? null : k)} className="flex w-full items-center gap-3 text-left">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white ${ok ? 'bg-emerald-500' : a?.choice == null ? 'bg-slate-400' : 'bg-rose-500'}`}>{k + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{q.enunciado}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {s?.name} · {ok ? 'certa' : a?.choice == null ? 'em branco' : `marcou ${'ABCDE'[a.choice]}, era ${'ABCDE'[q.correta ?? 0]}`}
                  </span>
                </button>
                {open === k && (
                  <div className="mt-2 space-y-2 rounded-2xl bg-[#f6f7f9] p-3 text-sm">
                    <MathText text={q.enunciado} className="font-semibold whitespace-pre-wrap" />
                    {q.alternativas.map((alt, j) => (
                      <div key={j} className={`rounded-xl px-3 py-1.5 ${j === q.correta ? 'bg-emerald-100 font-bold' : j === a?.choice ? 'bg-rose-100' : ''}`}>
                        {'ABCDE'[j]}) <MathText as="span" text={alt} />
                      </div>
                    ))}
                    {q.resolucao && <MathText text={q.resolucao} className="whitespace-pre-wrap text-slate-700" />}
                    {q.ideia && (
                      <p>
                        <b><Fx name="bulb" /> Ideia-chave:</b> <MathText as="span" text={q.ideia} />
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>
      <p className="text-center text-xs text-muted">
        <X size={12} className="inline" /> Erros já estão no Caderno de erros. Tudo contou nas estatísticas, no rank e no domínio.
      </p>
    </div>
  )
}
