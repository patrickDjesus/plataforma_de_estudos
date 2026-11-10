import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, Check, CheckCircle2, Clock, Flame, Play, Target } from 'lucide-react'
import { db } from '../db/db'
import { AREAS, useSessions, useSubjectMap, useTimer, useTopics, useWeekBlocks } from '../db/hooks'
import { currentWeekId, setBlockDone, startTimer } from '../db/repo'
import { AREA_COLOR, tint } from '../lib/colors'
import { addDays, fmtDuration, fmtTime, minutesNow, toISODate, weekDates } from '../lib/dates'
import { Btn, Card } from '../components/ui'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export function HomePage() {
  const weekId = currentWeekId()
  const blocks = useWeekBlocks(weekId)
  const subjects = useSubjectMap()
  const topics = useTopics()
  const sessions = useSessions()
  const timer = useTimer()
  const doneBlockDates = useLiveQuery(async () => (await db.blocks.filter((b) => b.done).toArray()).map((b) => b.date), [], [])
  const todayIso = toISODate(new Date())
  const topicMap = new Map(topics.map((t) => [t.id, t]))

  const study = blocks.filter((b) => b.kind === 'study')
  const today = blocks.filter((b) => b.date === todayIso).sort((a, b) => a.start - b.start)
  const weekStart = new Date(weekId + 'T00:00:00').getTime()
  const weekSeconds = sessions.filter((s) => s.startedAt >= weekStart).reduce((acc, s) => acc + s.seconds, 0)
  const plannedMin = study.reduce((acc, b) => acc + b.end - b.start, 0)
  const doneMin = study.filter((b) => b.done).reduce((acc, b) => acc + b.end - b.start, 0)

  const streak = useMemo(() => {
    const days = new Set([...sessions.map((s) => toISODate(new Date(s.startedAt))), ...doneBlockDates])
    let d = days.has(todayIso) ? todayIso : addDays(todayIso, -1)
    let n = 0
    while (days.has(d)) {
      n++
      d = addDays(d, -1)
    }
    return n
  }, [sessions, doneBlockDates, todayIso])

  const byArea = AREAS.map((a) => {
    const list = study.filter((b) => b.subjectId && subjects.get(b.subjectId)?.areaId === a.id)
    const planned = list.reduce((acc, b) => acc + b.end - b.start, 0)
    const done = list.filter((b) => b.done).reduce((acc, b) => acc + b.end - b.start, 0)
    return { ...a, planned, done }
  })

  const nextBlock = today.find((b) => b.kind === 'study' && !b.done && b.end > minutesNow())

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-6">
        <div className="min-w-56 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight">{greeting()}! 👋</h1>
          <p className="text-sm text-muted">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
        </div>
        <Stat icon={<Flame size={20} />} color="#f97316" value={`${streak}`} label={streak === 1 ? 'dia seguido' : 'dias seguidos'} />
        <Stat icon={<Clock size={20} />} color="#4f46e5" value={fmtDuration(weekSeconds)} label="estudadas na semana" />
        <Stat icon={<Target size={20} />} color="#10b981" value={plannedMin ? `${Math.round((doneMin / plannedMin) * 100)}%` : '—'} label="do plano cumprido" />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <CalendarDays size={18} /> Hoje
            </h2>
            <Link to="/calendario" className="text-sm font-semibold text-indigo-600">
              Ver semana →
            </Link>
          </div>
          {today.length === 0 && <p className="py-6 text-center text-sm text-muted">Nada planejado para hoje. Descanse ou crie um bloco na semana. ✨</p>}
          <div className="space-y-2">
            {today.map((b) => {
              const s = b.subjectId ? subjects.get(b.subjectId) : undefined
              const t = b.topicId ? topicMap.get(b.topicId) : undefined
              const color = b.kind === 'compromisso' ? '#64748b' : (s?.color ?? '#6366f1')
              const isNext = b.id === nextBlock?.id
              const running = timer?.blockId === b.id
              return (
                <div
                  key={b.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3 transition ${isNext ? 'border-transparent ring-2' : 'border-line'} ${b.done ? 'opacity-60' : ''}`}
                  style={isNext ? ({ '--tw-ring-color': color, background: tint(color, 0.06) } as React.CSSProperties) : undefined}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: color }}>
                    {b.done ? <Check size={20} /> : <span className="text-xs font-bold">{fmtTime(b.start)}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold" style={{ color }}>
                      {b.kind === 'study' ? s?.name : b.kind === 'prova' ? `Prova · ${s?.name ?? ''}` : 'Compromisso'}
                    </div>
                    <div className="truncate font-bold">{b.kind === 'study' ? (t?.name ?? s?.name) : b.title}</div>
                    <div className="text-xs text-muted">
                      {fmtTime(b.start)}–{fmtTime(b.end)} · {fmtDuration((b.end - b.start) * 60)}
                    </div>
                  </div>
                  {b.kind === 'study' && !b.done && (
                    <div className="flex gap-1.5">
                      {!running && (
                        <Btn variant={isNext ? 'primary' : 'soft'} onClick={() => startTimer({ blockId: b.id, subjectId: b.subjectId, topicId: b.topicId, label: t?.name ?? s?.name ?? 'Estudo' })}>
                          <Play size={15} /> Começar
                        </Btn>
                      )}
                      {running && <span className="self-center text-xs font-bold text-emerald-600">● estudando</span>}
                      <Btn onClick={() => setBlockDone(b.id, true)} title="Marcar como feito">
                        <CheckCircle2 size={15} />
                      </Btn>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold">Progresso da semana</h2>
          <div className="space-y-5">
            {byArea.map((a) => (
              <div key={a.id}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-semibold">{a.name}</span>
                  <span className="text-muted">
                    {fmtDuration(a.done * 60)} / {fmtDuration(a.planned * 60)}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full" style={{ background: tint(AREA_COLOR[a.id], 0.12) }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${a.planned ? (a.done / a.planned) * 100 : 0}%`, background: `linear-gradient(90deg, ${AREA_COLOR[a.id]}, ${AREA_COLOR[a.id]}bb)` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-7 gap-1.5">
            {weekDates(weekId).map((d) => {
              const dayBlocks = study.filter((b) => b.date === d)
              const ratio = dayBlocks.length ? dayBlocks.filter((b) => b.done).length / dayBlocks.length : 0
              return (
                <div key={d} className="text-center">
                  <div
                    className={`mx-auto h-9 w-full rounded-lg ${d === todayIso ? 'ring-2 ring-indigo-500' : ''}`}
                    style={{ background: dayBlocks.length ? `rgba(79,70,229,${0.12 + ratio * 0.8})` : '#f1f5f9' }}
                    title={`${dayBlocks.filter((b) => b.done).length}/${dayBlocks.length} blocos`}
                  />
                  <div className="mt-1 text-[10px] font-bold text-muted">{['S', 'T', 'Q', 'Q', 'S', 'S', 'D'][weekDates(weekId).indexOf(d)]}</div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Stat({ icon, color, value, label }: { icon: React.ReactNode; color: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-md" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 8px 18px -8px ${color}` }}>
        {icon}
      </div>
      <div>
        <div className="text-xl leading-none font-extrabold">{value}</div>
        <div className="text-xs text-muted">{label}</div>
      </div>
    </div>
  )
}
