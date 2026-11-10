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
import { Btn, Card, Chip } from '../components/ui'
import { Capybara } from '../components/Capybara'

const FAC_FLOOR = 66

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
        <h2 className="mb-1 text-lg font-bold">2. Horários disponíveis</h2>
        <p className="mb-4 text-sm text-muted">Pré-preenchido com a semana anterior. Ajuste o que mudou.</p>
        <div className="divide-y divide-line">
          {DAY_NAMES.map((name, day) => (
            <div key={day} className={`flex flex-wrap items-center gap-3 py-3 ${day < today ? 'opacity-40' : ''}`}>
              <span className="w-20 text-sm font-semibold">{name}</span>
              <div className="flex flex-1 flex-wrap gap-2">
                {availability[day].length === 0 && <span className="text-sm text-muted">Livre de estudos</span>}
                {availability[day].map((w, idx) => (
                  <div key={idx} className="flex items-center gap-1 rounded-xl bg-slate-50 px-2 py-1">
                    <input type="time" value={fmtTime(w.start)} onChange={(e) => setWin(day, idx, 'start', e.target.value)} className="bg-transparent text-sm outline-none" />
                    <span className="text-muted">–</span>
                    <input type="time" value={fmtTime(w.end)} onChange={(e) => setWin(day, idx, 'end', e.target.value)} className="bg-transparent text-sm outline-none" />
                    <button onClick={() => removeWin(day, idx)} className="ml-1 text-slate-400 hover:text-rose-600" aria-label="Remover horário">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => addWin(day)} className="rounded-lg p-1.5 text-brand hover:bg-brand-soft" aria-label={`Adicionar horário na ${name}`}>
                <Plus size={16} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {subjects.length > 0 && (
        <Card className="mb-8">
          <h2 className="mb-1 text-lg font-bold">3. Pausar matérias nesta semana</h2>
          <p className="mb-4 text-sm text-muted">Clique para pausar (ficam fora do plano só nesta semana).</p>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => {
              const isPaused = paused.includes(s.id)
              return (
                <button key={s.id} onClick={() => setPaused(isPaused ? paused.filter((p) => p !== s.id) : [...paused, s.id])}>
                  <Chip color={isPaused ? '#94a3b8' : s.color} className={isPaused ? 'line-through' : ''}>
                    {s.name}
                  </Chip>
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
