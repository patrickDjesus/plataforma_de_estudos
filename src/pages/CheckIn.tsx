import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarRange, Check, Clock3, Layers, Plus, Repeat, Rocket, Target, Trash2, X } from 'lucide-react'
import { db } from '../db/db'
import { AREAS, useSubjects } from '../db/hooks'
import { addSubject, currentWeekId, getSettings, saveCheckin, updateSubject } from '../db/repo'
import { exportBackup } from '../db/repo'
import { Download, GraduationCap } from 'lucide-react'
import type { AreaId, AreaPercents, Availability } from '../db/types'
import { AREA_COLOR } from '../lib/colors'
import { DAY_NAMES, addDays, dayIndex, fmtTime, fmtWeekRange, parseTime, toISODate } from '../lib/dates'
import { SubjectIcon } from '../components/SubjectIcon'
import { ThemeRoulette } from '../components/ThemeRoulette'
import { tint } from '../lib/colors'
import { Capybara, type CapiPose } from '../components/Capybara'
import { LogoMark } from '../components/Logo'
import { guessIcon } from '../components/SubjectIcon'
import { useSettings } from '../db/hooks'
import { loadMastery } from '../db/mastery'
import { suggestThemes, type ThemeSuggestion, type Themes } from '../lib/themes'
import { VoiceTextarea } from '../components/Voice'
import { loadWeekStats, saveRetro } from '../db/retro'
import { RETRO_TAGS, completionRate, hasWeekData, retroHints, trimAvailability, type WeekStats } from '../lib/retro'
import { CATEGORY_LABEL, REASON_LABEL } from '../lib/errors'
import { masteryColor } from '../lib/mastery'
import type { RetroTag, WeekRetro } from '../db/types'
import { FxText, Fx } from '../components/Fx'

const FAC_FLOOR = 66

const PRESETS = [
  { label: 'Manhã', start: 8 * 60, end: 12 * 60 },
  { label: 'Tarde', start: 14 * 60, end: 18 * 60 },
  { label: 'Noite', start: 19 * 60, end: 22 * 60 },
]

/** Ajusta uma área e redistribui o restante entre as outras, mantendo soma 100. */
function rebalance(p: AreaPercents, changed: AreaId, value: number): AreaPercents {
  const others = (Object.keys(p) as AreaId[]).filter((a) => a !== changed)
  const rest = 100 - value
  const otherSum = others.reduce((acc, a) => acc + p[a], 0)
  const next = { ...p, [changed]: value }
  others.forEach((a, i) => {
    next[a] = otherSum === 0 ? rest / others.length : (p[a] / otherSum) * rest
    if (i === others.length - 1) next[a] = 100 - value - others.slice(0, -1).reduce((acc, o) => acc + Math.round(next[o]), 0)
    next[a] = Math.max(0, Math.round(next[a]))
  })
  return next
}

type Step = 'retro' | 'inicio' | 'foco' | 'horarios' | 'materias' | 'resumo'
const STEPS: { id: Exclude<Step, 'inicio' | 'retro'>; label: string; icon: typeof Target }[] = [
  { id: 'foco', label: 'Foco', icon: Target },
  { id: 'horarios', label: 'Horários', icon: Clock3 },
  { id: 'materias', label: 'Matérias', icon: Layers },
  { id: 'resumo', label: 'Resumo', icon: Check },
]

const totalMinutes = (av: Availability, fromDay = 0) => av.slice(fromDay).flat().reduce((acc, w) => acc + Math.max(0, w.end - w.start), 0)

export function CheckInPage() {
  const navigate = useNavigate()
  // Sábado à tarde ou domingo: já planeja a semana que vem
  const planningNext = dayIndex() === 6 || (dayIndex() === 5 && new Date().getHours() >= 12)
  const weekId = planningNext ? addDays(currentWeekId(), 7) : currentWeekId()
  const subjects = useSubjects()
  const existing = useLiveQuery(() => db.weeks.get(weekId), [weekId])
  const [percents, setPercents] = useState<AreaPercents | null>(null)
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [paused, setPaused] = useState<string[]>([])
  const [confirmLow, setConfirmLow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<Step>('inicio')
  const [newSubject, setNewSubject] = useState<Record<string, string>>({})
  const settings = useSettings()
  const weekEnd = addDays(weekId, 6)
  const reviewsThisWeek = useLiveQuery(() => db.reviews.where('due').belowOrEqual(weekEnd).count(), [weekEnd], 0)
  const today = planningNext ? 0 : dayIndex()
  const prevWeekId = addDays(weekId, -7)
  const [prevStats, setPrevStats] = useState<WeekStats | null>(null)
  const [prevRetro, setPrevRetro] = useState<WeekRetro | undefined>()
  const [trimmed, setTrimmed] = useState(false)
  // Semana temática: uma matéria por área
  const [themeOn, setThemeOn] = useState(true)
  const [themes, setThemes] = useState<Themes>({})
  const [suggested, setSuggested] = useState<Partial<Record<AreaId, ThemeSuggestion>>>({})
  // Roleta da matéria da semana (Ensino Médio): gira uma vez por semana, ao chegar nas matérias
  const [roulette, setRoulette] = useState<'fechada' | 'aberta' | 'feita'>('fechada')
  const [rouletteWon, setRouletteWon] = useState(false)
  const [lastEnsino, setLastEnsino] = useState<string | undefined>()
  // Horas por dia (padrão) ou horários fixos
  const [mode, setMode] = useState<'horas' | 'horarios'>('horas')
  const [daily, setDaily] = useState<number[]>([0, 0, 0, 0, 0, 0, 0])

  useEffect(() => {
    if (percents) return
    getSettings().then((s) => {
      db.weeks.get(weekId).then((w) => {
        setPercents(w?.percents ?? s.lastPercents)
        // Descarta horários corrompidos (ex.: salvos vazios por versões antigas)
        const av = w?.availability ?? s.defaultAvailability
        const cleanAv = Array.from({ length: 7 }, (_, d) => (av[d] ?? []).filter((x) => Number.isFinite(x.start) && Number.isFinite(x.end)))
        setAvailability(cleanAv)
        setMode(w ? (w.dailyMinutes ? 'horas' : 'horarios') : (s.scheduleMode ?? 'horas'))
        // Sem metas salvas: começa com o tempo livre de cada dia, arredondado a 15 min
        setDaily(w?.dailyMinutes ?? s.defaultDailyMinutes ?? cleanAv.map((d) => Math.round(d.reduce((a, x) => a + Math.max(0, x.end - x.start), 0) / 15) * 15))
        setPaused(w?.pausedSubjectIds ?? [])
        Promise.all([db.weeks.toArray(), db.subjects.toArray(), loadMastery()]).then(([weeks, subs, mm]) => {
          const active = subs.filter((x) => !(w?.pausedSubjectIds ?? []).includes(x.id))
          const sug = suggestThemes(active, weeks.map((x) => ({ weekId: x.id, themes: x.themes })), Object.fromEntries(mm.subjects), weekId)
          setSuggested(sug)
          const prev = weeks.filter((x) => x.id < weekId && x.themes).sort((a, b) => b.id.localeCompare(a.id))[0]
          setLastEnsino(prev?.themes?.ensino)
          if (w?.themes?.ensino) setRoulette('feita') // semana já planejada: a roleta já rodou
          setThemeOn(w ? !!w.themes : s.themeWeeks !== false)
          setThemes(w?.themes ?? Object.fromEntries(Object.entries(sug).map(([a, v]) => [a, v!.id])))
        })
      })
    })
    Promise.all([loadWeekStats(prevWeekId), db.weeks.get(prevWeekId)]).then(([st, pw]) => {
      setPrevStats(st)
      setPrevRetro(pw?.retro)
      // Revisão semanal: primeiro passo quando a semana passada teve estudo e ainda não foi revisada
      if (hasWeekData(st) && !pw?.retro) setStep('retro')
    })
  }, [weekId, percents, prevWeekId])
  const hints = useMemo(() => retroHints(prevStats, prevRetro), [prevStats, prevRetro])
  const ensinoActive = subjects.filter((x) => x.areaId === 'ensino' && !paused.includes(x.id))
  useEffect(() => {
    if (step === 'materias' && themeOn && roulette === 'fechada' && ensinoActive.length > 1) setRoulette('aberta')
  }, [step, themeOn, roulette, ensinoActive.length])

  const minutes = useMemo(() => (mode === 'horas' ? daily.slice(today).reduce((a, m) => a + m, 0) : availability ? totalMinutes(availability, today) : 0), [mode, daily, availability, today])
  if (!percents || !availability) return null

  const lowFac = percents.faculdade < FAC_FLOOR
  const canSave = !lowFac || confirmLow

  // Só os temas válidos (matéria existe e não está pausada)
  const cleanThemes = (ps: string[]): Themes | null => {
    if (!themeOn) return null
    const t: Themes = {}
    for (const [a, id] of Object.entries(themes) as [AreaId, string][]) if (id && subjects.some((x) => x.id === id && !ps.includes(id))) t[a] = id
    return Object.keys(t).length ? t : null
  }
  const submit = async (p = percents, av = availability, ps = paused) => {
    setSaving(true)
    await saveCheckin(weekId, p, av, ps, cleanThemes(ps), mode === 'horas' ? daily : null)
    navigate('/calendario', { replace: true })
  }

  const repeatLast = async () => {
    const s = await getSettings()
    await submit(s.lastPercents, s.defaultAvailability, [])
  }

  const setWin = (day: number, idx: number, key: 'start' | 'end', value: string) => {
    // Campo apagado ("--:--") não vira horário: mantém o anterior
    if (!/^\d{1,2}:\d{2}/.test(value)) return
    const next = availability.map((d) => d.map((w) => ({ ...w })))
    next[day][idx][key] = parseTime(value)
    setAvailability(next)
  }
  const addWin = (day: number) => {
    const next = availability.map((d) => [...d])
    const last = next[day].at(-1)
    const start = last ? Math.min(last.end + 60, 22 * 60) : 19 * 60
    next[day].push({ start, end: Math.min(start + 120, 23 * 60 + 59) })
    setAvailability(next)
  }
  const addPreset = (day: number, start: number, end: number) => {
    const next = availability.map((d) => [...d])
    if (!next[day].some((w) => w.start === start && w.end === end)) next[day] = [...next[day], { start, end }].sort((a, b) => a.start - b.start)
    setAvailability(next)
  }
  const copyWeekdays = () => setAvailability(availability.map((d, i) => (i >= 1 && i <= 4 ? availability[0].map((w) => ({ ...w })) : d)))
  const removeWin = (day: number, idx: number) => {
    const next = availability.map((d) => [...d])
    next[day].splice(idx, 1)
    setAvailability(next)
  }

  const availabilityEditor = (
      <>
        {/* Régua de horas */}
        <div className="mb-1 hidden pl-[118px] sm:block">
          <div className="relative h-4 text-[10px] font-semibold text-muted">
            {[6, 9, 12, 15, 18, 21, 24].map((h) => (
              <span key={h} className="absolute -translate-x-1/2" style={{ left: `${((h - 6) / 18) * 100}%` }}>
                {h}h
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {DAY_NAMES.map((name, day) => {
            const wins = availability[day]
            const mins = wins.reduce((a, w) => a + Math.max(0, w.end - w.start), 0)
            const past = day < today
            return (
              <div key={day} className={`rounded-2xl border border-line p-3 transition ${past ? 'opacity-40' : 'hover:border-slate-300'}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-[106px] shrink-0">
                    <div className="text-sm font-bold">{name}</div>
                    <div className="text-xs text-muted">{mins ? `${(mins / 60).toFixed(1).replace('.0', '')}h livres` : 'sem estudo'}</div>
                  </div>
                  {/* Linha do tempo 6h–24h */}
                  <div className="relative hidden h-7 flex-1 overflow-hidden rounded-full bg-[#f1f2f5] sm:block">
                    {[9, 12, 15, 18, 21].map((h) => (
                      <span key={h} className="absolute top-0 bottom-0 w-px bg-white" style={{ left: `${((h - 6) / 18) * 100}%` }} />
                    ))}
                    {wins.map((w, i) => {
                      const a = Math.max(0, (w.start - 360) / (18 * 60))
                      const b = Math.min(1, (w.end - 360) / (18 * 60))
                      if (b <= a) return null
                      return (
                        <span
                          key={i}
                          className="absolute top-1 bottom-1 rounded-full bg-gradient-to-r from-[#5b7cff] to-[#3e63f2] shadow-[0_4px_10px_-4px_rgba(62,99,242,0.8)]"
                          style={{ left: `${a * 100}%`, width: `${(b - a) * 100}%` }}
                        />
                      )
                    })}
                  </div>
                  <div className="flex gap-1">
                    {PRESETS.map((p) => (
                      <button
                        key={p.label}
                        onClick={() => addPreset(day, p.start, p.end)}
                        className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-brand/40 hover:bg-brand-soft hover:text-brand"
                        title={`${fmtTime(p.start)}–${fmtTime(p.end)}`}
                      >
                        + {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                {wins.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2 sm:pl-[118px]">
                    {wins.map((w, idx) => (
                      <div key={idx} title={w.end <= w.start ? 'O fim precisa ser depois do início (horários após meia-noite não são aceitos)' : undefined} className={`flex items-center gap-1.5 rounded-xl py-1 pr-1.5 pl-3 ${w.end <= w.start ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-300' : 'bg-brand-soft text-brand'}`}>
                        <input type="time" value={fmtTime(w.start)} onChange={(e) => setWin(day, idx, 'start', e.target.value)} className="bg-transparent text-sm font-bold outline-none" aria-label="Início" />
                        <span className="opacity-60">→</span>
                        <input type="time" value={fmtTime(w.end)} onChange={(e) => setWin(day, idx, 'end', e.target.value)} className="bg-transparent text-sm font-bold outline-none" aria-label="Fim" />
                        <button onClick={() => removeWin(day, idx)} className="rounded-lg p-1 opacity-60 hover:bg-white hover:text-rose-600 hover:opacity-100" aria-label="Remover horário">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => addWin(day)} className="flex items-center gap-1 rounded-xl border border-dashed border-line px-3 py-1 text-xs font-semibold text-muted hover:border-brand/40 hover:text-brand">
                      <Plus size={14} /> horário
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </>
  )

  const name = settings.userName?.trim() || 'estudante'
  const stepIdx = STEPS.findIndex((x) => x.id === step)
  const go = (dir: 1 | -1) => {
    if (step === 'retro') return setStep('inicio')
    if (step === 'inicio') return setStep('foco')
    const i = stepIdx + dir
    setStep(i < 0 ? 'inicio' : STEPS[Math.min(i, STEPS.length - 1)].id)
  }
  const badWindows = availability.flat().filter((w) => w.end <= w.start).length
  const canContinue = step === 'foco' ? canSave : step === 'horarios' ? (mode === 'horas' ? minutes > 0 : badWindows === 0) : true
  const hours = (m: number) => `${(m / 60).toFixed(1).replace('.0', '')}h`
  const active = subjects.filter((s) => !paused.includes(s.id))

  const CAPI: Record<Step, { pose: CapiPose; text: string }> = {
    retro: { pose: 'pensando', text: `Antes de planejar, ${name}, bora olhar a semana passada? O que funcionou e o que travou?` },
    inicio: { pose: 'acenando', text: existing ? `Oi, ${name}! Mudou alguma coisa? Bora reajustar a semana.` : planningNext ? `Oi, ${name}! Fim de semana é hora de deixar a próxima pronta. Bora?` : `Oi, ${name}! Semana nova chegando. Bora planejar juntos?` },
    foco: { pose: 'pensando', text: 'Onde você quer colocar sua energia esta semana?' },
    horarios: { pose: 'focado', text: mode === 'horas' ? 'Quantas horas você quer estudar em cada dia?' : 'Quando você vai ter tempo livre para estudar?' },
    materias: { pose: 'relaxando', text: subjects.length ? 'Alguma matéria vai ficar de fora esta semana?' : 'Primeiro me conta: o que você está estudando?' },
    resumo: { pose: 'comemorando', text: 'Tudo pronto! Confere aí antes de eu montar sua rota.' },
  }
  const capi = CAPI[step]

  const quickAdd = async (areaId: AreaId) => {
    const n = (newSubject[areaId] ?? '').trim()
    if (!n) return
    const id = await addSubject(areaId, n)
    await updateSubject(id, { icon: guessIcon(n) })
    setNewSubject({ ...newSubject, [areaId]: '' })
  }

  return (
    <div className="page-in relative flex min-h-screen flex-col overflow-hidden bg-[#f3f4f7]">
      {/* fundo decorativo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-[#3e63f2]/12 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[480px] w-[480px] rounded-full bg-[#ff9a3d]/12 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-[420px] w-[420px] rounded-full bg-[#2fd89a]/10 blur-3xl" />
      </div>

      {/* topo */}
      <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-2.5">
          <LogoMark size={38} />
          <div className="leading-none">
            <div className="font-display text-[17px] font-bold">Mendonça</div>
            <div className="mt-1 text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">Check-in da semana</div>
          </div>
        </div>
        {step !== 'inicio' && step !== 'retro' && (
          <ol className="hidden items-center gap-2 md:flex">
            {STEPS.map((x, i) => {
              const Icon = x.icon
              const state = i < stepIdx ? 'feito' : i === stepIdx ? 'atual' : 'depois'
              return (
                <li key={x.id} className="flex items-center gap-2">
                  <button
                    onClick={() => i <= stepIdx && setStep(x.id)}
                    className={`flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 text-sm font-semibold transition ${
                      state === 'atual' ? 'bg-white text-ink shadow-sm' : state === 'feito' ? 'text-brand' : 'text-muted'
                    }`}
                  >
                    <span className={`grid h-7 w-7 place-items-center rounded-full ${state === 'depois' ? 'bg-white/70 text-muted' : 'bg-brand text-white'}`}>
                      {state === 'feito' ? <Check size={15} /> : <Icon size={15} />}
                    </span>
                    {x.label}
                  </button>
                  {i < STEPS.length - 1 && <span className={`h-0.5 w-6 rounded ${i < stepIdx ? 'bg-brand' : 'bg-slate-300/70'}`} />}
                </li>
              )
            })}
          </ol>
        )}
        <button
          onClick={() => navigate(existing ? '/calendario' : '/materias')}
          className="flex items-center gap-1.5 rounded-full bg-white/70 px-3.5 py-2 text-sm font-semibold text-slate-600 backdrop-blur hover:bg-white"
          title={existing ? 'Voltar sem mudar nada' : 'Entrar no site sem planejar agora'}
        >
          <X size={16} /> {existing ? 'Fechar' : 'Pular por agora'}
        </button>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 pb-6 lg:flex-row lg:items-start lg:gap-10">
        {/* Capi perguntando */}
        <aside className="flex shrink-0 items-end gap-2 lg:sticky lg:top-8 lg:w-[300px] lg:flex-col lg:items-start">
          <div key={step} className="capi-pop relative order-2 rounded-[22px] border border-line bg-white px-5 py-4 shadow-[0_18px_40px_-20px_rgba(16,24,40,0.35)] lg:order-1">
            <p className="font-display text-lg leading-snug font-bold text-ink">{capi.text}</p>
            <span className="absolute bottom-5 -left-2 h-4 w-4 rotate-45 border-b border-l border-line bg-white lg:-bottom-2 lg:left-14 lg:border-t-0 lg:border-r lg:border-b lg:border-l-0" />
          </div>
          <div className="order-1 shrink-0 lg:order-2 lg:pl-4">
            <Capybara key={capi.pose} pose={capi.pose} size={step === 'inicio' ? 190 : 150} />
          </div>
        </aside>

        {/* Conteúdo do passo */}
        <section key={`s-${step}`} className="capi-pop min-w-0 flex-1">
          {step === 'retro' && prevStats && (
            <RetroStep
              stats={prevStats}
              onDone={async (worked, blocked, tags) => {
                await saveRetro(prevWeekId, worked, blocked, tags)
                setPrevRetro({ worked, blocked, tags, at: Date.now() })
                setStep('inicio')
              }}
              onSkip={async () => {
                // Pular também conta como revisada, para não perguntar de novo
                await saveRetro(prevWeekId, '', '', [])
                setStep('inicio')
              }}
            />
          )}

          {step === 'inicio' && (
            <div className="rounded-[28px] border border-line bg-white p-8 shadow-[0_20px_50px_-28px_rgba(16,24,40,0.35)] sm:p-10">
              <p className="mb-3 inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-bold tracking-wider text-brand uppercase">{fmtWeekRange(weekId)}</p>
              <h1 className="text-4xl font-extrabold sm:text-5xl">{existing ? 'Reajustar a semana' : planningNext ? 'Planejar a próxima semana' : 'Nova semana, novo foco'}</h1>
              {planningNext && <p className="mt-2 text-sm font-semibold text-brand">Fim de semana: o plano vale para a semana que começa segunda.</p>}
              {subjects.length > 0 && !subjects.some((s) => s.areaId === 'faculdade') && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <GraduationCap size={18} className="shrink-0" />
                  <span className="flex-1">A Faculdade está sem matérias. Sem elas, o planejador não reserva os 2/3 e o tempo vai para as outras áreas.</span>
                  <button onClick={() => navigate('/materias')} className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600">
                    Cadastrar agora
                  </button>
                </div>
              )}
              <p className="mt-3 max-w-lg text-muted">
                Em 4 passos rápidos você define o foco por área, seus horários e as matérias da semana. Eu monto a rota de estudos com revisões incluídas.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <button onClick={() => setStep('foco')} className="group flex items-center gap-4 rounded-2xl bg-brand p-5 text-left text-white shadow-[0_14px_30px_-14px_rgba(62,99,242,0.9)] transition hover:-translate-y-0.5">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/20">
                    <CalendarRange size={24} />
                  </span>
                  <span className="flex-1">
                    <span className="block font-display text-lg font-bold">Planejar esta semana</span>
                    <span className="text-sm text-white/80">Responder as perguntas</span>
                  </span>
                  <ArrowRight className="transition group-hover:translate-x-1" />
                </button>
                {!existing && subjects.length > 0 && (
                  <button onClick={repeatLast} disabled={saving} className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-brand/40">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                      <Repeat size={24} />
                    </span>
                    <span className="flex-1">
                      <span className="block font-display text-lg font-bold">Repetir a semana passada</span>
                      <span className="text-sm text-muted">Mesmo foco e horários, num clique</span>
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'foco' && (
            <StepCard title="Foco por área" subtitle={`${today > 0 ? `Planejando de ${DAY_NAMES[today].toLowerCase()} em diante · ` : ''}${hours(minutes)} disponíveis`}>
              <Hints items={hints.foco} />
              <div className="space-y-7">
                {AREAS.map((a) => (
                  <div key={a.id}>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-3 font-semibold">
                        <span className="subject-icon h-11 w-11 rounded-[14px] font-display text-base font-extrabold" style={{ background: `linear-gradient(145deg, ${AREA_COLOR[a.id]}, color-mix(in srgb, ${AREA_COLOR[a.id]} 72%, #000))` }}>
                          <span className="relative z-10">{a.name[0]}</span>
                        </span>
                        <span className="text-lg">{a.name}</span>
                      </span>
                      <span className="text-right">
                        <span className="font-display text-2xl font-extrabold tabular-nums" style={{ color: AREA_COLOR[a.id] }}>
                          {percents[a.id]}%
                        </span>
                        <span className="block text-xs text-muted">{hours((minutes * percents[a.id]) / 100)}</span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={percents[a.id]}
                      aria-label={`Foco em ${a.name}`}
                      onChange={(e) => {
                        setPercents(rebalance(percents, a.id, Number(e.target.value)))
                        setConfirmLow(false)
                      }}
                      className="h-3.5 w-full cursor-pointer appearance-none rounded-full"
                      style={{ accentColor: AREA_COLOR[a.id], background: `linear-gradient(to right, ${AREA_COLOR[a.id]} ${percents[a.id]}%, #eef0f4 ${percents[a.id]}%)` }}
                    />
                  </div>
                ))}
              </div>
              {lowFac && (
                <div className="mt-6 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <div>
                    A Faculdade está abaixo de 2/3 do tempo ({FAC_FLOOR}%). Semana atípica?
                    <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold">
                      <input type="checkbox" checked={confirmLow} onChange={(e) => setConfirmLow(e.target.checked)} />
                      Sim, quero assim esta semana
                    </label>
                  </div>
                </div>
              )}
            </StepCard>
          )}

          {step === 'horarios' && (
            <StepCard
              title={mode === 'horas' ? 'Horas de estudo por dia' : 'Horários disponíveis'}
              subtitle={mode === 'horas' ? `Sem hora marcada: estude quando quiser no dia · ${hours(minutes)} na semana` : `Pré-preenchido com a semana anterior · ${hours(minutes)} livres`}
              action={
                <button
                  onClick={mode === 'horas' ? () => setDaily(daily.map((m, i) => (i >= 1 && i <= 4 ? daily[0] : m))) : copyWeekdays}
                  className="rounded-xl bg-[#f1f2f5] px-3 py-2 text-xs font-bold text-ink hover:bg-[#e8e9ee]"
                  title="Usa o valor de segunda em todos os dias úteis"
                >
                  Copiar segunda para seg–sex
                </button>
              }
            >
              <div className="mb-4 inline-flex rounded-xl bg-[#f1f2f5] p-1 text-sm font-bold" role="radiogroup" aria-label="Como planejar">
                {(
                  [
                    ['horas', 'Horas por dia'],
                    ['horarios', 'Horários fixos'],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} role="radio" aria-checked={mode === id} onClick={() => setMode(id)} className={`rounded-lg px-3.5 py-1.5 transition ${mode === id ? 'bg-white text-brand shadow-sm' : 'text-muted hover:text-ink'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <Hints items={hints.horarios}>
                {hints.trim && !trimmed && (
                  <button
                    onClick={() => {
                      if (mode === 'horas') setDaily(daily.map((m) => Math.round((m * hints.trim!) / 15) * 15))
                      else setAvailability(trimAvailability(availability, hints.trim!))
                      setTrimmed(true)
                    }}
                    className="mt-2 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
                  >
                    Enxugar {mode === 'horas' ? 'as horas' : 'horários'} para {Math.round(hints.trim * 100)}%
                  </button>
                )}
                {trimmed && <p className="mt-2 text-xs font-bold text-emerald-700"><Fx name="check" size="1.1em" /> Enxuguei. Ajuste à vontade abaixo.</p>}
              </Hints>
              {mode === 'horas' ? (
                <HoursEditor daily={daily} setDaily={setDaily} today={today} />
              ) : (
                <>
                  {badWindows > 0 && (
                    <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                      {badWindows === 1 ? 'Um horário termina' : `${badWindows} horários terminam`} antes de começar. Corrija (em vermelho) para continuar.
                    </p>
                  )}
                  {availabilityEditor}
                </>
              )}
            </StepCard>
          )}

          {roulette === 'aberta' && (
            <ThemeRoulette
              subjects={ensinoActive}
              lastWeekId={lastEnsino}
              onDone={(id) => {
                setThemes((t) => ({ ...t, ensino: id }))
                setRouletteWon(true)
                setRoulette('feita')
              }}
              onSkip={() => setRoulette('feita')}
            />
          )}
          {step === 'materias' && (
            <StepCard title="Matérias desta semana" subtitle={subjects.length ? 'Escolha a matéria da semana de cada área e desligue as que vão ficar de fora.' : 'Cadastre ao menos uma matéria. Depois você detalha os tópicos em Matérias.'}>
              {active.length > 0 && (
                <ThemePanel
                  onSpin={ensinoActive.length > 1 && !rouletteWon ? () => setRoulette('aberta') : undefined}
                  rouletteWon={rouletteWon}
                  on={themeOn}
                  setOn={setThemeOn}
                  themes={themes}
                  setThemes={setThemes}
                  suggested={suggested}
                  active={active}
                />
              )}
              {subjects.length > 0 && (
                <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2">
                  {subjects.map((s) => {
                    const isPaused = paused.includes(s.id)
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          setPaused(isPaused ? paused.filter((p) => p !== s.id) : [...paused, s.id])
                          if (!isPaused && themes[s.areaId] === s.id) setThemes({ ...themes, [s.areaId]: undefined })
                        }}
                        className={`flex items-center gap-3 rounded-2xl border p-2.5 text-left transition ${isPaused ? 'border-line bg-[#fafbfc]' : 'border-transparent'}`}
                        style={isPaused ? undefined : { background: tint(s.color, 0.08), boxShadow: `inset 0 0 0 1.5px ${tint(s.color, 0.35)}` }}
                      >
                        <span className={isPaused ? 'opacity-40 grayscale' : ''}>
                          <SubjectIcon subject={s} size={38} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm font-bold ${isPaused ? 'text-muted line-through' : ''}`}>{s.name}</span>
                          <span className="text-[11px] text-muted">{isPaused ? 'Pausada' : `Peso ${s.weight}${s.mandatory ? ' · obrigatória' : ''}`}</span>
                        </span>
                        <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${isPaused ? 'bg-slate-300' : ''}`} style={isPaused ? undefined : { background: s.color }}>
                          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${isPaused ? 'left-0.5' : 'left-[18px]'}`} />
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="rounded-2xl bg-[#f6f7f9] p-4">
                <div className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">Adicionar matéria</div>
                <div className="grid gap-2 md:grid-cols-3">
                  {AREAS.map((a) => (
                    <div key={a.id} className="flex gap-1.5">
                      <input
                        id={`checkin-new-${a.id}`}
                        value={newSubject[a.id] ?? ''}
                        onChange={(e) => setNewSubject({ ...newSubject, [a.id]: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && quickAdd(a.id)}
                        placeholder={a.name}
                        className="w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
                        style={{ borderLeft: `4px solid ${AREA_COLOR[a.id]}` }}
                      />
                      <button onClick={() => quickAdd(a.id)} className="grid w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: AREA_COLOR[a.id] }} aria-label={`Adicionar em ${a.name}`}>
                        <Plus size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </StepCard>
          )}

          {step === 'resumo' && (
            <StepCard title="Sua semana" subtitle={fmtWeekRange(weekId)}>
              <div className="grid gap-3 sm:grid-cols-3">
                {AREAS.map((a) => (
                  <div key={a.id} className="rounded-2xl p-4" style={{ background: tint(AREA_COLOR[a.id], 0.08), boxShadow: `inset 0 0 0 1.5px ${tint(AREA_COLOR[a.id], 0.3)}` }}>
                    <div className="text-sm font-semibold" style={{ color: AREA_COLOR[a.id] }}>
                      {a.name}
                    </div>
                    {active.some((s) => s.areaId === a.id) ? (
                      <>
                        <div className="mt-1 font-display text-3xl font-extrabold">{hours((minutes * percents[a.id]) / 100)}</div>
                        <div className="text-xs text-muted">
                          {percents[a.id]}% ·{' '}
                          {themeOn && themes[a.id] && active.some((s) => s.id === themes[a.id]) ? (
                            <b className="text-ink">Semana de {active.find((s) => s.id === themes[a.id])!.name}</b>
                          ) : (
                            `${active.filter((s) => s.areaId === a.id).length} matéria(s), variado`
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mt-1 font-display text-3xl font-extrabold text-muted">—</div>
                        <div className="text-xs text-muted">Sem matérias: o tempo vai para as outras áreas</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Summary label="Tempo total" value={hours(minutes)} />
                <Summary label="Blocos de estudo" value={`≈ ${Math.max(0, Math.round(minutes / ((settings.blockMinutes ?? 50) + (settings.breakMinutes ?? 10))))}`} />
                <Summary label="Revisões na semana" value={`${reviewsThisWeek}`} />
              </div>
              {active.length === 0 && <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Nenhuma matéria ativa: o plano sairá vazio. Volte um passo e cadastre ou ligue uma matéria.</p>}
              <BackupCard />
              <button
                onClick={() => submit()}
                disabled={!canSave || saving}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-display text-lg font-bold text-white shadow-[0_16px_34px_-14px_rgba(62,99,242,0.9)] transition hover:-translate-y-0.5 disabled:opacity-50"
              >
                <Rocket size={20} /> {saving ? 'Montando…' : existing ? 'Salvar e regerar plano' : 'Gerar minha semana'}
              </button>
            </StepCard>
          )}

          {step !== 'inicio' && step !== 'retro' && (
            <div className="mt-5 flex items-center justify-between">
              <button onClick={() => go(-1)} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-white">
                <ArrowLeft size={16} /> Voltar
              </button>
              {step !== 'resumo' && (
                <button
                  onClick={() => go(1)}
                  disabled={!canContinue}
                  className="flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white transition hover:bg-black disabled:opacity-40"
                >
                  Continuar <ArrowRight size={16} />
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )

}

function StepCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-line bg-white p-6 shadow-[0_20px_50px_-28px_rgba(16,24,40,0.35)] sm:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f6f7f9] p-4">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  )
}

function Hints({ items, children }: { items: string[]; children?: React.ReactNode }) {
  if (!items.length) return null
  return (
    <div className="mb-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
      <Capybara pose="pensando" size={46} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-extrabold tracking-wider text-amber-700 uppercase">Da sua revisão semanal</div>
        <ul className="mt-1 space-y-1 text-sm text-amber-900">
          {items.map((t) => (
            <li key={t}>• {t}</li>
          ))}
        </ul>
        {children}
      </div>
    </div>
  )
}

function RetroStep({ stats, onDone, onSkip }: { stats: WeekStats; onDone: (worked: string, blocked: string, tags: RetroTag[]) => Promise<void>; onSkip: () => void }) {
  const [worked, setWorked] = useState('')
  const [blocked, setBlocked] = useState('')
  const [tags, setTags] = useState<RetroTag[]>([])
  const [saving, setSaving] = useState(false)
  const rate = completionRate(stats)
  const total = AREAS.reduce((a, x) => a + stats.minutesByArea[x.id], 0)
  const reasons = Object.entries(stats.errorsByReason).sort((a, b) => b[1] - a[1])
  const cats = Object.entries(stats.errorsByCategory).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const h = (m: number) => `${(m / 60).toFixed(1).replace('.0', '')}h`
  const toggle = (t: RetroTag) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])
  return (
    <StepCard title="Revisão da semana passada" subtitle={fmtWeekRange(stats.weekId)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-[#f6f7f9] p-4">
          <div className="text-xs font-bold text-muted uppercase">Tempo estudado</div>
          <div className="mt-1 font-display text-3xl font-extrabold">{h(total)}</div>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-white">
            {AREAS.map((a) => (total ? <span key={a.id} style={{ width: `${(stats.minutesByArea[a.id] / total) * 100}%`, background: AREA_COLOR[a.id] }} /> : null))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
            {AREAS.map((a) => (
              <span key={a.id} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: AREA_COLOR[a.id] }} />
                {a.name}: {h(stats.minutesByArea[a.id])}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-[#f6f7f9] p-4">
          <div className="text-xs font-bold text-muted uppercase">Plano cumprido</div>
          <div className="mt-1 font-display text-3xl font-extrabold" style={{ color: masteryColor(rate * 100) }}>
            {stats.planned ? `${Math.round(rate * 100)}%` : '—'}
          </div>
          <div className="mt-1 text-xs text-muted">{stats.planned ? `${stats.done} de ${stats.planned} blocos` : 'Sem blocos planejados'}</div>
        </div>
        {stats.weakest.length > 0 && (
          <div className="rounded-2xl bg-[#f6f7f9] p-4">
            <div className="mb-1.5 text-xs font-bold text-muted uppercase">Pontos mais fracos</div>
            {stats.weakest.map((t) => (
              <div key={t.topicId} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">
                  {t.name} <span className="text-[11px] text-muted">· {t.subjectName}</span>
                </span>
                <b style={{ color: masteryColor(t.value) }}>{t.value}%</b>
              </div>
            ))}
          </div>
        )}
        {(reasons.length > 0 || cats.length > 0) && (
          <div className="rounded-2xl bg-[#f6f7f9] p-4">
            <div className="mb-1.5 text-xs font-bold text-muted uppercase">Erros mais comuns</div>
            <div className="flex flex-wrap gap-1.5">
              {reasons.map(([r, n]) => (
                <span key={r} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold">
                  <FxText text={REASON_LABEL[r as keyof typeof REASON_LABEL].emoji} /> {REASON_LABEL[r as keyof typeof REASON_LABEL].label} ×{n}
                </span>
              ))}
              {cats.map(([c, n]) => (
                <span key={c} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold">
                  <Fx name="write" /> {CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL]} ×{n}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold"><Fx name="check" /> O que funcionou?</span>
          <VoiceTextarea value={worked} onValue={setWorked} rows={3} placeholder="Ex.: estudar de manhã, os desafios rápidos…" className="w-full rounded-2xl border border-line bg-white p-3 text-sm outline-none focus:border-brand" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold"><Fx name="barrier" /> O que travou?</span>
          <VoiceTextarea value={blocked} onValue={setBlocked} rows={3} placeholder="Ex.: muitas provas, cansaço à noite…" className="w-full rounded-2xl border border-line bg-white p-3 text-sm outline-none focus:border-brand" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {RETRO_TAGS.map((t) => {
          const on = tags.includes(t.id)
          return (
            <button key={t.id} onClick={() => toggle(t.id)} aria-pressed={on} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${on ? 'border-brand bg-brand text-white' : 'border-line bg-white text-slate-600 hover:border-brand/40'}`}>
              <FxText text={t.emoji} /> {t.label}
            </button>
          )
        })}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button onClick={onSkip} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted hover:bg-[#f1f2f5]">
          Pular revisão
        </button>
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            await onDone(worked, blocked, tags)
          }}
          className="flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-40"
        >
          Salvar e planejar <ArrowRight size={16} />
        </button>
      </div>
    </StepCard>
  )
}

function ThemePanel({
  onSpin,
  rouletteWon,
  on,
  setOn,
  themes,
  setThemes,
  suggested,
  active,
}: {
  onSpin?: () => void
  rouletteWon: boolean
  on: boolean
  setOn: (v: boolean) => void
  themes: Themes
  setThemes: (t: Themes) => void
  suggested: Partial<Record<AreaId, ThemeSuggestion>>
  active: { id: string; name: string; color: string; areaId: AreaId; icon?: string }[]
}) {
  return (
    <div className={`mb-6 rounded-2xl border-2 p-4 transition ${on ? 'border-brand/40 bg-brand-soft/40' : 'border-line'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-bold"><Fx name="target" /> Semana temática</div>
          <p className="text-xs text-muted">Uma matéria por área: o estudo novo da semana fica todo nela. As revisões de outras matérias continuam, curtinhas, para você não esquecer.</p>
        </div>
        <button
          onClick={() => setOn(!on)}
          aria-pressed={on}
          aria-label="Semana temática"
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-brand' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
        </button>
      </div>
      {on && (
        <div className="mt-4 space-y-3">
          {AREAS.map((a) => {
            const list = active.filter((s) => s.areaId === a.id)
            if (!list.length) return null
            const cur = themes[a.id]
            const sug = suggested[a.id]
            return (
              <div key={a.id}>
                <div className="mb-1.5 flex flex-wrap items-baseline gap-2 text-xs font-bold" style={{ color: AREA_COLOR[a.id] }}>
                  {a.name}
                  {a.id === 'ensino' && rouletteWon && <span className="font-semibold text-muted">· sorteada pela roleta</span>}
                  {a.id === 'ensino' && onSpin && (
                    <button onClick={onSpin} className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-bold text-white hover:brightness-110">
                      Girar a roleta
                    </button>
                  )}
                  {sug && list.some((s) => s.id === sug.id) && !(a.id === 'ensino' && rouletteWon) && (
                    <span className="font-semibold text-muted">
                      · sugestão: {list.find((s) => s.id === sug.id)?.name} ({sug.reason})
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((s) => {
                    const sel = cur === s.id
                    return (
                      <button
                        key={s.id}
                        onClick={() => setThemes({ ...themes, [a.id]: sel ? undefined : s.id })}
                        aria-pressed={sel}
                        className={`flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm font-semibold transition ${sel ? 'text-white shadow-sm' : 'border-line bg-white hover:border-slate-300'}`}
                        style={sel ? { background: s.color, borderColor: s.color } : undefined}
                      >
                        <SubjectIcon subject={s as never} size={22} />
                        {s.name}
                        {sug?.id === s.id && <span className={`ml-0.5 text-[10px] ${sel ? 'text-white/80' : 'text-brand'}`}><Fx name="star" size="1.2em" /></span>}
                      </button>
                    )
                  })}
                  {!cur && <span className="self-center text-xs text-muted">Nenhuma escolhida: essa área fica variada.</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Backup semanal: a Capi lembra no check-in; some depois de baixar/copiar nesta semana. */
function BackupCard() {
  const key = 'mendonca-backup-week'
  const wk = currentWeekId()
  const [done, setDone] = useState(() => {
    try {
      return localStorage.getItem(key) === wk
    } catch {
      return false
    }
  })
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const mark = () => {
    try {
      localStorage.setItem(key, wk)
    } catch {
      /* ok */
    }
    setDone(true)
  }
  const run = async () => {
    const json = await exportBackup()
    if (import.meta.env.VITE_ARTIFACT) {
      // A página publicada não baixa arquivos: copia para a área de transferência
      try {
        await navigator.clipboard.writeText(json)
        setCopied(true)
        mark()
        return
      } catch {
        setText(json)
        return
      }
    }
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `mendonca-backup-${toISODate(new Date())}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    mark()
  }
  if (done && !text)
    return (
      <p className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800">
        <Check size={16} /> Backup desta semana feito{copied ? ' (copiado; cole num arquivo .json e guarde)' : ''}.
      </p>
    )
  return (
    <div className="mt-4 rounded-2xl border border-line bg-[#f6f7f9] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Capybara pose="estudando" size={46} />
        <div className="min-w-0 flex-1 text-sm">
          <b>Backup da semana.</b> <span className="text-muted">Seus dados ficam no navegador e na nuvem do claude.ai. Um backup por semana garante que nada se perca.</span>
        </div>
        <button onClick={run} className="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-xs font-bold text-white hover:bg-black">
          <Download size={14} /> {import.meta.env.VITE_ARTIFACT ? 'Copiar backup' : 'Baixar backup'}
        </button>
      </div>
      {text && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-muted">Não consegui copiar sozinho. Selecione tudo abaixo, copie e cole num arquivo .json:</p>
          <textarea readOnly value={text} onFocus={(e) => e.target.select()} className="h-24 w-full rounded-xl border border-line bg-white p-2 font-mono text-[11px]" />
          <button onClick={mark} className="mt-2 text-xs font-bold text-brand">
            Já copiei
          </button>
        </div>
      )}
    </div>
  )
}

const fmtMin = (m: number) => (m === 0 ? 'folga' : `${Math.floor(m / 60) ? `${Math.floor(m / 60)}h` : ''}${m % 60 ? `${String(m % 60).padStart(Math.floor(m / 60) ? 2 : 1, '0')}${Math.floor(m / 60) ? '' : 'min'}` : ''}`)

/** Metas de estudo por dia: menos/mais de 15 em 15 min, com atalhos. */
function HoursEditor({ daily, setDaily, today }: { daily: number[]; setDaily: (d: number[]) => void; today: number }) {
  const set = (i: number, m: number) => setDaily(daily.map((x, k) => (k === i ? Math.max(0, Math.min(12 * 60, m)) : x)))
  const max = Math.max(240, ...daily)
  return (
    <div className="space-y-1.5">
      {DAY_NAMES.map((name, i) => {
        const past = i < today
        const m = daily[i] ?? 0
        return (
          <div key={name} className={`flex flex-wrap items-center gap-3 rounded-2xl px-3 py-2 ${past ? 'opacity-40' : 'bg-[#f8f9fb]'}`}>
            <span className="w-24 text-sm font-bold">{name}</span>
            <button onClick={() => set(i, m - 15)} disabled={past || m === 0} aria-label={`Menos 15 minutos na ${name}`} className="grid h-8 w-8 place-items-center rounded-lg bg-white text-lg font-bold shadow-sm disabled:opacity-40">
              −
            </button>
            <span className={`w-16 text-center font-display text-lg font-extrabold tabular-nums ${m ? '' : 'text-muted'}`}>{fmtMin(m)}</span>
            <button onClick={() => set(i, m + 15)} disabled={past} aria-label={`Mais 15 minutos na ${name}`} className="grid h-8 w-8 place-items-center rounded-lg bg-white text-lg font-bold shadow-sm disabled:opacity-40">
              +
            </button>
            <div className="hidden h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-[#e6e8ee] sm:block">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(m / max) * 100}%` }} />
            </div>
            <div className="flex gap-1">
              {[0, 60, 120, 180].map((q) => (
                <button key={q} onClick={() => set(i, q)} disabled={past} className={`rounded-lg px-2 py-1 text-xs font-bold ${m === q ? 'bg-brand text-white' : 'bg-white text-slate-600 shadow-sm hover:bg-slate-50'} disabled:opacity-40`}>
                  {q === 0 ? 'folga' : `${q / 60}h`}
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {today > 0 && <p className="pt-1 text-xs text-muted">Os dias que já passaram ficam de fora do plano.</p>}
    </div>
  )
}
