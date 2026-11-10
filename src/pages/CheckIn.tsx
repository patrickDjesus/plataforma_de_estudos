import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Plus, Repeat, Rocket, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { AREAS, useSubjects } from '../db/hooks'
import { currentWeekId, getSettings, saveCheckin } from '../db/repo'
import type { AreaId, AreaPercents, Availability } from '../db/types'
import { AREA_COLOR } from '../lib/colors'
import { DAY_NAMES, dayIndex, fmtTime, fmtWeekRange, parseTime } from '../lib/dates'
import { Btn, Card } from '../components/ui'
import { SubjectIcon } from '../components/SubjectIcon'
import { tint } from '../lib/colors'
import { Capybara } from '../components/Capybara'

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

const totalMinutes = (av: Availability, fromDay = 0) => av.slice(fromDay).flat().reduce((acc, w) => acc + Math.max(0, w.end - w.start), 0)

export function CheckInPage() {
  const navigate = useNavigate()
  const weekId = currentWeekId()
  const subjects = useSubjects()
  const existing = useLiveQuery(() => db.weeks.get(weekId), [weekId])
  const [percents, setPercents] = useState<AreaPercents | null>(null)
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [paused, setPaused] = useState<string[]>([])
  const [confirmLow, setConfirmLow] = useState(false)
  const [saving, setSaving] = useState(false)
  const today = dayIndex()

  useEffect(() => {
    if (percents) return
    getSettings().then((s) => {
      db.weeks.get(weekId).then((w) => {
        setPercents(w?.percents ?? s.lastPercents)
        setAvailability(w?.availability ?? s.defaultAvailability)
        setPaused(w?.pausedSubjectIds ?? [])
      })
    })
  }, [weekId, percents])

  const minutes = useMemo(() => (availability ? totalMinutes(availability, today) : 0), [availability, today])
  if (!percents || !availability) return null

  const lowFac = percents.faculdade < FAC_FLOOR
  const canSave = !lowFac || confirmLow

  const submit = async (p = percents, av = availability, ps = paused) => {
    setSaving(true)
    await saveCheckin(weekId, p, av, ps)
    navigate('/calendario')
  }

  const repeatLast = async () => {
    const s = await getSettings()
    await submit(s.lastPercents, s.defaultAvailability, [])
  }

  const setWin = (day: number, idx: number, key: 'start' | 'end', value: string) => {
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

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="flex items-end gap-1">
          <Capybara pose="pensando" size={110} />
          <div className="relative mb-12 rounded-2xl border border-line bg-white px-4 py-2.5 text-left text-sm font-semibold shadow-sm">
            <span className="absolute bottom-3 -left-1.5 h-3 w-3 rotate-45 border-b border-l border-line bg-white" />
            {existing ? 'Mudou alguma coisa na semana?' : 'Onde vai ser o foco desta semana?'}
          </div>
        </div>
        <p className="mt-2 mb-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold tracking-wider text-brand uppercase">{fmtWeekRange(weekId)}</p>
        <h1 className="text-3xl font-extrabold sm:text-4xl">
          {existing ? 'Reajustar a semana' : 'Nova semana, novo foco 🚀'}
        </h1>
        <p className="mt-2 text-muted">Defina onde quer colocar sua energia. O Mendonça monta a rota de estudos.</p>
        {!existing && (
          <Btn variant="soft" className="mt-5" onClick={repeatLast} disabled={saving}>
            <Repeat size={16} /> Repetir a semana passada
          </Btn>
        )}
      </div>

      {subjects.length === 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/80">
          <p className="text-sm text-amber-900">
            Você ainda não cadastrou matérias, então o plano sairá vazio.{' '}
            <button className="font-bold underline" onClick={() => navigate('/materias')}>
              Cadastrar matérias primeiro
            </button>
          </p>
        </Card>
      )}

      <Card className="mb-6">
        <h2 className="mb-1 text-lg font-bold">1. Foco por área</h2>
        <p className="mb-5 text-sm text-muted">
          {today > 0 ? `Planejando de ${DAY_NAMES[today].toLowerCase()} em diante · ` : ''}
          <b className="text-ink">{(minutes / 60).toFixed(1).replace('.0', '')}h</b> disponíveis
        </p>
        <div className="space-y-6">
          {AREAS.map((a) => (
            <div key={a.id}>
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-3 font-semibold">
                  <span
                    className="subject-icon h-9 w-9 rounded-xl font-display text-sm font-extrabold"
                    style={{ background: `linear-gradient(145deg, ${AREA_COLOR[a.id]}, color-mix(in srgb, ${AREA_COLOR[a.id]} 72%, #000))` }}
                  >
                    <span className="relative z-10">{a.name[0]}</span>
                  </span>
                  {a.name}
                </span>
                <span className="text-sm">
                  <b style={{ color: AREA_COLOR[a.id] }}>{percents[a.id]}%</b>
                  <span className="text-muted"> = {((minutes * percents[a.id]) / 6000).toFixed(1).replace('.0', '')}h</span>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={percents[a.id]}
                onChange={(e) => {
                  setPercents(rebalance(percents, a.id, Number(e.target.value)))
                  setConfirmLow(false)
                }}
                className="h-3 w-full cursor-pointer appearance-none rounded-full"
                style={{
                  accentColor: AREA_COLOR[a.id],
                  background: `linear-gradient(to right, ${AREA_COLOR[a.id]} ${percents[a.id]}%, #eef0f4 ${percents[a.id]}%)`,
                }}
              />
            </div>
          ))}
        </div>
        {lowFac && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
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
      </Card>

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="mb-1 text-lg font-bold">2. Horários disponíveis</h2>
            <p className="text-sm text-muted">Pré-preenchido com a semana anterior. Use os atalhos ou ajuste os horários.</p>
          </div>
          <button onClick={copyWeekdays} className="rounded-xl bg-[#f1f2f5] px-3 py-2 text-xs font-bold text-ink hover:bg-[#e8e9ee]" title="Usa os horários de segunda em todos os dias úteis">
            Copiar segunda para seg–sex
          </button>
        </div>
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
                      <div key={idx} className="flex items-center gap-1.5 rounded-xl bg-brand-soft py-1 pr-1.5 pl-3 text-brand">
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
      </Card>

      {subjects.length > 0 && (
        <Card className="mb-8">
          <h2 className="mb-1 text-lg font-bold">3. Matérias desta semana</h2>
          <p className="mb-4 text-sm text-muted">Desligue as que vão ficar de fora só nesta semana.</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
            {subjects.map((s) => {
              const isPaused = paused.includes(s.id)
              return (
                <button
                  key={s.id}
                  onClick={() => setPaused(isPaused ? paused.filter((p) => p !== s.id) : [...paused, s.id])}
                  className={`flex items-center gap-3 rounded-2xl border p-2.5 text-left transition ${isPaused ? 'border-line bg-[#fafbfc]' : 'border-transparent'}`}
                  style={isPaused ? undefined : { background: tint(s.color, 0.08), boxShadow: `inset 0 0 0 1.5px ${tint(s.color, 0.35)}` }}
                >
                  <span className={isPaused ? 'opacity-40 grayscale' : ''}>
                    <SubjectIcon subject={s} size={36} />
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
        </Card>
      )}

      <div className="flex justify-center pb-10">
        <Btn variant="primary" className="px-8 py-3 text-base" onClick={() => submit()} disabled={!canSave || saving}>
          <Rocket size={18} /> {existing ? 'Salvar e regerar plano' : 'Gerar minha semana'}
        </Btn>
      </div>
    </div>
  )
}
