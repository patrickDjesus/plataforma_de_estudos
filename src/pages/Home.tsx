import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, BarChart3, CalendarCheck2, Check, ChevronRight, Clock3, Flame, Globe2, Medal, Play, Target, Trophy, Zap } from 'lucide-react'
import { db } from '../db/db'
import { AREAS, useSessions, useSettings, useSubjectMap, useTimer, useTopics, useWeek, useWeekBlocks } from '../db/hooks'
import { currentWeekId, startTimer } from '../db/repo'
import type { Block } from '../db/types'
import { AREA_COLOR, tint } from '../lib/colors'
import { DAY_SHORT, addDays, fmtDuration, fmtTime, minutesNow, toISODate, weekDates } from '../lib/dates'
import { XP_PER_BLOCK, levelInfo, xpFrom } from '../lib/xp'
import { LogoMark } from '../components/Logo'
import { SubjectIcon } from '../components/SubjectIcon'
import { Card, Ring, Tabs } from '../components/ui'

type Section = 'geral' | 'resultados' | 'metas'
type Scope = 'hoje' | 'semana'

export function HomePage() {
  const navigate = useNavigate()
  const weekId = currentWeekId()
  const week = useWeek(weekId)
  const blocks = useWeekBlocks(weekId)
  const subjects = useSubjectMap()
  const topics = useTopics()
  const sessions = useSessions()
  const settings = useSettings()
  const timer = useTimer()
  const doneBlocksAll = useLiveQuery(() => db.blocks.filter((b) => b.done).toArray(), [], [])
  const [section, setSection] = useState<Section>('geral')
  const [scope, setScope] = useState<Scope>('hoje')

  const todayIso = toISODate(new Date())
  const topicMap = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics])
  const study = blocks.filter((b) => b.kind === 'study')
  const scoped = (scope === 'hoje' ? study.filter((b) => b.date === todayIso) : study).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
  const startOf = (iso: string) => new Date(iso + 'T00:00:00').getTime()
  const scopeStart = scope === 'hoje' ? startOf(todayIso) : startOf(weekId)
  const scopeSessions = sessions.filter((s) => s.startedAt >= scopeStart)
  const scopeSeconds = scopeSessions.reduce((a, s) => a + s.seconds, 0)

  // XP
  const totalXp = xpFrom(
    sessions.reduce((a, s) => a + s.seconds, 0),
    doneBlocksAll.length,
  )
  const lvl = levelInfo(totalXp)
  const scopeXp = xpFrom(scopeSeconds, scoped.filter((b) => b.done).length)
  const scopeGoal = scoped.reduce((a, b) => a + (b.end - b.start) + XP_PER_BLOCK, 0)

  // Dias estudados e sequência
  const studyDays = useMemo(() => new Set([...sessions.map((s) => toISODate(new Date(s.startedAt))), ...doneBlocksAll.map((b) => b.date)]), [sessions, doneBlocksAll])
  const streak = useMemo(() => {
    let d = studyDays.has(todayIso) ? todayIso : addDays(todayIso, -1)
    let n = 0
    while (studyDays.has(d)) {
      n++
      d = addDays(d, -1)
    }
    return n
  }, [studyDays, todayIso])

  const nextBlock = study
    .filter((b) => !b.done && (b.date > todayIso || (b.date === todayIso && b.end > minutesNow())))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)[0]
  const startBlock = (b?: Block) => {
    if (!b) return navigate('/calendario')
    const s = b.subjectId ? subjects.get(b.subjectId) : undefined
    const t = b.topicId ? topicMap.get(b.topicId) : undefined
    startTimer({ blockId: b.id, subjectId: b.subjectId, topicId: b.topicId, label: t?.name ?? s?.name ?? 'Estudo' })
  }

  const focusArea = week ? AREAS.reduce((best, a) => (week.percents[a.id] > week.percents[best.id] ? a : best), AREAS[0]) : AREAS[0]
  const name = settings.userName?.trim() || 'estudante'

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-5 px-6 py-5">
        <div className="flex min-w-0 flex-1 basis-56 items-center gap-4">
          <div className="rounded-full bg-gradient-to-br from-[#ff9a3d] via-[#7c8cff] to-[#2fd89a] p-[3px]">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-white">
              <LogoMark size={40} />
            </div>
          </div>
          <div>
            <h1 className="truncate text-xl font-bold">Olá, {name}! 👋</h1>
            <p className="text-xs text-muted first-letter:uppercase">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
          </div>
        </div>

        {/* Nível e XP */}
        <div className="flex w-56 items-center gap-3 rounded-2xl bg-gradient-to-r from-[#3e63f2] to-[#5b7cff] px-3 py-2.5 text-white shadow-[0_10px_24px_-12px_rgba(62,99,242,0.9)]">
          <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ffb648] to-[#ff7a2f] shadow-inner">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white font-display text-base font-extrabold text-[#3e63f2]">{lvl.level}</span>
          </div>
          <div className="flex-1">
            <div className="mb-1.5 flex items-baseline justify-end gap-1 text-sm font-bold tabular-nums">
              {lvl.inLevel} <span className="text-xs font-semibold text-white/70">/ {lvl.needed} XP</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${lvl.progress * 100}%` }} />
            </div>
          </div>
        </div>

        <Stat tile={<TileIcon color="#ff5d6c"><CalendarCheck2 size={22} /></TileIcon>} value={`${studyDays.size}`} accent="#3e63f2" label="dias estudados" />
        <Stat tile={<TileIcon color="#ff8a1f"><Flame size={22} /></TileIcon>} value={`${streak}`} accent="#ff8a1f" label={streak === 1 ? 'dia seguido' : 'dias seguidos'} />
        <Stat
          tile={<TileIcon color={AREA_COLOR[focusArea.id]}><span className="font-display text-lg font-extrabold">{focusArea.name[0]}</span></TileIcon>}
          caption="Foco da semana"
          value={focusArea.name}
        />
        <button onClick={() => startBlock(nextBlock)} className="group flex items-center gap-3 text-left">
          <TileIcon color="#ef2b3f">
            <span className="h-5 w-5 rounded-full bg-gradient-to-b from-white/90 to-white/40 shadow transition group-hover:scale-110" />
          </TileIcon>
          <div>
            <div className="text-sm font-bold">{timer ? 'Estudando agora' : 'Comece por aqui'}</div>
            <div className="text-xs text-muted">{nextBlock ? 'Aperte o botão' : 'Monte sua semana'}</div>
          </div>
        </button>
      </Card>

      {/* Painel com barra lateral escura */}
      <div className="flex overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_8px_24px_-12px_rgba(16,24,40,0.08)]">
        <aside className="flex w-[84px] shrink-0 flex-col items-center gap-2 bg-[#1c1d22] py-5">
          <SideItem active={section === 'geral'} onClick={() => setSection('geral')} icon={<Globe2 size={22} />} label="Geral" />
          <SideItem active={section === 'resultados'} onClick={() => setSection('resultados')} icon={<BarChart3 size={22} />} label="Resultados" />
          <SideItem active={section === 'metas'} onClick={() => setSection('metas')} icon={<Target size={22} />} label="Metas" />
        </aside>

        <div className="min-w-0 flex-1 p-5">
          {section === 'geral' && (
            <>
              <div className="mb-5">
                <Tabs<Scope>
                  value={scope}
                  onChange={setScope}
                  items={[
                    { id: 'hoje', label: 'Hoje', icon: <Zap size={15} /> },
                    { id: 'semana', label: 'Semana', icon: <CalendarCheck2 size={15} /> },
                  ]}
                />
              </div>
              <div className="grid gap-5 lg:grid-cols-3">
                {/* XP */}
                <Panel title={scope === 'hoje' ? 'XP do dia' : 'XP da semana'} icon={<Medal size={18} />}>
                  <div className="flex flex-col items-center pt-1">
                    <Ring value={scopeGoal ? scopeXp / scopeGoal : 0} size={168} stroke={13}>
                      <span className="mb-1 rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white">{scopeGoal ? Math.round((scopeXp / scopeGoal) * 100) : 0}%</span>
                      <span className="font-display text-3xl font-extrabold tabular-nums">
                        {scopeXp}
                        <span className="text-sm font-semibold text-muted">/{scopeGoal}</span>
                      </span>
                      <span className="text-xs text-muted">{scope === 'hoje' ? 'Sua XP hoje' : 'Sua XP na semana'}</span>
                    </Ring>
                    <h3 className="mt-5 text-xl font-bold">{scopeXp === 0 ? 'Hora de começar!' : scopeXp >= scopeGoal && scopeGoal > 0 ? 'Meta batida! 🏆' : 'Continue assim!'}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {scopeGoal > scopeXp ? (
                        <>
                          Faltam <b className="text-brand">{scopeGoal - scopeXp} XP</b>
                        </>
                      ) : scopeGoal === 0 ? (
                        'Nada planejado aqui.'
                      ) : (
                        'Você completou o planejado.'
                      )}
                    </p>
                  </div>
                  <ActionBox label="Continuar de onde parei" onClick={() => startBlock(nextBlock)} />
                </Panel>

                {/* Tarefas */}
                <Panel title={scope === 'hoje' ? 'Tarefas do dia' : 'Tarefas da semana'} icon={<CalendarCheck2 size={18} />}>
                  <div className="thin-scroll -mx-1 max-h-[300px] flex-1 divide-y divide-line overflow-y-auto px-1">
                    {scoped.length === 0 && <p className="py-10 text-center text-sm text-muted">Nenhum bloco de estudo {scope === 'hoje' ? 'hoje' : 'nesta semana'}.</p>}
                    {scoped.map((b) => {
                      const s = b.subjectId ? subjects.get(b.subjectId) : undefined
                      const t = b.topicId ? topicMap.get(b.topicId) : undefined
                      const running = timer?.blockId === b.id
                      return (
                        <div key={b.id} className="group flex items-center gap-3 py-2.5">
                          <SubjectIcon subject={s} size={46} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold" style={{ color: s?.color }}>
                              {s?.name}
                              {scope === 'semana' && <span className="text-muted"> · {DAY_SHORT[weekDates(weekId).indexOf(b.date)].toLowerCase()}</span>}
                            </div>
                            <div className={`truncate text-sm font-bold ${b.done ? 'text-muted line-through' : ''}`}>{t?.name ?? s?.name}</div>
                            <div className="text-xs text-muted">
                              {fmtTime(b.start)} · {fmtDuration((b.end - b.start) * 60)}
                            </div>
                          </div>
                          {b.done ? (
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                              <Check size={16} />
                            </span>
                          ) : running ? (
                            <span className="text-xs font-bold text-emerald-600">● agora</span>
                          ) : (
                            <button onClick={() => startBlock(b)} className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-brand opacity-70 transition group-hover:opacity-100" title="Começar">
                              <Play size={14} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <ActionBox label="Ir para a semana" onClick={() => navigate('/calendario')} />
                </Panel>

                {/* Metas */}
                <Panel title="Metas" icon={<Target size={18} />}>
                  <div className="flex-1 space-y-6 pt-1">
                    <Goal icon={<Check size={16} />} color="#3e63f2" value={scoped.filter((b) => b.done).length} total={scoped.length} label="Blocos concluídos" />
                    <Goal
                      icon={<Clock3 size={16} />}
                      color="#ec4899"
                      value={Math.round(scopeSeconds / 60)}
                      total={scoped.reduce((a, b) => a + b.end - b.start, 0)}
                      label="Minutos estudados"
                    />
                    <Goal icon={<Zap size={16} />} color="#14b8a6" value={scopeSessions.length} total={Math.max(scoped.length, scopeSessions.length)} label="Sessões de foco" />
                  </div>
                </Panel>
              </div>
            </>
          )}

          {section === 'resultados' && <Results weekId={weekId} />}
          {section === 'metas' && <WeekGoals weekId={weekId} />}
        </div>
      </div>
    </div>
  )
}

function TileIcon({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="subject-icon h-12 w-12 rounded-[14px]" style={{ background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 72%, #000))` }}>
      <span className="relative z-10 flex">{children}</span>
    </span>
  )
}

function Stat({ tile, value, label, caption, accent }: { tile: ReactNode; value: string; label?: string; caption?: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3">
      {tile}
      <div className="leading-tight">
        {caption && <div className="text-xs text-muted">{caption}</div>}
        <div className="font-display text-lg font-bold" style={accent ? { color: accent } : undefined}>
          {value}
          {label && <span className="ml-1.5 font-sans text-sm font-medium text-ink">{label.split(' ')[0]}</span>}
        </div>
        {label && <div className="text-xs text-muted">{label.split(' ').slice(1).join(' ') || ' '}</div>}
      </div>
    </div>
  )
}

function SideItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${active ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}>
      <span className={`grid h-10 w-10 place-items-center rounded-full transition ${active ? 'bg-gradient-to-br from-[#5b7cff] to-[#3e63f2] shadow-[0_0_18px_rgba(91,124,255,0.6)]' : 'bg-white/5'}`}>{icon}</span>
      {label}
    </button>
  )
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-[440px] flex-col rounded-[18px] border border-line p-5">
      <h3 className="mb-4 flex items-center gap-2 font-sans text-sm font-semibold">
        {icon} {title}
      </h3>
      {children}
    </div>
  )
}

function ActionBox({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group mt-5 flex items-center justify-between rounded-2xl bg-brand-soft px-4 py-3.5 text-left text-sm font-bold text-ink transition hover:brightness-95">
      {label}
      <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-white transition group-hover:translate-x-0.5">
        <ArrowRight size={16} />
      </span>
    </button>
  )
}

function Goal({ icon, color, value, total, label }: { icon: ReactNode; color: string; value: number; total: number; label: string }) {
  return (
    <div>
      <div className="flex items-baseline gap-1.5" style={{ color }}>
        {icon}
        <span className="font-display text-2xl font-extrabold tabular-nums">{value}</span>
        <span className="text-sm font-semibold text-muted">/ {total}</span>
      </div>
      <div className="mt-0.5 text-sm font-medium">{label}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: tint(color, 0.12) }}>
        <div className="h-full rounded-full" style={{ width: `${total ? Math.min(100, (value / total) * 100) : 0}%`, background: color }} />
      </div>
    </div>
  )
}

/** Tempo estudado por matéria na semana. */
function Results({ weekId }: { weekId: string }) {
  const sessions = useSessions()
  const subjects = useSubjectMap()
  const start = new Date(weekId + 'T00:00:00').getTime()
  const bySubject = new Map<string, number>()
  for (const s of sessions) if (s.startedAt >= start && s.subjectId) bySubject.set(s.subjectId, (bySubject.get(s.subjectId) ?? 0) + s.seconds)
  const rows = [...subjects.values()].map((s) => ({ s, secs: bySubject.get(s.id) ?? 0 })).sort((a, b) => b.secs - a.secs)
  const max = Math.max(1, ...rows.map((r) => r.secs))
  const dates = weekDates(weekId)
  const perDay = dates.map((d) => sessions.filter((s) => toISODate(new Date(s.startedAt)) === d).reduce((a, s) => a + s.seconds, 0))
  const maxDay = Math.max(1, ...perDay)
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-[18px] border border-line p-5">
        <h3 className="mb-4 flex items-center gap-2 font-sans text-sm font-semibold">
          <BarChart3 size={18} /> Tempo por matéria nesta semana
        </h3>
        {rows.length === 0 && <p className="text-sm text-muted">Cadastre matérias para ver resultados.</p>}
        <div className="space-y-3">
          {rows.map(({ s, secs }) => (
            <div key={s.id} className="flex items-center gap-3">
              <SubjectIcon subject={s} size={34} />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="truncate font-semibold">{s.name}</span>
                  <span className="text-muted tabular-nums">{fmtDuration(secs)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: tint(s.color, 0.12) }}>
                  <div className="h-full rounded-full" style={{ width: `${(secs / max) * 100}%`, background: s.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-[18px] border border-line p-5">
        <h3 className="mb-4 flex items-center gap-2 font-sans text-sm font-semibold">
          <Clock3 size={18} /> Constância da semana
        </h3>
        <div className="flex h-48 items-end gap-2">
          {perDay.map((secs, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[10px] text-muted tabular-nums">{secs ? fmtDuration(secs) : ''}</span>
              <div className="w-full rounded-lg bg-[#eef0f4]" style={{ height: 140 }}>
                <div className="w-full rounded-lg bg-gradient-to-t from-[#3e63f2] to-[#7c8cff]" style={{ height: `${(secs / maxDay) * 100}%`, marginTop: `${140 - (secs / maxDay) * 140}px` }} />
              </div>
              <span className="text-[11px] font-bold text-muted">{DAY_SHORT[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Plano × feito por área, e tópicos concluídos por matéria. */
function WeekGoals({ weekId }: { weekId: string }) {
  const blocks = useWeekBlocks(weekId)
  const subjects = useSubjectMap()
  const topics = useTopics()
  const study = blocks.filter((b) => b.kind === 'study')
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-[18px] border border-line p-5">
        <h3 className="mb-4 flex items-center gap-2 font-sans text-sm font-semibold">
          <Target size={18} /> Plano da semana por área
        </h3>
        <div className="space-y-5">
          {AREAS.map((a) => {
            const list = study.filter((b) => b.subjectId && subjects.get(b.subjectId)?.areaId === a.id)
            const planned = list.reduce((acc, b) => acc + b.end - b.start, 0)
            const done = list.filter((b) => b.done).reduce((acc, b) => acc + b.end - b.start, 0)
            return (
              <div key={a.id}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-semibold">{a.name}</span>
                  <span className="text-muted tabular-nums">
                    {fmtDuration(done * 60)} / {fmtDuration(planned * 60)}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full" style={{ background: tint(AREA_COLOR[a.id], 0.12) }}>
                  <div className="h-full rounded-full" style={{ width: `${planned ? (done / planned) * 100 : 0}%`, background: AREA_COLOR[a.id] }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="rounded-[18px] border border-line p-5">
        <h3 className="mb-4 flex items-center gap-2 font-sans text-sm font-semibold">
          <Trophy size={18} /> Tópicos concluídos
        </h3>
        <div className="space-y-2">
          {[...subjects.values()].map((s) => {
            const ts = topics.filter((t) => t.subjectId === s.id)
            const d = ts.filter((t) => t.done).length
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-50">
                <SubjectIcon subject={s} size={30} />
                <span className="flex-1 truncate text-sm font-semibold">{s.name}</span>
                <span className="text-sm text-muted tabular-nums">
                  {d}/{ts.length}
                </span>
                <ChevronRight size={14} className="text-slate-300" />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
